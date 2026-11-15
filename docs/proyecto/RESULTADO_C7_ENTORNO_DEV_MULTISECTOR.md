# Resultado C7: entorno dev multisector

## Objetivo

Completar el entorno de desarrollo de SolicitudPro para que Reformas, Electricidad, Fontanería y Academias tengan un negocio dev, formulario publicado, owner ficticio y lectura aislada mediante RLS en el panel de solo lectura.

## Proyecto y alcance

- Proyecto usado: `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`).
- No se ha usado ni modificado el proyecto de la landing.
- No se ha tocado la landing ni la demo principal.
- El panel sigue aislado en `dev/panel-supabase-readonly.html` y sigue siendo solo lectura.

## Estado inicial

| Sector | Situación encontrada |
| --- | --- |
| Reformas | Negocio, owner, formulario, solicitudes y panel ya operativos. |
| Electricidad | Negocio, formulario y `ELE-001` existentes; faltaba owner interno. |
| Fontanería | Sector existente; faltaban negocio, formulario, owner y datos de prueba. |
| Academias | Negocio, owner, formulario, solicitudes y panel ya operativos. |

## Cambios aplicados

- Se usaron los dos usuarios ficticios creados manualmente en Auth para Electricidad y Fontanería. No se modificó `auth.users` por SQL.
- Se crearon sus perfiles y sus membresías `owner` activas, una por negocio.
- Se creó de forma idempotente `Fontanería Demo Dev` con slug `fontaneria-demo-dev`.
- Se creó su formulario publicado `solicitud`, con los campos `tipo_incidencia`, `agua_activa_urgencia`, `zona` y `descripcion`.
- Se añadió `FON-001`, con un contacto ficticio, cuatro respuestas dinámicas, un seguimiento pendiente y una actividad inicial.
- Se ejecutó el seed C7 dos veces para confirmar que no duplica esos datos.

## Entorno final por sector

| Sector | Negocio / slug | Formulario / slug | Campos activos | Solicitudes |
| --- | --- | --- | --- | --- |
| Reformas | Reformas Demo Dev / `reformas-demo-dev` | Solicitud de reforma / `solicitud` | `tipo_reforma`, `zona`, `descripcion`, `plazo` | 5 |
| Electricidad | Electricidad Demo Dev / `electricidad-demo-dev` | Solicitud eléctrica / `solicitud` | `tipo_trabajo`, `riesgo_urgencia`, `zona`, `descripcion` | 1 (`ELE-001`) |
| Fontanería | Fontanería Demo Dev / `fontaneria-demo-dev` | Solicitud de fontanería / `solicitud` | `tipo_incidencia`, `agua_activa_urgencia`, `zona`, `descripcion` | 1 (`FON-001`) |
| Academias | Academia Demo Dev / `academia-demo-dev` | Clases / `clases` | `materia`, `disponibilidad` | 13 |

Los cuatro owners ficticios tienen una única membresía activa como `owner` en su negocio correspondiente. Las contraseñas no se han guardado ni documentado.

## Panel, login y detalle

El panel dev se prueba en `http://localhost:3000/panel-supabase-readonly.html`.

- Reformas y Academias conservaron las validaciones manuales de C4/C5: listado y detalle correctos mediante RLS.
- Electricidad: login manual validado; `ELE-001` y su detalle cargaron con cabecera, contacto, resumen, seguimiento y estado de solo lectura.
- Fontanería: login manual validado; `FON-001` y su detalle cargaron con cabecera, contacto, resumen, urgencia, siguiente acción, seguimiento y estado de solo lectura.
- No aparecen acciones para editar, guardar, borrar, cambiar estado, prioridad, archivar ni enviar correos.

## Aislamiento y RLS

Se validó RLS con contexto autenticado para los cuatro owners:

- Owner Reformas: ve 5 solicitudes propias y 0 de Electricidad y Fontanería.
- Owner Electricidad: ve 1 solicitud propia y 0 de Reformas.
- Owner Fontanería: ve 1 solicitud propia y 0 de Reformas.
- Owner Academia: ve 13 solicitudes propias y 0 de Reformas.

Estas comprobaciones cubren las pruebas negativas solicitadas: Reformas frente a Electricidad/Fontanería, Electricidad frente a Reformas, Fontanería frente a Reformas y Academias frente a Reformas. La consulta de detalle no autorizado queda resuelta por la interfaz con el mensaje seguro: `Solicitud no disponible o no permitida.`

La revisión final encontró 0 cruces de `business_id` entre respuestas, seguimientos, actividades y campos de formulario. RLS permanece habilitada en las tablas operativas revisadas y no hay políticas `anon` en ellas.

## Seguridad

- No se expuso `service_role`, secretos, tokens ni contraseñas.
- No se guardaron contraseñas en HTML, JavaScript, tests, Markdown, `localStorage` ni `sessionStorage`.
- El panel hace únicamente lecturas de datos operativos; el único `POST` es el login de Supabase Auth.
- No se realizaron acciones desde el panel ni se conectaron emails, n8n, OpenAI o Storage.
- Solo se usaron datos ficticios de desarrollo, incluidos los correos `.test`.

## Archivos

- Creado: `docs/proyecto/sql/008_c7_dev_multisector_panel.sql`.
- Creado: `tests/c7-multisector-seed.test.js`.
- Modificado: `dev/panel-supabase-readonly.html` para ofrecer los cuatro owners ficticios, sin credenciales.
- Creado: este documento.

## Comprobaciones ejecutadas

- Seed C7 aplicado dos veces en `solicitudpro-app-dev`.
- Auditoría de negocios, formularios, campos, membresías, solicitudes y relaciones hijas.
- Pruebas RLS autenticadas y revisión de políticas `anon`.
- `node --test tests/*.js`: 51 pruebas correctas.
- `node --check js/script.js`, `js/request-detail.js`, `js/follow-up-rules.js` y `js/sector-presets.js`: correctos.

## Pendientes

- C8 puede conectar de forma controlada los formularios bonitos restantes, Fontanería y Academias, al endpoint dev.
- El panel continúa siendo un entorno dev aislado de solo lectura; no debe fusionarse todavía con la demo principal.
