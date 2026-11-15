# Resultado C19A+B · Detalle compacto y responsive

Fecha: 2026-10-13
Rama: `c19ab-detail-responsive`
Estado: **FINALIZADA / PENDIENTE DE REVISIÓN HUMANA Y COMMIT**.

## Problema y decisiones UX

El detalle real mantenía toda la información necesaria, pero la distribuía en una secuencia vertical de tarjetas altas, con espacio horizontal desaprovechado y aproximadamente cuatro recorridos de pantalla. C19A+B conserva la información y las acciones C18D, pero reorganiza la lectura con una cabecera compacta y grids explícitos:

- Solicitud y Contacto comparten la zona principal; Gestión ocupa una columna compacta.
- Resumen interno y Respuesta sugerida se leen en paralelo cuando hay anchura suficiente. La respuesta continúa identificada como borrador no enviado.
- Notas internas y Seguimiento comparten fila en escritorio y se apilan en móvil.
- Actividad ocupa la columna principal; Comunicaciones y Adjuntos forman una columna auxiliar con estados vacíos pequeños.
- El ancho útil del detalle aumenta de forma limitada para aprovechar monitores grandes sin alargar en exceso los textos.

No se eliminó contenido, no se cambió ningún contrato ni se añadió una acción de producto.

## Navegación estable del detalle local

Se reprodujo el salto Seguimiento → Actividad. La causa era doble: al ocultar el panel activo se contraía la altura del contenedor y, en el último paso, desaparecía el botón enfocado. El navegador ajustaba el scroll al nuevo máximo y el foco caía fuera de la navegación.

La corrección es estructural, sin temporizadores ni scroll hardcodeado:

- los cinco paneles ocupan la misma celda de un grid y los inactivos conservan su geometría con `visibility: hidden`;
- `aria-hidden` mantiene una exposición accesible coherente;
- el foco pasa a la pestaña Actividad con `preventScroll` antes de ocultar el botón siguiente;
- los controles Anterior/Siguiente conservan una altura estable, también en móvil.

En 390 y 1536 px se comprobó que documento, panel y barra de controles mantienen exactamente la misma altura antes y después de Seguimiento ↔ Actividad. La repetición no produce un segundo comportamiento distinto.

## Responsive y validación visual

Validación manual en navegador interno al 100 % de zoom (`devicePixelRatio = 1`):

- 1366 × 768: detalle en dos columnas, controles legibles y sin overflow horizontal.
- 1536 × 864: navegación estable desde el primer clic y sin cambio de altura.
- 1920 × 1080: uso ampliado del espacio con ancho de lectura controlado.
- 768 × 1024: columnas útiles donde caben y apilado progresivo sin desbordamiento.
- 390 × 844: una sola columna, tabs con desplazamiento horizontal propio y documento sin overflow horizontal.

El detalle local queda en torno a 1318 px de alto a 1366 × 768, aproximadamente 1,7 viewports, frente al recorrido manual anterior de varios scrolls. La ruta real autenticada no se abrió durante esta validación para no solicitar credenciales; el render real se verificó mediante sus tests y el modo real sin sesión mantuvo la pantalla `SolicitudPro · Supabase DEV` sin mostrar el badge local.

## Modos y funcionalidad preservada

- `?mode=local` mantiene visible `Datos ficticios locales` y su aviso de datos de ejemplo.
- El modo real oculta ese badge y conserva su identificación Supabase DEV.
- Navegación, estado, prioridad, archivar/restaurar, notas, seguimientos, adjuntos y comunicaciones conservan sus selectores y contratos.
- No se añadieron envíos, edición/aprobación de respuesta ni acciones C19D.

## Botón histórico para C19D

`Copiar respuesta` sigue existiendo en la demo local: en la navegación lateral de `index.html` y en el detalle local generado por `js/request-detail.js`, con copia mediante `navigator.clipboard` en `js/script.js`. No existe en el detalle real reorganizado y no se ha implementado en C19A+B. Se reserva para C19D.

## Tests y verificaciones

TDD: el test C19A+B comenzó en rojo por ausencia de la jerarquía compacta y del contenedor estable. La validación móvil añadió una regresión específica para que el control oculto conserve geometría.

```text
node --test tests/c19ab-detail-responsive.test.js tests/request-detail.test.js tests/product-demo-shell.test.js tests/c18c1-real-demo.test.js tests/c18c2-real-detail.test.js tests/c18c3-real-readings.test.js tests/c18d1-human-actions.test.js tests/c18d2-manual-followups.test.js
72/72 OK
```

Un fallo dirigido detectó que la clase visual `real-detail-support-stack` incluía el término técnico `stack` en el HTML. Se renombró a `real-detail-support-column`; la repetición completa quedó en 72/72.

También se verifican `node --check` sobre los JavaScript modificados, el validador local de evaluaciones y `git diff --check` en el cierre. No se modificaron backend, Supabase, datos reales ni modo local.

## Deuda posterior

C19D debe valorar la acción real `Copiar respuesta sugerida` y otras microacciones. No se inició C19C ni C19D.
