# C11C — Contexto dinámico de emails preparado para n8n

Estado: aplicado y validado únicamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). **C11C finalizada.**

## Arquitectura elegida

La migración `supabase/migrations/20260910111207_c11c_email_job_context.sql`
crea la RPC de solo lectura:

```sql
public.get_email_job_context(p_email_job_id uuid) returns jsonb
```

La función reúne en PostgreSQL el job, negocio, cliente, solicitud y respuestas
dinámicas. Así, el futuro ejecutor no necesita reproducir joins, reglas de
destinatarios ni conocimiento específico de los sectores. La función es
`LANGUAGE sql`, `STABLE` y `SECURITY INVOKER`; no reclama jobs, no escribe datos,
no renderiza HTML y no realiza llamadas externas.

Un identificador válido devuelve un único objeto JSON. Un UUID inexistente
devuelve `null` sin revelar si existen otros trabajos.

## Contrato JSON exacto

```json
{
  "job": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email_type": "customer_confirmation",
    "status": "pending",
    "request_id": "00000000-0000-0000-0000-000000000002",
    "business_id": "00000000-0000-0000-0000-000000000003"
  },
  "recipient_email": "destinatario@example.test",
  "business": {
    "name": "Nombre comercial",
    "sector": "Nombre humano del sector",
    "contact_email": "negocio@example.test"
  },
  "customer": {
    "name": "Nombre del cliente",
    "email": "cliente@example.test",
    "phone": "+34900000000"
  },
  "request": {
    "reference": "REF-001",
    "created_at": "fecha ISO 8601",
    "service": "Servicio solicitado",
    "form_name": "Título humano del formulario",
    "description": "Descripción o resumen",
    "urgency": "Normal",
    "priority": 2
  },
  "answers": [
    { "label": "Etiqueta humana", "value": "Valor legible" }
  ]
}
```

Los UUID y textos anteriores son ficticios. Los campos opcionales
`recipient_email`, `customer.email`, `customer.phone`, `request.urgency` y
`request.priority` usan `null` cuando el dato no existe; no se inventan cadenas.

## Destinatarios

La RPC deriva `recipient_email` exclusivamente de relaciones persistidas:

- `customer_confirmation`: `contacts.email` del contacto asociado a la solicitud.
- `business_notification`: `businesses.contact_email` del negocio propietario.

No se guardan destinatarios en `email_jobs` ni se hardcodean direcciones. Si el
destinatario requerido es `null`, C13 no debe intentar el envío: debe registrar
un fallo operativo saneado conforme al ciclo de la cola.

## Respuestas dinámicas

Cada elemento expone únicamente `label` y `value`. La etiqueta usa
`request_custom_answers.label_snapshot`, que conserva el texto visto al enviar
el formulario, con `form_fields.label` como respaldo. El orden procede de
`form_fields.display_order`, con desempate estable por creación e identificador.

La normalización convierte:

- texto, opciones, números y fechas en texto legible;
- booleanos en `Sí` o `No`;
- listas en valores separados por coma y espacio.

No se devuelven `field_key`, slugs, tipo de campo, posición ni otros metadatos
técnicos. La RPC entrega todas las respuestas, necesarias para el aviso interno.

## Estructura prevista de los emails

### Confirmación al cliente

1. Saludo con `customer.name` cuando exista.
2. Confirmación de recepción por `business.name`.
3. Referencia y resumen desde `request`.
4. Resumen genérico de hasta cuatro respuestas no vacías, en el orden recibido.
5. Omitir del resumen cualquier respuesta cuyo valor repita literalmente
   `request.description`; esta regla depende del contenido, no del sector.
6. Cierre indicando que el negocio podrá revisar la solicitud y contactar, sin
   prometer plazos no definidos.

### Aviso interno al negocio

1. Referencia, fecha, servicio/formulario, urgencia y prioridad.
2. Nombre, email y teléfono del cliente.
3. Descripción de la solicitud.
4. Todas las entradas de `answers`, respetando su orden.

Ambas estructuras son genéricas. No existen ramas del tipo
`if sector === reformas` ni seis plantillas hardcodeadas.

## Funcionamiento multisector

El mismo contrato se validó con formularios publicados de Reformas,
Electricidad, Fontanería, Climatización, Cristalerías y Academias. En los seis
casos el contexto conservó el nombre humano del sector y formulario, las
etiquetas y el orden configurados, y las relaciones de negocio y solicitud.
Un sector futuro que use `form_configs`, `form_fields` y
`request_custom_answers` obtiene el mismo contrato sin cambiar la RPC.

## Seguridad y permisos

La ejecución se revoca explícitamente a `PUBLIC`, `anon` y `authenticated`, y se
concede al rol backend `service_role`. `email_jobs` mantiene RLS activa, sin
policies públicas y sin nuevos privilegios de tabla. La función es
`SECURITY INVOKER`, usa relaciones cualificadas con `public` y fija
`search_path` vacío.

No se modificaron RLS, Edge Functions, frontend, UI, producción ni la landing.
No se incorporaron claves, tokens, contraseñas o credenciales al repositorio.

## Interfaz esperada para C13

El flujo previsto, todavía no implementado, es:

1. Un componente backend reclama atómicamente jobs `pending` con
   `available_at <= now()`, usando el índice parcial existente y bloqueo apto
   para concurrencia.
2. En la misma operación cambia el job a `processing`, establece
   `processing_started_at`, incrementa `attempt_count` y actualiza `updated_at`.
3. Obtiene el payload mediante `get_email_job_context(job.id)`.
4. Usa `job.email_type` para elegir una de las dos estructuras genéricas y
   `recipient_email` como destinatario. Convierte `answers` en filas o una lista
   de etiqueta y valor sin interpretar campos sectoriales.
5. Tras una entrega confirmada marca `sent`, establece `sent_at`, limpia
   `last_error` y actualiza `updated_at`.
6. Ante error marca `failed`, conserva `sent_at` nulo y escribe en `last_error`
   un mensaje saneado. Un reintento posterior vuelve a `pending`, limpia
   `processing_started_at` y programa `available_at`.
7. No procesa de nuevo jobs `sent`. La identidad estable `email_jobs.id`, junto
   con la unicidad `(request_id, email_type)`, debe usarse también como clave de
   idempotencia ante el proveedor si este la admite.

La reclamación concurrente y las transiciones de estado pertenecen a C13; C11C
no añade una RPC de escritura.

### Decisión pendiente sobre credenciales de n8n

El permiso actual permite que un backend con `service_role` invoque la RPC, pero
no decide que n8n vaya a recibir esa credencial de amplio alcance. En C13 debe
elegirse la opción razonable de menor privilegio. Se evaluará preferentemente una
Edge Function o endpoint backend que mantenga `service_role` dentro de Supabase
y exponga a n8n solo operaciones autenticadas y acotadas de reclamar, leer y
resolver jobs. La alternativa de acceso directo requeriría una credencial o rol
dedicado con privilegios mínimos; no debe reutilizarse una clave pública ni
entregarse `service_role` sin esa evaluación.

## Pruebas realizadas

- Migración aplicada únicamente al proyecto DEV autorizado.
- Catálogo: función `STABLE`, `SECURITY INVOKER`, argumento UUID y retorno JSONB.
- Permisos: ejecución denegada realmente para `anon` y `authenticated`; acceso
  concedido a `service_role`.
- Prueba transaccional con datos ficticios de los seis sectores: dos tipos de
  job, destinatarios correctos, claves comunes, relaciones multi-tenant,
  etiquetas humanas y orden exacto. Finalizó con `ROLLBACK`.
- UUID inexistente: resultado `null`.
- Valores booleanos y multivalor: `Sí` y lista legible; prueba revertida.
- No quedaron contactos, solicitudes ni jobs técnicos de C11C.
- La suite local completa y las comprobaciones finales se ejecutaron sin
  introducir cambios funcionales en C10, C11A o C11B.

## Archivos y limitaciones

- `supabase/migrations/20260910111207_c11c_email_job_context.sql`
- `tests/c11c-email-job-context.test.js`
- `docs/proyecto/sql/README_SQL.md`
- Este documento.

C11C no reclama jobs, no cambia estados, no crea plantillas persistidas, no
envía emails, no conecta n8n ni proveedor y no añade estado de email al panel.
El renderizado final, proveedor, política de reintentos, recuperación de jobs
atascados y mecanismo de acceso de menor privilegio se decidirán en C13.
