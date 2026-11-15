# Resultado PRE-C13B — Worker seguro de `email_jobs` en DEV

Fecha de validación: 16 de septiembre de 2026  
Proyecto autorizado: `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)

## Resumen

PRE-C13B incorpora un puente backend específico entre el futuro workflow de n8n y `public.email_jobs`. n8n no necesita acceso general a Supabase ni recibe la credencial `service_role`: invocará una Edge Function limitada, autenticada con un secreto exclusivo del worker, y esta ejecutará tres RPC backend-only.

No se ha conectado n8n, no se ha elegido proveedor y no se ha enviado ningún email.

## Arquitectura final

```text
n8n (C13)
  -> HTTPS + secreto exclusivo del worker
  -> Edge Function email-job-worker
  -> RPC backend-only
  -> public.email_jobs + get_email_job_context(uuid)
```

La migración versionada es:

- `supabase/migrations/20260916111556_pre_c13b_email_job_worker.sql`

Añade únicamente a `email_jobs`:

- `claim_token uuid`: identifica de forma opaca el claim vigente.
- `lease_expires_at timestamptz`: fija cuándo otro worker puede recuperar el job.

Se reutilizan `available_at`, `attempt_count`, `processing_started_at`, `sent_at`, `last_error`, `status` y `updated_at`.

## RPC backend-only

Las tres funciones son `SECURITY INVOKER`, usan `search_path` vacío y revocan `EXECUTE` a `PUBLIC`, `anon` y `authenticated`. Solo `service_role`, utilizada dentro de Supabase, tiene ejecución.

### `claim_email_jobs(p_limit, p_lease_seconds)`

- Acepta de 1 a 10 jobs y leases de 30 a 3600 segundos.
- Reclama jobs `pending` cuyo `available_at` ya haya llegado.
- Recupera jobs `processing` cuyo lease haya expirado.
- Usa `FOR UPDATE SKIP LOCKED`, por lo que dos workers concurrentes no reciben el mismo claim vigente.
- Pasa a `processing`, incrementa `attempt_count`, genera un token nuevo y fija el lease.
- Devuelve solo los jobs reclamados con `job_id`, tipo, intento, lease, token, `delivery_id` y el contexto normalizado de C11C.
- `delivery_id` es el propio `email_job.id`, estable para una futura clave de idempotencia del proveedor.

### `resolve_email_job_sent(p_job_id, p_claim_token)`

Solo permite `processing -> sent` cuando coinciden job, token vigente y lease activo. Registra `sent_at`, limpia el error y elimina token y lease. Un token incorrecto, caducado o sustituido modifica cero filas.

### `resolve_email_job_failed(p_job_id, p_claim_token, p_error, p_retry_at)`

- Sin `retry_at`: `processing -> failed`, terminal.
- Con `retry_at` futuro: `processing -> pending` y `available_at = retry_at`.
- Conserva un error saneado de hasta 500 caracteres.
- En ambos casos exige claim vigente y limpia token y lease.
- No existe un estado adicional `retrying`; backoff, máximo de intentos y clasificación de fallos pertenecen a C13.

## Contrato HTTP

Base: `/functions/v1/email-job-worker`

Todas las operaciones usan `POST`, `Content-Type: application/json` y `Authorization: Bearer <secreto-del-worker>`.

### `POST /claim`

Entrada opcional:

```json
{ "limit": 1, "lease_seconds": 300 }
```

Respuesta `200`:

```json
{
  "jobs": [
    {
      "job_id": "uuid",
      "email_type": "customer_confirmation | business_notification",
      "attempt_count": 1,
      "lease_expires_at": "ISO-8601",
      "claim_token": "uuid",
      "delivery_id": "uuid",
      "context": {
        "job": {},
        "recipient_email": "dirección derivada por C11C",
        "business": {},
        "customer": {},
        "request": {},
        "answers": []
      }
    }
  ]
}
```

### `POST /sent`

```json
{ "job_id": "uuid", "claim_token": "uuid" }
```

Devuelve `200` con el job resuelto o `409` si el claim ya no es válido.

### `POST /failed`

Fallo terminal:

```json
{ "job_id": "uuid", "claim_token": "uuid", "error": "mensaje saneado" }
```

Reintento programado:

```json
{
  "job_id": "uuid",
  "claim_token": "uuid",
  "error": "mensaje saneado",
  "retry_at": "ISO-8601 futuro"
}
```

La función rechaza operaciones, métodos, campos, UUID, límites, leases y fechas inválidos. Los errores internos se convierten en respuestas genéricas y no exponen detalles de PostgreSQL ni credenciales.

## Autenticación y secretos

La Edge Function valida un secreto específico antes de leer el payload o ejecutar una RPC. Ese valor se gestiona en los secretos de Supabase y, en C13, en las credenciales protegidas de n8n. No se versiona, no se entrega al frontend y no se registra.

`SUPABASE_SERVICE_ROLE_KEY` permanece exclusivamente dentro del entorno gestionado de la Edge Function. `verify_jwt = false` es intencionado: el endpoint no acepta JWT de usuarios; aplica su autenticación de servicio propia.

`EMAIL_WORKER_SECRET` quedó configurado exclusivamente en los secretos de Edge Functions de DEV. Durante la configuración se realizó una rotación preventiva antes de usarlo; solo el valor rotado quedó vigente. Su huella en Supabase se comprobó sin copiar ni documentar el valor. El secreto y los tokens usados por las pruebas se eliminaron de la memoria efímera al terminar.

No fue necesario volver a desplegar código: la Edge Function reconoció el secreto actualizado. Después de la configuración y rotación, Supabase la muestra activa como versión 3, con el mismo contenido desplegado.

## Concurrencia, lease y recuperación

En la prueba real SQL de DEV, dos invocaciones concurrentes con límite 1 reclamaron dos jobs distintos. Al expirar artificialmente un lease de prueba, el mismo job fue reclamado con un token nuevo y `attempt_count = 2`. El token anterior no pudo marcarlo como enviado, fallido ni reprogramarlo; solo el token nuevo resolvió el job.

El lease evita procesamiento simultáneo válido dentro de la cola, pero no garantiza exactamente-once frente a un proveedor externo. Si el proveedor acepta un email y la respuesta se pierde antes de `sent`, el job podría reintentarse. C13 deberá enviar `email_job.id` como clave estable de entrega cuando el proveedor elegido soporte idempotencia.

## Validación DEV realizada

- Migración aplicada en DEV con versión remota `20260916111556`.
- Edge Function `email-job-worker` desplegada y activa, versión 3; código remoto comprobado contra la implementación local.
- HTTP sin credencial: `401`.
- HTTP con credencial incorrecta: `401`.
- HTTP con la credencial específica del worker: `200` y claim correcto.
- Payload fuera de límites: `400` sin ejecutar un claim válido.
- Resolución `sent`: `200` y estado `sent`.
- Fallo terminal: `200` y estado `failed`.
- Retry programado: `200`, vuelta a `pending`, claim posterior con `attempt_count = 2` y resolución terminal correcta.
- Token anterior tras recuperar un lease: `409` tanto para `sent` como para `failed`.
- Claims concurrentes: dos workers obtuvieron jobs y tokens distintos.
- Contexto C11C incluido y destinatario correcto para ambos tipos.
- `sent`, fallo terminal y reintento con `available_at` futuro verificados.
- `retry_at` pasado rechazado con error controlado.
- Recuperación por lease y bloqueo de token antiguo verificados.
- `anon` y `authenticated` recibieron denegación de ejecución de la RPC.
- Fixtures ficticios eliminados; quedaron cero contactos, solicitudes o jobs PRE-C13B, cero jobs `processing` y los 8 jobs DEV previos continuaron `pending`.
- Advisories: los avisos de RLS sin policy sobre colas backend-only son intencionados; el índice nuevo figura todavía como no usado por ser recién creado.

## Reconstrucción limpia y regresión

La reconstrucción aislada aplicó desde cero las 14 migraciones y verificó:

- 17 tablas con RLS.
- 7 firmas de funciones de aplicación, incluidas las tres PRE-C13B.
- 129 constraints, 69 índices y 34 policies.
- bucket privado de adjuntos, 10 MiB y 6 MIME.
- 4 checks legacy `NOT VALID` conservados.
- seed de 6 sectores, 6 negocios, 6 formularios y 12 campos.
- ciclo worker final con 2 jobs `sent` y 2 `failed`.

La suite completa pasó con **122/122 tests**. C11A/B/C, formularios públicos y C12 permanecen cubiertos sin regresiones. No se modificaron UI, Storage, envío, n8n ni proveedor.

## Pendiente exacto para C13

C13 debe:

1. Guardar el mismo secreto como credencial protegida de n8n, sin entregar `service_role`.
2. Ejecutar `/claim` de forma programada.
3. Construir el contenido con `context` y diferenciar por `email_type`.
4. Usar `delivery_id` como clave de idempotencia cuando el proveedor lo permita.
5. Decidir backoff, máximo de intentos y clasificación transient/permanent.
6. Llamar `/sent` o `/failed` con el token del claim vigente.

No existe garantía absoluta exactly-once hasta integrar un proveedor con una estrategia de idempotencia compatible.

## Estado final

- Claim atómico y concurrencia: OK.
- Lease, recuperación y token obsoleto: OK.
- `sent`, `failed` y `retry_at`: OK.
- Contexto C11C: OK.
- Edge Function autenticada con secreto propio: OK.
- `service_role` fuera de n8n y frontend: OK.
- RPC sin acceso `PUBLIC`, `anon` ni `authenticated`: OK.
- Reconstrucción limpia: OK.
- Validación HTTP real DEV: OK.
- Limpieza y cero jobs `processing`: OK.
- Suite completa: 122/122.

**PRE-C13B FINALIZADA — PUENTE SEGURO LISTO PARA N8N**
