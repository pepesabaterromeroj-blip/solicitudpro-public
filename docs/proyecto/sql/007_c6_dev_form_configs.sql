-- SolicitudPro C6: configuracion idempotente de formularios exclusivamente
-- para solicitudpro-app-dev. No crea usuarios, no modifica RLS y no habilita
-- acceso anon directo a tablas operativas.

begin;

-- Electricidad necesita un negocio dev aislado para probar el formulario
-- sectorial. Reformas ya existe y se conserva mediante su slug estable.
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
  'Electricidad Demo Dev',
  'electricidad-demo-dev',
  'electricidad.demo@solicitudpro.test',
  'Valencia',
  'active'
from public.sectors s
where s.slug = 'electricidad'
on conflict (slug) do update
set
  sector_id = excluded.sector_id,
  name = excluded.name,
  contact_email = excluded.contact_email,
  service_area = excluded.service_area,
  status = excluded.status,
  updated_at = now();

-- Un formulario publicado por negocio, identificado solo por slug publico.
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
    when 'reformas-demo-dev' then 'Solicitud de reforma'
    when 'electricidad-demo-dev' then 'Solicitud electrica'
  end,
  'solicitud',
  1,
  case b.slug
    when 'reformas-demo-dev' then 'Cuentanos tu reforma'
    when 'electricidad-demo-dev' then 'Cuentanos que ocurre'
  end,
  case b.slug
    when 'reformas-demo-dev' then 'Datos ficticios de desarrollo para validar el formulario sectorial.'
    when 'electricidad-demo-dev' then 'Datos ficticios de desarrollo para validar el formulario sectorial.'
  end,
  case b.slug
    when 'reformas-demo-dev' then 'Hemos recibido tu solicitud de reforma.'
    when 'electricidad-demo-dev' then 'Hemos recibido tu solicitud electrica.'
  end,
  'published',
  true,
  now()
from public.businesses b
where b.slug in ('reformas-demo-dev', 'electricidad-demo-dev')
on conflict (business_id, public_slug) do update
set
  sector_id = excluded.sector_id,
  name = excluded.name,
  title = excluded.title,
  description = excluded.description,
  confirmation_text = excluded.confirmation_text,
  status = 'published',
  is_default = true,
  published_at = coalesce(public.form_configs.published_at, now()),
  updated_at = now();

-- Las claves reflejan solo los campos no sensibles que C6 envia al endpoint.
-- Los adjuntos simulados de la demo se excluyen: no hay Storage en esta fase.
with desired_fields as (
  select * from (values
    ('reformas-demo-dev', 'tipo_reforma', 'Tipo de reforma', 'select', '["Baño", "Cocina", "Reforma integral", "Reforma parcial", "Local comercial", "Suelo o pintura", "Otro"]'::jsonb, true, 1),
    ('reformas-demo-dev', 'zona', 'Zona o municipio', 'text', '[]'::jsonb, true, 2),
    ('reformas-demo-dev', 'descripcion', 'Descripcion breve', 'textarea', '[]'::jsonb, true, 3),
    ('reformas-demo-dev', 'plazo', 'Plazo deseado', 'select', '["Lo antes posible", "En las próximas semanas", "En 1-3 meses", "Más adelante", "Solo quiero orientación"]'::jsonb, true, 4),
    ('electricidad-demo-dev', 'tipo_trabajo', 'Tipo de trabajo', 'select', '["Avería eléctrica", "Instalación de enchufes", "Iluminación", "Cuadro eléctrico", "Revisión", "Boletín o certificado", "Otro"]'::jsonb, true, 1),
    ('electricidad-demo-dev', 'riesgo_urgencia', 'Urgencia o riesgo', 'select', '["Riesgo inmediato", "Hoy", "24-48 horas", "Esta semana", "Sin prisa"]'::jsonb, true, 2),
    ('electricidad-demo-dev', 'zona', 'Zona o municipio', 'text', '[]'::jsonb, true, 3),
    ('electricidad-demo-dev', 'descripcion', 'Descripcion breve', 'textarea', '[]'::jsonb, true, 4)
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
select
  b.id,
  f.id,
  d.field_key,
  d.label,
  d.field_type,
  d.options,
  d.is_required,
  d.display_order,
  true
from desired_fields d
join public.businesses b on b.slug = d.business_slug
join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'
on conflict (form_config_id, field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  options = excluded.options,
  is_required = excluded.is_required,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

commit;
