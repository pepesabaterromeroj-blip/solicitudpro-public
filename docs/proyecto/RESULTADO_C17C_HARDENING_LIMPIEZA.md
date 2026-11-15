# Resultado C17C — Hardening y limpieza DEV

Fecha: 2026-09-29. Entorno: n8n/Supabase DEV de SolicitudPro. Alcance
limitado a los tres puntos identificados y una inspección runtime dirigida;
no se ejecutaron requests, emails, Gateway, E2E ni Ops Maintenance.

## Estado

**C17C cerrada en DEV.** Se corrigieron los dos ajustes activos encontrados y
la arquitectura congelada no cambió. C17A/B y las fases C13–C16 no se
revalidaron.

## CORREGIDO C17C

### C13B — timezone explícita

`SolicitudPro DEV - Email Worker C13B` (`PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID`) no declaraba
timezone en settings. Se añadió exclusivamente `Europe/Madrid`.

El workflow permanece activo/publicado, con 27 nodos, webhook wake, fallback
horario, credenciales, frecuencia, conexiones, lógica de claim/envío/retry y
Error Handler intactos. La actualización devolvió una operación aplicada y
cero warnings.

### Ops Maintenance — Error Handler

`SolicitudPro DEV - Ops Maintenance` (`PUBLIC_SOLICITUDPRO_DEV_OPS_MAINTENANCE_WORKFLOW_ID`) tenía timezone
`Europe/Madrid` y schedule diario 03:10 correctos, pero no declaraba
`settings.errorWorkflow`. Se conectó al Error Handler compartido existente
`PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`.

Conserva exactamente 3 nodos y no se modificaron retención, Data Table,
condiciones de borrado ni schedule. La actualización devolvió una operación
aplicada y cero warnings.

## C13A legacy

`SolicitudPro DEV - Email Worker C13A` (`PUBLIC_LEGACY_EMAIL_WORKER_C13A_WORKFLOW_ID`) está inactivo,
no archivado, no disponible para MCP y declara 0 triggers.

Evidencia previa al intento de retirada:

- ninguno de los cinco workflows activos contiene su ID, nombre o referencia;
- ninguna de las cuatro Edge Functions activas contiene su ID/nombre;
- no existen llamadas runtime locales a C13A;
- las únicas coincidencias locales están en `n8n/README.md` y el export
  histórico `n8n/prepared/SolicitudPro_DEV_Email_Worker_C13A.json`;
- C13B cubre actualmente claim, render, envío, retry y resolución de jobs.

Se intentó el archivado recuperable mediante n8n MCP. El backend respondió:
`Workflow is not available in MCP`. No se habilitó acceso ni se usó UI porque
quedaban fuera del alcance/herramientas autorizadas. C13A se conserva como
registro inerte: no está activo, no publica triggers y no bloquea C17D.

## Inspección dirigida

- Workflows activos esperados: C13B, C14A, C15A/B, Error Handler y Ops
  Maintenance; todos activos y con sus grafos publicados.
- Error Handler configurado en C13B, C14A, C15 y Ops. El propio Error Handler
  mantiene `errorWorkflow` vacío, sin autorreferencia.
- Nodos huérfanos relevantes en grafos activos: 0.
- Referencias activas a C13A: 0.
- Webhooks activos: solo wakes C13B y C14A; ambos forman parte del flujo
  demostrado en C17B. No se detectó webhook legacy publicado.
- Schedules: C13B horario y `Europe/Madrid`; C14A `:17`; C15 `:37`; Ops
  `03:10`, estos tres también en `Europe/Madrid`.
- Las comprobaciones C17B permanecen limpias: no hay fixture conocida ni jobs
  o activities huérfanos atribuibles a C17.
- Configuración n8n expone referencias de credencial por nombre/tipo, no
  valores. El escaneo local de patrones sensibles no encontró secretos reales;
  una coincidencia `re_...` era parte del nombre de una migración histórica.

## Credenciales y secretos

Credenciales referenciadas por workflows activos, solo nombre/tipo:

- `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_01` — `httpHeaderAuth`, worker C13B;
- `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_02` — `httpHeaderAuth`, Resend C13B;
- `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_03` — `httpHeaderAuth`, wake C13B;
- `REPLACE_WITH_HTTPHEADERAUTH_CREDENTIAL_NAME_06` — `httpHeaderAuth`;
- `REPLACE_WITH_HTTPBEARERAUTH_CREDENTIAL_NAME_07` — `httpBearerAuth`;
- `REPLACE_WITH_HTTPCUSTOMAUTH_CREDENTIAL_NAME_05` — `httpCustomAuth`;
- `REPLACE_WITH_GMAILOAUTH2_CREDENTIAL_NAME_04` — `gmailOAuth2`, Error Handler.

No se creó, mostró, rotó ni eliminó ningún secreto/credencial. Las credenciales
genéricas `HTTP_HEADER_AUTH_UNUSED_2`, `HTTP_HEADER_AUTH_UNUSED_3`,
`HTTP_HEADER_AUTH_UNUSED_6` y `HTTP_HEADER_AUTH_UNUSED_7` no aparecen en los cinco
workflows activos, pero se conservan porque C13A no puede inspeccionarse por
MCP y no está demostrado que sean exclusivamente suyas.

## Clasificación final

### ACEPTADO

- C13A permanece como registro inactivo sin triggers por la limitación de
  acceso MCP. Riesgo runtime: nulo según el inventario actual.
- Se conservan nombres genéricos de credenciales existentes; renombrarlos no
  aporta hardening funcional antes de la demo.

### C17D

- Exportar únicamente los cinco workflows activos y sus dependencias.
- Incluir en el manifiesto portable las credenciales requeridas solo por
  nombre/tipo y excluir C13A del paquete operativo.

### POST-DEMO

- Archivar C13A desde la UI de n8n o habilitar temporalmente MCP para
  archivarlo, sin reactivarlo.
- Revisar manualmente propiedad/uso de las cuatro credenciales genéricas no
  referenciadas antes de considerar su eliminación.

No quedan BLOCKERS funcionales o de seguridad para iniciar C17D mediante una
instrucción separada.
