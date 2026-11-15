-- SolicitudPro: revisión local de índices posteriores a la migración inicial.
-- NO ejecutado en Supabase durante B4. Revisar y aplicar como migración separada
-- solo cuando se apruebe para desarrollo. No contiene cambios destructivos.

-- Relaciones compuestas que no quedan cubiertas por los índices operativos de 001.
-- Ayudan a validar borrados/restricciones y evitan escaneos cuando se consulta una
-- entidad relacionada por su id y su negocio.
create index if not exists activities_request_business_fk_idx
  on public.activities (request_id, business_id);

create index if not exists activities_contact_business_fk_idx
  on public.activities (contact_id, business_id);

create index if not exists activities_business_actor_user_fk_idx
  on public.activities (business_id, actor_user_id);

-- Configuración y respuestas dinámicas: cubren las claves foráneas compuestas que
-- se usarán al editar una versión de formulario o un campo concreto.
create index if not exists form_fields_config_business_fk_idx
  on public.form_fields (form_config_id, business_id);

create index if not exists request_custom_answers_field_business_fk_idx
  on public.request_custom_answers (form_field_id, business_id);

-- Asignación y procedencia de solicitudes: no sustituyen los índices de bandeja
-- existentes por estado, fecha, contacto o próximo seguimiento.
create index if not exists requests_business_assigned_to_fk_idx
  on public.requests (business_id, assigned_to);

create index if not exists requests_form_config_business_fk_idx
  on public.requests (form_config_id, business_id);

-- Responsables de tareas: cubren cambios de miembro o consultas por responsable.
create index if not exists follow_ups_business_assigned_to_fk_idx
  on public.follow_ups (business_id, assigned_to);

create index if not exists follow_ups_business_completed_by_fk_idx
  on public.follow_ups (business_id, completed_by);

-- No se añaden índices JSONB, de texto completo ni índices adicionales sobre
-- business_id: los filtros MVP ya quedan cubiertos en 001_initial_schema.sql.

