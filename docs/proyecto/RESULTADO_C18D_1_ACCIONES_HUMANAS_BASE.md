# Resultado C18D-1 · Acciones humanas base

Fecha: 2026-10-07
Rama: `c18d-1-human-actions`
Estado: **CERRADA**.

## Alcance implementado

- Cambio de estado con los seis valores reales de `requests_status_check`.
- Cambio de prioridad con `null`, 1, 2 o 3.
- Archivado y restauración simétrica mediante `requests.archived_at`; nunca `DELETE`.
- Finalización de un `follow_up` pendiente, con fecha real y usuario autenticado.
- Alta de nota interna como actividad `internal_note`, solo visible para el equipo.

No se ha iniciado seguimiento manual, registro de contactos, edición/aprobación/envío de respuesta, regeneración de enrichment ni retry de comunicaciones.

## Arquitectura y contratos reutilizados

La UI de `js/real-product.js` llama exclusivamente a `js/data/product-data.js`. La capa de datos reutiliza los contratos REST ya probados por C10:

- `PATCH requests` acotado por `id` y `business_id`, con `Prefer: return=representation`;
- `PATCH follow_ups` acotado además por `status=eq.pending`;
- `POST activities` con `actor_type=user` y `actor_user_id` derivado de la sesión;
- confirmación estricta de una única fila devuelta antes de refrescar la UI.

Las escrituras comprueban primero el `activeBusiness` contra las membresías cargadas. PostgreSQL RLS y las claves foráneas compuestas siguen siendo la autoridad. No hay schema, migraciones, RPC, policies ni secretos nuevos.

Restaurar reutiliza el mismo contrato seguro de archivado escribiendo `archived_at = null`. Estado, prioridad y archivado no generan hoy una actividad específica: se conserva el comportamiento C10 y se registra como deuda no bloqueante, sin inventar infraestructura.

## UI y errores

El detalle real incorpora controles mínimos de gestión y nota interna. Seguimientos permite completar únicamente filas pendientes. Durante una escritura el control queda deshabilitado; no hay éxito optimista. Tras confirmación del servidor se recargan solicitudes, detalle, métricas y seguimientos autorizados. Los errores son humanos y no muestran respuestas SQL.

La nota se recorta, exige contenido y limita la UX a 2.000 caracteres; el texto se renderiza escapado. No existe edición ni borrado. `?mode=local` conserva la simulación existente y no inicializa `real-product.js`.

## Tests

TDD: `tests/c18d1-human-actions.test.js` falló inicialmente por ausencia de los cuatro contratos, controles y coordinador; pasó tras la implementación.

Verificación dirigida ejecutada:

```text
node --test tests/c10a-status-priority.test.js tests/c10b-follow-up-archive.test.js tests/c10c-internal-notes.test.js tests/c18c1-real-demo.test.js tests/c18c2-real-detail.test.js tests/c18c3-real-readings.test.js tests/c18d1-human-actions.test.js
53/53 OK
```

También pasaron `node --check` para `js/data/product-data.js`, `js/real-product.js` y el test C18D-1.

## Smoke

- HTTP local real sin sesión: correcto; muestra únicamente el acceso y no datos.
- `?mode=local`: correcto y aislado.
- Supabase DEV autenticado: **validación manual reportada por el usuario** con la solicitud `REF-010` de Reformas Demo Dev.
- Estado: cambiado a `Ganado`, confirmado por backend y persistente al volver a entrar.
- Prioridad: cambiada a `Media`, confirmada por backend y persistente al volver a entrar.
- Archivado/restauración: archivado tras confirmación explícita; restaurado después con el mensaje «Solicitud restaurada» y disponible nuevamente.
- Nota interna: se añadió `Prueba 1`; quedó visible con fecha 07 oct 2026 y persistió al salir y volver a entrar.
- Comportamiento general: no hubo falso éxito; los cambios aparecieron tras la confirmación del backend y la navegación/detalle continuaron funcionando.

Completar seguimiento manual fue **NO APLICABLE** en el smoke porque el negocio mostraba `0 seguimientos pendientes`. Los eventos «Seguimiento automático · 24 h», «48 h» y «72 h» son historial automático C15: no son tareas editables ni deben completarse manualmente. El contrato de completar un `follow_up` pendiente permanece cubierto por los tests dirigidos.

## Cierre, alcance futuro y deuda UX

- No quedan incidencias bloqueantes conocidas para C18D-1.
- Gap no bloqueante: no hay actividad específica para cambios de estado/prioridad/archivado.
- C18D-2 deberá estudiar el seguimiento manual: crear seguimiento, fecha, motivo/tarea, estado pendiente, acción «Marcar como completado» y registro de finalización en actividad. No debe confundirse con los hitos históricos automáticos C15.
- Deuda C19: compactar el detalle, actualmente demasiado largo; aprovechar mejor el espacio en Solicitud/Contacto sin eliminar información; priorizar rapidez para usuarios poco técnicos; añadir «Copiar respuesta sugerida»; revisar escala y responsive en pantallas usadas por debajo del 100 % de zoom.
- C18D-2, C19 y las acciones de alto impacto no se han iniciado.
