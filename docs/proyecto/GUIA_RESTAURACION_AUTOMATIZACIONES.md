# Guía de restauración de automatizaciones

Esta guía reconstruye SolicitudPro en otra cuenta o instancia de n8n sin
consultar chats anteriores. Los exports y su inventario están en
`docs/proyecto/n8n-exports/`.

## Reglas de seguridad

- Trabajar primero en un entorno no productivo.
- Mantener todos los workflows importados inactivos hasta completar backend,
  secretos, credenciales, URLs, Data Table, Gateway y Error Handler.
- No copiar valores de secretos a JSON, Git, logs ni documentación.
- Verificar los SHA-256 contra `n8n-exports/MANIFEST.md` antes de importar.

## Orden de restauración

1. Preparar el proyecto Supabase destino y sus políticas de acceso.
2. Aplicar, en orden, las migraciones de `supabase/migrations/`.
3. Desplegar `receive-public-form`, `email-job-worker`,
   `request-enrichment-worker` y `follow-up-basic-worker` desde
   `supabase/functions/`.
4. Configurar en Supabase los secrets requeridos, sin documentar sus valores:
   `EMAIL_WORKER_SECRET`, `REQUEST_ENRICHMENT_WORKER_SECRET`,
   `C15A_WORKER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   `N8N_EMAIL_WAKE_SECRET` y `N8N_REQUEST_ENRICHMENT_WAKE_SECRET`.
5. Configurar el runtime: `SUPABASE_URL`, `PUBLIC_FORM_ALLOWED_ORIGINS` y,
   cuando existan los nuevos webhooks, `N8N_EMAIL_WAKE_URL` y
   `N8N_REQUEST_ENRICHMENT_WAKE_URL`.
6. Preparar n8n y confirmar compatibilidad de los tipos/versiones de nodo de
   los exports.
7. Crear las credenciales n8n con los nombres/tipos del manifiesto. Gmail
   necesita una autorización OAuth nueva; las credenciales Header/Bearer/
   Custom Auth necesitan valores nuevos o recuperados del gestor seguro.
8. Habilitar el Gateway administrado compatible con C14A, disponer de
   plan/créditos y seleccionar de nuevo `gpt-5-mini` en el nodo
   `C14A - Modelo Gateway`. Verificar razonamiento bajo, 1000 tokens, timeout
   60 s y 0 retries, sin ejecutar una inferencia todavía.
9. Recrear en n8n la Data Table `SolicitudPro DEV - Alertas operativas` con
   las columnas `workflow` (string), `execution_id` (string), `node` (string),
   `timestamp` (date) y `message` (string).
10. Importar `error-handler.json` y mantenerlo inactivo. Reasignar la Data
    Table y `REPLACE_WITH_GMAILOAUTH2_CREDENTIAL_NAME_04`; comprobar que su `settings.errorWorkflow` queda
    vacío.
11. Importar `email-worker-c13b.json`, `request-enrichment-c14a.json`,
    `follow-up-c15.json` y `ops-maintenance.json`, todos inactivos.
12. Reasignar cada credencial y la Data Table usando el manifiesto. No usar
    IDs de la instancia origen.
13. En C13B, C14A, C15 y Ops, seleccionar como `settings.errorWorkflow` el
    nuevo ID del Error Handler importado.
14. Si cambia Supabase, actualizar todas las URLs de Edge Functions en los
    nodos HTTP. Obtener las URLs completas nuevas de los webhooks C13B/C14A y
    guardarlas en Supabase como `N8N_EMAIL_WAKE_URL` y
    `N8N_REQUEST_ENRICHMENT_WAKE_URL`.
15. Revisar que C13B, C14A, C15 y Ops usan `Europe/Madrid`; confirmar schedules
    horario, `:17`, `:37` y diario `03:10`, respectivamente.
16. Ejecutar las comprobaciones estáticas y después activar siguiendo el orden
    seguro indicado abajo.

## Orden seguro de activación

No activar nada hasta que todas las dependencias anteriores estén listas.

1. Error Handler.
2. C13B Email Worker.
3. C14A Request Enrichment.
4. C15A/C15B Follow-up.
5. Ops Maintenance.

Antes de cada activación, comprobar credenciales/recurso asociado y Error
Handler. Ops va al final porque borra filas caducadas de la Data Table.

## Comprobación estática previa

- Los cinco JSON parsean y sus hashes coinciden.
- C13A no está presente.
- Cada workflow conserva nombre, nodos, conexiones, settings y triggers.
- Paths: `solicitudpro-dev-email-worker-wake` y
  `solicitudpro-dev-request-enrichment-wake`.
- Ningún ID de credencial, workflow o Data Table del origen se considera
  válido hasta reasignarlo.
- No hay tokens, passwords, API keys ni valores OAuth en los archivos.

## Smoke plan post-restauración

Ejecutar estas pruebas solo después de restaurar y activar el entorno destino:

1. Enviar una solicitud controlada al formulario público y obtener HTTP 201.
2. Confirmar exactamente dos `email_jobs`: `customer_confirmation` y
   `business_notification`.
3. Confirmar que C13B reclama y procesa ambos sin duplicarlos.
4. Confirmar que C14A completa un enrichment válido y una sola activity.
5. Confirmar que C15 procesa el hito esperado mediante worker/schedule y que
   no crea emails.
6. Provocar, en un entorno seguro, un fallo saneable y confirmar que el Error
   Handler está asociado, registra una fila y aplica deduplicación.
7. Confirmar que Ops está activo y apunta a la Data Table nueva; probar la
   retención solo con una fila ficticia caducada controlada.
8. Repetir los eventos y confirmar replay sin duplicados.
9. Retirar fixtures y confirmar cero residuos.

## ANTES DE QUE TERMINE EL TRIAL N8N

- [x] Exports 5/5 guardados fuera de n8n.
- [x] Hashes SHA-256 guardados.
- [ ] Sincronizar GitHub después de revisión humana; C17D no hace commit/push.
- [x] Secrets inventariados solo por nombre, sin valores.
- [x] Gateway C14A y dependencia de plan/créditos documentados.
- [x] URLs wake que deben actualizarse identificadas.
- [x] Reasignación de Error Handler e IDs internos documentada.
- [x] Data Table no exportable y su esquema documentados.
- [x] Guía de restauración completa.
- [x] Exports accesibles en el repositorio fuera de la instancia n8n.
- [x] Ninguna dependencia crítica queda solo en la instancia cloud: la Data
  Table se reconstruye con el esquema documentado; credenciales y secretos se
  recuperan o regeneran desde sus gestores seguros.
