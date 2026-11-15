# Resultado C17A — Inventario y freeze de automatización DEV

Fecha: 2026-09-29. Entorno: `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). Inventario de lectura de n8n MCP y contratos backend
C13–C16; no se ejecutaron workflows, Gateway, envíos, fixtures ni cambios.

## Inventario real de workflows

| Workflow | ID | Estado | Nodos | Responsabilidad | Trigger / programación | Error Handler |
| --- | --- | --- | ---: | --- | --- | --- |
| SolicitudPro DEV - Email Worker C13A | `PUBLIC_LEGACY_EMAIL_WORKER_C13A_WORKFLOW_ID` | Inactivo; no disponible en MCP | — | Histórico de correo C13A | Sin triggers | No aplicable |
| SolicitudPro DEV - Email Worker C13B | `PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID` | Activo/publicado | 27 | Claim, render C16, envío Resend, retry y estado de `email_jobs` | Webhook POST `solicitudpro-dev-email-worker-wake` + Schedule horario fallback | `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID` |
| SolicitudPro DEV - Request Enrichment | `PUBLIC_SOLICITUDPRO_DEV_REQUEST_ENRICHMENT_WORKFLOW_ID` | Activo/publicado | 15 | Claim, enriquecimiento estructurado, complete/retry/fail | Webhook POST `solicitudpro-dev-request-enrichment-wake` + cada hora `:17`, `Europe/Madrid` | `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID` |
| SolicitudPro DEV - Follow-up Basic C15A | `PUBLIC_SOLICITUDPRO_DEV_FOLLOW_UP_BASIC_C15A_WORKFLOW_ID` | Activo/publicado | 2 | Milestones C15A/C15B y recomendación interna contextual | Cada hora `:37`, `Europe/Madrid` | `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID` |
| SolicitudPro DEV - Error Handler | `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID` | Activo/publicado | 6 | Sanea, registra, deduplica 15 min y notifica errores | Error Trigger; no schedule/webhook | Handler compartido |
| SolicitudPro DEV - Ops Maintenance | `PUBLIC_SOLICITUDPRO_DEV_OPS_MAINTENANCE_WORKFLOW_ID` | Activo/publicado | 3 | Retención de alertas >30 días | Diario `03:10`, `Europe/Madrid` | No configurado |

El fallback horario C13B no declara zona propia y depende de la zona por defecto
de n8n. Los demás schedules relevantes fijan `Europe/Madrid`.

## Mapa integrado C13–C16

```text
Formulario público
  -> receive-public-form
  -> submit_public_form_submission_with_enrichment_wake
  -> requests + contacts + request_custom_answers + dos email_jobs
  |    -> wake C13B -> email-job-worker / claim_email_jobs
  |       -> render C16 -> Resend -> sent / failed
  |
  -> wake C14A -> request-enrichment-worker / claim_request_enrichments
      -> Gateway + parser -> complete_request_enrichment
      -> internal_summary + suggested_reply + activity

Tiempo/contexto -> C15A -> follow-up-basic-worker
  -> process_basic_follow_up_milestones -> request + activity interna

Errores C13B/C14A/C15A -> Error Handler -> Data Table -> Gmail
Diario 03:10 -> Ops Maintenance -> elimina alertas operativas >30 días
```

El render C16 no espera C14A: `get_email_job_context` expone opcionalmente
`internal_summary`; sin resumen usa la descripción. C15 solo genera activities
internas: no crea `email_jobs` ni invoca Resend.

## Recursos backend asociados

| Recurso | Función |
| --- | --- |
| `receive-public-form` | Entrada pública y wake en segundo plano de C13B/C14A. |
| `email-job-worker` | Bridge C13B: `claim`, `sent`, `failed` y render C16. |
| `request-enrichment-worker` | Bridge C14A: claim, complete y retry/fail. |
| `follow-up-basic-worker` | Bridge C15 para milestones. |
| `email_jobs` | Cola backend-only de los dos tipos C16. |
| `requests`, `activities`, `follow_ups`, `request_custom_answers` | Estado, historial, contexto manual y datos de solicitud. |
| `claim_email_jobs`, `get_email_job_context`, `resolve_email_job_sent`, `resolve_email_job_failed` | Contrato C13B/C16. |
| `claim_request_enrichments`, `complete_request_enrichment`, `fail_request_enrichment` | Contrato C14A. |
| `process_basic_follow_up_milestones` | Contrato transaccional C15A/C15B. |

## Credenciales y secretos por nombre/tipo

| Nombre visible | Tipo | Uso |
| --- | --- | --- |
| `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_01` | `httpHeaderAuth` | C13B -> `email-job-worker`. |
| `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_02` | `httpHeaderAuth` | C13B -> Resend. |
| `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_03` | `httpHeaderAuth` | Protege wake C13B. |
| `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_06` | `httpHeaderAuth` | Protege wake C14A. |
| `REPLACE_WITH_HTTPBEARERAUTH_CREDENTIAL_NAME_07` | `httpBearerAuth` | C14A -> worker backend. |
| `REPLACE_WITH_HTTPCUSTOMAUTH_CREDENTIAL_NAME_05` | `httpCustomAuth` | C15A -> worker backend. |
| `REPLACE_WITH_GMAILOAUTH2_CREDENTIAL_NAME_04` | `gmailOAuth2` | Notificación del Error Handler. |
| `N8N_EMAIL_WAKE_*`, `N8N_REQUEST_ENRICHMENT_WAKE_*`, `EMAIL_WORKER_SECRET`, `REQUEST_ENRICHMENT_WORKER_SECRET` | Variables/secretos DEV | Wakes y bridges backend. |

El modelo C14A usa Gateway administrado de n8n; no se inventarían ni muestran
valores de credenciales.

## Legacy, hallazgos y freeze

- **Candidato C17C:** C13A está inactivo, sin triggers y no disponible en MCP.
  No se elimina sin comprobar retención y referencias externas/documentales.
- **CORREGIR EN C17C:** decidir timezone explícita para el Schedule fallback de
  C13B. No bloquea C17B porque consume cola y no aplica reglas temporales.
- **CORREGIR EN C17C:** decidir routing de fallos de Ops Maintenance al Error
  Handler; no declara `settings.errorWorkflow`. No bloquea C17B.
- **NINGUNO:** no hay responsabilidades activas duplicadas, ciclos, conflictos
  entre los schedules `:17`/`:37`, ni ausencia de Error Handler en C13B/C14A/C15.

**ARQUITECTURA CONGELADA PARA C17.** No nuevas features, workflows, proveedores,
integraciones ni secretos; solo bugs reales, hardening, limpieza segura, E2E,
documentación y portabilidad.

## Inputs exactos para C17B

1. Usar los workflows, Edge Functions y contratos inventariados arriba.
2. No revalidar C13–C16 ni crear comunicaciones nuevas.
3. Usar fixtures DEV y limpiarlas; mantener dos `email_jobs` por request.
4. C14A no bloquea C16 y C15 no envía email.
5. C13A y los dos puntos C17C son revisiones posteriores, no cambios previos a E2E.
