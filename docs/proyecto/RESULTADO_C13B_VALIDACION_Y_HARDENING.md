# Resultado C13B — validación y hardening DEV

Fecha: 23 de septiembre de 2026

## Estado

Validación bloqueada en la Fase 1. No se iniciaron las fases de retry, fallo
terminal, Error Handler operativo ni limpieza remota porque el happy path
automático no quedó demostrado.

## Baseline

- Repositorio inspeccionado en la rama `main`.
- El árbol tenía trabajo preexistente sin seguimiento:
  `docs/automatizacion-codex/`,
  `docs/proyecto/HERRAMIENTA_E2E_SOLICITUD_DEV.md`, `package.json`,
  `scripts/` y `tests/dev-test-request.test.js`.
- No se sobrescribió ni reformateó ninguno de esos archivos.
- C13B (`PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID`) estaba activo, publicado y con
  `availableInMCP=true`.
- Error Handler (`PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`) estaba activo, publicado y con
  `availableInMCP=true`.
- C13A (`PUBLIC_LEGACY_EMAIL_WORKER_C13A_WORKFLOW_ID`) seguía inactivo y con
  `availableInMCP=false`. No se usó como referencia funcional.
- Webhook, inicio manual y schedule convergían en el mismo nodo
  `Claim email jobs`.
- La versión activa de C13B coincidía con el borrador inspeccionado.

## Pruebas realizadas

### Dry-run local

Comando:

```text
npm run dev:test-request
```

El wrapper `npm.ps1` fue bloqueado por la política de ejecución local antes
de arrancar la herramienta. Se repitió el mismo comando mediante `npm.cmd`,
sin cambiar scripts ni políticas.

Resultado:

- endpoint DEV: proyecto `rinrgjancwvcvpzjyqmu`;
- negocio: `reformas-demo-dev`;
- formulario: `solicitud`;
- teléfono vacío;
- email sustituido por un marcador;
- ningún secreto impreso;
- ningún tráfico externo durante el dry-run.

Run de dry-run: `SP-E2E-20260923-113011-EBC3`.

### Envío real controlado

Se ejecutó una sola vez:

```text
npm run dev:test-request -- --send --json
```

Resultado seguro:

- `run_id`: `SP-E2E-20260923-113055-CB68`;
- HTTP: `201`;
- referencia: `REF-007`;
- no se devolvió `request_id`;
- no se imprimieron email, payload completo, tokens ni secretos.

## Evidencia del happy path

La solicitud fue creada correctamente, pero no apareció ninguna ejecución de
C13B posterior a `2026-09-23T11:30:40Z`. Se consultó dos veces el historial
por MCP y el resultado fue cero ejecuciones nuevas. Tampoco apareció una
ejecución del Error Handler en esa ventana.

El último evento registrado de C13B continuó siendo la ejecución programada
`15`, iniciada a `2026-09-23T11:00:42.087Z`. La última ejecución webhook
continuó siendo la `14`, iniciada a `2026-09-23T10:34:09.880Z`, anterior
a esta prueba.

Por tanto:

- creación de la solicitud: **VERIFICADA**;
- activación automática de C13B por el formulario: **NO VERIFICADA**;
- trigger webhook para esta solicitud: **NO OCURRIÓ según el historial MCP**;
- ramas cliente y negocio: **NO VERIFICADAS para este run**;
- invocación de Resend: **NO VERIFICADA para este run**;
- nodos `sent`: **NO VERIFICADOS para este run**;
- estado final de los dos `email_jobs`: **NO VERIFICADO**.

No había en esta sesión una herramienta MCP de Supabase o Resend disponible
para consultar de forma segura y de solo lectura el estado de los jobs o los
envíos. No se intentó crear una vía alternativa ni usar `service_role`.

## Investigación de la causa

El código local actual de
`supabase/functions/receive-public-form/index.ts` crea la solicitud mediante
`submit_public_form_submission` y devuelve la respuesta, pero no contiene
ninguna llamada al webhook de C13B. Una búsqueda completa del repositorio no
encontró la ruta del webhook ni la cabecera de wake en código ejecutable.

La evidencia disponible sitúa el fallo en la conexión
`receive-public-form -> webhook de C13B`, no dentro de C13B. El webhook de
n8n está activo y había aceptado una ejecución anterior, pero la nueva
solicitud no lo invocó.

No se modificó la Edge Function porque el acceso adicional a Supabase estaba
limitado expresamente a solo lectura y no existía un mecanismo autorizado
para desplegar o verificar ese cambio.

## Retry

**NO EJECUTADO.** El gate exige validar primero el happy path. La inspección
estática confirma la clasificación de red, 408, 425, 429 y 5xx, el límite
`attempt_count < 5` y los backoffs 2/10/30/60, pero no se considera evidencia
de ejecución.

## Fallo terminal

**NO EJECUTADO.** No se provocó ningún error permanente ni se modificaron
jobs reales.

## Error Handler

**NO EJECUTADO.** La definición confirma:

- `Error Trigger -> Sanear error -> Salida pendiente de configurar`;
- la salida final continúa siendo NoOp;
- el workflow mantiene su propio ID en `settings.errorWorkflow`.

No se corrigió la autorreferencia porque la Fase 1 no superó el gate.

## Cambios realizados

- Creación de este documento de resultados.

No se modificó ningún workflow, nodo, conexión, credencial, configuración,
Edge Function, tabla, job ni proveedor de correo.

## Cambios no realizados

- No se eliminaron los tres nodos huérfanos de C13B.
- No se cambió la expresión de `job_id` de negocio.
- No se cambiaron `=from` ni `=to`.
- No se modificó la clasificación duplicada de errores.
- No se cambió la política de retry de `claim`, `sent` o `failed`.
- No se corrigió la autorreferencia del Error Handler.
- No se añadió una salida operativa al Error Handler.

Todos se aplazaron porque el happy path automático no quedó validado.

## Riesgos restantes

1. El formulario puede crear solicitudes y jobs sin despertar inmediatamente
   C13B; el procesamiento queda pendiente del schedule horario.
2. Los dos jobs de `REF-007` no pudieron comprobarse mediante una interfaz
   segura de solo lectura.
3. El Error Handler sigue sin alerta persistente y conserva la
   autorreferencia.
4. C13B conserva tres nodos `Marcar sent cliente1/2/3` aislados.
5. Retry, fallo terminal y saneado real del Error Handler siguen sin evidencia
   E2E.

## Siguiente paso recomendado

Implementar y desplegar únicamente en DEV el enlace mínimo y autenticado desde
`receive-public-form` al webhook wake de C13B, sin enviar PII y sin hacer que
un fallo del wake invalide la solicitud ya creada. La URL y el secreto deben
residir en secretos del entorno DEV, nunca en Git.

Después:

1. añadir pruebas unitarias del wake y de su fallo controlado;
2. desplegar solo la Edge Function DEV;
3. repetir una única solicitud E2E;
4. localizar la ejecución webhook y validar ambas ramas;
5. consultar los dos jobs mediante una interfaz DEV segura de solo lectura;
6. solo entonces continuar con retry, terminal, Error Handler y limpieza.

## Seguridad

- No se leyó ni mostró el contenido de `.env.local`.
- No se expusieron emails, claves, tokens, headers ni credenciales.
- No se utilizó `service_role`.
- No se tocó producción ni el proyecto landing.
- C13A no se modificó ni ejecutó.
- No se hizo commit, push ni deploy.

---

# Continuación del cierre C13B — 24 de septiembre de 2026

## Estado

**BLOQUEADA en el gate de secretos previo al despliegue.** La implementación
local y sus pruebas están terminadas, pero las herramientas disponibles no
permiten comprobar ni configurar de forma segura los secretos de la Edge
Function. No se desplegó código ni se ejecutó una nueva solicitud E2E.

## Baseline actual

- Proyecto Supabase confirmado mediante el endpoint del conector:
  `rinrgjancwvcvpzjyqmu` (`solicitudpro-app-dev`).
- `receive-public-form` estaba ACTIVE, versión 9 y `verify_jwt=false`.
- Antes de editar, el contenido local de `index.ts` coincidía exactamente con
  el desplegado, normalizando únicamente finales de línea.
- C13B (`PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID`) estaba activo y publicado; la versión activa
  coincidía con el borrador.
- `C13B - Webhook wake DEV` y `Schedule Trigger` estaban habilitados y ambos
  convergían directamente en `Claim email jobs`, seguido de `¿Hay jobs?`.
- El webhook conservaba autenticación por cabecera y respuesta inmediata 202.
- El Schedule Trigger horario se conservó como fallback.
- El Error Handler (`PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`) seguía activo, con
  `Error Trigger -> Sanear error -> Salida pendiente de configurar`, y mantenía
  la autorreferencia `settings.errorWorkflow = PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`.
- Git estaba en `main`, sin cambios tracked previos. Se preservaron todos los
  archivos E2E y de documentación que ya estaban untracked.

## Implementación local del wake

Se añadió un helper pequeño y aislado que:

- lee `N8N_EMAIL_WAKE_URL` y `N8N_EMAIL_WAKE_SECRET` mediante `Deno.env.get`;
- agenda una única tarea con `EdgeRuntime.waitUntil`;
- envía `POST`, `Content-Type: application/json`, la cabecera
  `X-SolicitudPro-Wake-Secret` y el body literal `{}`;
- no recibe ni transmite email, teléfono, referencia, `request_id`,
  `business_id` ni payload del formulario;
- registra solo `email_worker_wake` con los outcomes `accepted`, `rejected`,
  `network_error` o `configuration_missing`, y status HTTP cuando procede;
- absorbe errores de red y respuestas no 2xx sin invalidar la solicitud;
- no usa timeout adicional, porque no es necesario para desacoplar la
  respuesta y evita introducir una dependencia de runtime no requerida.

`receive-public-form` agenda el wake solo después de que
`submit_public_form_submission` termine sin error. También lo agenda en un
replay idempotente válido: el wake solo significa «consulta la cola», Claim es
idempotente y este comportamiento mejora la recuperación. Sigue siendo un
único wake por invocación del formulario, no uno por `email_job`.

## Pruebas locales

Se aplicó TDD: las cinco pruebas nuevas fallaron primero por ausencia del
helper y del punto de integración; después pasaron con la implementación
mínima.

Cobertura añadida:

1. una submission correcta agenda un único wake en background;
2. método POST y body `{}` sin PII;
3. cabecera de autenticación obtenida del entorno;
4. el wake no bloquea ni modifica la respuesta correcta del formulario;
5. error de red absorbido;
6. HTTP no 2xx absorbido y registrado como `rejected`;
7. configuración ausente sin fetch, sin secretos en logs y sin excepción;
8. wake situado después de la rama que retorna los errores del RPC;
9. ausencia de wake para submissions rechazadas antes de completar el RPC.

Resultados:

- `node --test tests/c13b-email-worker-wake.test.js`: 5/5 passing.
- `npm.cmd test`: 138/138 passing, 0 fallos.
- `node --check supabase/functions/receive-public-form/index.ts`: exit 0.
- El helper TypeScript fue cargado y ejecutado por Node en la suite. El
  comando `node --check` aislado no aplica stripping de tipos y devuelve un
  error sintáctico sobre `type`; no representa un fallo de la Edge Function.
- La suite mantiene los avisos preexistentes de Node por módulos TypeScript
  sin `type: module`; no se cambió `package.json` porque convertir el proyecto
  CommonJS quedaría fuera de alcance.

## Gate de secretos

El MCP de Supabase disponible permite leer y desplegar Edge Functions, pero
no listar ni configurar secretos. Tampoco existe Supabase CLI autenticada en
el entorno local. Conforme al gate de seguridad, falta confirmar fuera del
chat y sin exponer valores:

- crear/configurar `N8N_EMAIL_WAKE_URL`;
- crear/configurar `N8N_EMAIL_WAKE_SECRET`.

No se intentó leer la credencial de n8n, no se pidió pegarla en el chat y no
se creó ningún `.env`.

## Versión Edge Function

- Versión desplegada: 9, sin cambios.
- Versión nueva: **NO DESPLEGADA**.
- `verify_jwt=false`: conservado en remoto.

## E2E

**NO EJECUTADO** por el gate de secretos.

- `run_id`: **NO VERIFICADO**.
- referencia: **NO VERIFICADA**.
- ejecución n8n modo webhook: **NO VERIFICADA**.
- `customer_confirmation`: **NO VERIFICADO**.
- `business_notification`: **NO VERIFICADO**.
- latencia creación -> `processing_started_at`: **NO VERIFICADA**.

## Retry

**NO EJECUTADO.** El happy path nuevo todavía no está demostrado mediante
evidencia real.

## Fallo terminal

**NO EJECUTADO.** El gate del happy path no se ha superado.

## Error Handler

**NO MODIFICADO NI VALIDADO EN EJECUCIÓN.** La inspección volvió a confirmar
la autorreferencia y la salida NoOp, pero su corrección queda después del gate
del happy path.

## Limpieza

**NO EJECUTADA.** No se eliminaron nodos, no se cambió el `job_id` de negocio
y no se tocaron `=from`, `=to` ni la clasificación duplicada.

## Riesgos restantes

1. Hasta configurar los dos secretos y desplegar, las nuevas submissions
   seguirán dependiendo del Schedule Trigger horario.
2. Falta demostrar el wake inmediato con una ejecución n8n `mode=webhook` y
   exactamente dos jobs en estado `sent`.
3. Retry, fallo terminal y Error Handler continúan sin evidencia dinámica.
4. El Error Handler conserva su autorreferencia y salida NoOp.
5. C13B conserva los tres nodos huérfanos `Marcar sent cliente1/2/3` y el
   salto de línea observado en la preparación del `job_id` de negocio.

## Seguridad

- Solo se consultó SolicitudPro DEV.
- No se desplegó ni modificó Supabase, n8n, Resend, base de datos, RLS, Auth o
  Storage.
- No se expusieron secretos, destinatarios, payloads ni PII.
- C13A no se abrió, ejecutó ni modificó.
- No se tocó landing ni producción.
- No se hizo commit ni push.

---

# Cierre tras confirmación de secretos — 24 de septiembre de 2026

Esta sección continúa la evidencia anterior. No la sustituye: el gate de
secretos quedó levantado por confirmación externa, sin leer ni recuperar sus
valores.

## Baseline inmediatamente anterior al despliegue

- Proyecto limitado por el conector a `rinrgjancwvcvpzjyqmu`,
  `solicitudpro-app-dev`.
- La API informó `receive-public-form` ACTIVE, versión 10 y
  `verify_jwt=false`. Aunque la versión observada el día anterior era 9, el
  contenido remoto seguía siendo el previo: coincidía con el local al retirar
  deliberadamente el import y la llamada nuevos del wake, y
  `attachment-upload.ts` coincidía exactamente. No se detectó drift remoto.
- Se confirmó que el único objetivo del despliegue era
  `receive-public-form`; no se incluyeron otras funciones ni cambios de base
  de datos.
- C13B seguía activo. `C13B - Webhook wake DEV` y `Schedule Trigger`
  convergían en el mismo `Claim email jobs`; el schedule horario se mantuvo
  como fallback.

## Despliegue del wake

- Se desplegó únicamente `receive-public-form` en DEV.
- Resultado: ACTIVE, versión 11, `verify_jwt=false`.
- Archivos remotos: `index.ts`, `attachment-upload.ts` y
  `email-worker-wake.ts`.
- El código remoto contiene `EdgeRuntime.waitUntil`, lee exclusivamente
  `N8N_EMAIL_WAKE_URL` y `N8N_EMAIL_WAKE_SECRET`, y agenda un único POST con
  body `{}` después del RPC correcto.
- No se leyó ningún valor de secreto. La revisión de logs fue saneada: no se
  observaron secretos ni PII. No apareció un evento custom del wake en la
  ventana consultada; la recepción efectiva quedó demostrada por la ejecución
  webhook de n8n descrita a continuación.

## E2E del happy path

Dry-run:

- comando: `npm.cmd run dev:test-request`;
- `run_id`: `SP-E2E-20260924-073143-D57C`;
- resultado: válido, sin envío.

Única solicitud real:

- comando: `npm.cmd run dev:test-request -- --send --json`;
- `run_id`: `SP-E2E-20260924-073156-093C`;
- referencia: `REF-008`;
- timestamp del run: `2026-09-24T07:31:56Z`;
- respuesta HTTP: 201.

n8n registró una única ejecución correspondiente:

- execution ID: `37`;
- modo: `webhook`;
- inicio: `2026-09-24T07:31:58.136Z`;
- fin: `2026-09-24T07:32:02.622Z`;
- estado: success.

La ejecución recorrió, sin errores, `C13B - Webhook wake DEV -> Claim email
jobs -> ¿Hay jobs? -> Iterar jobs reclamados -> Tipo de email` y las dos ramas
completas: preparación, Resend y marcado `sent` de confirmación de cliente y
aviso de negocio.

Consulta limitada a los jobs de `REF-008`:

| Tipo | Estado | Intentos | `last_error` | Creado | Inicio de proceso | Latencia |
| --- | --- | ---: | --- | --- | --- | ---: |
| `customer_confirmation` | `sent` | 1 | `null` | 07:31:57.722027Z | 07:31:59.454213Z | 1,732 s |
| `business_notification` | `sent` | 1 | `null` | 07:31:57.722027Z | 07:31:59.466428Z | 1,744 s |

Existían exactamente dos jobs. Los timestamps y el modo `webhook` demuestran
procesamiento inmediato, sin esperar al Schedule Trigger horario. El gate del
Happy Path queda **SUPERADO**.

## Retry controlado

Se ejecutó el JavaScript exacto de ambos clasificadores activos en un arnés
V8 aislado, sin escribir jobs ni llamar a Resend. Resultado: 14/14 casos
esperados.

- error de red y HTTP 408, 425, 429, 500 y 503 se clasifican reintentables
  mientras `attempt_count < 5`;
- los backoffs observados fueron 2, 10, 30 y 60 minutos para los intentos 1 a
  4;
- con intento 5 no se programa retry;
- HTTP 400 se clasifica permanente;
- las conexiones de las dos ramas dirigen `true` a las operaciones de retry y
  `false` a las operaciones terminales;
- las llamadas de retry incluyen `retry_at`; las terminales no lo incluyen.

La clasificación y el backoff quedan **VERIFICADOS EN SIMULACIÓN
CONTROLADA**. Un fallo real inducido en Resend queda **NO VERIFICADO**, porque
provocarlo habría requerido alterar credenciales, destinatarios o proveedor.

## Fallo terminal

Se validó de forma reversible el contrato real de
`resolve_email_job_failed` sobre el job `customer_confirmation` de `REF-008`,
dentro de una transacción con `ROLLBACK`:

- transición observada a `failed`;
- error operativo saneado persistido;
- `claim_token` y lease eliminados;
- `sent_at` eliminado durante la simulación;
- sin estado pendiente ni `retry_at` equivalente.

Tras el rollback, una lectura independiente confirmó que el job original
seguía `sent`, con `attempt_count=1`, `last_error=null` y `sent_at` conservado.
No quedó ninguna mutación de datos. El contrato terminal queda
**VERIFICADO DE FORMA TRANSACCIONAL**; una ejecución real con rechazo
permanente de Resend queda **NO VERIFICADA**.

## Error Handler

Estado inicial confirmado:

- `Error Trigger -> Sanear error -> Salida pendiente de configurar`;
- salida final NoOp;
- autorreferencia `settings.errorWorkflow = PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`.

La ejecución manual controlada 38 demostró que el saneador ocultaba email y
Authorization, pero no un token con prefijo `re_`. Se corrigió una sola causa,
añadiendo la regla de redacción específica. La ejecución 39 pasó con email,
bearer y token ficticio redactados, sin conservar el valor secreto ficticio.

Después se eliminó la autorreferencia. El Error Handler ya no se selecciona a
sí mismo y C13B mantiene este workflow como su `errorWorkflow` dedicado.

Como salida operativa mínima se creó la Data Table interna
`SolicitudPro DEV - Alertas operativas`, sin SaaS ni credenciales externas,
con solo los campos autorizados: `workflow`, `execution_id`, `node`,
`timestamp` y `message`. La ejecución de prueba 40 terminó success y almacenó
una única fila de fixture claramente identificada; su lectura confirmó que no
contenía el email, bearer ni token ficticios originales. Se retiraron el NoOp
y la nota obsoleta. Versión activa final del Error Handler:
`b50586d2-dcda-4403-92c4-073e5b1df9c4`.

El recorrido y la persistencia interna quedan **VERIFICADOS CON FIXTURE**.
El disparo automático por un fallo real de producción n8n queda **NO
VERIFICADO**, porque no se forzó una caída real del workflow activo.

## Limpieza de C13B

- Se eliminaron únicamente los tres nodos huérfanos
  `C13B - Marcar sent cliente1`, `C13B - Marcar sent cliente2` y
  `C13B - Marcar sent cliente3`.
- Se quitó el salto de línea de la expresión `job_id` de negocio y se conservó
  `String(...).trim()`.
- Se revisaron `=from` y `=to`; se conservaron porque la ejecución 37 demostró
  que ambos envíos funcionaban.
- No se refactorizó la clasificación duplicada cliente/negocio.
- La versión activa final de C13B es
  `d27d232a-082e-4953-9c4a-e2ebf979af86`, con 27 nodos.
- Webhook y schedule continúan convergiendo en `Claim email jobs`.

## Riesgos restantes

1. Retry y fallo terminal no se validaron contra un rechazo real de Resend;
   la evidencia es de clasificación exacta y contrato transaccional.
2. El Error Handler no se disparó mediante un fallo real de una ejecución de
   producción; sí se validaron saneado, persistencia y grafo con fixture.
3. La Data Table contiene una fila de fixture no sensible. No se eliminó para
   respetar la prohibición de borrar datos y conservar evidencia auditable.
4. Conviene definir en una tarea futura una política de retención para la
   tabla de alertas operativas.

## Seguridad

- Toda actuación remota quedó limitada a SolicitudPro DEV.
- No se leyó, imprimió, copió ni recuperó ningún secreto.
- No se mostró PII ni destinatarios.
- No se modificaron producción, landing, RLS, Auth, Storage, esquema de base
  de datos ni `email-job-worker`.
- C13A permaneció intacto y no se utilizó.
- No se borraron solicitudes ni jobs.
- No se hizo commit, push, pull ni reset.

---

# Cierre del hardening pendiente — 25 de septiembre de 2026

## Baseline

- C13B (`PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID`) estaba activo, publicado y con 27 nodos.
- Sus settings apuntaban al Error Handler `PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`.
- `C13B - Webhook wake DEV` y `Schedule Trigger` seguían habilitados.
- El Error Handler estaba activo, publicado, sin autorreferencia y con el
  recorrido `Error Trigger -> Sanear error -> Registrar alerta operativa DEV`.
- La Data Table `SolicitudPro DEV - Alertas operativas` conservaba únicamente
  las columnas `workflow`, `execution_id`, `node`, `timestamp` y `message`.
- Las tres ejecuciones anteriores del Error Handler eran manuales; por tanto,
  el disparo automático aún no estaba demostrado al comenzar esta sesión.

## Disparo automático del Error Handler

Se añadió temporalmente a C13B el nodo Code
`DEV TEST - Forzar fallo controlado`, conectado solo desde el Schedule Trigger
y situado antes de `Claim email jobs`. El nodo lanzó un error explícito con
marcadores sintéticos de email, autorización, secreto y token. La variante
temporal se publicó con 28 nodos y se inició una única ejecución de producción
desde el Schedule Trigger.

Evidencia:

- ejecución C13B `64`, modo `trigger`, estado `error`;
- inicio `2026-09-25T06:38:39.998Z` y fin `2026-09-25T06:38:41.805Z`;
- último nodo ejecutado: `DEV TEST - Forzar fallo controlado`;
- ejecución Error Handler `65`, modo `error`, estado `success`;
- la metadata de `Error Trigger` identifica como padre la ejecución `64` del
  workflow C13B.

La ejecución `65` no fue manual. El disparo automático por un fallo real de
C13B queda **VERIFICADO**.

## Alerta persistida y saneado

La fila creada por la ejecución `65` contiene exclusivamente:

- `workflow`: `SolicitudPro DEV - Email Worker C13B`;
- `execution_id`: `64`;
- `node`: `DEV TEST - Forzar fallo controlado`;
- `timestamp`: `2026-09-25T06:38:41.957Z`;
- `message`: mensaje operativo con todos los marcadores sensibles redactados.

La lectura de la Data Table confirmó que no se persistieron el email
sintético, el valor bearer, el valor del secreto, el token con prefijo `re_`,
headers completos, payloads ni stack trace. El saneado queda **VERIFICADO**.

## Retirada del fixture remoto

Después de capturar la evidencia se eliminó el nodo temporal, se restauró
`Schedule Trigger -> Claim email jobs` y se volvió a publicar C13B. La
operación terminó sin advertencias de validación. El estado final vuelve a ser
27 nodos, con webhook, schedule fallback y Error Handler asignado.

## Fixture local DEV para retry y fallo terminal

Se añadió `scripts/c13b-dev-fixture.js` como fixture local reutilizable. Solo
se ejecuta mediante el flag explícito `--dev-fixture`; no lee variables de
entorno, no usa credenciales y no realiza llamadas de red. El comando es:

```text
npm run dev:c13b-fixture
```

El fixture valida 12 casos deterministas:

- red, HTTP 408, 425, 429, 500 y 503 como reintentables antes del intento 5;
- backoffs de 2, 10, 30 y 60 minutos para los intentos 1 a 4;
- HTTP 503 en intento 5 como fallo terminal;
- HTTP 400 como fallo terminal;
- ausencia de `retry_at` para casos terminales;
- saneado del mensaje operativo.

Resultado: 10 casos reintentables y 2 terminales, todos correctos. La prueba
automatizada confirmó además que el fixture no invoca `fetch`. La liberación
de claim y lease del fallo terminal continúa respaldada por la validación
transaccional reversible del 24/09; el fixture local no presenta esa propiedad
como una escritura real de base de datos.

## Retención de alertas operativas

Política definida:

- conservar 30 días;
- ejecutar la limpieza una vez al día;
- eliminar solo filas con `timestamp` anterior al umbral de 30 días;
- no tocar alertas recientes;
- mantener la tabla limitada a datos operativos saneados, sin PII.

La política queda **DEFINIDA Y PENDIENTE DE AUTOMATIZACIÓN**. No se creó un
workflow adicional: el MCP actual no ofrece una operación de borrado de filas
y no existe una fila caducada con la que validar la limpieza sin eliminar la
evidencia reciente.

## Seguridad

- Trabajo limitado a DEV.
- No se modificaron credenciales, secretos, claves Resend ni dominio de envío.
- No se enviaron correos ni se reclamaron jobs durante el fallo controlado.
- No se mostraron secretos ni PII; todos los valores del error eran
  marcadores sintéticos.
- C13A, producción, landing, RLS, Auth y Storage quedaron intactos.
- No se borraron solicitudes, jobs ni alertas.
- No se hizo commit, push, pull, reset ni rebase.

---

# Alertas operativas por Gmail — 25 de septiembre de 2026

- El Error Handler (`PUBLIC_SOLICITUDPRO_DEV_ERROR_HANDLER_WORKFLOW_ID`) quedó publicado con la ruta
  `Error Trigger -> Sanear error -> Registrar alerta operativa DEV -> Buscar alertas iguales (15 min) -> Anti-spam operativo -> Gmail`.
- La Data Table registra cada error antes del filtro. Este consulta filas del
  mismo `workflow`, `node` y `message` dentro de los 15 minutos anteriores;
  una coincidencia previa suprime el correo. Las alertas repetidas se conservan.
- Gmail usa el destinatario y OAuth existentes. El asunto es
  `[SolicitudPro DEV] Error en {{workflow}}`; el cuerpo de texto contiene solo
  `SolicitudPro DEV`, `workflow`, `execution_id`, `node`, `timestamp`,
  `message` saneado y, cuando el ID es numérico y el workflow es C13B, el
  enlace de ejecución construido con el host fijo de n8n. Sin adjuntos ni
  atribución automática. `onError=continueRegularOutput` evita que un fallo
  de Gmail borre la fila o dispare un error recursivo. El fallo de Gmail no se
  provocó en vivo: **NO VERIFICADO**.
- Prueba real única DEV: ejecución C13B `73` en modo `trigger`, estado `error`,
  detenida en `DEV TEST - Alerta Gmail controlada` antes de `Claim email jobs`.
  Inició automáticamente Error Handler `74` en modo `error`, estado `success`,
  con `parentExecutionId=73`. La Data Table guardó la fila `3` saneada y Gmail
  terminó con éxito y devolvió un ID de mensaje. No hubo claim de jobs, Resend
  ni correo a clientes.
- El fixture remoto se retiró y C13B se republicó con 27 nodos. Webhook y
  Schedule Trigger siguen conectados a `Claim email jobs`.
- Retención: sigue definida en 30 días con limpieza diaria pendiente. No se
  implementó porque esta sesión no podía validar borrados sin tocar evidencia
  real; ninguna alerta fue eliminada.
- Anti-spam validado por configuración y paso de la primera alerta; la
  supresión de una segunda ocurrencia queda **NO VERIFICADA** en vivo.

---

# Cierre de anti-spam y retención DEV — 25 de septiembre de 2026

## Anti-spam en vivo

- Dos fallos idénticos y controlados de C13B (`76` y `78`) iniciaron
  automáticamente Error Handler `77` y `79`, respectivamente. Ambos errores
  ocurrieron en el mismo nodo temporal, antes de `Claim email jobs`.
- La Data Table conservó dos filas (`4` y `5`) con el mismo `workflow`, `node`
  y `message` saneado; sus marcas de tiempo distan siete segundos.
- En `77`, el filtro dejó pasar una alerta y Gmail devolvió un ID de mensaje.
  En `79`, la consulta encontró las dos filas equivalentes, el filtro produjo
  cero elementos y Gmail no se ejecutó. Resultado: **un Gmail para dos
  ocurrencias dentro de 15 minutos**.
- Se retiró el fixture, se restauró `Schedule Trigger -> Claim email jobs` y
  se republicó C13B con 27 nodos. El webhook conserva su conexión original.
  Ninguna prueba reclamó jobs, llamó a Resend ni envió correo a clientes.

## Retención automática

- Se creó y publicó `SolicitudPro DEV - Ops Maintenance`
  (`PUBLIC_SOLICITUDPRO_DEV_OPS_MAINTENANCE_WORKFLOW_ID`): `Schedule Trigger` diario a las 03:10 en
  `Europe/Madrid` -> localizar filas con `timestamp` anterior a 30 días ->
  borrar cada fila por `id` solo si sigue siendo anterior al umbral.
- Antes de probar, las cinco alertas existentes eran recientes. Se creó una
  única fila ficticia sin PII, ID `6`, con fecha de más de 31 días. La
  ejecución manual `80` terminó con éxito: localizó y eliminó únicamente esa
  fila. Las filas recientes `1` a `5` permanecieron intactas. No queda
  fixture antiguo en la Data Table.
- La limpieza diaria programada aún no ha llegado a su primera ejecución
  automática: **NO VERIFICADA** en vivo. El borrado selectivo del workflow sí
  quedó verificado mediante la ejecución `80`.
