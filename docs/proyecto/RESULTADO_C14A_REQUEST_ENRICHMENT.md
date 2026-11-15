# Resultado C14A — Request Enrichment

Fecha: 2026-09-29. Entorno: DEV exclusivamente.

## Estado

C14A queda implementada y operativa en DEV. Es independiente de C13B, no
envía el borrador y no modifica producción ni landing.

## Arquitectura

`receive-public-form` crea la solicitud mediante un wrapper backend compatible,
lanza un wake C14A best-effort con `EdgeRuntime.waitUntil()` y conserva el wake
de C13B. El workflow `SolicitudPro DEV - Request Enrichment`
(`PUBLIC_SOLICITUDPRO_DEV_REQUEST_ENRICHMENT_WORKFLOW_ID`) reclama trabajo, genera una salida estructurada, la valida
y completa el enrichment. Un Schedule Trigger horario, minuto 17, cubre wakes
perdidos, retries y leases recuperables.

## Migración y estados

La migración `20260927190015_c14a_request_enrichment.sql` añade a `requests`
estado, token y fecha de claim, fecha de enrichment, contador de intentos y
próximo intento. Los dos últimos campos son necesarios para backoff y máximo
de cinco intentos. El histórico permanece `legacy`; las nuevas solicitudes de
formulario nacen `pending` con `internal_summary` y `suggested_reply` a `NULL`.

Estados: `legacy`, `pending`, `processing`, `completed` y `failed`.

## Claim, bridge e idempotencia

El bridge `request-enrichment-worker` acepta únicamente `claim`, `complete` y
`failed`, con autenticación Bearer dedicada. Las RPC usan `FOR UPDATE SKIP
LOCKED`, claim token, lease de 900 segundos, aislamiento por `business_id` y
máximo de cinco intentos. Un claim vencido se recupera; completar o fallar
exige tenant, request, token y lease vigentes.

La activity `request_enrichment_generated` tiene índice único parcial por
solicitud y texto visible «Resumen y respuesta sugerida generados
automáticamente.». No guarda prompt, salida bruta ni detalles técnicos.

## Wake y secretos

El wake transmite exclusivamente `{ "request_id": "..." }` mediante una
cabecera dedicada. Existen dos credenciales persistentes separadas en n8n y
dos secretos separados en Supabase DEV; sus valores no se guardan ni se
documentan. La URL del webhook también está configurada como variable segura.

## Gateway y generación

Se usan créditos del Gateway administrado, sin BYOK, auto-top-up ni método de
pago. El adaptador compatible es Basic LLM Chain + OpenAI Chat Model +
Structured Output Parser. Modelo: `gpt-5-mini`, razonamiento bajo, máximo 1000
tokens, una inferencia por solicitud y parser sin autocorrección ni segunda
llamada. El proveedor queda encapsulado en el nodo de modelo.

El contexto del modelo contiene solo sector, servicio, descripción, zona/plazo
útiles y respuestas personalizadas filtradas. Nombre, email, teléfono, IDs,
secretos y cabeceras no se incluyen. Todo texto del cliente se declara input
no confiable.

## Validación, retry y errores

Se exige objeto JSON con `internal_summary` y `suggested_reply`, límites de
longitud, normalización y rechazo de HTML, scripts, secretos, prompts y texto
técnico. Un resultado inválido no se completa. Solo timeout, red, 429 y 5xx
entran en backoff 2/10/30/60 minutos; el resto termina `failed`. El Error
Handler compartido recibe únicamente el error saneado.

## Evidencia DEV

- Solicitud única `REF-009`: `pending`, wake aceptado 202 y claim confirmado.
- Ejecución final controlada `173`: un nodo de modelo, un parser, validación y
  complete; estado `completed`, intento 1 y `enriched_at` informado.
- Resumen de 280 caracteres y borrador de 911, ambos sin HTML.
- Una sola activity de enrichment. Replay `174`: claim sin trabajos y ningún
  nodo Gateway ejecutado.
- C13B terminó de forma independiente con dos jobs (`business_notification` y
  `customer_confirmation`) en `sent`. El borrador no originó ningún email.
- Los 34 registros históricos siguen en `legacy`.

La validación final usó la solicitud pública `REF-010` (request
`dd1f33ec-47cb-46ab-8d97-7097fa682c76`). El wake real inició automáticamente
la ejecución n8n `205` en modo `webhook`; claim devolvió intento 1, el Gateway
ejecutó una sola inferencia `gpt-5-mini`, el parser produjo JSON válido y
complete persistió ambos textos, `completed` y `enriched_at` a las
`2026-09-29T06:48:49.497753Z`. Existe exactamente una activity
`request_enrichment_generated` y no hubo ejecución manual, schedule, retry ni
segunda inferencia. C13B se ejecutó aparte como `204`; sus dos emails salieron
antes del enrichment y fueron exclusivamente `customer_confirmation` y
`business_notification`, por lo que `suggested_reply` no se envió. Con esta
evidencia, el recorrido wake→complete autónomo queda verificado y **C14A queda
CERRADA EN DEV**.

## Seguridad y límites

Las funciones de datos son backend-only, con privilegios explícitos para
`service_role` y `search_path` seguro. El frontend no recibe `service_role`.
No se modificaron C13A, producción, landing ni el comportamiento de C13B.

No se implementan C15A, C15B, C16, C17 ni cambios de panel/UX.
