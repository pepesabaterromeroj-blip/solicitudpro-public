# Resultado C19 GLOBAL · Cierre de producto, DEV e integración

Fecha: 2026-10-27

Rama de producto: `c19ab-detail-responsive`

Runtime solicitado: GPT-5.6 Sol / High. Runtime real: **NO VERIFICADO**.

Estado: **C19 GLOBAL CERRADA; INTEGRACIÓN EN `main` VALIDADA**.

## Alcance consolidado

C19 reúne el detalle responsive C19A+B y el polish UX C19C+D, incluida la revisión humana PASS, los filtros `Pendientes` / `Contactados` / `Todos`, el estado `✓ Contactado`, las prioridades legibles, el tratamiento de archivadas, la copia honesta de respuesta y el contrato real de `Desmarcar`.

El frontend real sigue usando Supabase como fuente de verdad. La reapertura se realiza mediante `reopen_manual_follow_up`, definida en `20261023100000_c19_reopen_manual_follow_up.sql` como `SECURITY INVOKER`. La RPC solo admite tareas manuales completadas del tenant autenticado, excluye automatizaciones C15 y solicitudes archivadas o comercialmente cerradas, y evita éxito falso en replays. La Activity se registra después de la confirmación; un fallo parcial se comunica sin revertir visualmente un resultado no confirmado.

## Supabase DEV

Proyecto verificado: `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`).

- La migración equivalente ya estaba aplicada en DEV y no se reaplicó.
- Firma RPC, `SECURITY INVOKER`, permisos `authenticated` y RLS multi-tenant comprobados.
- Sin `service_role` en frontend, privilegios `anon`, secretos nuevos ni acceso a producción.

## Smoke autenticado

Owner ficticio: Reformas.

- Negocio correcto, 11 solicitudes reales y ningún fixture local mezclado.
- Seguimiento manual: `pending → completed`, persistencia tras recarga, aparición en `Contactados`, `✓ Contactado` y desaparición del CTA de completar.
- `completed → Desmarcar → pending`: `completed_at` y `completed_by` nulos; texto, fecha y asignación conservados; Activity `Seguimiento reabierto`; persistencia confirmada mediante nueva lectura backend.
- Denegación efectiva para otro tenant, tarea C15, solicitud archivada, solicitud cerrada y replay sobre una tarea ya pendiente.
- Recorrido real: Inicio → Solicitudes → detalle → estado/prioridad → nota → seguimiento → completar → Desmarcar → Activity → respuesta sugerida/copiar → Contactos → Inicio.
- Logout/sesión no se modificaron; no hubo correo real, n8n ni producción.

Durante el smoke se detectó que una tarea C15 asignada se etiquetaba visualmente como `Manual`. Se añadió una regresión roja y se corrigió el origen para exigir asignación, `cadence_hours` nulo y canal `internal`. La protección de reapertura ya era correcta.

Una tarea C15 usada inicialmente para verificar esa protección quedó completada en DEV. No se intentó reabrirla ni borrarla por vías privilegiadas. El seguimiento manual de smoke quedó finalmente pendiente, con la trazabilidad de Activity intacta.

## Gates de la rama

- TDD de la etiqueta C15: RED y GREEN verificados.
- Regresiones C18D/C19 afectadas: 37/37.
- Suite global: 253/253.
- Evaluaciones, sintaxis JavaScript y `git diff --check`: PASS.
- Revisión humana del producto: PASS.

## Integración

La rama `c19ab-detail-responsive` (`b0789868b8623cd79bd8ce0ab19d0d7c4eb49d2b`) se integró de forma controlada sobre `origin/main` (`a616a07f8f134c657d2693a701510508c6cb090f`) en el commit de integración `40b3a56bb7bdc698252c7328f2d3621f4db830cb`. El merge fue automático y conservó la infraestructura de backups, `AGENTS.md` y `docs/contexto-chatgpt/`; los cambios históricos de `PLAN_DIARIO.md` y `LOG_DIARIO.md` se excluyeron expresamente.

El gate post-integración obtuvo 253/253 tests globales, 21/21 C18D, 26/26 C19, 2/2 del evaluador y 2/2 del backup, además de sintaxis JavaScript, YAML, escaneo de secretos y `git diff --check` correctos. El smoke corto autenticado confirmó Inicio → Solicitudes → detalle → Seguimientos → completar → Contactados → Desmarcar → Pendientes → Activity → Inicio.

Durante ese smoke se detectó una etiqueta local visible en Inicio real: el controlador añadía `hidden`, pero `display: inline-flex` prevalecía en CSS. Se reprodujo con una prueba roja y se añadió la regla mínima `.dashboard-local-badge[hidden]`; la revalidación real confirmó que la etiqueta ya no aparece en DEV.

No se ha iniciado C20. La rama C19 se conserva publicada para trazabilidad.
