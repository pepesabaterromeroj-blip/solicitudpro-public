# Resultado C19C+D · Polish UX global y microacciones

Fecha: 2026-10-22

Rama: `c19ab-detail-responsive`

Runtime solicitado: GPT-5.6 Sol / Medium. Runtime real: **NO VERIFICADO**.
Estado: **CERRADA TÉCNICAMENTE; REVISIÓN HUMANA: PASS; C19 GLOBAL EN CIERRE DE INTEGRACIÓN**.

## Problema y alcance

C19C+D completa el recorrido visual global y corrige tres defectos concretos sin cambiar contratos, backend ni datos: el fallback de copia podía informar éxito cuando `execCommand('copy')` devolvía `false`, el listado real mostraba prioridades numéricas y las solicitudes archivadas no se distinguían visualmente. Durante el smoke se detectó además que el foco del detalle local anulaba el reset de scroll; se corrigió en el mismo alcance UX.

La revisión humana posterior pidió un último ajuste acotado en Seguimientos: separar `Pendientes`, `Contactados` y `Todos`, dejar pendientes como vista inicial y permitir deshacer el contacto. La primera iteración limitó la reversión a la demo local; el cierre C19 añadió después el contrato real seguro mediante una RPC `SECURITY INVOKER`, sin convertir el frontend en fuente de verdad.

## Cambios

- `js/real-product.js`: copia fiable con resultado booleano, limpieza garantizada del `textarea`, feedback honesto, reutilización de `priorityLabel` y badge `Archivada` basado en `archived_at`.
- `js/script.js`: foco del detalle local con `preventScroll`, conservando `scrollY = 0` al abrirlo.
- `index.html`: selector de estado de Seguimientos con las tres vistas aprobadas.
- `js/request-detail.js` y `js/script.js`: transición local reversible, restauración del seguimiento anterior y representación `✓ Contactado` sin CTA duplicada.
- `js/real-product.js`: filtrado real sobre estados existentes, con acción de completar solo para registros pendientes y `Desmarcar` únicamente para seguimientos manuales elegibles.
- `css/style.css`: estilos de filtros y estado contactado, además del tratamiento secundario de archivadas.
- `tests/c19cd-ux-polish.test.js`: regresiones para clipboard, prioridades, archivado, scroll, filtros y reversión local.

El cierre posterior añadió exclusivamente el contrato backend de reapertura documentado en el resultado global C19. No se añadieron envíos, automatizaciones ni funcionalidades de C20.

## Defectos corregidos

1. **Copiar respuesta:** se copia exactamente el borrador. `Copiada` solo aparece tras éxito; un `false` o excepción muestra `No se pudo copiar.`. El nodo temporal se elimina también cuando hay error.
2. **Prioridad:** `1/2/3` se muestran como `Alta/Media/Baja`; nulos y valores desconocidos como `Sin prioridad`.
3. **Archivadas:** `archived_at` añade la etiqueta `Archivada` y un estilo secundario sin ocultar la solicitud ni alterar filtros o navegación.
4. **Scroll del detalle local:** el foco ya no desplaza la cabecera después de cambiar de vista.
5. **Seguimientos:** pendientes, contactados y todos quedan separados; el CTA desaparece al completar. En local, `Desmarcar` restaura la fecha y acción anteriores. En real, la RPC protegida restaura `pending`, limpia campos de completado, conserva texto/fecha/asignación y registra `Seguimiento reabierto`.
6. **Origen real del seguimiento:** una tarea C15 asignada ya no se etiqueta erróneamente como `Manual`; solo es manual si tiene asignación, `cadence_hours` nulo y canal `internal`.
7. **Casos límite revisados:** los estados `cancelled/skipped` no se presentan como pendientes; el contexto automático se conserva tras tareas completadas; las solicitudes cerradas no ofrecen CTA de contacto; y `Desmarcar` no sobrescribe un seguimiento recalculado después del contacto.

## Tests y comprobaciones

TDD confirmado: las nuevas pruebas fallaron primero por las funciones/ramas ausentes y quedaron verdes tras los cambios mínimos.

```text
node --test tests/c19ab-detail-responsive.test.js tests/c19cd-ux-polish.test.js
node --test tests/c18d1-human-actions.test.js tests/c18d2-manual-followups.test.js
node --check js/real-product.js
node --check js/request-detail.js
node --check js/script.js
node evals/codex-prompts/validar.mjs
node --test evals/codex-prompts/validar.test.mjs
git diff --check
```

Resultados del cierre:

- C19A+B + C19C+D: **23/23**.
- Regresión C18D: **16/16**.
- Validador de evaluaciones: **2/2** y validación estructural correcta.
- Sintaxis de los tres JavaScript comprobados: correcta.
- `git diff --check`: correcto.
- Suite global contemporánea de la rama: **253/253**.
- `sector-presets`: corregido como test histórico obsoleto para el contrato explícito `?mode=local`.

Los gates dirigidos de C19 y C18D y la suite global quedan verdes.

## Validación visual local

Servidor estático local del worktree aislado, siempre con `?mode=local`, zoom 100 % y datos ficticios:

- recorrido Inicio → Solicitudes → Detalle → Resumen → Respuesta → Seguimiento → Actividad → Solicitudes → Seguimientos → Contactos → Inicio;
- copia local con feedback `Copiada`;
- estado vacío del listado mediante búsqueda sin coincidencias;
- reset de scroll confirmado al cambiar de vista y estabilidad Seguimiento → Actividad;
- prioridades y archivada comprobadas con una previsualización efímera que usa directamente `renderRequestRows`, sin crear fixtures ni archivos;
- 390 × 844, 768 × 1024, 1366 × 768, 1536 × 864 y 1920 × 1080: sin overflow horizontal del documento, acciones esenciales accesibles y detalle legible. En móvil, las pestañas conservan su scroll horizontal propio.

### Revisión humana y último smoke

- Revisión humana del resultado: **PASS con el ajuste de Seguimientos incorporado**.
- A 390 px se verificaron filtros, contacto, estado visual, `Desmarcar`, restauración, detalle y navegación hasta Contactos e Inicio, sin overflow del documento.
- A 1366 y 1536 px se verificaron jerarquía, filtros, tarjetas y acciones sin overflow.
- La aparente discrepancia tras recargar en móvil no era pérdida de estado: la aplicación vuelve a `Inicio` por diseño. Al abrir de nuevo Seguimientos, el contacto persistía correctamente; tras `Desmarcar`, se recuperaron la fecha y la acción previas. No requirió corrección funcional.

## Validación real DEV de cierre

El 24/10/2026 se completó el smoke autenticado con el owner ficticio de Reformas sobre Supabase DEV:

- carga real del negocio y 11 solicitudes, sin mezcla con fixtures locales;
- creación de un seguimiento manual, completar, persistir tras recarga, aparecer en `Contactados` con `✓ Contactado` y desaparecer su CTA;
- `Desmarcar` real mediante RPC, retorno a `pending`, campos `completed_at`/`completed_by` nulos, texto/fecha/asignación conservados y Activity `Seguimiento reabierto`;
- denegación comprobada para otro tenant, tarea C15, solicitud archivada, solicitud cerrada y replay sobre una fila ya pendiente;
- recorrido mínimo con detalle, estado/prioridad, nota, respuesta sugerida/copia, Seguimientos, Contactos e Inicio.

Una tarea C15 usada inicialmente para comprobar la protección quedó completada en DEV; no se reabrió ni se borró porque el contrato la excluye correctamente. El seguimiento manual de smoke quedó finalmente pendiente y conserva su trazabilidad de Activity.

## Modos y limitaciones

- El modo local permanece identificado como datos ficticios y no mezcla datos reales.
- El modo real se validó contra Supabase DEV con Auth y RLS; no se almacenaron credenciales ni se introdujeron secretos.
- C19C+D queda cerrada técnicamente y con revisión humana PASS. El cierre global depende todavía del gate posterior a integrar la rama en `main`.
