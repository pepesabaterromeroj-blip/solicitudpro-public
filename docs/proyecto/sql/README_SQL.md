# SQL local de SolicitudPro

La primera migración, los sectores y el borrador RLS se aplicaron **solo** en
el proyecto de desarrollo `solicitudpro-app-dev` durante B3. No se han aplicado
en producción, no están conectados a la landing ni conectan la demo local. El
detalle queda registrado en `RESULTADO_B3_SUPABASE_DEV.md`.

## Archivos

| Archivo | Propósito | Estado |
| --- | --- | --- |
| `001_initial_schema.sql` | Tablas, constraints e índices de la primera migración MVP. | Aplicado solo en desarrollo. |
| `002_rls_policies_draft.sql` | Borrador de aislamiento multiempresa con RLS. | Aplicado y validado solo en desarrollo. |
| `003_seed_sectors.sql` | Cuatro sectores de referencia. | Aplicado dos veces en desarrollo; idempotente. |
| `004_indexes_review.sql` | Índices adicionales revisados tras la validación. | Aplicado solo en desarrollo durante C1. |
| `005_public_form_submission_rpc.sql` | Operación transaccional para recepción pública desde servidor. | Aplicada solo en desarrollo durante C1. |
| `006_public_form_rate_limit_idempotency.sql` | Límite persistente e idempotencia de la recepción pública. | Aplicado solo en desarrollo durante C2. |
| `../../../supabase/migrations/20260910082352_c11a_email_jobs.sql` | Cola backend-only de trabajos de email, constraints, RLS e índices. | Aplicada solo en desarrollo durante C11A. |
| `../../../supabase/migrations/20260910082542_c11a_email_jobs_fk_index.sql` | Ajuste del índice que cubre la FK compuesta de los jobs. | Aplicada solo en desarrollo durante C11A. |
| `../../../supabase/migrations/20260910092630_c11b_email_jobs_from_public_form.sql` | Creación transaccional e idempotente de dos jobs al aceptar una solicitud pública. | Aplicada solo en desarrollo durante C11B. |
| `../../../supabase/migrations/20260910111207_c11c_email_job_context.sql` | RPC backend-only de contexto normalizado y dinámico para cada trabajo de email. | Aplicada solo en desarrollo durante C11C. |
| `../../../supabase/migrations/20260911080621_c12a_request_attachments_storage.sql` | Bucket privado, constraints y acceso de lectura multi-tenant para adjuntos. | Aplicada solo en desarrollo durante C12A. |
| `../../../supabase/migrations/20260911081108_c12a_attachment_uploader_fk_index.sql` | Ajuste del índice que cubre la FK opcional del usuario que sube un adjunto. | Aplicada solo en desarrollo durante C12A. |
| `../../../supabase/migrations/20260911082835_c12b1_authorize_attachment_upload.sql` | RPC backend-only que valida la capacidad temporal de subida contra negocio, formulario y solicitud. | Aplicada solo en desarrollo durante C12B1. |

C11A incorpora `email_jobs` como cola backend-only, todavía sin creación
automática, n8n, proveedor ni envío real. `automation_logs` y cualquier registro
adicional permanecen fuera hasta que exista un flujo real que los necesite.
C11B crea los dos jobs previstos dentro de la transacción de recepción pública.
C11C añade exclusivamente una lectura normalizada para backend; no reclama jobs,
no cambia estados y no envía mensajes.
C12A reutiliza `attachments`, crea el bucket privado
`request-attachments` y deja las escrituras reservadas al backend.
C12B1 amplía `receive-public-form` con una ruta multipart server-side,
validación binaria, paths deterministas y compensación Storage/metadata, sin
conectar todavía los formularios.

## Orden futuro de ejecución

Para un proyecto Supabase de desarrollo nuevo, el orden previsto es:

1. Revisar [CIERRE_ESQUEMA_DATOS_MVP.md](../CIERRE_ESQUEMA_DATOS_MVP.md) y
   resolver las decisiones abiertas.
2. Aplicar `001_initial_schema.sql` en una base de datos de desarrollo, nunca
   primero en producción.
3. Aplicar `003_seed_sectors.sql`.
4. Crear dos negocios de prueba, dos perfiles y sus membresías.
5. Aplicar y probar `002_rls_policies_draft.sql` con esas dos cuentas.
6. Verificar que cada usuario solo puede acceder a su propio `business_id`.
7. Construir después un endpoint o función segura para formularios públicos.

En `solicitudpro-app-dev`, los pasos 2 a 5 ya se completaron durante B3.
`004_indexes_review.sql` se aplicó en `solicitudpro-app-dev` durante C1 tras
una nueva revisión. La función de `005_public_form_submission_rpc.sql` también
se aplicó solo en ese proyecto de desarrollo. C2 aplicó
`006_public_form_rate_limit_idempotency.sql` y desplegó la Edge Function de
desarrollo `receive-public-form`; no abre acceso `anon` ni conecta la demo
local. B4 añadió los documentos de diseño `../API_RECEPCION_FORMULARIOS_MVP.md`,
`../ALTA_NEGOCIO_OWNER_MVP.md` y el resultado
`RESULTADO_B4_HARDENING_DEV.md`.

## Qué se debe revisar antes de ejecutar

- Confirmar que cada negocio tendrá un único sector principal en el MVP.
- Confirmar el formato visible de `businesses.slug` y `form_configs.public_slug`.
- Definir quién aprovisiona negocios, perfiles y membresías iniciales.
- Definir qué puede editar `owner`, `member` y `viewer` antes de activar RLS.
- Confirmar la retención de solicitudes, adjuntos y futuros emails.
- Revisar que el panel actual puede actualizar `updated_at` y recalcular la
  próxima acción dentro de la misma transacción que el seguimiento.

## Seguridad incluida y límites

- Las tablas operativas usan `business_id` y claves compuestas para impedir
  asociaciones entre negocios distintos.
- Las asignaciones y actores de actividad deben pertenecer también al mismo
  negocio mediante la relación `business_users`.
- Los adjuntos guardan una ruta privada prevista para Storage; no guardan base64
  ni URLs públicas permanentes.
- No hay políticas `anon` ni inserciones públicas en el borrador RLS.
- El formulario público no debe escribir directamente en las tablas: necesitará
  un backend o función segura que valide el slug y derive el `business_id`.
- No hay claves, tokens, proveedores de correo, webhooks ni llamadas externas.

## Comprobaciones recomendadas en Supabase de prueba

1. Validar sintaxis y orden de claves foráneas.
2. Probar los checks de estado, cierre ganado/perdido, rol, contacto mínimo y
   referencia única.
3. Crear una solicitud con respuestas dinámicas y seguimiento.
4. Intentar asociar un contacto de un negocio a una solicitud de otro: debe
   fallar por la clave compuesta.
5. Probar lectura y escritura como `owner`, `member` y `viewer` en dos negocios.
6. Confirmar que `Ganado` y `Perdido` no entran en la bandeja de seguimiento del
   panel cuando se conecte el frontend.

## Fuera de alcance

Estos archivos no implementan Supabase Auth, Storage, un backend, API, n8n,
Gmail, Resend, Google Sheets, automatizaciones reales, emails reales, deploy o
dominio. Tampoco modifican la demo local basada en `localStorage`.
