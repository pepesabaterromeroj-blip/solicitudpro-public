# C12C — Visualización segura de fotos y adjuntos en el panel DEV

Estado final revisado el 15 de septiembre de 2026: **C12C FINALIZADA — C12 COMPLETA.**
Visualización multiformato, casos 2/3/5, PDF firmado, responsive corregido y
limpieza verificados. El aislamiento HTTP cross-tenant ya validado no se repitió.
Los estados pendientes del historial inferior corresponden a sesiones anteriores
y quedan sustituidos por este resultado final.

## Matriz definitiva de requisitos

| Requisito | Estado | Evidencia suficiente revisada |
| --- | --- | --- |
| JPG/JPEG | VALIDADO | Subida real, miniaturas y apertura en modal; proporción correcta. |
| PNG | VALIDADO | Subida real, previsualización y apertura individual. |
| WebP | VALIDADO | Subida real, previsualización y apertura individual. |
| HEIC | VALIDADO | Subida real y fallback seguro con nombre, tamaño, tipo y acción de apertura cuando el navegador no ofrece preview. |
| HEIF | VALIDADO | Subida real y fallback seguro sin rotura visual ni de JavaScript. |
| Multiarchivo 2/3/5 | VALIDADO | Casos reales de 2, 3 y 5 archivos; orden, grid, miniaturas y modal correctos, sin duplicado en reintento. |
| &gt; 10 MB | VALIDADO | Rechazo backend HTTP 413, sin metadato ni objeto residual. |
| Archivo inválido | VALIDADO | MIME no permitido y firma binaria falsa rechazados con HTTP 415, sin residuos ni detalle interno. |
| Nombres especiales | VALIDADO | Espacios, tildes, paréntesis, varios puntos y nombre largo sin romper la interfaz. |
| PDF | VALIDADO | PDF real de una página, `application/pdf`, acceso firmado y render/apertura correctos como archivo secundario. |
| Responsive | VALIDADO | Escritorio 1366 px, tablet 768 px y móvil 375 px sin overflow; modal, nombres y botones accesibles. |
| Cross-tenant | VALIDADO | Owner A obtuvo 0 filas y no pudo firmar ni leer B; Owner B obtuvo 1 fila, firma válida y JPEG HTTP 200. |
| URLs firmadas | VALIDADO | Temporales (120 s), bucket privado y ausencia de persistencia en BD, localStorage, sessionStorage o logs. |
| Reapertura | VALIDADO | Cierre y reapertura del detalle conservaron adjuntos correctos, sin duplicados. |
| Limpieza | VALIDADO | Comprobación DEV final: 0 solicitudes, metadatos y objetos técnicos; 4 objetos previstos y 2 registros legacy intactos. |

## Resultado de la validación final autenticada

Se confirmó raíz Git del colegio, main y los cambios locales C12C preservados.
No se recargó la página ni se extrajeron credenciales del navegador.

- JPG/JPEG, PNG y WebP: las cuatro miniaturas cargan realmente (48 × 32),
  con nombres, tamaños y orden coherentes. Se abrieron sus vistas ampliadas;
  PNG y WebP también se comprobaron individualmente. Las fotos conservan
  proporción y no reemplazan otras. Se distingue carga asíncrona de fallo.
- HEIC/HEIF: los dos archivos reales de prueba aparecen con nombre, formato,
  tamaño, aviso de vista previa no disponible y acción Abrir archivo. No hay
  miniaturas rotas ni conversión. Se ejercitó la acción de HEIC sin error del
  panel; no se afirma que el navegador renderice estos formatos. El HEIF de
  prueba es RGB genérico, no un corpus completo de fotos iPhone.
- Dos archivos: REF-007 antes de añadir PNG, con ambos fallbacks correctos.
  Tres archivos: mismo caso tras añadir un PNG con nombre muy largo, aceptado
  con HTTP 201; una imagen primero y dos archivos secundarios, sin duplicados.
  Cinco archivos: REF-006 con cuatro miniaturas independientes y PDF secundario.
  Se verificaron grid, nombres y acciones. El máximo de selección de cinco
  sigue cubierto por los tests C12B2; no se cambió el contrato.
- PDF real: el fixture generado y validado con pypdf se abre desde Abrir archivo
  mediante una URL /object/sign/ temporal, nunca /object/public/. El visor nativo
  muestra correctamente una página y el rectángulo ficticio original. El tipo
  de metadata/upload es application/pdf y el contenido almacenado es un PDF
  renderizable, no el fixture mínimo previo de 115 bytes. No hizo falta visor
  propio. La validación fue apertura/render nativo, no lectura directa de
  headers HTTP desde el navegador ni comparación byte a byte de descarga.
- Responsive: escritorio 1366 × 900, tablet 768 × 1024, móvil 375 × 812.
  Anchos del documento 1351, 768 y 375 respectivamente: no overflow horizontal.
  Tablet carga ya el CSS corregido, con las cuatro tarjetas dentro del detalle.
  El modal con nombre largo mide 998, 728 y 335 px útiles respectivamente,
  sin overflow interno. Cierre visible y accesible, foco inicial en Cerrar foto,
  Escape y botón funcionan. Espacios, tildes, paréntesis y varios puntos no
  rompen el layout; nombre largo con saltos de línea, sin scroll horizontal.
- Reapertura: se cerró y reabrió REF-007, se recargó su detalle sin recargar la
  página y aparecieron los adjuntos persistidos, incluida la tercera imagen.
  La sesión del panel se conservó. No se repitió logout/login ni cross-tenant.

Limpieza real completada: ocho objetos de los dos casos multiformato retirados
por la API de Storage mediante la compensación existente, provocando un conflicto
de metadata solo en esos datos desechables. Después se eliminaron metadatos,
jobs, idempotencia, solicitudes y contactos técnicos. Consulta final: cero
requests, contactos, metadata, jobs, claves de idempotencia y objetos de prueba;
cuatro objetos anteriores y dos registros legacy conservados. No se ejecutó
DELETE SQL sobre storage.objects. Se vaciaron las capacidades de subida y
fixtures en memoria y se cerró la pestaña PDF temporal. No hubo fixtures locales
en disco que retirar. Los contadores operativos y logs no se alteraron.
La lectura final del panel vuelve a mostrar cinco solicitudes previas.

No se encontraron nuevos fallos de producto en esta continuación. Solo se
actualizó documentación; no hubo cambios RLS, Auth, backend, MIME, subida,
emails, n8n, landing o producción. Comprobador temporal ya eliminado; no queda
como funcionalidad. Sin commit ni push.

Verificación final: 113 tests, cero fallos; node --check de panel y de los dos
tests JS modificados, y git diff --check correctos. C10/C11/C12A/B1/B2 conservan
sus pruebas sin regresiones. C12 completa queda cerrada.

## Arquitectura

Se amplía únicamente el detalle del panel real
`dev/panel-product-readonly.html`, `.js` y `.css`. No hay página nueva ni
cambios en la demo principal, formularios públicos, Edge Function, migraciones,
emails o configuración de Storage. No se ha hecho commit ni push.

El bloque «Fotos y adjuntos» carga después del resto del detalle. Un fallo en
los adjuntos no impide consultar ni gestionar la solicitud. Sus estados son:

- «Cargando adjuntos…»;
- «Esta solicitud no tiene fotos ni archivos adjuntos.»;
- listado de fotos y archivos;
- «No se pudieron cargar los adjuntos.».

Los errores internos no se muestran ni se registran en consola. Los nombres se
escapan antes de generar HTML. Las respuestas tardías se descartan al cambiar
solicitud, cerrar detalle o cerrar sesión.

## Lectura y autorización

La solicitud se obtiene primero con el JWT autenticado y RLS. Después se
consulta `public.attachments` por ese `request_id` y su `business_id`, con
`deleted_at IS NULL`, orden `created_at ASC, id ASC`, seleccionando:

```text
id, request_id, business_id, storage_path, file_name,
mime_type, size_bytes, created_at
```

Los IDs de la UI no son autorización. Se conservan las policies de C12A:
membresía activa, metadato canónico y asociación solicitud/negocio; la lectura
del objeto exige además coincidencia con el metadato. No hay permisos nuevos.
Los dos registros legacy no canónicos siguen preservados y ocultos por RLS.

## Acceso privado temporal

Se reutiliza la API REST de Storage, coherente con el panel existente sin SDK:

```text
POST /storage/v1/object/sign/request-attachments/{path_canónico}
Authorization: Bearer {JWT del usuario autenticado}
Body: { "expiresIn": 120 }
```

La firma exige la policy SELECT existente sobre el objeto. El cliente utiliza
solo la clave publicable existente, nunca una credencial privilegiada.
Se comprueban origen, ruta y presencia de token en la respuesta. No se generan
URLs públicas permanentes. El bucket continúa privado.

Las URLs viven solo en memoria y en los atributos de las imágenes. No se
guardan en base de datos, localStorage, sessionStorage ni logs. Cada apertura
obtiene una firma nueva; actualizar/reabrir el detalle renueva las miniaturas.
Una miniatura cuyo acceso haya expirado ofrece un mensaje discreto y permite
intentar abrir la foto de nuevo. Cerrar detalle/sesión limpia las imágenes.

Una URL firmada es una capacidad temporal: quien reciba una URL válida podrá
usarla hasta su vencimiento, incluso después del logout del emisor. No se
afirma revocación instantánea ni autorización permanente. Manipular IDs/paths
no permite generar una firma autorizada del negocio ajeno.

## Experiencia image-first

JPEG, PNG y WebP se presentan primero en una cuadrícula, con miniatura,
nombre, tamaño y «Ver foto». Un diálogo nativo muestra la imagen ampliada:
cierre visible, Escape nativo, foco contenido por el navegador y retorno al
botón al cerrar. Las imágenes tienen texto alternativo y no envían referente.

HEIC/HEIF se presentan como archivos con nombre, formato, tamaño, aviso de
vista previa no disponible y «Abrir archivo». No se convierte ni comprime.
El navegador decide si abre o descarga el archivo. PDF aparece como archivo
secundario con la misma acción, sin visor embebido. La pestaña se reserva
durante el gesto y se elimina su opener antes de abrir el acceso temporal.

No se amplían ni eliminan los tipos permitidos. Restringir futuras subidas
solo a imágenes requeriría un cambio posterior explícito en C12A/B2.

La cuadrícula utiliza columnas adaptables, nombres con salto de línea y
botones de al menos 44 px. El diálogo limita ancho/alto al viewport. Estas
reglas se comprobaron visualmente en escritorio, tablet y móvil estrecho.
El desbordamiento anterior de filtros en tablet está corregido y la
distribución actual se verificó sin overflow.

## Pruebas realizadas

Doce tests C12C verifican la carga versionada, el ajuste de filtros en tablet
y ejecutan el JavaScript real con DOM/red simulados; cubren:
vacío/carga/error, JPEG/PNG/WebP, escape de nombres, HEIC/HEIF/PDF, orden
image-first, firma corta con JWT, rechazo de URLs inseguras, consultas
acotadas, fallos independientes, respuestas tardías y renovación al abrir el
diálogo. También comprueban ausencia de persistencia, credenciales
privilegiadas y operaciones de escritura en el bloque.

Se amplió únicamente el simulador DOM del test C10A con `removeAttribute`,
necesario para limpiar la imagen al cerrar sesión; sus assertions originales
se mantienen. La suite completa pasa: **113 tests, cero fallos**.
`node --check` del panel y del test C12C, y `git diff --check`, sin errores.

Verificación real, exclusivamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`):

- bucket privado, 10 MiB y los seis MIME aprobados;
- RLS activa; anon sin SELECT/INSERT en metadatos;
- authenticated sin INSERT/UPDATE/DELETE en metadatos;
- cero policies anon o de escritura en metadatos/objetos;
- contexto SQL autenticado de Reformas: dos metadatos/objetos propios,
  cero de Academias, cero para attachment inexistente;
- contexto SQL autenticado de Academias: dos metadatos/objetos propios,
  cero de Reformas;
- contexto anon: cero objetos visibles.

Las pruebas de roles usaron `SET LOCAL ROLE` y claims ficticios dentro de
transacciones con `ROLLBACK`. No equivalen a una prueba HTTP de firma ni a un
login del navegador. Se conservaron los cuatro objetos ficticios C12B2 y los
registros legacy existentes.
C10/C11/C12A/B1/B2 permanecen intactas funcionalmente y sus tests pasan.

## Historial de validación y límites

### Cross-tenant HTTP validado y continuación multiformato

Se leyó únicamente el informe sanitizado y se aceptó la confirmación del usuario,
sin repetir la prueba. A Reformas contra recurso B Fontanería:

- metadata HTTP 200, cero filas;
- firma HTTP 400, estado API 404, sin URL firmada válida;
- contenido autenticado HTTP 400, sin archivo.

B Fontanería contra su recurso: metadata HTTP 200, una fila; firma HTTP 200
válida, duración solicitada 120 segundos; contenido HTTP 200, image/jpeg,
645 bytes y firma JPEG válida. Ambos login HTTP 200 y logout local HTTP 204;
el informe confirma eliminación de referencias a tokens y limpieza correcta.
No se mostraron credenciales ni URLs firmadas completas.

Se eliminaron los dos archivos c12c-cross-tenant-temporal.*, se cerró su pestaña
y se retiraron el objeto, metadata, jobs, idempotencia, solicitud y contacto
técnicos de Fontanería. Objeto eliminado por la compensación existente y API de
Storage, no por DELETE SQL de storage.objects. Consulta posterior: cero
metadatos, requests y contactos de ese caso; cuatro objetos previos conservados.
La capacidad de subida temporal se retiró de memoria. El comprobador no queda
como funcionalidad del producto. Auth y RLS no se modificaron.

Para las comprobaciones restantes se generaron en memoria con Pillow imágenes
ficticias de 48 × 32 en JPG/JPEG/PNG/WebP y un PDF de 1508 bytes. pypdf confirma
un PDF válido de una página. Nombres: foto obra baño 01.jpg,
foto.con.varios.puntos.jpeg, captura-mañana.png, medidas (cliente).webp y
documento ficticio válido.pdf. Todos aceptados por el backend DEV con HTTP 201.
El reintento del JPG devuelve HTTP 200 y el mismo ID. Consulta real posterior:
exactamente cinco metadatos y cinco objetos en la solicitud técnica REF-006
(fd611d7d-a873-4af8-9ab1-d5254288e806), sin duplicado ni objetos extra por los
rechazos. Contacto 2779c103-49fc-4eeb-b966-85d7f031fd71.

Pruebas negativas reales: contenido MZ ficticio renombrado a JPG y MIME JPEG,
HTTP 415, «El contenido del archivo no coincide con el tipo declarado.»;
texto con MIME text/plain renombrado JPG, HTTP 415, «Tipo de archivo no
permitido.»; JPEG rellenado hasta 10485761 bytes, HTTP 413, «El archivo supera
el límite de 10 MB.» La solicitud válida permanece íntegra. No se insertaron
metadatos/objetos adicionales para esos casos.

HEIC/HEIF: no había encoder local. Se reutilizaron fixtures sintéticos oficiales
de libheif, commit 08075aebcc0d9bf7d35f900c36114b1b6e90ed7d:

- [rainbow-451x461.heic](https://github.com/strukturag/libheif/blob/08075aebcc0d9bf7d35f900c36114b1b6e90ed7d/tests/data/rainbow-451x461.heic),
  7080 bytes, SHA256 4b2ce727f093944975f143ba2b39c4c64511b766d94552f8d51a755916e7f983;
- [uncompressed_pix_RGB.heif](https://github.com/strukturag/libheif/blob/08075aebcc0d9bf7d35f900c36114b1b6e90ed7d/tests/data/uncompressed_pix_RGB.heif),
  2204 bytes, SHA256 30a001333302cd2a850149c757754981eebfeed9509bc3ac7f2633c49141eb12.

Ambos suben con HTTP 201, como arcoiris ficticio.heic y colores ficticios.heif
en REF-007 (045110ed-98cd-4035-92c1-236b414d9dac; contacto
4729d144-1a1c-4fae-83a6-7a74cc8069f6). No se instalaron dependencias, no se convirtieron archivos ni se
utilizaron fotos personales. El HEIF genérico de prueba no equivale a una foto
HEVC de iPhone. Estos datos acreditan upload/backend, no apertura real del panel.

El panel real actual se abrió sin el comprobador y sigue pendiente del login
manual de Reformas. Las dos solicitudes y siete objetos multiformato se
conservan exclusivamente para la visualización pendiente y deberán eliminarse
después; por tanto NO se declara aún cero residuos ni fase finalizada.
Faltan preview/modal por formato, fallback HEIC/HEIF real, contenido firmado
del PDF con MIME correcto, casos visuales 2/3/5 y responsive con CSS actualizado.
No se reabre como pendiente la seguridad cross-tenant ya validada.

### Owners definitivos del comprobador — Reformas y Fontanería

Por preferencia del usuario se inspeccionaron perfiles y business_users, sin
SQL sobre auth.users ni cambios Auth. Electricidad y Fontanería tienen perfil
owner y membresía activa. Se seleccionó B Fontanería
(`owner.fontaneria.dev@solicitudpro.test`); A sigue siendo Reformas
(`owner.reformas.dev@solicitudpro.test`). El login real de ambos se verificará
cuando el usuario introduzca las contraseñas manualmente en el comprobador.

Ninguno de los dos sectores candidatos tenía adjuntos. Se generó en memoria
un JPEG ficticio sólido de 32 × 24 con Pillow, 645 bytes. El backend público
existente aceptó solicitud FON-003 y archivo con HTTP 201, sin cambiar RLS ni
Storage. Recurso técnico para retirar al acabar: request
f036b937-36d3-4495-987f-579059681315, attachment
5e01eaf5-59b5-55b7-bce7-4b50970dad93 y contact
f34eb213-b525-439e-99e0-0597bda5fb3d. También se retirarán sus jobs y registro
de idempotencia; no se alterarán registros legacy. El archivo local no se
escribió a disco; la clave de subida solo se conserva temporalmente en memoria.

Se actualizó exclusivamente el comprobador temporal para estos owners y este
recurso. Se cargó la página actualizada tras confirmar campos de contraseña
vacíos y prueba inactiva. Sintaxis JS y git diff --check correctos. El
comprobador no forma parte del producto y se eliminará una vez documentado el
resultado HTTP. La prueba real sigue pendiente de las credenciales manuales.

### Comprobador local temporal aprobado — pendiente de entrada manual

Se prepararon `dev/c12c-cross-tenant-temporal.html` y su JavaScript únicamente
para validar aislamiento HTTP. Página limitada a localhost y al proyecto DEV;
sin dependencias, almacenamiento persistente, logs o credenciales privilegiadas.
El usuario introduce manualmente las credenciales de Reformas (A) y Academias
(B). Se comprueban las identidades esperadas antes de probar un JPEG ficticio
existente de Academias. No se crean solicitudes, usuarios ni objetos nuevos.

El comprobador consulta el ID del adjunto B usando el JWT de A, solicita firma
del path B con ese JWT e intenta descarga directa autenticada. Después verifica
metadata, firma y descarga firmada de B, incluyendo MIME, tamaño y firma JPEG.
El resultado visible contiene estados HTTP, recuentos y booleanos; no paths,
contraseñas, tokens ni URLs firmadas completas. La URL de B no se comparte con
A: una capacidad firmada ya autorizada sería utilizable hasta caducar y no
serviría para probar RLS del solicitante.

Las contraseñas se vacían antes de autenticar cada owner. Los JWT viven solo
durante la prueba; finalmente se solicita logout con scope local para las
sesiones nuevas y se borran las referencias, también cuando hay error.
El informe distingue limpieza local y éxito HTTP del logout. Este logout no
implica revocación instantánea de JWT ya emitidos. No afecta a la sesión previa
del panel. Mantener la pestaña abierta hasta finalizar la limpieza; no aceptar
guardar contraseñas en el navegador.

Autotest temporal con red/DOM simulados: aislamiento detectado como correcto,
metadata ajena visible detectada como fallo, dos logouts locales, campos
vacíos y resultado sin URLs firmadas. No equivale a ejecución real contra DEV.
Suite existente: 113 tests, cero fallos; sintaxis del comprobador y los JS
modificados, y git diff --check, correctos. No hubo cambios SQL/RLS/backend,
commit ni push. Falta la entrada manual del usuario para registrar HTTP real.
El comprobador se eliminará después de recoger el resultado; por ahora se
conserva temporalmente para permitir dicha prueba. C12C no queda cerrada.

### Precomprobación de validación exhaustiva — 14 de septiembre de 2026

Se confirmó la raíz del PC del colegio, rama main y HEAD e8ea469. Los cambios
locales C12C se preservaron; no se realizó commit ni push.
Pillow dispone de JPEG y WebP. No se localizaron magick, ffmpeg, heif-enc ni
pillow_heif, ni fixtures HEIC/HEIF en el repositorio. No se instalaron paquetes.

La prueba HTTP cross-tenant obligatoria requiere autenticar dos owners en un
cliente de pruebas seguro. No hay credenciales de prueba disponibles en las
variables de entorno inspeccionadas; la sesión actual del panel solo está en
memoria. No se extrajo el JWT del navegador ni se usaron credenciales
privilegiadas para simular owners. No se considera completada la denegación
HTTP de firma basándose únicamente en las pruebas SQL RLS anteriores.

Esta ejecución se detuvo en esa precondición: no se afirma haber realizado el
flujo exhaustivo nuevo de JPG/JPEG/PNG/WebP/HEIC/HEIF/PDF, 2/3/5 archivos,
nombres especiales, rechazo real de más de 10 MB o firma incorrecta, ni la
comprobación visual del CSS actualizado. Los resultados positivos anteriores
siguen distinguiéndose de estas verificaciones nuevas pendientes.
No se crearon archivos, solicitudes, objetos ni metadatos técnicos nuevos.

Se ejecutó nuevamente la suite completa: 113 tests, cero fallos; los tres
checks de sintaxis JS y git diff --check terminaron sin errores. La revisión
de los archivos C12C no detectó credenciales privilegiadas: las coincidencias
service_role/sb_secret_ son patrones prohibitivos del test, no claves reales.

Siguiente requisito: disponer de un comprobador local que solicite las
credenciales de ambos owners mediante entrada segura, las conserve solo en
memoria y publique únicamente estados HTTP/resultados sanitizados. No enviar
contraseñas ni JWT por chat ni incorporarlos a archivos versionados.
Hasta completar esas pruebas reales, C12C y C12 completa no están cerradas.

### Resultado autenticado más reciente — 14 de septiembre de 2026

Este apartado sustituye el estado pendiente descrito en las continuaciones
históricas que aparecen después. Se preservó la sesión iniciada por el usuario:
no se recargó la página, no se cerró sesión y no se extrajeron credenciales.

Verificación manual real:

- REF-002, sin adjuntos: mensaje vacío correcto.
- REF-005: miniatura JPEG cargada y vista ampliada real, 1920 × 1200.
  Se comprobó acceso firmado en miniatura y modal sin guardar ni publicar tokens.
- Escape cierra la foto y devuelve el foco a «Ver foto».
- Solicitud técnica temporal: dos miniaturas PNG/WebP cargadas, orden correcto
  y nombre largo con salto de línea. El modal móvil abre correctamente y su
  botón «Cerrar foto» funciona; foco inicial en el cierre.
- Actualizar lectura y reabrir el detalle mantienen la sesión y vuelven a
  cargar las dos fotos. Esto no equivale a una recarga completa de página.
- PDF de REF-005 permanece debajo de las imágenes como archivo secundario;
  «Abrir archivo» abre una pestaña con acceso firmado, no público. Se cerró la
  pestaña técnica; no se valida un visor PDF ni el contenido del fixture mínimo.
- Escritorio 1366 × 900: grid de dos fotos sin desbordamiento del bloque.
- Móvil 375 × 812: columna de fotos, nombre largo y modal sin desbordamiento
  horizontal; documento de 375 px y modal sin overflow interno.
- Tablet 768 × 1024: fotos correctas, pero el documento alcanzaba 810 px por
  los cinco filtros con anchos mínimos. Se añadió distribución flexible de dos
  columnas hasta 1040 px. El test de regresión falló antes y pasó después.
  No se recargó la pestaña para cargar este CSS, respetando la instrucción del
  usuario; falta verificar visualmente el resultado corregido.

RLS real en DEV, con claims de los dos owners ficticios y ROLLBACK: ambos
leen dos metadatos propios y cero metadatos/objetos del negocio contrario.
No se modificaron permisos. Esta prueba SQL más la firma HTTP positiva no
equivalen a una prueba HTTP negativa de firma desde cada sesión del navegador;
esa comprobación sigue pendiente. La UI no constituye la barrera de seguridad.

No hay un caso HEIC/HEIF disponible: fallback cubierto por tests, sin afirmar
validación visual con archivo real. Carga, errores seguros y descarte de
respuestas tardías se verifican automáticamente; no se provocó un fallo de red
manual. No se forzó logout/login ni recarga completa para evitar perder la sesión.

Se retiraron exclusivamente los dos objetos temporales mediante la compensación
existente de C12B1 y la API de Storage, sin DELETE SQL sobre storage.objects.
Después se eliminaron sus metadatos, jobs, clave de idempotencia, solicitud y
contacto técnicos. Consulta final: cero metadatos, solicitudes y contactos
temporales; cuatro objetos ficticios previos conservados. No se alteraron datos
legacy, contadores operativos, políticas ni backend.

Verificación final: `node --test tests/*.js` pasa con 113 tests y cero fallos.
Checks de sintaxis de los tres JS modificados y `git diff --check`, sin errores.
Sin commit ni push. C10/C11/C12A/B1/B2 sin regresiones en la suite.

Pendientes para cerrar: comprobar visualmente el CSS corregido en tablet y
verificar denegación HTTP de firma para objeto ajeno/inexistente. C12 completa
solo se declarará cerrada cuando estas validaciones estén terminadas.

### Continuación manual del 14 de septiembre de 2026

En la siguiente continuación se reprodujo el listado antiguo incluso con una
sesión recién iniciada. Se aplicó una corrección mínima de carga: las
referencias JS y CSS del panel llevan ahora `?v=c12c`. Se añadió un test que
falló antes del cambio y pasó después. La pestaña se abrió con
`?version=c12c` y la inspección DOM confirmó expresamente ambas referencias
versionadas antes de solicitar el login. No se cambió el contrato de PDF.
La medición del viewport de escritorio fue 1366 × 900, con anchura de
documento y cliente de 1366: sin scroll horizontal en la pantalla de acceso.
Esta medición no sustituye la comprobación responsive del detalle autenticado.
Se volvió a verificar RLS de Reformas: dos metadatos propios, cero metadatos y
objetos de Academias. La suite final de esta continuación pasa con 112 tests,
checks de sintaxis y diff sin errores. No se crearon nuevos fixtures en esta
continuación. La validación visual del bloque sigue pendiente del login en la
pestaña con las referencias versionadas.

Se confirmó nuevamente la raíz Git y `main`; se preservaron los cambios
locales C12C. La sesión de Reformas estaba activa, pero el documento abierto
seguía renderizando la versión anterior («Adjuntos», sin acciones). La
respuesta del servidor local sí contenía `PREVIEW_IMAGE_TYPES` y «Fotos y
adjuntos». Tras recargar realmente la pestaña se confirmó la presencia de
`#photo-dialog`, pero se perdió la sesión en memoria. Se solicitó un nuevo
login al usuario; no se reutilizaron ni extrajeron tokens del navegador.

Para preparar la prueba de varias imágenes se creó una solicitud temporal
ficticia mediante el endpoint existente. PNG y WebP válidos se aceptaron con
HTTP 201, incluidos un nombre largo y metadatos canónicos. Esto verifica la
preparación de datos, no su visualización en el panel.

Al seguir pendiente el login se retiraron ambos objetos mediante la
compensación de C12B1, provocando exclusivamente en esos dos metadatos
temporales un conflicto controlado de path durante el reintento. El backend
devolvió el error seguro de metadatos y eliminó los objetos por la API de
Storage. Después se retiraron los metadatos temporales, jobs, clave de
idempotencia, solicitud y contacto. La consulta final confirmó cero objetos,
metadatos, solicitudes o contactos de esa prueba y cuatro objetos existentes
preservados. No se ejecutó DELETE SQL sobre `storage.objects` ni se alteró
ninguna policy, bucket o Edge Function. Los contadores operativos y logs no se
reescribieron.

La suite completa se ejecutó otra vez: 111 tests, cero fallos. Se mantiene
pendiente la validación visual autenticada: no se afirma haber comprobado
manualmente miniaturas, modal, responsive, firma HTTP o logout/login del bloque
nuevo. PDF conserva exactamente su tratamiento secundario.

Se abrió el panel local y se revisó el detalle anterior con una sesión real de
Reformas. Tras recargar para cargar la implementación nueva, la sesión en
memoria se perdió y se solicitó al usuario iniciar sesión de nuevo sin enviar
contraseñas por chat. No se inventaron credenciales ni se consultó auth.users.

Antes de finalizar se debe verificar en el bloque nuevo:

1. solicitud vacía, una foto y varias fotos;
2. apertura real del JPEG y PDF ficticios existentes;
3. firma HTTP denegada para objeto ajeno/inexistente;
4. escritorio, tablet, móvil estrecho, foco y Escape;
5. recarga/reapertura del detalle y logout/login con nueva lectura.

No existen HEIC/HEIF en los datos DEV inspeccionados: su fallback se verifica
automáticamente, no se afirma una prueba de archivo real. Los fixtures
existentes tienen como máximo una imagen por solicitud; varias imágenes se
han comprobado en tests, no visualmente con datos reales DEV.

Product Design se utilizó para revisar la integración existente; no se
atribuye una auditoría visual completada al bloque nuevo. No hay visor PDF
complejo, conversión, thumbnails, edición, borrado, subida desde panel, OCR,
IA, n8n ni envío de emails. C12 completa quedará cerrada únicamente cuando
C12C cumpla también las validaciones pendientes.
