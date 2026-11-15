# C10B — Seguimiento y archivado en Supabase DEV

Estado: funcionalidad validada manualmente por el usuario y pruebas automatizadas correctas. **C10B finalizada.**

## Arquitectura

El panel de producto conserva `dev/panel-product-readonly.html` como acceso existente. Reutiliza las estructuras reales del proyecto DEV `rinrgjancwvcvpzjyqmu`:

- `public.follow_ups`: los seguimientos con estado `pending` se pueden completar mediante `PATCH` confirmado por el servidor, que escribe únicamente `status: completed` y `completed_at`.
- `public.requests.archived_at`: archivar escribe una fecha mediante `PATCH`; no se usa `DELETE`. Las solicitudes archivadas se conservan y se consultan mediante el filtro Archivado.

Las peticiones de escritura incluyen ID de registro y `business_id`, token de sesión en memoria, clave publicable y `Prefer: return=representation`. La interfaz cambia solo después de recibir exactamente una fila confirmada del negocio y registro esperados. Ante fallo conserva la última lectura confirmada y muestra un error seguro.

## Interfaz

El filtro Archivado muestra Activas de forma predeterminada y permite consultar Archivadas o Todas. Las archivadas llevan una etiqueta visible y continúan accesibles en listado y detalle. El detalle ofrece “Marcar como completado” solo para seguimientos pendientes y “Archivar solicitud” solo si aún no está archivada. Archivar solicita confirmación, explica que no elimina datos y aclara que la solicitud seguirá disponible en “Archivadas”.

Las métricas, el listado y los filtros se recalculan con la vista seleccionada. El ajuste responsive mantiene una rejilla de filtros de dos columnas en anchos intermedios y una columna en móvil; no se modifica la solución responsive del detalle de C10A.

El seguimiento muestra siempre dos momentos distintos: “Fecha prevista” usa `due_at`; una vez completado, “Completado el” usa exclusivamente `completed_at` devuelto por el servidor. Así la hora mostrada corresponde a la acción real y se conserva al recargar el detalle. La etiqueta Archivada utiliza la paleta ámbar del producto y conserva su visibilidad en todas las vistas responsive.

## Seguridad y datos

No se modifican schema, SQL, migraciones, Auth ni policies. Se reutilizan las policies RLS existentes de lectura y actualización para owner/member del negocio autenticado en `requests` y `follow_ups`. No se incluyen secretos, contraseñas, `service_role`, almacenamiento persistente de sesión ni borrado físico.

## Archivos modificados

- `dev/panel-product-readonly.html`
- `dev/panel-product-readonly.js`
- `dev/panel-product-readonly.css`
- `tests/c10b-follow-up-archive.test.js`
- `tests/panel-product-readonly.test.js`
- Este documento.

## Pruebas automatizadas

- Test C10B de seguimiento pendiente, `PATCH` confirmado y acotado.
- Test C10B de archivado mediante `PATCH`, sin `DELETE`, y respuesta confirmada.
- Test C10B de filtros Activas, Archivadas y Todas.
- Test C10B que separa la fecha prevista de la fecha real de completado confirmada.
- Test C10B del estilo ámbar de Archivada.
- `node --test tests/*.js`: **69 pruebas, 69 correctas, 0 fallos**.
- `node --check dev/panel-product-readonly.js`: sin errores.
- `git diff --check`: sin errores.

## Validación manual

El usuario confirma que C10B está funcionalmente validada. La validación autenticada cubre completar seguimiento y persistir tras recargar, archivar sin borrar y persistir tras recargar, filtros Activas/Archivadas/Todas, coherencia de listado y detalle, aislamiento por negocio, logout, responsive y la regresión de estado/prioridad de C10A. El pulido final conserva esa escritura real y muestra la hora `completed_at` confirmada sin sustituirla por `due_at`.

## Límites

No se inicia C10C: no hay notas internas. Tampoco se implementan desarchivado, emails, Gmail, OpenAI, n8n, Storage, adjuntos, edición libre de cliente/formulario, nuevos sectores, landing ni producción.
