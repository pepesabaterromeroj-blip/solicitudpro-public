# C11B — Generación automática de email jobs en Supabase DEV

Estado: aplicado y validado únicamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). **C11B finalizada.**

## Integración elegida

Se actualiza exclusivamente la RPC protegida de ocho argumentos
`public.submit_public_form_submission`. La Edge Function
`receive-public-form` ya invoca esa operación con el rol de backend, por lo que
no se modifica.

La RPC conserva su transacción e idempotencia de C2. Después de que la creación
existente devuelve una referencia y se obtiene el `request_id` persistido, inserta
en `public.email_jobs` los dos tipos previstos:

- `customer_confirmation`
- `business_notification`

La inserción usa `ON CONFLICT (request_id, email_type) DO NOTHING` y después
comprueba que existen exactamente los dos jobs para esa solicitud y negocio. La
clave única de C11A sigue siendo la protección persistente frente a duplicados.

## Consistencia e idempotencia

La creación de solicitud, jobs y finalización de la clave de idempotencia ocurre
en la misma transacción de PostgreSQL. Si no se obtiene una solicitud persistida
o no quedan exactamente dos jobs, la RPC lanza un error controlado y la
transacción completa se revierte: no persiste una solicitud parcial ni jobs
huérfanos.

En un reintento con la misma clave y el mismo payload, la rama idempotente devuelve
la solicitud ya completada antes de intentar crear otra solicitud o más jobs. No
se generan jobs retroactivamente para solicitudes históricas anteriores a C11B.

## Destinatarios y datos

No se guardan destinatarios, cuerpos, plantillas, credenciales ni secretos en
`email_jobs`. La comprobación de DEV confirmó que los negocios publicados usados
por el flujo tienen `businesses.contact_email` no vacío. La creación pública ya
valida y conserva el email del cliente en `contacts.email` cuando se proporciona.

En C13, el ejecutor backend resolverá el destinatario del cliente desde
`contacts.email` y el aviso interno desde `businesses.contact_email`, junto con
los datos actuales de solicitud y negocio. No hay direcciones hardcodeadas.

## Seguridad

No se cambia RLS, grants ni policies de `email_jobs`: permanece backend-only,
sin acceso de `anon` ni de `authenticated`. La RPC sigue siendo `SECURITY
INVOKER` y su ejecución continúa revocada para `public`, `anon` y
`authenticated`, y concedida al rol backend existente. La Edge Function conserva
sus credenciales exclusivamente en variables de entorno de servidor.

No hay n8n, SMTP, proveedor, webhook, trigger, UI ni envío de email.

## Archivos modificados

- `supabase/migrations/20260910092630_c11b_email_jobs_from_public_form.sql`
- `tests/c11b-email-jobs.test.js`
- `docs/proyecto/sql/README_SQL.md`
- Este documento.

No se modificó `supabase/functions/receive-public-form/index.ts` ni ninguna
funcionalidad de C10 o C11A.

## Pruebas reales en DEV

Todas las pruebas de datos se realizaron con payloads y contactos ficticios en
una transacción con `ROLLBACK`:

- Una solicitud válida nueva de Reformas creó exactamente los dos tipos de job,
  asociados al mismo `request_id` y `business_id`.
- El reintento con la misma clave de idempotencia devolvió la misma solicitud y
  mantuvo exactamente dos jobs.
- Una solicitud válida de Electricidad creó sus dos jobs bajo su propio negocio;
  no se observó mezcla multi-tenant.
- Una petición con un valor de campo no permitido falló y no dejó solicitud ni
  job adicional.
- Tras `ROLLBACK`, `email_jobs` quedó con `0` filas técnicas persistidas.

Comprobaciones finales:

- `node --test tests/*.js`: **82 pruebas correctas, 0 fallos**; incluye C10A,
  C10B, C10C y C11A sin regresiones.
- `node --check tests/c11b-email-jobs.test.js`: sin errores.
- `git diff --check`: sin errores.
- Catálogo DEV: la función contiene la inserción de jobs, el conflicto
  idempotente y la comprobación de dos jobs; `email_jobs` conserva RLS y no
  concede inserción al frontend.
- El asesor de seguridad conserva el aviso informativo de RLS sin policies en
  `email_jobs`, intencional por ser backend-only, y un aviso de Auth previo fuera
  del alcance de C11B. El asesor de rendimiento no incorpora una incidencia nueva
  atribuible a esta fase.

## Limitaciones y siguiente paso

C11B no envía mensajes, no prepara plantillas finales, no añade jobs históricos,
no muestra estados en UI y no conecta n8n. C11C podrá decidir la composición de
los mensajes; C13 deberá reclamar de forma atómica los jobs `pending` y resolver
los destinatarios en backend antes de enviar mediante el proveedor que se defina.
