-- Datos mínimos y exclusivamente ficticios para una reconstrucción local.
-- No contiene usuarios Auth, contraseñas, tokens ni credenciales.

insert into public.sectors (slug, name, description)
values
  ('reformas', 'Reformas', 'Fixture local para solicitudes de reformas.'),
  ('electricidad', 'Electricidad', 'Fixture local para solicitudes eléctricas.'),
  ('fontaneria', 'Fontanería', 'Fixture local para solicitudes de fontanería.'),
  ('climatizacion', 'Climatización', 'Fixture local para solicitudes de climatización.'),
  ('cristaleria', 'Cristalerías', 'Fixture local para solicitudes de cristalería.'),
  ('academias', 'Academias', 'Fixture local para solicitudes de academias.')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

insert into public.businesses (
  sector_id,
  name,
  slug,
  contact_email,
  contact_phone,
  service_area,
  status
)
select
  s.id,
  seed.name,
  seed.business_slug,
  seed.contact_email,
  '+34 600 000 000',
  'Zona ficticia DEV',
  'active'
from (
  values
    ('reformas', 'Reformas Baseline DEV', 'reformas-baseline-dev', 'reformas.baseline@solicitudpro.test'),
    ('electricidad', 'Electricidad Baseline DEV', 'electricidad-baseline-dev', 'electricidad.baseline@solicitudpro.test'),
    ('fontaneria', 'Fontanería Baseline DEV', 'fontaneria-baseline-dev', 'fontaneria.baseline@solicitudpro.test'),
    ('climatizacion', 'Climatización Baseline DEV', 'climatizacion-baseline-dev', 'climatizacion.baseline@solicitudpro.test'),
    ('cristaleria', 'Cristalerías Baseline DEV', 'cristaleria-baseline-dev', 'cristaleria.baseline@solicitudpro.test'),
    ('academias', 'Academias Baseline DEV', 'academias-baseline-dev', 'academias.baseline@solicitudpro.test')
) as seed(sector_slug, name, business_slug, contact_email)
join public.sectors s on s.slug = seed.sector_slug
on conflict (slug) do update
set name = excluded.name,
    sector_id = excluded.sector_id,
    contact_email = excluded.contact_email,
    contact_phone = excluded.contact_phone,
    service_area = excluded.service_area,
    status = 'active',
    updated_at = now();

insert into public.form_configs (
  business_id,
  sector_id,
  name,
  public_slug,
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
  'Solicitud baseline',
  'solicitud',
  'Cuéntanos qué necesitas',
  'Formulario ficticio mínimo para desarrollo local.',
  'Hemos recibido tu solicitud correctamente.',
  'published',
  true,
  now()
from public.businesses b
where b.slug like '%-baseline-dev'
on conflict (business_id, public_slug) do update
set title = excluded.title,
    description = excluded.description,
    confirmation_text = excluded.confirmation_text,
    status = 'published',
    is_default = true,
    published_at = coalesce(public.form_configs.published_at, now()),
    updated_at = now();

insert into public.form_fields (
  business_id,
  form_config_id,
  field_key,
  label,
  placeholder,
  field_type,
  validation,
  is_required,
  display_order
)
select
  f.business_id,
  f.id,
  field.field_key,
  field.label,
  field.placeholder,
  field.field_type,
  field.validation,
  field.is_required,
  field.display_order
from public.form_configs f
join public.businesses b on b.id = f.business_id
cross join (
  values
    ('servicio', 'Servicio solicitado', 'Describe el servicio', 'text', '{"max_length": 160}'::jsonb, true, 1),
    ('detalles', 'Detalles de la solicitud', 'Añade la información que consideres útil', 'textarea', '{"max_length": 2000}'::jsonb, true, 2)
) as field(field_key, label, placeholder, field_type, validation, is_required, display_order)
where b.slug like '%-baseline-dev'
  and f.public_slug = 'solicitud'
on conflict (form_config_id, field_key) do update
set label = excluded.label,
    placeholder = excluded.placeholder,
    field_type = excluded.field_type,
    validation = excluded.validation,
    is_required = excluded.is_required,
    display_order = excluded.display_order,
    is_active = true,
    updated_at = now();
