# Resultado C18D-2 · Seguimientos manuales reales

Fecha: 2026-10-13
Rama: `c18d-2-manual-followups`
Estado: **CERRADA**.

## Arquitectura y modelo reutilizado

C18D-2 reutiliza `public.follow_ups` para las tareas y `public.activities` para el historial. No crea una tabla paralela, migration, RPC, policy ni secreto. La UI mantiene el recorrido `js/real-product.js` → `js/data/product-data.js` → REST autenticado → RLS.

Un seguimiento manual se identifica por `assigned_to = auth.uid()`, usa `channel = internal`, `cadence_hours = null`, texto obligatorio y fecha futura. Se asocia mediante la FK compuesta existente `(request_id, business_id)`. Los hitos automáticos C15 de 24/48/72 horas siguen siendo exclusivamente actividades históricas, no tareas editables.

## Creación, pendientes y finalización

La vista Seguimientos mantiene visible «+ Añadir seguimiento», incluso con cero pendientes. Permite elegir una solicitud activa del negocio autorizado, escribir una tarea de hasta 500 caracteres y elegir fecha/hora futura. El control queda deshabilitado durante la petición y la UI se refresca únicamente tras una fila confirmada por el servidor.

La tarea aparece como pendiente con solicitud, cliente, texto, fecha prevista y origen «Manual». «Marcar como completado» ejecuta un `PATCH` acotado por `id`, `business_id` y `status=eq.pending`; guarda `completed_at` real y `completed_by` derivado de la sesión. El filtro evita replays y el bloqueo de UI evita el doble clic concurrente. Al confirmar, se refrescan Seguimientos, detalle e Inicio.

El detalle muestra por separado las tareas manuales y el historial automático. Completar una tarea no modifica el estado comercial de la solicitud.

## Actividad y fallo parcial

Tras crear se registra `manual_follow_up_created`; tras completar, `manual_follow_up_completed`. Ambas actividades son de tipo `user`, atribuidas al usuario autenticado y enlazadas al seguimiento mediante `metadata.follow_up_id`. La UI usa títulos permitidos y escapa el texto.

Las dos escrituras usan contratos RLS existentes, pero no forman una única transacción. Si el seguimiento queda persistido y falla únicamente Activity, la capa de datos devuelve un resultado parcial explícito: la UI vuelve a leer el backend y avisa de que la tarea cambió pero el historial no pudo registrarse. Nunca muestra falso error de guardado ni falso éxito total.

## Seguridad

- `activeBusiness` debe pertenecer a las membresías autenticadas antes de escribir.
- La FK compuesta impide asociar una tarea a una solicitud de otro negocio.
- RLS limita lectura, creación y actualización a owners/members activos.
- `assigned_to`, `completed_by` y `actor_user_id` proceden de `auth.uid()`/sesión, no del formulario.
- No hay `service_role`, secretos, `auth.users`, acceso a `email_jobs` ni policies `anon` en frontend.
- `?mode=local` no inicializa la capa real y conserva su navegación aislada.

## Tests

TDD: el test C18D-2 comenzó en rojo por ausencia de los contratos y controles. Un fallo posterior del test se rastreó a que incluía el `POST` de Auth entre las escrituras REST; se corrigió el selector de evidencia, no el producto.

Verificación dirigida:

```text
node --test tests/c10a-status-priority.test.js tests/c10b-follow-up-archive.test.js tests/c10c-internal-notes.test.js tests/c15a-follow-up-basic.test.js tests/c15b-follow-up-intelligent.test.js tests/c18c1-real-demo.test.js tests/c18c2-real-detail.test.js tests/c18c3-real-readings.test.js tests/c18d1-human-actions.test.js tests/c18d2-manual-followups.test.js tests/product-demo-shell.test.js tests/request-detail.test.js
96/96 OK
```

Se cubren alta autorizada, texto/fecha inválidos, request ajena, persistencia pendiente, finalización pending-only, `completed_at`, replay, Activity, distinción manual/C15, contador, error parcial, aislamiento local y ausencia de credenciales privilegiadas.

El smoke detectó que la lista usaba una sola tarea pendiente por solicitud y ocultaba las posteriores. Se añadió primero un test rojo y después una corrección mínima para representar todos los pendientes de una misma solicitud. Verificación final afectada:

```text
node --test tests/c18c3-real-readings.test.js tests/c18d1-human-actions.test.js tests/c18d2-manual-followups.test.js
26/26 OK
```

También pasaron `node --check` sobre los dos JavaScript implicados y `git diff --check`.

## Validación DEV y cierre

El usuario inició sesión manualmente con el owner DEV; Codex no pidió, leyó ni almacenó credenciales. En `Reformas Demo Dev` se usó únicamente `REF-010` y se creó un seguimiento con el texto «Llamar al cliente - prueba C18D-2» y fecha 14 oct 2026, 10:00.

Evidencia visual autenticada:

- la creación fue confirmada por el servidor y el contador pasó de 10 a 11 pendientes;
- tras recargar y volver a iniciar sesión, la tarea persistía como «Manual · Pendiente»;
- el detalle de `REF-010` mostraba la tarea separada del historial automático;
- «Marcar como completado» fue confirmado por backend y guardó la hora real;
- tras actualizar los datos desde el backend, el contador volvió a 10 y la tarea no reapareció entre pendientes;
- el detalle persistía como «Manual · Completado» y Activity mostraba tanto «Seguimiento manual creado» como «Seguimiento completado»;
- los hitos automáticos C15 de 24, 48 y 72 horas permanecieron intactos como historial, sin acciones de edición o finalización.

No se modificaron estado, prioridad, archivado, notas ni comunicaciones. No hay gaps de schema, RLS o arquitectura. **C18D-2 queda CERRADA y C18D GLOBAL queda CERRADA.** La siguiente fase es C19 — UX / POLISH, que no se ha iniciado.
