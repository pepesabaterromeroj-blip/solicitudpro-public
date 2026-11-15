-- SolicitudPro C8A: sectores de desarrollo para Climatización y Cristalerías.
-- Ejecutar exclusivamente en solicitudpro-app-dev. Es idempotente y usa datos ficticios.
-- No administra Auth, contraseñas, configuración privada, RLS ni políticas de acceso.

begin;

-- Catálogo de sectores prioritarios para el entorno de desarrollo.
insert into public.sectors (slug, name, description, is_active)
values
  ('climatizacion', 'Climatización', 'Aire acondicionado, instalaciones, averías y mantenimiento.', true),
  ('cristaleria', 'Cristalerías', 'Cristales, ventanas, mamparas y cerramientos.', true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

-- Referencias a usuarios ficticios creados previamente desde Supabase Auth.
-- Este seed no consulta ni modifica identidades de Auth.
insert into public.profiles (id, display_name)
values
  ('fca0e098-36df-47ff-9de0-cd54a34d9fee'::uuid, 'Owner Climatización Dev'),
  ('a8942ced-aeea-4882-adec-776b9ad9cbbc'::uuid, 'Owner Cristalerías Dev')
on conflict (id) do update
set display_name = excluded.display_name,
    updated_at = now();

insert into public.businesses (
  sector_id,
  name,
  slug,
  contact_email,
  service_area,
  status
)
select s.id, d.name, d.slug, d.contact_email, 'Valencia', 'active'
from (
  values
    ('climatizacion', 'Climatización Demo Dev', 'climatizacion-demo-dev', 'climatizacion.demo@solicitudpro.test'),
    ('cristaleria', 'Cristalerías Demo Dev', 'cristaleria-demo-dev', 'cristaleria.demo@solicitudpro.test')
) as d(sector_slug, name, slug, contact_email)
join public.sectors s on s.slug = d.sector_slug
on conflict (slug) do update
set sector_id = excluded.sector_id,
    name = excluded.name,
    contact_email = excluded.contact_email,
    service_area = excluded.service_area,
    status = 'active',
    updated_at = now();

with memberships as (
  select * from (values
    ('climatizacion-demo-dev', 'fca0e098-36df-47ff-9de0-cd54a34d9fee'::uuid),
    ('cristaleria-demo-dev', 'a8942ced-aeea-4882-adec-776b9ad9cbbc'::uuid)
  ) as membership(business_slug, user_id)
)
insert into public.business_users (business_id, user_id, role, is_active)
select b.id, m.user_id, 'owner', true
from memberships m
join public.businesses b on b.slug = m.business_slug
on conflict (business_id, user_id) do update
set role = 'owner',
    is_active = true;

insert into public.form_configs (
  business_id,
  sector_id,
  name,
  public_slug,
  version,
  title,
  description,
  confirmation_text,
  status,
  is_default,
  published_at
)
select
  b.id,
  b.sector_id,
  case b.slug
    when 'climatizacion-demo-dev' then 'Solicitud de climatización'
    when 'cristaleria-demo-dev' then 'Solicitud de cristalería'
  end,
  'solicitud',
  1,
  case b.slug
    when 'climatizacion-demo-dev' then 'Cuéntanos tu instalación o avería'
    when 'cristaleria-demo-dev' then 'Cuéntanos el trabajo de cristalería'
  end,
  'Formulario de desarrollo con datos ficticios para validar el panel interno.',
  'Hemos recibido tu solicitud de desarrollo.',
  'published',
  true,
  now()
from public.businesses b
where b.slug in ('climatizacion-demo-dev', 'cristaleria-demo-dev')
on conflict (business_id, public_slug) do update
set sector_id = excluded.sector_id,
    name = excluded.name,
    title = excluded.title,
    description = excluded.description,
    confirmation_text = excluded.confirmation_text,
    status = 'published',
    is_default = true,
    published_at = coalesce(public.form_configs.published_at, now()),
    updated_at = now();

with desired_fields as (
  select * from (values
    ('climatizacion-demo-dev', 'tipo_trabajo', 'Qué necesitas', 'select', '["Instalación de aire acondicionado", "Reparación / avería", "Mantenimiento", "Equipo no enfría", "Ruido o fuga", "Presupuesto para varios splits", "Otro"]'::jsonb, true, 1),
    ('climatizacion-demo-dev', 'urgencia', 'Urgencia', 'select', '["Lo antes posible", "Hoy", "Esta semana", "Sin prisa"]'::jsonb, true, 2),
    ('climatizacion-demo-dev', 'zona', 'Zona o municipio', 'text', '[]'::jsonb, true, 3),
    ('climatizacion-demo-dev', 'tipo_equipo', 'Tipo de equipo', 'select', '["Split pared", "Conductos", "Cassette", "Varios splits", "No lo sé", "Otro"]'::jsonb, true, 4),
    ('climatizacion-demo-dev', 'descripcion', 'Describe el problema o instalación', 'textarea', '[]'::jsonb, true, 5),
    ('cristaleria-demo-dev', 'tipo_trabajo', 'Qué necesitas', 'select', '["Cristal roto", "Cambio de cristal / ventana", "Mampara", "Espejo", "Cerramiento", "Presupuesto con medidas", "Otro"]'::jsonb, true, 1),
    ('cristaleria-demo-dev', 'urgencia', 'Urgencia', 'select', '["Lo antes posible", "Hoy", "Esta semana", "Sin prisa"]'::jsonb, true, 2),
    ('cristaleria-demo-dev', 'zona', 'Zona o municipio', 'text', '[]'::jsonb, true, 3),
    ('cristaleria-demo-dev', 'medidas_aproximadas', 'Medidas aproximadas', 'text', '[]'::jsonb, true, 4),
    ('cristaleria-demo-dev', 'descripcion', 'Describe el trabajo', 'textarea', '[]'::jsonb, true, 5)
  ) as fields(business_slug, field_key, label, field_type, options, is_required, display_order)
)
insert into public.form_fields (
  business_id,
  form_config_id,
  field_key,
  label,
  field_type,
  options,
  is_required,
  display_order,
  is_active
)
select b.id, f.id, d.field_key, d.label, d.field_type, d.options, d.is_required, d.display_order, true
from desired_fields d
join public.businesses b on b.slug = d.business_slug
join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'
on conflict (form_config_id, field_key) do update
set label = excluded.label,
    field_type = excluded.field_type,
    options = excluded.options,
    is_required = excluded.is_required,
    display_order = excluded.display_order,
    is_active = true,
    updated_at = now();

insert into public.contacts (
  business_id,
  display_name,
  email,
  phone,
  source,
  privacy_notice_version
)
select b.id, d.display_name, d.email, d.phone, 'manual', 'dev-c8a'
from (
  values
    ('climatizacion-demo-dev', 'Cliente Climatización Dev', 'cliente.climatizacion@solicitudpro.test', '+34600000041'),
    ('cristaleria-demo-dev', 'Cliente Cristalería Dev', 'cliente.cristaleria@solicitudpro.test', '+34600000051')
) as d(business_slug, display_name, email, phone)
join public.businesses b on b.slug = d.business_slug
where not exists (
  select 1 from public.contacts c where c.business_id = b.id and c.email = d.email
);

insert into public.requests (
  business_id,
  contact_id,
  sector_id,
  form_config_id,
  reference,
  title,
  service,
  description,
  status,
  urgency,
  priority,
  source,
  internal_summary,
  suggested_reply,
  suggested_questions,
  next_action,
  next_follow_up_at
)
select
  b.id,
  c.id,
  b.sector_id,
  f.id,
  d.reference,
  d.title,
  d.service,
  d.description,
  'Nuevo',
  d.urgency,
  d.priority,
  'manual',
  d.internal_summary,
  d.suggested_reply,
  '[]'::jsonb,
  d.next_action,
  now() + d.follow_up_interval
from (
  values
    ('climatizacion-demo-dev', 'cliente.climatizacion@solicitudpro.test', 'CLI-001', 'Solicitud de climatización · Cliente Climatización Dev', 'Instalación de aire acondicionado', 'Quiere presupuesto para instalar aire acondicionado en salón y habitación.', 'Esta semana', 2::smallint, 'Solicitud ficticia para preparar visita y presupuesto de instalación de aire acondicionado.', 'Hola, hemos recibido tu solicitud. Revisaremos el equipo, la zona y la disponibilidad para confirmar el siguiente paso.', 'Confirmar visita y tipo de equipo', interval '48 hours'),
    ('cristaleria-demo-dev', 'cliente.cristaleria@solicitudpro.test', 'CRI-001', 'Solicitud de cristalería · Cliente Cristalería Dev', 'Cambio de cristal / ventana', 'Necesita presupuesto para sustituir un cristal y valorar cambio de ventana.', 'Lo antes posible', 1::smallint, 'Solicitud ficticia para revisar medidas, fotos simuladas y prioridad de una sustitución de cristal.', 'Hola, hemos recibido tu solicitud. Revisaremos las medidas y la urgencia antes de confirmar una visita o presupuesto.', 'Confirmar medidas y acceso para visita', interval '24 hours')
) as d(business_slug, email, reference, title, service, description, urgency, priority, internal_summary, suggested_reply, next_action, follow_up_interval)
join public.businesses b on b.slug = d.business_slug
join public.contacts c on c.business_id = b.id and c.email = d.email
join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'
where not exists (
  select 1 from public.requests r where r.business_id = b.id and r.reference = d.reference
);

with desired_answers as (
  select * from (values
    ('climatizacion-demo-dev', 'CLI-001', 'tipo_trabajo', 'Instalación de aire acondicionado'),
    ('climatizacion-demo-dev', 'CLI-001', 'urgencia', 'Esta semana'),
    ('climatizacion-demo-dev', 'CLI-001', 'zona', 'Valencia'),
    ('climatizacion-demo-dev', 'CLI-001', 'tipo_equipo', 'Split pared'),
    ('climatizacion-demo-dev', 'CLI-001', 'descripcion', 'Quiere presupuesto para instalar aire acondicionado en salón y habitación.'),
    ('cristaleria-demo-dev', 'CRI-001', 'tipo_trabajo', 'Cambio de cristal / ventana'),
    ('cristaleria-demo-dev', 'CRI-001', 'urgencia', 'Lo antes posible'),
    ('cristaleria-demo-dev', 'CRI-001', 'zona', 'Valencia'),
    ('cristaleria-demo-dev', 'CRI-001', 'medidas_aproximadas', '120 x 90 cm'),
    ('cristaleria-demo-dev', 'CRI-001', 'descripcion', 'Necesita presupuesto para sustituir un cristal y valorar cambio de ventana.')
  ) as answers(business_slug, reference, field_key, value_text)
)
insert into public.request_custom_answers (
  business_id,
  request_id,
  form_field_id,
  field_key,
  label_snapshot,
  value_jsonb,
  value_text
)
select r.business_id, r.id, ff.id, d.field_key, ff.label, to_jsonb(d.value_text), d.value_text
from desired_answers d
join public.businesses b on b.slug = d.business_slug
join public.requests r on r.business_id = b.id and r.reference = d.reference
join public.form_fields ff on ff.business_id = b.id and ff.form_config_id = r.form_config_id and ff.field_key = d.field_key
on conflict (request_id, field_key) do update
set form_field_id = excluded.form_field_id,
    label_snapshot = excluded.label_snapshot,
    value_jsonb = excluded.value_jsonb,
    value_text = excluded.value_text;

with desired_follow_ups as (
  select * from (values
    ('climatizacion-demo-dev', 'CLI-001', 48::smallint, 'Confirmar visita y tipo de equipo'),
    ('cristaleria-demo-dev', 'CRI-001', 24::smallint, 'Confirmar medidas y acceso para visita')
  ) as follow_up(business_slug, reference, cadence_hours, action_text)
)
insert into public.follow_ups (
  business_id,
  request_id,
  due_at,
  cadence_hours,
  channel,
  action_text,
  status
)
select r.business_id, r.id, r.next_follow_up_at, d.cadence_hours, 'call', d.action_text, 'pending'
from desired_follow_ups d
join public.businesses b on b.slug = d.business_slug
join public.requests r on r.business_id = b.id and r.reference = d.reference
where not exists (
  select 1 from public.follow_ups f where f.request_id = r.id and f.action_text = d.action_text
);

with desired_activities as (
  select * from (values
    ('climatizacion-demo-dev', 'CLI-001', 'Solicitud ficticia de Climatización creada', 'Datos ficticios para validar Climatización en el panel interno.'),
    ('cristaleria-demo-dev', 'CRI-001', 'Solicitud ficticia de Cristalerías creada', 'Datos ficticios para validar Cristalerías en el panel interno.')
  ) as activity(business_slug, reference, title, detail)
)
insert into public.activities (
  business_id,
  request_id,
  contact_id,
  actor_type,
  type,
  title,
  detail,
  metadata
)
select
  r.business_id,
  r.id,
  r.contact_id,
  'system',
  'request_created',
  d.title,
  d.detail,
  jsonb_build_object('source', 'c8a_dev_seed', 'sector', b.slug)
from desired_activities d
join public.businesses b on b.slug = d.business_slug
join public.requests r on r.business_id = b.id and r.reference = d.reference
where not exists (
  select 1 from public.activities a where a.request_id = r.id and a.type = 'request_created' and a.title = d.title
);

commit;
