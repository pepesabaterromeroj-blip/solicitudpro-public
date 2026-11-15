# Auditoría global C10-C12 previa a C13

Fecha: 15 de septiembre de 2026.

Ámbito: repositorio `pepesabaterromeroj-blip/solicitudpro`, rama `main`,
`HEAD fd68499`, y únicamente Supabase DEV `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). No se modificaron producción, landing, Auth, RLS,
Storage, funciones desplegadas ni datos. No se hizo commit ni push.

## Resultado ejecutivo

| Fase | Estado | Evidencia principal |
| --- | --- | --- |
| C10A — estado y prioridad | OK | PATCH autenticado y acotado por solicitud/negocio, valores y cierres validados, respuesta servidor obligatoria, filtros y métricas coherentes. |
| C10B — seguimiento y archivado | OK | Seguimiento pendiente pasa a completado con `completed_at`; archivado usa `archived_at`, nunca DELETE; vistas Activas/Archivadas/Todas cubiertas. |
| C10C — notas internas | OK | Usa `activities.type = 'internal_note'`; FK y RLS preservan tenant; la UI solo incorpora la fila confirmada y revierte visualmente ante error. |
| C11A — `email_jobs` | OK | Esquema, lifecycle, constraints, índice parcial, FK compuesta, idempotencia y backend-only coinciden entre repo y DEV. |
| C11B — generación de jobs | OK | Cada nueva solicitud pública aceptada crea en la misma transacción los dos tipos exactos; reintento no duplica y no hay jobs retroactivos. |
| C11C — contexto | OK | RPC real `get_email_job_context(uuid)`, `STABLE`, `SECURITY INVOKER`, backend-only y payload humano normalizado. |
| C12A — Storage y metadata | OK | Bucket privado, 10 MiB, seis MIME admitidos, paths canónicos, FK tenant, RLS de lectura y cuatro checks `NOT VALID` intencionales por legacy. |
| C12B1 — backend de subida | OK | Edge Function desplegada idéntica al repo; autorización server-side, firma binaria, path determinista, idempotencia y compensación. |
| C12B2 — formularios | OK | Un uploader común para los seis sectores, solicitud primero, máximo 5, 10 MiB, reintento solo de fallidos y contexto sensible solo en memoria. |
| C12C — visualización | OK | Previews, modal, fallbacks HEIC/HEIF, PDF secundario, firmas de 120 s, responsive y cross-tenant real ya validados. |

## Estado Git preservado

La raíz es `C:/Users/ciclo1/Downloads/demo solicitudpro/solicitudpro`, la rama
es `main` y `origin` corresponde al repositorio esperado. Al iniciar había un
único cambio local: la actualización documental final de C12C. Esta auditoría
lo preserva y añade solamente este documento.

## Flujo de extremo a extremo

El flujo implementado es coherente:

1. El formulario sectorial genera una clave de idempotencia en memoria y envía
   JSON a `receive-public-form`.
2. La Edge Function valida origen, tamaño, payload y protección de tasa; el
   backend deriva negocio y formulario por sus slugs publicados.
3. `submit_public_form_submission` crea contacto, solicitud, respuestas y
   seguimiento mediante la RPC base; la envoltura C11B crea también
   `customer_confirmation` y `business_notification` dentro de la misma
   transacción.
4. Los adjuntos opcionales se envían después. La clave y referencia de la
   solicitud autorizan temporalmente cada upload en backend; no se confían
   `business_id` o `request_id` proporcionados por el navegador.
5. Storage conserva el objeto privado y `attachments` su metadata. Una FK
   `(request_id, business_id)` y el path canónico impiden asociaciones entre
   tenants; si falla metadata tras el upload se elimina el objeto.
6. El panel autenticado lee bajo RLS y obtiene firmas temporales para los
   objetos autorizados. C10 actualiza estado/prioridad, seguimiento, notas y
   archivado sin alterar jobs ni adjuntos.
7. `get_email_job_context` reúne job, destinatario, negocio, cliente, solicitud
   y respuestas dinámicas para el futuro worker.

No se detectaron IDs inconsistentes, duplicados de `(request_id, email_type)`,
jobs o metadata huérfanos, objetos canónicos sin metadata, metadata canónica sin
objeto ni asociaciones multi-tenant incorrectas.

## C10 y regresiones

El código C12 añadió al panel únicamente lectura/renderizado de adjuntos,
lightbox y estilos responsive. No cambió las funciones C10 de escritura.
Los tests ejecutan el código real del panel en un entorno DOM controlado y
cubren PATCH acotado, respuesta confirmada, descarte tras logout, fallos
seguros, filtros, `completed_at`, ausencia de DELETE y notas no optimistas.

DEV mantiene RLS activa y FKs compuestas para `requests`, `follow_ups` y
`activities`. Hay 31 solicitudes, un archivado, un seguimiento completado y
una nota interna persistida como evidencia DEV previa. No se repitieron las
pruebas manuales históricas porque el código de C10 afectado no ha cambiado y
la suite de regresión sigue vigente.

## C11 y preparación funcional

DEV contiene 8 jobs pendientes correspondientes a 4 solicitudes. Para cada
solicitud existen exactamente dos filas, una por tipo. Resultado de integridad:

- duplicados: 0;
- jobs huérfanos o con tenant incorrecto: 0;
- destinatarios requeridos ausentes: 0;
- solicitudes públicas posteriores a C11B sin sus jobs: 0;
- solicitudes anteriores a C11 con jobs retroactivos: 0.

Los contextos actuales devuelven las seis claves de primer nivel documentadas,
destinatario no vacío y respuestas compuestas solo por `label` y `value`. La
prueba C11C anterior, realizada con ROLLBACK, cubrió los seis sectores. DEV
conserva un formulario publicado y un email interno utilizable para cada uno de
Reformas, Electricidad, Fontanería, Climatización, Cristalerías y Academias.

La idempotencia de creación está resuelta por
`UNIQUE (request_id, email_type)`. Esto no equivale a idempotencia de entrega:
si el proveedor envía y el workflow pierde la respuesta, la base no puede saber
por sí sola si hubo entrega.

## C12 y residuos

`request-attachments` continúa privado, con límite 10 MiB y MIME JPEG, PNG,
WebP, HEIC, HEIF y PDF. RLS permite solo lectura autenticada ligada a membresía;
no existen escrituras directas de frontend ni policies `anon`.

Los cuatro constraints C12A `NOT VALID` (tamaño, MIME, path y coherencia
MIME/extensión) son deliberados: se aplican a toda fila nueva o modificada sin
invalidar dos registros legacy previos. El estado actual conserva 4 objetos
previstos y 2 metadatos legacy. La consulta final detectó 0 residuos técnicos,
0 huérfanos y 0 asociaciones de tenant incorrectas.

La versión 5 desplegada de `receive-public-form` coincide, archivo por archivo,
con `index.ts` y `attachment-upload.ts` del repositorio.

## Seguridad global

- Todas las tablas públicas tienen RLS activa.
- No existe ninguna policy para `anon`, ningún bucket público ni función
  `SECURITY DEFINER` en `public`.
- `email_jobs`, las tablas de idempotencia y rate limit no tienen policies de
  fila por diseño: son backend-only. El aviso informativo del asesor es esperado.
- `get_email_job_context`, `authorize_public_attachment_upload` y la RPC pública
  protegida no son ejecutables por `PUBLIC`, `anon` o `authenticated`; sí por el
  backend.
- No se hallaron credenciales privilegiadas en frontend, firmas persistidas,
  claves secretas, contraseñas, claves privadas ni archivos temporales.
- Las firmas de adjuntos duran 120 segundos y no se guardan en BD,
  `localStorage`, `sessionStorage` ni logs.
- La única referencia SQL a `auth.users` es la FK estándar de `profiles.id`;
  no existe SELECT, INSERT, UPDATE o DELETE directo sobre esa tabla.
- La prueba HTTP cross-tenant C12C no se repitió: Owner A obtuvo 0 filas y no
  pudo firmar ni leer el objeto de B; Owner B sí obtuvo metadata, firma y JPEG.

El asesor de seguridad conserva un aviso de proyecto: protección frente a
contraseñas filtradas desactivada. Es endurecimiento de Auth recomendable antes
de producción, pero no fue introducido por C10-C12 ni bloquea C13 en DEV.
Los avisos de rendimiento son informativos con el volumen actual; el índice
parcial `email_jobs_pending_idx` aparece aún sin uso porque todavía no existe
worker. No se eliminaron índices.

## Auditoría de migraciones

Las 7 migraciones C11/C12 de `supabase/migrations/`:

- existen, no están vacías y no repiten versión o nombre;
- aparecen en DEV en el mismo orden;
- su SQL aplicado coincide exactamente con el archivo local;
- no contienen CREATE/DROP contradictorios. Las dos migraciones cortas de
  índices sustituyen deliberadamente un índice por el orden que cubre su FK.

Existe una deuda de reproducibilidad anterior a C11. DEV registra cinco
migraciones históricas (esquema inicial, sectores, RLS, índices y C8B) cuyo SQL
equivalente está en `docs/proyecto/sql/`, no en `supabase/migrations/`.
Además, C1/C2 y los seeds/configuraciones C6/C7/C8A se aplicaron mediante SQL
controlado pero no constan como entradas separadas del historial formal.
Por tanto, las 7 migraciones actuales reproducen C11/C12 sobre el baseline
existente, pero `supabase/migrations/` por sí solo no puede levantar desde cero
todo SolicitudPro. No se renombró ni reorganizó ninguna migración aplicada.

Esta deuda no altera DEV ni impide diseñar el worker, pero debe reconciliarse
antes del primer entorno limpio o promoción a producción. La solución segura
es inventariar el baseline aplicado, conservar sus versiones históricas y
validar una reconstrucción en una base desechable; no crear una migración
gigante improvisada sobre DEV.

## Calidad de tests

La suite combina:

- tests de comportamiento real del panel para C10 y C12C;
- tests unitarios ejecutables de validación, idempotencia y compensación C12B1;
- tests del uploader y reintentos C12B2;
- contratos estáticos de migrations para C11/C12A;
- pruebas transaccionales DEV documentadas para las invariantes que requieren
  PostgreSQL/RLS/Storage reales.

Los tests C11 son principalmente contractuales sobre SQL y, aislados, podrían
dar un falso positivo si DEV divergiera. Esta auditoría compensa esa limitación
comparando el SQL aplicado, catálogo, grants, funciones y datos reales. La
carencia estructural que permanece es no disponer aún de una reconstrucción
automática de base limpia desde `supabase/migrations/`.

## Análisis pre-n8n

### Lo que ya está listo

`email_jobs` tiene estados `pending`, `processing`, `sent` y `failed`, contador
de intentos, disponibilidad, inicio de procesamiento, fecha de envío, error
saneado, índice de pendientes y un ID estable. El contexto normalizado evita
joins o condicionales sectoriales en n8n.

### Lo que falta antes de conectar el workflow

No existe todavía una operación atómica que seleccione con bloqueo un job
pendiente y lo cambie a `processing`. La única función de worker es la lectura
`get_email_job_context`. Tampoco existe una interfaz acotada para resolver un
intento como `sent` o `failed`. Conectar n8n ahora obligaría a una secuencia
SELECT/UPDATE vulnerable a carrera o a entregar acceso directo amplio con
`service_role`.

Ante reinicio, timeout o dos ejecuciones concurrentes, el esquema aporta datos
para recuperación, pero no impone aún el protocolo. Ante «proveedor entregó,
n8n perdió la respuesta», la garantía depende de usar `email_jobs.id` como
clave de idempotencia de proveedor. Si el proveedor elegido no admite una clave
idempotente, el sistema será al menos una vez y conservará una ventana real de
duplicado; C13 debe hacer explícita esa decisión.

## Decisión: fase mínima recomendada

Nombre sugerido: **PRE-C13 — Puente seguro de worker de emails**.

Objetivo: validar el contrato de concurrencia y mínimo privilegio antes de
introducir n8n o un proveedor.

Cambios exactos propuestos:

1. Una migration versionada con una RPC de claim que use
   `FOR UPDATE SKIP LOCKED`, `available_at <= now()`, cambie a `processing`,
   establezca `processing_started_at`, incremente `attempt_count` y devuelva el
   intento reclamado.
2. Operaciones acotadas de `sent` y `failed/retry` que exijan `job_id`, estado
   `processing` y el `attempt_count` esperado, evitando que un worker antiguo
   resuelva un intento ya recuperado.
3. Recuperación explícita de jobs `processing` caducados y política pequeña de
   reintentos usando `available_at`; sin borrar jobs enviados.
4. Una Edge Function/backend de capacidad limitada para n8n. La credencial
   amplia permanece dentro de Supabase; n8n recibe únicamente una credencial
   dedicada al endpoint y no acceso general a tablas.
5. Entregar contexto mediante la RPC C11C existente y usar `email_jobs.id` como
   idempotency key del proveedor cuando este lo soporte.
6. Tests de claim concurrente, ausencia de doble claim, transición válida,
   rechazo de intento obsoleto, recuperación, permisos y errores saneados.

Riesgo: bajo si se mantiene aislada; alto si se omite y n8n opera directamente
sobre la tabla. Tamaño estimado: pequeño, una migration, una vía backend mínima,
aproximadamente 6-10 tests y documentación. No incluye workflow, proveedor,
plantillas ni envío real, por lo que conviene validarla antes de C13.

La reconciliación del baseline de migrations debe registrarse como deuda de
infraestructura paralela y resolverse antes de crear un entorno nuevo; no amplía
el puente worker ni requiere tocar DEV en esta auditoría.

## Correcciones realizadas

Ninguna corrección funcional. No apareció un bug pequeño que justificase tocar
código, migrations, RLS o datos. Solo se creó este informe y se preservó el
cambio documental previo de C12C.

## Verificación final

- `node --test tests/*.js`: 113 tests, 113 correctos, 0 fallos.
- `node --check`: 30 archivos JavaScript correctos.
- Deno CLI no está instalado en este equipo. El TypeScript de la función queda
  cubierto por la importación ejecutable del helper, los tests específicos y la
  comparación exacta entre los dos archivos locales y la versión 5 activa en DEV.
- `git diff --check`: correcto; únicamente se informa la conversión futura de
  LF a CRLF del documento C12C, sin error de whitespace.
- Revisión de secretos y archivos temporales: sin hallazgos.
- Estado final esperado: dos documentos modificados/no confirmados, sin cambios
  de código, SQL ni configuración remota.

## Limitaciones

- No existe todavía claim/lease ni resolución acotada de jobs.
- La entrega exactamente una vez exige idempotencia admitida por el proveedor;
  no puede deducirse solo del estado PostgreSQL.
- El baseline pre-C11 no está completo en el directorio formal de migrations.
- La protección de contraseñas filtradas está desactivada en DEV.
- Los cuatro checks C12A permanecen `NOT VALID` para conservar dos filas legacy.

PREPARADO PARA C13: NO
