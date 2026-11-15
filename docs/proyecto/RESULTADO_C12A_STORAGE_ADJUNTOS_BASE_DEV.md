# C12A — Base segura de adjuntos y fotos en Supabase Storage DEV

Estado: aplicado y validado únicamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). **C12A finalizada.**

## Arquitectura elegida

Se reutiliza la tabla existente `public.attachments`; no se crea una tabla
`request_attachments` duplicada. La tabla ya separaba correctamente los
metadatos del binario y tenía:

- UUID propio;
- `business_id` y `request_id`;
- FK compuesta `(request_id, business_id)` hacia `requests`;
- `storage_path` único;
- `file_name`, `mime_type`, `size_bytes`, origen y fecha;
- `uploaded_by` opcional para una futura subida interna;
- `deleted_at` para borrado lógico futuro.

`file_name` conserva el nombre original visible únicamente como metadato.
Nunca se usa como nombre físico ni se guardan binarios en PostgreSQL.

Las migraciones versionadas son:

- `supabase/migrations/20260911080621_c12a_request_attachments_storage.sql`;
- `supabase/migrations/20260911081108_c12a_attachment_uploader_fk_index.sql`.

## Bucket y límites

Se creó el bucket privado `request-attachments` con:

- `public = false`;
- límite por objeto de 10 MiB (`10 485 760` bytes);
- `image/jpeg`;
- `image/png`;
- `image/webp`;
- `image/heic`;
- `image/heif`;
- `application/pdf`.

No se admiten SVG, HTML, ejecutables ni otros tipos. El bucket limita el MIME y
el tamaño declarado; C12B deberá validar además la firma/contenido real del
archivo y rechazar archivos vacíos antes de subirlos.

## Ruta canónica

Todo objeto nuevo debe usar:

```text
{business_id}/{request_id}/{file_uuid}.{ext}
```

Los dos primeros segmentos deben coincidir exactamente con los UUID del
metadato y su FK compuesta. El tercer segmento es un UUID nuevo, nunca el nombre
original. Solo se permiten las extensiones `jpg`, `jpeg`, `png`, `webp`,
`heic`, `heif` y `pdf`, coherentes con `mime_type`.

Esta estructura evita colisiones y datos personales en el path, y permite que
las policies validen tenant y solicitud sin confiar en nombres aportados por el
cliente.

## Constraints e índices

Para filas nuevas o modificadas, `public.attachments` exige:

- tamaño entre 1 byte y 10 MiB;
- MIME dentro de la lista aprobada;
- extensión coherente con el MIME;
- path canónico ligado a `business_id` y `request_id`;
- FK compuesta válida;
- `storage_path` único.

El índice simple de `request_id` se sustituyó por
`attachments_request_business_fk_idx (request_id, business_id)`, que cubre la
FK y las consultas por solicitud y negocio. El índice simple de negocio se
sustituyó por `attachments_business_uploaded_by_fk_idx (business_id,
uploaded_by)`; conserva las búsquedas por negocio y cubre la FK opcional del
usuario que realizó una futura subida interna.

DEV contenía antes de C12A dos metadatos ficticios del seed inicial, con tamaño
cero, rutas `development/...` y sin objetos reales en Storage. Se preservaron
para no borrar datos preexistentes. Por ello los nuevos checks se añadieron
`NOT VALID`: PostgreSQL los aplica a toda fila nueva o cambiada, pero no fuerza
una migración destructiva de esos fixtures históricos. Las policies canónicas
los excluyen de las lecturas autenticadas de C12C. Una limpieza futura podrá
retirarlos de forma explícita sin afectar objetos, porque nunca existieron.

## RLS y permisos de metadatos

RLS permanece activa en `public.attachments`.

- `anon`: todos los privilegios revocados.
- `authenticated`: únicamente `SELECT`.
- `service_role`: operaciones backend necesarias.
- No hay policy autenticada de `INSERT`, `UPDATE` o `DELETE`.

La única policy de lectura muestra un metadato cuando:

1. no está borrado lógicamente;
2. usa el path canónico que coincide con negocio y solicitud;
3. `auth.uid()` tiene una membresía activa en ese `business_id`.

Esto mantiene el aislamiento multi-tenant y deja el panel preparado para
consultar metadatos sin abrir escrituras.

## Seguridad de Storage

`storage.objects` tiene una única policy C12A para este bucket:
`SELECT TO authenticated`. Exige simultáneamente:

- bucket `request-attachments`;
- metadato activo en `public.attachments` con el mismo `storage_path`;
- primer y segundo segmento iguales a `business_id` y `request_id`;
- membresía activa del usuario en el negocio.

No se creó ninguna policy `anon` ni policy de `INSERT`, `UPDATE` o
`DELETE` para el bucket. Por tanto, el frontend no puede subir, sustituir,
mover ni borrar objetos.

## Flujo previsto para C12B

C12B deberá mantener este flujo completamente server-side:

1. El formulario envía el archivo a un backend o Edge Function controlado, no
   directamente al bucket.
2. El backend valida solicitud y negocio, nombre, tamaño, MIME permitido y
   firma/contenido real; no confía en IDs o cabeceras enviados por el navegador.
3. Genera un UUID de archivo y la extensión canónica correspondiente.
4. Sube mediante la API de Storage al bucket privado y al path canónico.
5. Solo después de una subida confirmada inserta `public.attachments` con la
   misma pareja solicitud/negocio.
6. Si falla el metadato, elimina el objeto mediante la API de Storage como
   compensación; nunca mediante SQL directo sobre `storage.objects`.
7. Si falla la compensación, registra el incidente de forma saneada para una
   reconciliación backend. Si falla la subida, no crea metadato.

Storage y PostgreSQL no ofrecen una transacción atómica conjunta. Esta secuencia,
el path único y la compensación son la estrategia mínima para evitar objetos
huérfanos o metadatos sin archivo. La credencial privilegiada permanece
exclusivamente en servidor; C12B no necesitará policies `anon`.

## Lectura prevista para C12C

El panel autenticado podrá:

1. consultar metadatos visibles mediante `public.attachments`;
2. descargar el objeto privado con su JWT, sujeto a la policy de
   `storage.objects`.

Si C12C necesita URLs temporales para imágenes o PDFs, podrá usar URLs firmadas
de corta duración mediante un backend seguro. No se crearán URLs públicas
permanentes ni se relajarán las policies para facilitar la UI.

## Pruebas reales

Se verificó en Supabase DEV:

- bucket existente, privado, con 10 MiB y los seis MIME exactos;
- RLS activa y permisos efectivos de la tabla;
- lectura del negocio propio y ocultación del negocio ajeno para owner
  autenticado;
- misma separación multi-tenant en `storage.objects`;
- lectura e inserción denegadas a `anon`;
- INSERT, UPDATE y DELETE de metadata denegados al frontend autenticado;
- INSERT, UPDATE y DELETE de objetos sin policy de escritura;
- rechazo de FK solicitud/negocio cruzada;
- rechazo de path duplicado;
- rechazo de MIME, tamaño y path inválidos;
- índice compuesto de la FK;
- ausencia de objetos y metadatos técnicos persistidos tras las pruebas.

Las filas y objetos de prueba fueron ficticios y se crearon únicamente dentro
de transacciones con `ROLLBACK`. La prueba de objetos solo ejercitó sus
metadatos RLS transitorios; no subió binarios ni usó SQL para operaciones reales
de Storage.

El asesor posterior no añadió incidencias de seguridad atribuibles a C12A. Los
avisos previos sobre colas backend sin policies y protección de contraseñas de
Auth quedan fuera de esta fase. El asesor de rendimiento dejó de señalar las dos
FK de `attachments`; el nuevo índice figura como no usado porque todavía no hay
un flujo real de adjuntos, comportamiento esperado en C12A.

La suite local completa, el check de sintaxis y `git diff --check` se ejecutaron
como verificación final. C10 y C11 permanecieron sin regresiones.

## Límites de C12A

C12A no añade inputs, subida desde formularios, Edge Functions, signed URLs,
visualización, borrado, compresión, OCR, IA, n8n ni envío de emails. Tampoco
modifica la landing, producción o el Supabase de landing.

La comprobación binaria real, compensación entre Storage y PostgreSQL, política
de retención y experiencia de visualización pertenecen a C12B/C12C.
