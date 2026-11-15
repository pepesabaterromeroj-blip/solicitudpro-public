# C10A — Estado y prioridad en Supabase DEV

Estado: funcionalidad, persistencia y ajuste responsive validados manualmente por el usuario con Owner Reformas Dev. **C10A finalizada.**

## Arquitectura e intervención

Se conserva la URL `dev/panel-product-readonly.html` para mantener los accesos existentes, aunque el panel de producto ahora permite guardar estado y prioridad. No se duplica lógica ni se renombra la familia de archivos. El panel técnico `dev/panel-supabase-readonly.html` permanece intacto y de solo lectura.

Se modifican seis archivos en total:

- `dev/panel-product-readonly.html`: textos que explican las escrituras reales en DEV.
- `dev/panel-product-readonly.js`: validación, PATCH autenticado, confirmación y sincronización visual.
- `dev/panel-product-readonly.css`: controles del editor en una columna adaptable.
- `tests/panel-product-readonly.test.js`: conserva controles de seguridad y respaldo técnico; adapta la antigua restricción de solo lectura del panel de producto.
- `tests/c10a-status-priority.test.js`: seis pruebas específicas sobre el código real con DOM y red sustituidos.
- Este documento.

No se modifica la demo principal ni el resultado histórico de C9A. No se realiza commit ni push.

## Escritura y valores reales

Único destino: `solicitudpro-app-dev`, referencia `rinrgjancwvcvpzjyqmu`.

La inspección del esquema remoto confirmó los estados `Nuevo`, `En preparación`, `Enviado`, `Seguimiento pendiente`, `Ganado` y `Perdido`; prioridad admite `null`, `1`, `2` y `3` (sin prioridad, alta, media y baja). Se reutilizan esos valores sin crear enums ni estados.

El formulario envía PATCH a `rest/v1/requests`, filtrado por ID y negocio, con el token de la sesión en memoria y la clave publicable existente. `Prefer: return=representation` exige recibir exactamente una fila que coincida con ID, negocio, estado y prioridad enviados. La lista, detalle, métricas y filtros se actualizan después de esa confirmación, nunca de forma optimista. Una respuesta vacía por RLS se trata como guardado no confirmado.

Por la restricción existente de cierre, cambiar estado también ajusta `won_at` y `lost_at`: Ganado requiere fecha de ganado, Perdido fecha de perdido y los demás estados ambas fechas nulas. Un cambio exclusivo de prioridad no modifica esas fechas. No se escriben otros campos ni se generan actividades o seguimientos.

Se bloquean guardados simultáneos y el solapamiento con Actualizar. Las respuestas tardías de otra sesión se descartan. Los errores muestran un mensaje genérico y conservan la última lectura confirmada. Si la red falla después de que el servidor haya aplicado una escritura, debe actualizarse la lectura antes de reintentar: un fallo de respuesta no demuestra que la transacción no se guardara.

## Auth y RLS

Se inspeccionaron las policies reales y RLS está habilitada. La policy existente `owners and members can update requests`, dirigida a `authenticated`, comprueba tanto en USING como en WITH CHECK una pertenencia activa al negocio de la solicitud, con `user_id = auth.uid()` y rol owner o member. SELECT también exige pertenencia activa.

No se añadieron ni aplicaron migrations, policies o cambios de Auth. El filtro del frontend no sustituye la protección RLS. Se mantienen los permisos existentes para owner/member; esta fase no endurece permisos por columna de la API: la limitación a estado/prioridad es la del editor implementado, mientras RLS protege el negocio autorizado.

No se consulta directamente `auth.users`. No se introduce ninguna clave privilegiada, contraseña ni token persistente. La clave publicable no es un secreto. El código del panel no utiliza localStorage ni sessionStorage para la sesión. Cerrar sesión descarta el token local; no añade revocación remota del token ya emitido.

## Pruebas ejecutadas y resultados

- `node --test tests/*.js`: **66 pruebas, 66 correctas, 0 fallos** tras el ajuste responsive.
- `node --check` en los tres JS modificados o nuevos: panel de producto y ambos archivos de tests; sin errores.
- `git diff --check`: sin errores.
- Ciclo TDD: las pruebas iniciales fallaron por ausencia de las funciones; después pasaron. La prueba añadida de solapamiento falló antes de incorporar el bloqueo y pasó después.
- Tests C10A: valores y fechas de cierre; PATCH autenticado y acotado; rechazo de respuesta vacía/negocio incorrecto; descarte tras logout; ausencia de actualización optimista y sincronización de métricas/filtros; error seguro; bloqueo durante una lectura.
- En la base DEV real, dentro de transacciones con `SET LOCAL ROLE authenticated` y contexto `auth.uid()` de owners ficticios: Reformas pudo actualizar REF-DEV-001; Academias pudo actualizar ACA-DEV-001. En ambos sentidos, UPDATE sobre la solicitud del otro negocio afectó **cero filas**. Valores inválidos de estado y prioridad provocaron violación de CHECK.
- Todas esas transacciones de prueba terminaron en **ROLLBACK**, sin dejar cambios de datos. Son pruebas reales de RLS en PostgreSQL, no pruebas de login en navegador ni evidencia de persistencia tras recargar.

## Validación manual comunicada por el usuario

El usuario confirma la validación manual autenticada con Owner Reformas Dev en Supabase DEV:

- responsive correcto en escritorio, tablet y móvil;
- “Ver detalle” abre y cierra correctamente en pantallas estrechas;
- cambio de estado correcto;
- cambio de prioridad correcto;
- los cambios persisten tras “Actualizar lectura”;
- los cambios persisten tras cerrar sesión y volver a iniciar sesión;
- no se detectan regresiones visibles.

Esta confirmación procede del usuario y cubre la comprobación visual y funcional solicitada; no se atribuye a una repetición automatizada de toda la lista manual.

## Ajuste responsive del detalle — 8 de septiembre de 2026

Se reprodujo el problema en la sesión abierta de Academias, con ACA-012. En escritorio (1440 × 900) el detalle aparecía en la columna lateral. A 390 × 844, la regla de hasta 1040 px lo convertía en un bloque estático al final del listado: su borde superior quedaba a 5350 px del viewport. Abría, pero fuera de la zona visible.

Corrección exclusivamente de presentación:

- Escritorio conserva el panel lateral sticky.
- Hasta 1040 px, el detalle es un panel fijo con 12 px de margen y altura basada en el viewport dinámico (`dvh`, con respaldo `vh`).
- Cabecera sticky con fondo opaco: el cierre permanece visible al desplazar el contenido.
- Scroll interno, contención del desplazamiento y bloqueo del scroll de fondo mientras está abierto en pantalla estrecha.
- Ajuste de palabras largas para evitar desbordamiento horizontal y espacio inferior para que el mensaje de guardado no impida alcanzar el final.

Solo se cambian CSS, la prueba de regresión de presentación y este documento durante este ajuste. HTML y JS funcional no se modifican. No se alteran Auth, RLS, SQL, políticas ni la lógica de guardado. Los textos visibles se conservan.

Las 66 pruebas pasan, incluida una nueva regresión de CSS. Se recargó el panel para obtener los estilos nuevos y volvió al login, confirmando que la sesión no persiste tras recargar. La validación visual autenticada posterior queda registrada en la sección siguiente.

## Validación final — 9 de septiembre de 2026

Se verificó que la copia de Windows sigue en `main`, sin cambios locales, y que el panel local abre desde `dev/panel-product-readonly.html`. Las reglas responsive permanecen presentes en `css/style.css`, incluyendo los breakpoints de escritorio, tablet y móvil, el panel de detalle fijo en pantallas estrechas, cabecera sticky, scroll interno y contención del desbordamiento horizontal.

Pruebas ejecutadas en esta sesión:

- `node --test tests/c10a-status-priority.test.js tests/panel-product-readonly.test.js tests/request-detail.test.js`: **14 pruebas, 14 correctas, 0 fallos**.
- `node --check dev/panel-product-readonly.js`: sin errores.
- `git diff --check`: sin errores.

La validación manual autenticada comunicada por el usuario cubre escritorio, tablet y móvil; apertura y cierre de “Ver detalle”; detalle dentro del viewport, scroll correcto y ausencia de desbordamiento horizontal; cambios de estado y prioridad; persistencia tras “Actualizar lectura” y tras cerrar sesión y volver a iniciar sesión; y ausencia de regresiones visibles. No se modificaron SQL, RLS, Supabase, la demo principal, landing, producción ni C10B.

## Límites y cierre

La validación funcional y visual de C10A está completa. No quedan pendientes reales de esta fase. No se solicitan ni almacenan contraseñas en chat, código, tests o documentación.

No se incorpora bloqueo optimista por versión para ediciones simultáneas desde dos dispositivos. Se conserva el comportamiento existente del resto del panel y sus lecturas.

C10B no se ha iniciado. No hay notas internas, archivado, edición de cliente, emails, Gmail, OpenAI, n8n, Storage, nuevos sectores ni cambios en landing o producción.

La fase queda cerrada tras registrar la validación manual autenticada comunicada por el usuario y confirmar las verificaciones automatizadas.
