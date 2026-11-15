# C10C — Notas internas simples en Supabase DEV

Estado: C10C finalizada tras validación automática y manual autenticada.

## Arquitectura

Se reutiliza `public.activities`, sin crear tablas ni campos. Cada nota se guarda como una actividad con `type: internal_note`, `title: Nota interna`, texto en `detail`, fecha real de servidor en `created_at` y el usuario autenticado en `actor_user_id`.

La nota se relaciona con la solicitud y el negocio mediante `request_id` y `business_id`. El identificador del usuario se obtiene del `sub` del token de sesión en memoria y la policy existente de inserción exige que coincida con `auth.uid()`. La policy existente de lectura limita las actividades al negocio del miembro activo. No se ha cambiado schema, SQL, Auth, RLS ni policies.

## Interfaz y persistencia

El detalle incluye el bloque “Notas internas”, con el aviso “Solo visible para tu equipo.”, textarea breve y el botón “Añadir nota”. El historial se carga en orden descendente por `created_at`. Cada entrada muestra su texto, la fecha y hora confirmada por el servidor y el autor: el email de la sesión para la nota propia o un identificador breve de usuario para otro miembro del equipo.

La interfaz no añade una nota de forma optimista: solo la muestra tras recibir exactamente una fila confirmada de Supabase. El detalle normaliza siempre su historial de notas y, tras el éxito, integra la fila confirmada en el detalle ya abierto y limpia el textarea. Ante un fallo conserva la última lectura confirmada, no añade una nota falsa y muestra un mensaje seguro. Las notas se consultan en un bloque independiente y no se mezclan con la actividad general.

Cada nota del historial tiene un recuadro verde suave, texto principal visible y fecha/hora con autor en segundo nivel. Se conserva el aviso “Solo visible para tu equipo.” y el diseño responde al ancho disponible sin crear una interfaz de chat.

## Archivos modificados

- `dev/panel-product-readonly.js`
- `dev/panel-product-readonly.css`
- `tests/c10c-internal-notes.test.js`
- Este documento.

## Pruebas automáticas

- Obtención segura del identificador de usuario desde el token de sesión.
- Inserción `POST` confirmada de una actividad interna, acotada por solicitud, negocio y usuario autenticado.
- Rechazo de una nota vacía antes de cualquier petición de red.
- Renderizado de las notas como historial interno separado de la actividad general.
- Integración inmediata de una nota confirmada en un detalle que ya estaba abierto, incluso si se cargó sin historial de notas.
- `node --test tests/*.js`: **76 pruebas correctas, 0 fallos**.
- `node --check dev/panel-product-readonly.js`: sin errores.
- `git diff --check`: sin errores.

## Validación manual

Owner Reformas confirmó que la nota aparece inmediatamente tras guardarla, persiste al recargar y después de cerrar sesión y volver a iniciar sesión. Otro owner solo ve sus propias solicitudes y notas; no se detectó acceso cruzado. También se validaron responsive en escritorio, tablet y móvil, además del funcionamiento existente de estado/prioridad, seguimiento y archivado, sin regresiones visibles.

La validación confirmó que los errores de escritura no dejan notas falsas y que el textarea se limpia únicamente después de una respuesta correcta del servidor.

## Límites

No se implementan edición ni borrado de notas, menciones, adjuntos, formato enriquecido ni tiempo real. C11 no se ha iniciado, ni ninguna integración de email, Gmail, OpenAI, n8n o Storage.
