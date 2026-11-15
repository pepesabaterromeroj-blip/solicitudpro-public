# Resultado C12B2 — Formularios públicos con adjuntos DEV

## Resultado y arquitectura

C12B2 conecta los formularios públicos con el backend seguro de C12B1. El
flujo común es:

1. validar los datos y los archivos en el navegador para mejorar la UX;
2. crear primero la solicitud mediante `receive-public-form`;
3. conservar en memoria la referencia devuelta y la clave de idempotencia
   original;
4. subir cada archivo, de forma secuencial, a la ruta multipart de C12B1;
5. mostrar el resultado individual sin invalidar una solicitud ya guardada.

`js/public-form-attachments.js` concentra límites, validación, estados y
subida. No hay implementaciones por sector ni escritura directa del navegador
a Storage o a la tabla `attachments`.

## Archivos modificados

- `index.html`: carga el módulo común antes del script principal.
- `js/public-form-attachments.js`: validación y subida secuencial reutilizable.
- `js/script.js`: selección en memoria, eliminación previa, creación antes de
  subida, estados, fallo parcial y reintento de fallidos.
- `js/sector-presets.js`: bloque común de adjuntos en los seis formularios.
- `css/style.css`: presentación accesible y responsive del selector, progreso
  y errores.
- `tests/c12b2-public-form-attachments.test.js`: pruebas específicas C12B2.
- Tests históricos C8/demo: expectativas actualizadas únicamente por la
  conexión aprobada de Academias y su nuevo campo común.

## Integración multisector y Academias

Reformas, Electricidad, Fontanería, Climatización, Cristalerías y Academias
usan el mismo componente. Academias se conectó con el cambio mínimo aprobado:

- negocio `academia-demo-dev`;
- formulario `clases`;
- respuestas publicadas `materia` y `disponibilidad` exclusivamente.

No se envían `nivel`, `objetivo` ni `modalidad` al endpoint porque no forman
parte del formulario publicado actual. No se creó backend, schema, policy ni
lógica de Storage específica para Academias.

Los tests históricos C8 que afirmaban que Academias estaba desconectada y el
test que fijaba ocho campos para ese formulario quedaron obsoletos por esta
extensión explícitamente aprobada. Se actualizaron sin alterar la intención de
seguridad de C6/C8 ni las pruebas de fases posteriores.

## Límites y experiencia

- adjuntos opcionales;
- máximo de 5 archivos por solicitud;
- máximo de 10 MB por archivo;
- JPEG, PNG, WebP, HEIC, HEIF y PDF;
- selección múltiple y eliminación antes de enviar;
- nombres largos con salto seguro y botones táctiles en móvil;
- estados `Pendiente`, `Subiendo`, `Enviado` y error seguro.

Estas comprobaciones frontend son solo ayuda de UX. C12B1 continúa validando
tamaño, MIME, extensión y firma binaria como autoridad de seguridad.

## Idempotencia, fallos parciales y reintentos

Los objetos `File`, la referencia, la clave y el contexto de retry viven solo
en memoria. No se guardan en `localStorage`, `sessionStorage`, HTML, URL ni
logs visibles. La clave usada por cada subida es exactamente la empleada para
crear la solicitud.

Si falla un archivo, la UI confirma que la solicitud sí fue recibida y permite
reintentar únicamente los fallidos. El botón de retry no ejecuta el POST de la
solicitud. Un resultado ambiguo puede reenviar el mismo archivo con la misma
clave; la idempotencia de C12B1 evita duplicarlo. Cuando todos terminan bien,
se elimina el contexto sensible mantenido por la página.

Al recargar o cerrar la página se pierde deliberadamente la posibilidad de
retry. No se persisten credenciales para conservarla.

## Seguridad

Se mantienen intactos el bucket privado, RLS, aislamiento multi-tenant y el
backend C12B1. El frontend no contiene `service_role`, no recibe
`business_id`/`request_id`, no usa el SDK de Storage y no genera URLs públicas.
No se modificaron Edge Functions, migraciones, schema ni policies.

## Pruebas automáticas

Las pruebas C12B2 cubren:

- envío sin adjuntos y compatibilidad con el flujo existente;
- JPEG, PDF y selección múltiple;
- rechazo de archivos superiores a 10 MB, MIME no permitido y más de cinco;
- subida secuencial después de una solicitud confirmada;
- reutilización de la clave original;
- fallo parcial sin recrear la solicitud;
- retry exclusivo de fallidos;
- ausencia de IDs internos y escritura directa a Storage;
- integración común y configuración mínima de Academias.

La verificación final incluye `node --test tests/*.js`, `node --check` para los
JavaScript modificados y `git diff --check`.

## Validación real en Supabase DEV

Con datos ficticios se verificó:

- Academias sin archivo: solicitud creada y cero adjuntos;
- Academias con JPEG: solicitud creada y un adjunto;
- Reformas con JPEG y PDF: solicitud creada antes de dos uploads secuenciales;
- replay del mismo PDF: HTTP 201 inicial, HTTP 200 en el reintento y un único
  metadato;
- SVG rechazado por C12B1 con HTTP 415, sin adjunto falso;
- cada referencia consultada corresponde a una sola solicitud;
- Academias guarda únicamente `materia` y `disponibilidad`;
- responsive sin desbordamiento horizontal en escritorio, tablet y móvil.

Se conservaron cuatro solicitudes técnicas ficticias y cuatro adjuntos de
prueba como evidencia DEV. No se borraron solo los metadatos mediante SQL,
porque eso dejaría objetos huérfanos y contradiría la limpieza segura definida
en C12A. No contienen datos ni archivos personales.

## Limitaciones y C12C

El retry existe únicamente durante la vida de la página. No hay progreso por
bytes, compresión, miniaturas ni subida resumible. C12C queda reservada para la
consulta/descarga autenticada de adjuntos privados y no se ha iniciado.
