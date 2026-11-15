# Resultado C8A: nuevos sectores prioritarios dev

**Fecha:** 2026-09-03  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Alcance:** desarrollo con datos ficticios; no es la landing ni producción.

## Objetivo y estado retomado

C8A incorpora Climatización y Cristalerías como sectores completos de desarrollo: demo local sectorial, negocio y formulario publicados, owner ficticio, datos de prueba y consulta autenticada en el panel aislado de solo lectura.

Se añaden porque comparten el flujo prioritario de SolicitudPro: solicitudes con zona, urgencia, visita, presupuesto, medidas o tipo de equipo. Academias se mantiene intacto como sector secundario; no se elimina ni se modifican sus datos o su owner.

- La arquitectura local ya concentraba presets, solicitudes de ejemplo, formularios y lenguaje comercial en `js/sector-presets.js`.
- C7 ya había validado los cuatro sectores anteriores y el panel read-only.
- Los usuarios Auth ficticios nuevos ya habían sido creados manualmente en el Dashboard. Este trabajo no creó ni modificó identidades Auth.
- La ruta local no tiene metadatos Git disponibles; la continuación auditó directamente archivos y pruebas antes de continuar los cambios parciales.

## Cambios en la demo local

| Sector | URL | Datos locales | Formulario |
| --- | --- | --- | --- |
| Climatización | `http://localhost:3000/index.html?sector=climatizacion` | `CLI-001` a `CLI-005` | tipo de trabajo, urgencia, zona, tipo de equipo, descripción, fotos simuladas, nombre, email y teléfono |
| Cristalerías | `http://localhost:3000/index.html?sector=cristaleria` | `CRI-001` a `CRI-005` | tipo de trabajo, urgencia, zona, medidas aproximadas, descripción, fotos simuladas, nombre, email y teléfono |

Cada sector tiene su almacenamiento local separado: `solicitudpro-demo:v1.1:climatizacion` y `solicitudpro-demo:v1.1:cristaleria`. Se validaron solicitudes locales ficticias `CLI-006` y `CRI-006`, con resumen, respuesta sugerida y seguimiento adaptados. Las fotos son simuladas: no se suben archivos ni se activa Storage.

En C8A no se habilitó envío real para estos dos sectores. Con `submit=supabase-dev`, ambos muestran: `Este sector se ha añadido a la demo, pero su envío real al endpoint se conectará en C8B.` Reformas y Electricidad conservan C6; Fontanería y Academias tampoco se conectaron en esta fase.

## Cambios en Supabase dev

Se creó y ejecutó dos veces el seed idempotente [009_c8a_dev_new_priority_sectors.sql](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/docs/proyecto/sql/009_c8a_dev_new_priority_sectors.sql).

| Sector | Owner UUID | Negocio / slug | Formulario | Datos dev |
| --- | --- | --- | --- | --- |
| Climatización | `fca0e098-36df-47ff-9de0-cd54a34d9fee` | Climatización Demo Dev / `climatizacion-demo-dev` | `solicitud`, publicado, 5 campos | `CLI-001`, contacto ficticio, 5 respuestas, 1 seguimiento y 1 actividad |
| Cristalerías | `a8942ced-aeea-4882-adec-776b9ad9cbbc` | Cristalerías Demo Dev / `cristaleria-demo-dev` | `solicitud`, publicado, 5 campos | `CRI-001`, contacto ficticio, 5 respuestas, 1 seguimiento y 1 actividad |

Los campos publicados de Climatización son `tipo_trabajo`, `urgencia`, `zona`, `tipo_equipo` y `descripcion`. Los de Cristalerías son `tipo_trabajo`, `urgencia`, `zona`, `medidas_aproximadas` y `descripcion`.

El seed creó o completó perfiles y membresías activas `owner` solo para los UUID aportados. No usa SQL sobre `auth.users`, contraseñas, configuración privada ni cambios de RLS.

## Panel aislado y detalle

El panel sigue en [panel-supabase-readonly.html](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/dev/panel-supabase-readonly.html). Solo se ampliaron las opciones de usuarios ficticios, sin credenciales.

Las pruebas manuales autenticadas desde `http://localhost:3000/panel-supabase-readonly.html` confirmaron:

- Owner Climatización Dev: ve `CLI-001`, Climatización Demo Dev y el detalle con cabecera, contacto, resumen, urgencia, respuestas dinámicas, seguimiento y actividad.
- Owner Cristalerías Dev: ve `CRI-001`, Cristalerías Demo Dev y el detalle con cabecera, contacto, resumen, urgencia, respuestas dinámicas, seguimiento y actividad.
- Ambos casos muestran `Solo lectura` y no ofrecen editar, guardar, borrar, cambiar estado, prioridad, archivar o enviar nada.

## Aislamiento y RLS

Se validó RLS con contexto autenticado:

| Sesión simulada | Datos propios | Datos ajenos nuevos |
| --- | ---: | ---: |
| Owner Reformas | 5 | 0 de Climatización y 0 de Cristalerías |
| Owner Climatización | 1 | 0 de Reformas |
| Owner Cristalerías | 1 | 0 de Reformas |
| Owner Fontanería | 1 | 0 de Climatización |
| Owner Electricidad | 1 | 0 de Cristalerías |
| Owner Academia | 13 | 0 de Climatización y 0 de Cristalerías |

La validación relacional devolvió `0` cruces de `business_id` entre solicitudes, contactos, respuestas, seguimientos, actividades y campos. RLS sigue activa en las tablas operativas comprobadas y hay `0` políticas `anon`.

## Seguridad y límites

- No se expuso `service_role`, claves privadas, tokens, secretos ni contraseñas.
- No se guardaron contraseñas en HTML, JavaScript, tests, Markdown, `localStorage` ni `sessionStorage`.
- El panel solo lee datos operativos; su único `POST` es el login de Supabase Auth.
- No hubo escrituras desde el panel, ni cambios de RLS, políticas, landing, proyecto Supabase de landing o producción.
- No se usaron datos reales, emails, n8n, OpenAI ni Storage.

El asesor de seguridad de Supabase mantiene dos avisos informativos de C2: `public_form_idempotency_keys` y `public_form_rate_limit_windows` tienen RLS sin políticas. Es el estado esperado para tablas internas que no deben ser leídas por `anon` ni por usuarios autenticados; no se modificaron en C8A. El asesor también mantiene el aviso de que la protección de contraseñas filtradas de Auth está desactivada. No se cambió ese ajuste en esta fase; debe activarse desde los ajustes de Auth antes de cualquier uso distinto de desarrollo.

## Archivos creados o modificados

- Modificado: [index.html](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/index.html), selector de sectores.
- Modificado: [js/sector-presets.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/js/sector-presets.js), presets, solicitudes, formularios y experiencias locales.
- Modificado: [js/script.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/js/script.js), previsualización y bloqueo explícito C8B.
- Modificado: [dev/panel-supabase-readonly.html](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/dev/panel-supabase-readonly.html), opciones de owners ficticios sin credenciales.
- Modificados: tests de presets, panel y envío explícito de Supabase dev.
- Creado: [tests/c8a-new-sectors-seed.test.js](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/tests/c8a-new-sectors-seed.test.js).
- Creado: [009_c8a_dev_new_priority_sectors.sql](/Users/joanet/Documents/Proyectos-Joanet/solicitudpro/demo/web-automatizaciones-negocios/docs/proyecto/sql/009_c8a_dev_new_priority_sectors.sql).
- Creado: este documento.

## Comprobaciones ejecutadas

```sh
node --test tests/*.js
node --check js/script.js
node --check js/request-detail.js
node --check js/follow-up-rules.js
node --check js/sector-presets.js
```

Resultado: 52 pruebas correctas, 0 fallos y las cuatro comprobaciones de sintaxis superadas. También se verificó visualmente la demo local desde `localhost:3000`, incluido el bloqueo C8B de ambos sectores.

## Pendientes y recomendación para C8B

C8B puede decidir y preparar la conexión explícita al endpoint dev de Fontanería, Climatización y Cristalerías, tras revisar que sus formularios publicados y el contrato del endpoint coinciden. Academias permanece secundaria y debe decidirse expresamente si se conecta o se conserva solo como demo y entorno interno.

Antes de ampliar el uso de Auth fuera de desarrollo, activar la protección de contraseñas filtradas indicada por el asesor de seguridad.
