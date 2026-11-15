# Resultado C4: panel Supabase dev de solo lectura

**Fecha:** 2026-09-01  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo con datos ficticios. No es la landing ni producción.

## Objetivo y decisión técnica

C4 valida que el panel interno puede leer solicitudes reales del entorno de
desarrollo sin sustituir ni alterar la demo v1.1 local.

Se eligió una **página aislada en `dev/`** en vez de incorporar un parámetro o
una ruta al panel principal. Es la alternativa de menor riesgo: el modo local
permanece como comportamiento predeterminado y el experimento de Supabase no
añade escritura ni credenciales privadas a la demo.

## Archivos creados o modificados

- Creado: `dev/panel-supabase-readonly.html`.
- Creado: `tests/supabase-readonly-panel.test.js`.
- Creado: este documento.

No se modificaron `index.html`, los estilos de la demo, los scripts de la demo,
la landing, Netlify ni el proyecto Supabase de la landing.

## Cómo probar la página aislada

1. Desde la raíz del proyecto, iniciar un servidor local que sirva `dev/` en el
   puerto `3000`.
2. Abrir `http://localhost:3000/panel-supabase-readonly.html`.
3. Elegir uno de los dos usuarios ficticios autorizados e introducir su
   contraseña temporal manualmente.
4. Confirmar que aparece el aviso: **"Modo desarrollo · Supabase dev · Solo
   lectura"**.

La sesión se conserva solamente en memoria de la página. No se guarda en
`localStorage` ni `sessionStorage`. Se restablecieron contraseñas temporales de
usuarios ficticios dev para validar lectura autenticada. Sus valores no se
registraron en el repositorio ni en esta documentación.

## Lectura y presentación de datos

La página usa la clave publicable de Supabase y una sesión de Auth del usuario
ficticio. No contiene una clave de servicio ni ningún secreto. Tras autenticar,
solo realiza peticiones `GET` a estas tablas protegidas por RLS:

- `requests`
- `contacts`
- `request_custom_answers`
- `follow_ups`
- `activities`
- `businesses`
- `sectors`
- `form_configs`

Por solicitud muestra referencia, contacto, email o teléfono disponible,
negocio, sector, estado, prioridad, origen, fecha, resumen interno, siguiente
acción, seguimiento, formulario, respuestas dinámicas y actividad inicial. Los
filtros locales disponibles son búsqueda por contacto/referencia, negocio,
estado y prioridad. La página no inventa valores cuando faltan.

No hay acciones de negocio: no cambia estados ni prioridades, no asigna
usuarios, no crea ni elimina registros y no incorpora un detalle editable.

## Pruebas manuales de lectura real

| Usuario ficticio | Negocio leído mediante RLS | Resultado |
| --- | --- | --- |
| Owner Academia Dev | Academia Demo Dev / Academias | Inicio de sesión correcto; listado visible con solicitudes, respuestas dinámicas, formulario, seguimiento y actividad inicial. |
| Owner Reformas Dev | Reformas Demo Dev / Reformas | Inicio de sesión correcto; listado visible. Después se cerró sesión. |

Las pruebas se hicieron desde `localhost:3000` con los dos propietarios
ficticios autorizados. No se usaron datos personales reales.

## Verificación directa en Supabase dev

La revisión se realizó únicamente sobre `solicitudpro-app-dev`.

| Negocio | Sector | Solicitudes | Contactos | Respuestas dinámicas | Seguimientos | Actividades |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Academia Demo Dev | Academias | 13 | 13 | 26 | 13 | 13 |
| Reformas Demo Dev | Reformas | 3 | 3 | 6 | 3 | 3 |

Las comprobaciones de integridad devolvieron `0` para solicitudes con contacto
de otro negocio, respuestas dinámicas cruzadas, seguimientos cruzados y
actividades cruzadas.

La base conserva RLS activada en las 15 tablas operativas revisadas y tiene
`0` políticas para el rol `anon` sobre esas tablas. El uso de la página no creó
ni actualizó registros: la última creación/actualización de solicitud y la
última actividad permanecían en el timestamp de las pruebas C3
(`2026-09-01 17:43:38 UTC`).

## Seguridad revisada

- No hay `service_role` ni secretos en el HTML, JavaScript o tests del panel.
- La clave usada en el navegador es publicable y queda limitada por RLS y por
  una sesión autenticada; no concede acceso a datos de otros negocios.
- El frontend no envía ni permite editar `business_id`, `status`, `priority` o
  `assigned_to`; los identificadores de negocio solo se leen para asociar de
  forma segura los datos que RLS ya devolvió.
- La página aplica una lista cerrada de tablas de lectura y no contiene
  llamadas `POST`, `PUT`, `PATCH` o `DELETE` contra la API de datos.
- La única petición `POST` es el inicio de sesión contra Supabase Auth con la
  contraseña introducida manualmente; no es una escritura de negocio.
- No se cambió RLS, no se añadieron políticas `anon` y no se tocó el endpoint
  público C2.

## Pruebas y comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Suite local `node --test tests/*.js` | 46 pruebas correctas, 0 fallos. |
| Prueba específica del panel | 2 pruebas correctas: aislamiento y modo explícito. |
| Sintaxis de scripts de la demo | Correcta para `script.js`, `request-detail.js`, `follow-up-rules.js` y `sector-presets.js`. |
| Sintaxis del script incrustado del panel | Correcta. |
| Servicio local del panel | HTTP `200` para `panel-supabase-readonly.html`. |
| Consola del panel durante la prueba | Sin errores ni avisos. |
| Datos y RLS en Supabase dev | Revisión correcta, sin cruces entre los dos negocios. |

## Limitaciones y pendiente de seguridad

El asesor de seguridad de Supabase marca dos avisos informativos esperados: las
tablas internas de idempotencia y rate limiting tienen RLS sin políticas, para
que solo el endpoint de servidor pueda usarlas. No son accesibles desde el
panel ni desde `anon`.

Queda pendiente activar en Supabase Auth la protección contra contraseñas
filtradas. No bloquea la prueba controlada de desarrollo, pero debe activarse
antes de manejar usuarios no ficticios.

## Qué queda para C5

C5 debe definir el detalle interno completo de una solicitud de Supabase en un
alcance separado. Conviene reutilizar este adaptador de lectura y mantener el
panel en solo lectura hasta aprobar explícitamente las acciones de escritura y
sus validaciones.
