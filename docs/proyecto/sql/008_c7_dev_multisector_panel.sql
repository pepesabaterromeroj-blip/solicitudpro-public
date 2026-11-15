-- SolicitudPro C7: entorno multisector exclusivamente para solicitudpro-app-dev.
-- Es idempotente, usa datos ficticios y no administra cuentas Auth ni contraseñas.
-- Ejecutar solo despues de crear manualmente los dos usuarios ficticios autorizados.

begin;

-- Los UUID se corresponden con los dos usuarios ficticios creados en Auth para dev.
-- Se usan como referencias de perfiles ya existentes; este archivo no consulta ni modifica Auth.
insert into public.profiles (id, display_name)
values
  ('3f5189f9-f3e8-4dff-a016-c3de97338a9a'::uuid, 'Owner Electricidad Dev'),
  ('ad12c65c-3373-4ca8-91c3-d3b2d5e05111'::uuid, 'Owner Fontanería Dev')
on conflict (id) do update
set display_name = excluded.display_name,
    updated_at = now();

-- Fontanería todavía no tenía negocio de desarrollo. Electricidad ya existe y se conserva.
insert into public.businesses (
  sector_id,
  name,
  slug,
  contact_email,
  service_area,
  status
)
select
  s.id,
  'Fontanería Demo Dev',
  'fontaneria-demo-dev',
  'fontaneria.demo@solicitudpro.test',
  'Valencia',
  'active'
from public.sectors s
where s.slug = 'fontaneria'
on conflict (slug) do update
set sector_id = excluded.sector_id,
    name = excluded.name,
    contact_email = excluded.contact_email,
    service_area = excluded.service_area,
    status = excluded.status,
    updated_at = now();

-- Cada owner nuevo queda limitado a un unico negocio de desarrollo.
with memberships as (
  select * from (values
    ('electricidad-demo-dev', '3f5189f9-f3e8-4dff-a016-c3de97338a9a'::uuid),
    ('fontaneria-demo-dev', 'ad12c65c-3373-4ca8-91c3-d3b2d5e05111'::uuid)
  ) as owner_membership(business_slug, user_id)
)
insert into public.business_users (business_id, user_id, role, is_active)
select b.id, m.user_id, 'owner', true
from memberships m
join public.businesses b on b.slug = m.business_slug
on conflict (business_id, user_id) do update
set role = 'owner',
    is_active = true;

-- Formulario publicado para Fontanería. No conecta aun el formulario bonito de la demo.
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
  'Solicitud de fontanería',
  'solicitud',
  1,
  'Cuéntanos tu incidencia de fontanería',
  'Formulario de desarrollo con datos ficticios para validar el panel interno.',
  'Hemos recibido tu solicitud de fontanería.',
  'published',
  true,
  now()
from public.businesses b
where b.slug = 'fontaneria-demo-dev'
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
    ('tipo_incidencia', 'Tipo de incidencia', 'select', '["Fuga", "Desagüe atascado", "Grifo o cisterna", "Tubería", "Calentador", "Otro"]'::jsonb, true, 1),
    ('agua_activa_urgencia', 'Agua activa o urgencia', 'select', '["Agua activa", "Hoy", "24-48 horas", "Esta semana", "Sin prisa"]'::jsonb, true, 2),
    ('zona', 'Zona o municipio', 'text', '[]'::jsonb, true, 3),
    ('descripcion', 'Descripción breve', 'textarea', '[]'::jsonb, true, 4)
  ) as fields(field_key, label, field_type, options, is_required, display_order)
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
join public.businesses b on b.slug = 'fontaneria-demo-dev'
join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'
on conflict (form_config_id, field_key) do update
set label = excluded.label,
    field_type = excluded.field_type,
    options = excluded.options,
    is_required = excluded.is_required,
    display_order = excluded.display_order,
    is_active = true,
    updated_at = now();

-- Una solicitud de panel ficticia, estable por referencia, para validar listado y detalle.
insert into public.contacts (
  business_id,
  display_name,
  email,
  phone,
  source,
  privacy_notice_version
)
select b.id, 'Cliente Fontanería Dev', 'cliente.fontaneria.dev@solicitudpro.test', '+34600000031', 'manual', 'dev-c7'
from public.businesses b
where b.slug = 'fontaneria-demo-dev'
  and not exists (
    select 1
    from public.contacts c
    where c.business_id = b.id
      and c.email = 'cliente.fontaneria.dev@solicitudpro.test'
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
  'FON-001',
  'Solicitud de fontanería · Cliente Fontanería Dev',
  'Fuga',
  'Datos ficticios: fuga activa en cocina, con agua saliendo.',
  'Nuevo',
  'Agua activa',
  1,
  'manual',
  'Solicitud ficticia de Fontanería para validar el listado y detalle internos.',
  'Hola, hemos recibido tu solicitud. Priorizaremos la incidencia y confirmaremos el siguiente paso.',
  '[]'::jsonb,
  'Revisar la urgencia y contactar',
  now() + interval '24 hours'
from public.businesses b
join public.contacts c on c.business_id = b.id and c.email = 'cliente.fontaneria.dev@solicitudpro.test'
join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'
where b.slug = 'fontaneria-demo-dev'
  and not exists (
    select 1 from public.requests r where r.business_id = b.id and r.reference = 'FON-001'
  );

with desired_answers as (
  select * from (values
    ('tipo_incidencia', 'Fuga'),
    ('agua_activa_urgencia', 'Agua activa'),
    ('zona', 'Valencia'),
    ('descripcion', 'Fuga activa en cocina; el agua sigue saliendo.')
  ) as answers(field_key, value_text)
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
join public.businesses b on b.slug = 'fontaneria-demo-dev'
join public.requests r on r.business_id = b.id and r.reference = 'FON-001'
join public.form_fields ff on ff.business_id = b.id and ff.form_config_id = r.form_config_id and ff.field_key = d.field_key
on conflict (request_id, field_key) do update
set form_field_id = excluded.form_field_id,
    label_snapshot = excluded.label_snapshot,
    value_jsonb = excluded.value_jsonb,
    value_text = excluded.value_text;

insert into public.follow_ups (
  business_id,
  request_id,
  due_at,
  cadence_hours,
  channel,
  action_text,
  status
)
select r.business_id, r.id, r.next_follow_up_at, 24, 'call', 'Confirmar urgencia y disponibilidad de visita', 'pending'
from public.requests r
join public.businesses b on b.id = r.business_id
where b.slug = 'fontaneria-demo-dev'
  and r.reference = 'FON-001'
  and not exists (
    select 1 from public.follow_ups f where f.request_id = r.id and f.action_text = 'Confirmar urgencia y disponibilidad de visita'
  );

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
select r.business_id, r.id, r.contact_id, 'system', 'request_created', 'Solicitud ficticia de desarrollo creada', 'Datos ficticios para validar Fontanería en el panel interno.', jsonb_build_object('source', 'c7_dev_seed', 'sector', 'fontaneria')
from public.requests r
join public.businesses b on b.id = r.business_id
where b.slug = 'fontaneria-demo-dev'
  and r.reference = 'FON-001'
  and not exists (
    select 1 from public.activities a where a.request_id = r.id and a.type = 'request_created' and a.title = 'Solicitud ficticia de desarrollo creada'
  );

commit;
