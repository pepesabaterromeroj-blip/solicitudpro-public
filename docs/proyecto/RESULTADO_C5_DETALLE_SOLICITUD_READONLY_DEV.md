# Resultado C5: detalle de solicitud Supabase dev de solo lectura

**Fecha:** 2026-09-02  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo con datos ficticios. No es la landing ni producción.

## Objetivo

C5 amplía el panel aislado de C4 para abrir una solicitud real y entenderla en
detalle sin permitir ninguna acción de negocio. El flujo validado es:

`listado autenticado -> detalle autenticado mediante RLS -> solo lectura`.

## Decisión técnica

Se incorporó un panel de detalle dentro de la misma página aislada de C4,
debajo del listado. Es la opción de menor impacto: conserva el inicio de
sesión, filtros y listado existentes, no toca la demo local y evita crear una
ruta o aplicación adicional. El parámetro dev opcional `?request=<uuid>` solo
permite abrir un detalle ya autorizado por RLS; no concede acceso por sí mismo.

## Archivos modificados

- Modificado: `dev/panel-supabase-readonly.html`.
- Modificado: `tests/supabase-readonly-panel.test.js`.
- Creado: este documento.

No se modificaron la demo principal, `index.html`, sus scripts o estilos, la
landing, Netlify, el esquema de Supabase, RLS ni el proyecto Supabase de la
landing.

## Cómo probarlo

1. Servir la carpeta `dev/` localmente en el puerto `3000`.
2. Abrir `http://localhost:3000/panel-supabase-readonly.html`.
3. Iniciar sesión manualmente con uno de los usuarios ficticios de desarrollo
   autorizados. Las contraseñas no se guardan ni se documentan.
4. Pulsar **Ver detalle** en una solicitud o usar el parámetro `request` con
   un UUID de una solicitud del negocio autorizado.
5. Pulsar **Volver al listado** para cerrar el detalle.

La página mantiene la sesión solamente en memoria. Sigue mostrando los avisos
**Modo desarrollo · Supabase dev · Solo lectura** y **Datos ficticios**.

## Datos mostrados en el detalle

El detalle carga de forma autenticada y muestra estados de carga, vacío, error
seguro y denegación. Sus bloques son:

- Cabecera: referencia, estado, prioridad, negocio, sector, formulario,
  origen, fechas de creación y actualización.
- Cliente: nombre, email y teléfono disponibles.
- Resumen: resumen interno, siguiente acción y próxima fecha de seguimiento.
- Respuestas dinámicas: etiqueta conservada, clave, tipo y valor de cada
  `request_custom_answers`, ordenadas por el formulario.
- Seguimientos: acción, fecha prevista, estado, notas y fecha de creación.
- Actividad: título, tipo, actor disponible, fecha y metadatos con una lista
  segura de claves visibles.
- Adjuntos: solo metadatos (nombre, tipo, tamaño, estado y fecha). No accede a
  Storage ni descarga archivos.
- Identificadores técnicos de desarrollo: request, business, contacto y
  formulario, sin secretos ni tokens.

Cuando no existe información relacionada se muestran mensajes claros, por
ejemplo **Sin adjuntos registrados** o **No hay actividad registrada para esta
solicitud**.

## Tablas leídas y relaciones

El panel solo consulta mediante `GET` autenticados:

- `requests` como registro principal.
- `contacts`, `businesses`, `sectors` y `form_configs` para el contexto.
- `form_fields` y `request_custom_answers` para presentar respuestas con su
  etiqueta y tipo.
- `follow_ups`, `activities` y `attachments` para el historial relacionado.

La solicitud se consulta primero. Si RLS no devuelve esa fila, el panel no
solicita ni renderiza sus relaciones y muestra **Solicitud no disponible o no
permitida**. Cuando sí existe, cada consulta relacionada se restringe también
por `request_id` y el `business_id` derivado de la solicitud autorizada.

## Pruebas manuales de lectura real

| Usuario ficticio | Resultado |
| --- | --- |
| Owner Reformas Dev | Inicio de sesión y listado de Reformas correctos. Se abrió una solicitud con cabecera, contacto, resumen, respuestas dinámicas, seguimiento, actividad, adjuntos y los identificadores dev. No aparecieron controles de edición o escritura. |
| Owner Academia Dev | Inicio de sesión y listado de Academias correctos. Se abrió una solicitud de Academias con cabecera, contacto, negocio, sector, formulario, origen, resumen, siguiente acción, respuestas dinámicas y seguimiento. No aparecieron controles de edición o escritura. |

Las pruebas se hicieron desde `http://localhost:3000`, no desde `file:///`, y
solo usaron datos ficticios del entorno de desarrollo.

## Prueba negativa de aislamiento

Con la sesión de Owner Reformas Dev se abrió directamente un UUID de una
solicitud de Academias desde el parámetro `?request=`. RLS permitió cargar el
listado de Reformas, pero no devolvió la solicitud ajena. El detalle mostró:

> Solicitud no disponible o no permitida.

No se mostraron datos de Academias ni relaciones asociadas. Esta prueba valida
la denegación por datos dev reales, no un filtro visual del buscador.

## Solo lectura y ausencia de escrituras

- Las consultas de datos declaran `method: "GET"` y se limitan a una lista
  cerrada de tablas de lectura.
- La única petición `POST` de la página es el inicio de sesión de Supabase Auth
  con la contraseña introducida manualmente; no crea ni actualiza datos de
  negocio.
- No hay botones ni acciones para guardar, editar, borrar, enviar emails,
  cambiar estado, prioridad o asignación.
- La verificación posterior no detectó cambios desde las pruebas C3: última
  creación/actualización de request, actividad y seguimiento en
  `2026-09-01 17:43:38 UTC`.

## Verificación en Supabase dev

La revisión se realizó únicamente sobre `solicitudpro-app-dev`.

- RLS permanece activada en las 13 tablas operativas revisadas; ninguna quedó
  desprotegida.
- Hay `0` políticas para `anon` sobre esas tablas.
- Las comprobaciones de integridad devolvieron `0` solicitudes con contacto de
  otro negocio, `0` respuestas dinámicas cruzadas, `0` seguimientos cruzados,
  `0` actividades cruzadas y `0` adjuntos cruzados.
- La denegación cruzada anterior confirmó que una sesión de Reformas no puede
  leer el detalle de Academias.
- No se consultó ni modificó el proyecto de la landing.

## Seguridad

- No hay `service_role`, secretos, contraseñas ni tokens hardcodeados en el
  HTML o los tests.
- El frontend usa únicamente una clave publicable, protegida por una sesión
  Auth y RLS; no tiene privilegios de servidor.
- Las contraseñas temporales de los usuarios ficticios solo se introdujeron
  manualmente para la prueba y no se guardan en el repositorio, navegador o
  documentación.
- La interfaz no permite enviar ni editar `business_id`, `status`, `priority`
  o `assigned_to`.
- No se añadieron políticas `anon`, no se desactivó RLS y no hubo escrituras
  desde el panel.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Suite local `node --test tests/*.js` | 47 pruebas correctas, 0 fallos. |
| Pruebas del panel C4/C5 | 3 pruebas correctas: aislamiento, modo local intacto y detalle seguro. |
| Sintaxis del script incrustado del panel | Correcta. |
| Navegador en `localhost:3000` | Detalles reales validados para Reformas y Academias. |
| Denegación cruzada | Correcta para sesión Reformas frente a una solicitud de Academias. |
| Consola durante la carga del detalle de Academias | Sin errores ni avisos. |
| Integridad y RLS en Supabase dev | Correctas; sin cruces ni políticas `anon` operativas. |

## Limitaciones y siguiente paso

C5 no edita solicitudes ni permite acciones comerciales. Tampoco conecta el
formulario sectorial de la demo, adjuntos reales, emails, automatizaciones,
n8n, Gmail, Resend, Google Sheets, Storage u OpenAI.

Antes de usar usuarios no ficticios conviene activar en Supabase Auth la
protección frente a contraseñas filtradas, pendiente identificado en C4.

La siguiente fase recomendada es C6: decidir y conectar de forma controlada un
formulario sectorial real al endpoint ya validado, manteniendo el panel sin
acciones de escritura hasta aprobar una fase específica para ellas.
