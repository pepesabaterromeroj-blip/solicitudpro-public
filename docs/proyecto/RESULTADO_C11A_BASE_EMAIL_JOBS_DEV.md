# C11A — Base robusta de trabajos de email en Supabase DEV

Estado: estructura aplicada y verificada únicamente en `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). **C11A finalizada.**

## Arquitectura final

Se creó `public.email_jobs` como cola backend-only y fuente de verdad de los
trabajos de email. La tabla no envía mensajes, no ejecuta automatizaciones y no
almacena cuerpos HTML, plantillas completas, credenciales ni secretos.

`public.email_templates` ya existía, pero no era una infraestructura equivalente:
representa contenido configurable y no el ciclo de vida de un trabajo. Por eso
se mantiene separada y sin cambios.

Cada job referencia una solicitud y su negocio mediante una FK compuesta. C11B
podrá crear, como máximo, estos dos trabajos por solicitud:

- `customer_confirmation`: confirmación al cliente.
- `business_notification`: aviso interno al negocio.

Los destinatarios y el contenido se resolverán en backend a partir de los datos
vigentes de solicitud, contacto, negocio y plantilla. No se duplican en la cola.

## Tabla, campos y restricciones

| Campo | Propósito |
| --- | --- |
| `id` | UUID único del trabajo. |
| `business_id` | Negocio propietario; forma parte de la relación multi-tenant. |
| `request_id` | Solicitud origen. |
| `email_type` | `customer_confirmation` o `business_notification`. |
| `status` | `pending`, `processing`, `sent` o `failed`; empieza en `pending`. |
| `attempt_count` | Número no negativo de intentos realizados. |
| `available_at` | Momento mínimo para reclamar el trabajo o reintentarlo. |
| `processing_started_at` | Inicio del procesamiento; obligatorio en estado `processing`. |
| `sent_at` | Fecha real de envío; existe exclusivamente en estado `sent`. |
| `last_error` | Error operativo saneado para diagnóstico/reintento; obligatorio en `failed`. |
| `created_at` | Fecha de creación del job. |
| `updated_at` | Última actualización escrita por el backend ejecutor. |

Restricciones principales:

- FK `(request_id, business_id)` → `requests(id, business_id)`, que impide asociar
  una solicitud a un negocio distinto.
- `UNIQUE (request_id, email_type)`, que bloquea la duplicación del mismo tipo de
  email para una solicitud.
- Checks de tipos, estados, intentos, error, inicio de procesamiento y fecha de
  envío.
- Índice parcial `email_jobs_pending_idx` sobre
  `(available_at, created_at, id) WHERE status = 'pending'` para la búsqueda
  ordenada de trabajo disponible.
- Índice `email_jobs_request_business_fk_idx` sobre `(request_id, business_id)`
  para cubrir la FK.

## Seguridad y RLS

RLS está activado. No existe ninguna policy para `anon` ni para
`authenticated`, y ambos roles tienen revocados todos los privilegios sobre la
tabla. Por tanto, el frontend no puede consultar, insertar, modificar, borrar ni
falsificar jobs, incluidos los del propio negocio.

Esta denegación total es intencional en C11A: todavía no hay una necesidad de UI
que justifique lectura autenticada. Además de reducir superficie de ataque,
garantiza que un usuario de un negocio no pueda consultar ni manipular jobs de
otro. El rol backend `service_role` dispone de las operaciones necesarias; su
clave no se incorpora al repositorio ni debe enviarse nunca al navegador.

El asesor de seguridad informa de “RLS enabled no policy”. En esta tabla es una
decisión deliberada de denegación por defecto, reforzada mediante `REVOKE` para
los roles públicos. El aviso de protección de contraseñas filtradas que también
muestra el proyecto es previo y ajeno al alcance de C11A.

## Idempotencia

La unicidad `(request_id, email_type)` permite reintentar la creación de los jobs
de C11B sin duplicarlos. La creación futura deberá usar una operación backend
transaccional y tratar el conflicto de unicidad como trabajo ya existente.

Esta idempotencia es distinta de la clave de idempotencia del formulario público:
una evita solicitudes duplicadas y la otra evita trabajos de email duplicados
para una solicitud ya aceptada.

## Interfaz prevista para n8n en C13

n8n no está conectado en C11A. En C13 deberá ejecutarse solo en servidor con una
credencial backend, nunca con una clave expuesta al frontend, y seguir este ciclo:

1. Reclamar de forma atómica un lote `pending` cuyo `available_at <= now()`,
   ordenado por `available_at`, `created_at` e `id`.
2. Cambiar cada job a `processing`, escribir `processing_started_at`, incrementar
   `attempt_count` y actualizar `updated_at` en la misma reclamación.
3. Resolver destinatario y contenido desde las tablas relacionadas; no confiar
   en datos aportados por el navegador.
4. Tras el proveedor, marcar `sent` junto con `sent_at`, o `failed` junto con un
   `last_error` saneado.
5. Para reintentar, volver a `pending` y programar `available_at` según la política
   que se defina en C13.

La función o RPC de reclamación atómica todavía no se crea: debe diseñarse en C13
cuando se concrete el modelo de ejecución y concurrencia de n8n. Un flujo basado
en `SELECT` seguido de `UPDATE` por separado no será suficiente si existen varios
workers.

## Archivos y migraciones

- `supabase/migrations/20260910082352_c11a_email_jobs.sql`: tabla, constraints,
  índice de pendientes, RLS, grants y comentarios.
- `supabase/migrations/20260910082542_c11a_email_jobs_fk_index.sql`: ajusta el
  orden del índice relacional para cubrir exactamente la FK compuesta, tras la
  comprobación del asesor de rendimiento.
- `tests/c11a-email-jobs-schema.test.js`: contrato local de esquema, seguridad,
  idempotencia y ausencia de envío automático.
- Este documento.

Ambas versiones coinciden con el historial real de migraciones de Supabase DEV.
No se modificó `supabase/functions/receive-public-form/index.ts`.

## Pruebas reales

- La migración `c11a_email_jobs` y su ajuste de índice se aplicaron correctamente
  en el proyecto DEV autorizado.
- Catálogo PostgreSQL: tabla y campos presentes, RLS activo, cero policies para
  `email_jobs`, cero privilegios para `anon`/`authenticated` y acceso backend.
- Prueba con `SET LOCAL ROLE authenticated` y usuarios ficticios de dos negocios:
  lectura, inserción, actualización y borrado fueron denegados; también se probó
  el acceso cruzado en ambos sentidos.
- Prueba transaccional: el duplicado `(request_id, email_type)` produjo violación
  de unicidad; una combinación solicitud/negocio cruzada produjo violación de FK;
  un estado no permitido produjo violación de check.
- Todas las pruebas de datos se ejecutaron dentro de transacciones con `ROLLBACK`.
  La tabla quedó con `0` filas técnicas persistidas.
- El asesor de rendimiento dejó de señalar la FK de `email_jobs` como no cubierta.
  Los avisos restantes pertenecen a estructuras anteriores o a índices nuevos aún
  sin uso por no existir jobs reales.
- `EXPLAIN` de la consulta prevista de pendientes confirmó `Index Scan` mediante
  `email_jobs_pending_idx`.
- `node --test tests/*.js`: **80 pruebas correctas, 0 fallos**.
- `node --check tests/c11a-email-jobs-schema.test.js`: sin errores.
- `git diff --check`: sin errores.
- La suite completa incluye las pruebas de C10A, C10B y C10C; todas continuaron
  correctas.

## Limitaciones y siguiente paso

C11A no crea jobs automáticamente, no modifica `receive-public-form`, no añade UI,
no conecta n8n ni proveedor de correo y no realiza envíos. Tampoco define contenido
definitivo, política final de reintentos ni reclamación concurrente.

El siguiente paso es C11B: crear de forma backend y transaccional los dos tipos de
job al aceptar una solicitud pública, preservando la idempotencia existente y sin
activar todavía el envío real.
