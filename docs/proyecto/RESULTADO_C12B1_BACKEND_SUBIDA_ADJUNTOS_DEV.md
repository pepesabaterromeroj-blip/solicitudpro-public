# Resultado C12B1 — Backend seguro de subida de adjuntos DEV

## Resultado

C12B1 amplía de forma aislada la Edge Function existente
`receive-public-form`. El endpoint JSON de creación de solicitudes conserva su
ruta y contrato. No se han conectado todavía los formularios públicos ni se ha
añadido UI.

La implementación está desplegada únicamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). El bucket `request-attachments` continúa siendo
privado y no se han añadido policies de escritura para `anon` o
`authenticated`.

## Endpoint y flujo

La ruta backend preparada para C12B2 es:

```text
POST /functions/v1/receive-public-form/api/public/forms/{businessSlug}/{formSlug}/requests/{reference}/attachments
Content-Type: multipart/form-data
Idempotency-Key: {misma clave usada al crear la solicitud}
Campo multipart único: file
```

El backend:

1. comprueba origen, método, tipo de petición y tamaño declarado;
2. exige la misma clave de idempotencia usada para crear la solicitud;
3. llama a `authorize_public_attachment_upload` para resolver el negocio y la
   solicitud sin aceptar `business_id` ni `request_id` del cliente;
4. comprueba que negocio, formulario, referencia, solicitud y clave SHA-256
   pertenecen al mismo contexto y que la autorización de 24 horas no ha
   expirado;
5. valida tamaño, MIME declarado, extensión y firma binaria real;
6. genera un UUID estable y un path canónico;
7. sube al bucket privado con `upsert: false`;
8. registra el metadato en `public.attachments` solo después del upload;
9. devuelve una respuesta mínima sin URL pública ni path interno.

Respuesta correcta:

```json
{
  "attachment_id": "uuid",
  "filename": "nombre-visible.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 12345,
  "status": "stored"
}
```

Una creación nueva devuelve HTTP `201`; un reintento reconocido devuelve
HTTP `200` con el mismo identificador.

## Validaciones del archivo

Se mantiene el máximo de 10 MB definido en C12A. Los únicos MIME admitidos
son:

- `image/jpeg` (`.jpg` o `.jpeg`);
- `image/png` (`.png`);
- `image/webp` (`.webp`);
- `image/heic` (`.heic`);
- `image/heif` (`.heif`);
- `application/pdf` (`.pdf`).

El MIME del navegador no se acepta como única prueba. Se contrasta con la
extensión y con las firmas binarias JPEG, PNG, WebP, HEIC/HEIF o PDF. El nombre
original se limpia de rutas, caracteres de control, caracteres bidireccionales
y espacios anómalos, se limita a 180 caracteres y solo se conserva como
metadato visible.

El nombre físico nunca procede del usuario. Su formato es:

```text
{business_id}/{request_id}/{file_uuid}.{ext}
```

## Autorización y aislamiento

La migración
`supabase/migrations/20260911082835_c12b1_authorize_attachment_upload.sql`
añade la RPC de solo lectura:

```text
authorize_public_attachment_upload(
  p_business_slug,
  p_form_slug,
  p_reference,
  p_idempotency_key_hash
) -> (business_id, request_id)
```

Es `SECURITY INVOKER`, `STABLE` y no realiza escrituras. `PUBLIC`, `anon` y
`authenticated` no tienen `EXECUTE`; solo `service_role`, utilizada dentro de
la Edge Function, puede invocarla. La clave se compara únicamente mediante su
hash SHA-256 y debe corresponder a una solicitud completada y no expirada.

La FK compuesta existente `(request_id, business_id)` sigue siendo la última
defensa contra asociaciones entre negocios. No se modificaron RLS ni permisos
de C12A.

## Idempotencia y reintentos

No fue necesario añadir una columna ni un constraint nuevo. Para cada
solicitud, el backend deriva de `request_id + SHA-256(contenido)` un UUID
determinista. Un reintento del mismo archivo obtiene el mismo `attachment_id`
y path, y la unicidad de `storage_path` impide duplicados incluso ante carreras.

Consecuencia deliberada: dos archivos con bytes idénticos dentro de la misma
solicitud se consideran el mismo adjunto. Un archivo diferente genera otro
UUID aunque reutilice el mismo nombre visible.

## Coherencia y compensación

PostgreSQL y Storage no comparten transacción. El orden aplicado es upload y,
solo tras confirmarlo, inserción de metadata.

- Si Storage falla y el objeto no existe, no se escribe metadata.
- Si el upload tuvo resultado ambiguo o el objeto ya existía, se verifica el
  objeto y el metadato determinista antes de decidir si es un reintento.
- Si falla la inserción de metadata después del upload, se vuelve a comprobar
  si otra ejecución completó el mismo metadato. Si no, se elimina el objeto con
  la API de Storage.
- Si la compensación falla, se registra en logs técnicos
  `metadata_failed_cleanup_failed`, la petición no se presenta como exitosa y
  no se envían detalles internos al cliente.

Los dos metadatos legacy conservados por C12A no se tocaron.

## Errores públicos

El endpoint diferencia de forma segura:

- petición o multipart inválido;
- solicitud no disponible para adjuntos;
- MIME o extensión no permitidos;
- firma binaria incompatible;
- archivo vacío o superior a 10 MB;
- fallo de Storage;
- fallo de metadata;
- fallo de compensación que requiere revisión técnica.

No devuelve credenciales, stack traces, paths internos ni URLs permanentes.

## Pruebas

Se verificó en local:

- detección de JPEG y PDF;
- rechazo de MIME, extensión/firma incompatible y tamaño superior a 10 MB;
- path multi-tenant y UUID determinista;
- reintento sin duplicado;
- upload fallido sin metadata;
- fallo de metadata seguido de eliminación compensatoria;
- preservación del endpoint JSON y de C11/C12A.

En Supabase DEV, con datos totalmente ficticios, se comprobó:

- solicitud válida y autorización correcta por negocio, formulario,
  referencia y hash;
- rechazo cross-tenant;
- RPC no ejecutable por `PUBLIC`, `anon` ni `authenticated`;
- JPEG: un objeto y un metadato con negocio/solicitud/path correctos;
- PDF: un objeto y un metadato correctos;
- reintento JPEG: HTTP `200`, mismo `attachment_id` y una sola fila;
- SVG rechazado con HTTP `415` y sin residuos;
- archivo superior a 10 MB rechazado con HTTP `413` y sin residuos;
- fallo de metadata forzado tras upload: respuesta de error y objetos
  eliminados por compensación;
- limpieza final: cero solicitudes, contactos, claves, metadatos y objetos de
  prueba.

La suite completa se ejecuta con `node --test tests/*.js`. También se validan
los dos archivos TypeScript modificados con `node --check` y el diff con
`git diff --check`.

## Qué debe hacer C12B2

C12B2 debe conservar la clave de idempotencia generada para la solicitud. Tras
recibir la referencia del POST JSON exitoso, debe enviar cada archivo en una
petición multipart separada a la ruta indicada, usando esa misma clave y un
único campo `file`.

El navegador no debe usar el SDK de Storage ni escribir en `attachments`. Debe
mostrar los errores seguros del endpoint y considerar HTTP `200` y `201` como
éxito. La subida debe realizarse dentro de las 24 horas de vigencia de la clave
de la solicitud.

## Límites y fuera de alcance

- Se procesa un archivo por petición para simplificar reintentos y
  compensación.
- El límite de 10 MB se mantiene por compatibilidad con C12A; para este tamaño,
  una futura revisión podría valorar upload resumible si la experiencia de red
  lo exige.
- No se añadieron inputs, UX pública, visualización, signed URLs, borrado desde
  UI, OCR, thumbnails, emails ni n8n.
- No se modificaron landing, producción ni Supabase de landing.
