# Manifiesto de portabilidad n8n — C17D

Fecha: 2026-09-30. Origen: n8n DEV. Este directorio contiene los cinco
workflows activos recuperados en formato JSON nativo mediante n8n MCP. No
contiene ejecuciones ni valores de credenciales. C13A
(`PUBLIC_LEGACY_EMAIL_WORKER_C13A_WORKFLOW_ID`) está excluido expresamente.

Los exports conservan nombres, grafos, nodos, conexiones, settings, triggers,
paths, schedules, timezone y referencias de credenciales por nombre/tipo. Los
IDs de credenciales, workflows, Data Tables y otros recursos se publican como
placeholders: deben reasignarse en el destino.

## Inventario y hashes SHA-256

| Archivo | Workflow / ID DEV original | Activo esperado | Nodos | SHA-256 |
| --- | --- | --- | ---: | --- |
| `email-worker-c13b.json` | SolicitudPro DEV - Email Worker C13B / `PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID` | Sí, después de configurar | 27 | `4df0439eae13290c37d9d34c0f3942de1d8a396c4e17dcddc02fb70c70bc44c7` |
| `request-enrichment-c14a.json` | SolicitudPro DEV - Request Enrichment / `PUBLIC_SOLICITUDPRO_DEV_REQUEST_ENRICHMENT_WORKFLOW_ID` | Sí, después de configurar | 15 | `34a64944e6dbb956c53d613291777d26c30c1cd2d5d6351871644ccf70bc498e` |
| `follow-up-c15.json` | SolicitudPro DEV - Follow-up Basic C15A / `PUBLIC_SOLICITUDPRO_DEV_FOLLOW_UP_BASIC_C15A_WORKFLOW_ID` | Sí, después de configurar | 2 | `6b1e2ae2a50529cf21ec94a09ff8e2ca2f3cbe4bfcc71c06d388c7cacfa0c78f` |
| `error-handler.json` | SolicitudPro DEV - Error Handler / `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID` | Sí, primero | 6 | `719132bf2e434f863d3eac3c8bafbd5efb83abc289864d4b91c2251cac242232` |
| `ops-maintenance.json` | SolicitudPro DEV - Ops Maintenance / `PUBLIC_SOLICITUDPRO_DEV_OPS_MAINTENANCE_WORKFLOW_ID` | Sí, al final | 3 | `e674bbc9b06c46cbd59e9535d67412853b3fc4de5a356b12cf06213d50c232a8` |

Si cambia cualquier JSON, hay que recalcular y sustituir su hash antes de usar
este manifiesto.

## Email Worker C13B

- Responsabilidad: reclamar `email_jobs`, renderizar/enviar por Resend y
  resolver éxito, retry o fallo terminal.
- Triggers: webhook POST y fallback horario.
- Webhook path: `solicitudpro-dev-email-worker-wake`.
- Schedule/timezone: cada hora; `Europe/Madrid`.
- Error Handler: reasignar al nuevo ID del Error Handler importado.
- Backend: Edge Functions `receive-public-form` (wake) y `email-job-worker`;
  RPC `claim_email_jobs`, `get_email_job_context`,
  `resolve_email_job_sent`, `resolve_email_job_failed`; tablas `email_jobs`,
  `requests`, `contacts` y `request_custom_answers`.
- N8N CREDENTIAL: `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_01` (`httpHeaderAuth`, worker),
  `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_02` (`httpHeaderAuth`, Resend) y
  `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_03` (`httpHeaderAuth`, webhook wake).
- SUPABASE SECRET/CONFIG: `EMAIL_WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `N8N_EMAIL_WAKE_SECRET` y `N8N_EMAIL_WAKE_URL`.
- Efectos externos: llamadas al backend Supabase y envío de dos tipos de email
  mediante Resend.
- Activación: segundo, después del Error Handler y de completar backend,
  secretos, credenciales y URL wake.

## Request Enrichment C14A

- Responsabilidad: reclamar solicitudes, generar enrichment estructurado y
  completar o registrar retry/fallo.
- Triggers: webhook POST, fallback horario y trigger manual conservado.
- Webhook path: `solicitudpro-dev-request-enrichment-wake`.
- Schedule/timezone: cada hora, minuto 17; `Europe/Madrid`.
- Error Handler: reasignar al nuevo ID del Error Handler importado.
- Backend: Edge Functions `receive-public-form` (wake) y
  `request-enrichment-worker`; RPC `claim_request_enrichments`,
  `complete_request_enrichment`, `fail_request_enrichment`; tablas
  `requests`, `activities` y `request_custom_answers`.
- N8N CREDENTIAL: `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_06` (`httpHeaderAuth`) y
  `REPLACE_WITH_HTTPBEARERAUTH_CREDENTIAL_NAME_07` (`httpBearerAuth`).
- SUPABASE SECRET/CONFIG: `REQUEST_ENRICHMENT_WORKER_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`, `N8N_REQUEST_ENRICHMENT_WAKE_SECRET` y
  `N8N_REQUEST_ENRICHMENT_WAKE_URL`.
- Gateway: el nodo conserva `gpt-5-mini`, razonamiento bajo, 1000 tokens,
  timeout de 60 s y 0 retries. Los créditos/autorización administrados no
  viajan: habilitar un Gateway compatible y volver a seleccionar el modelo.
- Efectos externos: una inferencia Gateway por trabajo reclamado y escritura
  del resultado validado en Supabase.
- Activación: tercero, una vez configurados Gateway, backend, credenciales,
  secretos y URL wake.

## Follow-up C15A/C15B

- Responsabilidad: procesar hitos de seguimiento y recomendación contextual.
- Trigger: Schedule Trigger.
- Webhook path: no aplica.
- Schedule/timezone: cada hora, minuto 37; `Europe/Madrid`.
- Error Handler: reasignar al nuevo ID del Error Handler importado.
- Backend: Edge Function `follow-up-basic-worker`; RPC
  `process_basic_follow_up_milestones`; tablas `requests`, `follow_ups` y
  `activities`.
- N8N CREDENTIAL: `REPLACE_WITH_HTTPCUSTOMAUTH_CREDENTIAL_NAME_05` (`httpCustomAuth`).
- SUPABASE SECRET/CONFIG: `C15A_WORKER_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL`.
- Efectos externos: actualización transaccional de seguimientos/activities;
  no envía emails.
- Activación: cuarto, después del backend y de reasignar credencial y Error
  Handler.

## Error Handler

- Responsabilidad: sanear, deduplicar 15 minutos, registrar y notificar fallos.
- Trigger: Error Trigger.
- Webhook/schedule: no aplica. Timezone: no aplica.
- Error Handler: vacío intencionadamente; no debe autorreferenciarse.
- Recurso n8n: Data Table `SolicitudPro DEV - Alertas operativas`, placeholder
  `REPLACE_WITH_DATA_TABLE_ID`. No viaja con el workflow. Recrear con columnas
  `workflow` (string), `execution_id` (string), `node` (string), `timestamp`
  (date) y `message` (string), y reasignar los nodos Data Table.
- N8N CREDENTIAL: `REPLACE_WITH_GMAILOAUTH2_CREDENTIAL_NAME_04` (`gmailOAuth2`); requiere OAuth nuevo.
- SUPABASE SECRET/CONFIG: ninguno.
- Efectos externos: inserción en Data Table n8n y correo operativo por Gmail.
- Activación: primero, después de recrear/reasignar Data Table y Gmail.

## Ops Maintenance

- Responsabilidad: eliminar alertas operativas con más de 30 días.
- Trigger: Schedule Trigger.
- Webhook path: no aplica.
- Schedule/timezone: diario a las 03:10; `Europe/Madrid`.
- Error Handler: reasignar al nuevo ID del Error Handler importado.
- Recurso n8n: misma Data Table `SolicitudPro DEV - Alertas operativas`; el ID
  origen no es portable y debe reasignarse.
- Credenciales/secrets: ninguno adicional.
- Efectos externos: lectura y borrado de filas caducadas en Data Table n8n.
- Activación: quinto y último.

## Dependencias por dominio

### Git

- `supabase/migrations/`: esquema y RPC versionadas.
- `supabase/functions/`: Edge Functions y contratos versionados.
- `supabase/config.toml`: configuración declarativa de funciones/storage.
- `tests/` y `docs/proyecto/`: pruebas y documentación de operación.

### Supabase runtime

- Proyecto, base de datos migrada, Edge Functions desplegadas y variables
  runtime configuradas.
- `PUBLIC_FORM_ALLOWED_ORIGINS` debe ajustarse a los orígenes reales del
  entorno destino.

### n8n

- Los cinco workflows, la Data Table operativa, timezone/schedules, Gateway y
  las asociaciones entre workflows/recursos.

### Secrets/credentials

- No están incluidos. Deben recrearse y enlazarse por nombre/tipo según este
  manifiesto. Las credenciales genéricas `HTTP_HEADER_AUTH_UNUSED_2`,
  `HTTP_HEADER_AUTH_UNUSED_3`, `HTTP_HEADER_AUTH_UNUSED_6` y
  `HTTP_HEADER_AUTH_UNUSED_7` no son requisitos del paquete.

## URLs y referencias no portables

- Los paths de webhook viajan y son estables.
- Las URLs completas dependen del host n8n destino. Actualizar en Supabase
  `N8N_EMAIL_WAKE_URL` y `N8N_REQUEST_ENRICHMENT_WAKE_URL`.
- Las URLs de Edge Functions usan `YOUR_PROJECT.supabase.co`; sustituir el
  placeholder y revisar todas antes de activar.
- Reasignar credenciales, Data Table y `settings.errorWorkflow`; ningún
  placeholder publicado identifica recursos de la instancia de origen.
