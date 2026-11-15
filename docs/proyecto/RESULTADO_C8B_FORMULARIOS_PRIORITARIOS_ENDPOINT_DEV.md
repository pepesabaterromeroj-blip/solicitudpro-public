# Resultado C8B: formularios prioritarios al endpoint dev

**Fecha:** 2026-09-03  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Alcance:** desarrollo con datos ficticios `.test`; no es producción ni la landing.

## Objetivo

Conectar de forma explícita los formularios bonitos de Fontanería, Climatización y Cristalerías al endpoint de recepción ya desplegado, solo bajo `submit=supabase-dev`. El modo habitual de la demo conserva `localStorage` y no llama al endpoint.

Academias se mantiene intacta como sector secundario. En C8B no se conecta su formulario bonito al endpoint y, si se abre con `submit=supabase-dev`, aparece un aviso claro de que no está conectado en esta fase.

## Decisión técnica y archivos

Se reutilizó el patrón de C6 en [script.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/js/script.js): una configuración por sector con `businessSlug`, `formSlug` y el mapeo de respuestas permitidas. No hay escritura directa del navegador a las tablas de Supabase.

- Modificado: [js/script.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/js/script.js), mapeo C8B y clave de idempotencia en memoria por sector y payload.
- Modificado: [js/sector-presets.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/js/sector-presets.js), opciones de Fontanería alineadas con los `form_fields` publicados.
- Modificado: [005_public_form_submission_rpc.sql](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/docs/proyecto/sql/005_public_form_submission_rpc.sql), fuente de la RPC con prefijos `CLI` y `CRI`.
- Creado y aplicado solo en dev: [010_c8b_reference_prefixes.sql](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/docs/proyecto/sql/010_c8b_reference_prefixes.sql), actualización idempotente de la RPC y corrección acotada de la referencia ficticia inicial de Climatización.
- Modificados: [demo-supabase-dev-submit.test.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/tests/demo-supabase-dev-submit.test.js) y [public-form-endpoint.test.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/tests/public-form-endpoint.test.js).
- Creado: este documento.

La clave de idempotencia permanece solo en memoria. Se reutiliza exclusivamente cuando el sector y el JSON del payload son exactamente iguales; al cambiar cualquier dato se genera una clave nueva. No se usa `localStorage` ni `sessionStorage` para claves, sesiones o contraseñas.

## Rutas, slugs y campos

Endpoint usado:

`POST https://rinrgjancwvcvpzjyqmu.supabase.co/functions/v1/receive-public-form/api/public/forms/:businessSlug/:formSlug/requests`

| Sector | URL de envío dev | Business slug | Form slug | Campos enviados |
| --- | --- | --- | --- | --- |
| Fontanería | `index.html?sector=fontaneria&submit=supabase-dev` | `fontaneria-demo-dev` | `solicitud` | `tipo_incidencia`, `agua_activa_urgencia`, `zona`, `descripcion` |
| Climatización | `index.html?sector=climatizacion&submit=supabase-dev` | `climatizacion-demo-dev` | `solicitud` | `tipo_trabajo`, `urgencia`, `zona`, `tipo_equipo`, `descripcion` |
| Cristalerías | `index.html?sector=cristaleria&submit=supabase-dev` | `cristaleria-demo-dev` | `solicitud` | `tipo_trabajo`, `urgencia`, `zona`, `medidas_aproximadas`, `descripcion` |

El payload público contiene exclusivamente `contact`, `answers`, `metadata` segura y `privacy_notice_version`. No incluye `business_id`, estado, prioridad, asignación, campos internos, adjuntos reales, secretos ni credenciales. Las fotos simuladas se excluyen porque C8B no habilita Storage.

## Pruebas HTTP y resultados

Las pruebas se hicieron desde el navegador local mediante origen de desarrollo permitido. Los `OPTIONS` devolvieron `204`, confirmando CORS. El endpoint registró los siguientes resultados:

- Fontanería: el primer intento devolvió `422` de forma segura por una opción local que no coincidía con el campo publicado. No creó datos. Se alinearon las opciones locales y el siguiente envío devolvió `201`, creando `FON-002`.
- Climatización: `201`, creando `CLI-002`. El primer identificador temporal `SOL-001` se corrigió de manera controlada a `CLI-002` al completar el prefijo sectorial en la RPC.
- Cristalerías: `201`, creando `CRI-002`; una sonda posterior creó `CRI-003`.
- Idempotencia de Cristalerías: el primer envío corregido creó `CRI-004` con `201`; el mismo payload y la misma clave devolvieron `200` y la misma referencia `CRI-004`. La tabla confirma una sola request y una sola fila de idempotencia para esa prueba.
- Payload cambiado: generó una nueva clave y `CRI-005`, como corresponde. Esa sonda y sus dependencias fueron eliminadas de forma acotada tras validar el comportamiento.

Al final quedan las referencias representativas `FON-002`, `CLI-002`, `CRI-002`, `CRI-003` y `CRI-004`. `CRI-005` no existe.

## Verificación en Supabase dev

Las solicitudes de C8B tienen `status = Nuevo`, `source = form` y el negocio/formulario correctos:

| Referencia | Negocio | Respuestas dinámicas | Seguimientos | Actividades | Idempotencia |
| --- | --- | ---: | ---: | ---: | ---: |
| `FON-002` | `fontaneria-demo-dev` | 4 | 1 | 1 | 1 |
| `CLI-002` | `climatizacion-demo-dev` | 5 | 1 | 1 | 1 |
| `CRI-002` | `cristaleria-demo-dev` | 5 | 1 | 1 | 1 |
| `CRI-003` | `cristaleria-demo-dev` | 5 | 1 | 1 | 1 |
| `CRI-004` | `cristaleria-demo-dev` | 5 | 1 | 1 | 1 |

La auditoría relacional obtuvo cero cruces de `business_id` entre solicitudes, contactos, respuestas, campos, seguimientos y actividades.

## Panel y aislamiento

El panel permanece aislado y solo lectura en `dev/panel-supabase-readonly.html`. Las verificaciones manuales autenticadas confirmaron:

- Owner Fontanería Dev ve `FON-002` y su detalle con contacto, resumen, respuestas, seguimiento y actividad.
- Owner Climatización Dev ve la solicitud de Climatización y su detalle completo de lectura.
- Owner Cristalerías Dev ve sus solicitudes y su detalle; fue necesario limpiar el filtro de prioridad a `Todas`, una mejora de UX pendiente que no afecta al acceso ni a los datos.
- No hay acciones de editar, guardar, borrar, cambiar estado, prioridad, archivar o enviar comunicaciones.

La comprobación RLS con el contexto autenticado de seis owners devolvió: Fontanería solo `FON-002`; Climatización solo `CLI-002`; Cristalerías solo `CRI-002` y `CRI-004`; Reformas, Electricidad y Academias cero solicitudes C8B. El panel no expone datos cruzados.

## Seguridad

- RLS sigue activa en `contacts`, `requests`, `request_custom_answers`, `follow_ups` y `activities`.
- Hay cero políticas `anon` en esas tablas operativas.
- `anon` y `authenticated` no pueden ejecutar directamente la RPC de recepción; solo el endpoint de servidor la invoca con su secreto de entorno, que nunca llega al frontend.
- No se expusieron `service_role`, secretos, tokens ni contraseñas. No se guardaron credenciales en HTML, JS, tests, Markdown, `localStorage` o `sessionStorage`.
- No se modificaron RLS ni Auth, no se tocó la landing ni su proyecto Supabase, y no hubo producción, Netlify, emails, n8n, OpenAI ni Storage.

El asesor de Supabase mantiene dos avisos informativos esperados: las tablas internas de rate limit e idempotencia tienen RLS sin políticas, para negar acceso directo a `anon` y usuarios autenticados. También permanece el aviso previo de protección de contraseñas filtradas desactivada en Auth; debe habilitarse antes de cualquier uso que exceda desarrollo.

## Comandos y pruebas

- `node --test tests/*.js`: 55 pruebas correctas.
- `node --check js/script.js`, `js/sector-presets.js`, `js/request-detail.js` y `js/follow-up-rules.js`: correctos.
- Consultas SQL de integridad, RLS, privilegios de RPC y auditoría de políticas: correctas.
- Logs de Edge Function: preflight `204`, creaciones `201`, repetición idempotente `200`.

## Qué no se hizo y siguiente paso

C8B no conecta Academias, no fusiona el panel con la demo, no añade acciones internas ni cambia RLS. Tampoco se añadieron emails, n8n, OpenAI, Storage, despliegue de frontend o cambios de landing.

La siguiente fase recomendada es C9: decidir una integración progresiva entre la experiencia visual de la demo y el panel autenticado, manteniendo las escrituras internas fuera de alcance.
