-- SolicitudPro: esquema inicial local para revisión humana.
-- No se ha ejecutado contra Supabase ni contra ninguna base de datos.
-- Alcance: primera migración del MVP. No incluye email_logs ni automation_logs.

create extension if not exists pgcrypto;

-- Catálogo global de sectores. No contiene información de un negocio concreto.
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sectors_slug_not_blank check (btrim(slug) <> ''),
  constraint sectors_name_not_blank check (btrim(name) <> '')
);

-- Perfil de aplicación enlazado a la identidad futura de Supabase Auth.
-- No almacena contraseñas, sesiones ni metadatos de autorización.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada negocio es un tenant y tiene un sector principal durante el MVP.
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectors(id),
  name text not null,
  slug text not null unique,
  contact_email text not null,
  contact_phone text,
  service_area text,
  timezone text not null default 'Europe/Madrid',
  status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_name_not_blank check (btrim(name) <> ''),
  constraint businesses_slug_not_blank check (btrim(slug) <> ''),
  constraint businesses_email_not_blank check (btrim(contact_email) <> ''),
  constraint businesses_status_check check (
    status in ('trial', 'active', 'paused', 'archived')
  ),
  constraint businesses_id_sector_unique unique (id, sector_id)
);

-- Relación entre identidades internas y negocios. No se gestiona autenticación aquí.
create table public.business_users (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  constraint business_users_role_check check (role in ('owner', 'member', 'viewer'))
);

-- Preferencias pequeñas y no sensibles del negocio.
create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint business_settings_updated_by_membership_fk foreign key (business_id, updated_by)
    references public.business_users(business_id, user_id) on delete restrict
);

-- Contactos finales, aislados por negocio. No es un CRM avanzado.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  display_name text not null,
  email text,
  phone text,
  source text,
  notes text,
  privacy_notice_version text,
  contact_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_name_not_blank check (btrim(display_name) <> ''),
  constraint contacts_contact_method_check check (
    nullif(btrim(email), '') is not null or nullif(btrim(phone), '') is not null
  ),
  constraint contacts_id_business_unique unique (id, business_id)
);

-- Formularios versionados: modificar uno publicado exige crear una versión nueva.
create table public.form_configs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  sector_id uuid not null,
  name text not null,
  public_slug text not null,
  version integer not null default 1,
  title text not null,
  description text,
  confirmation_text text not null,
  status text not null default 'draft',
  is_default boolean not null default false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_configs_business_sector_fk foreign key (business_id, sector_id)
    references public.businesses(id, sector_id) on delete restrict,
  constraint form_configs_created_by_membership_fk foreign key (business_id, created_by)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint form_configs_name_not_blank check (btrim(name) <> ''),
  constraint form_configs_public_slug_not_blank check (btrim(public_slug) <> ''),
  constraint form_configs_title_not_blank check (btrim(title) <> ''),
  constraint form_configs_confirmation_not_blank check (btrim(confirmation_text) <> ''),
  constraint form_configs_version_check check (version > 0),
  constraint form_configs_status_check check (status in ('draft', 'published', 'archived')),
  constraint form_configs_published_at_check check (
    (status = 'published' and published_at is not null) or status <> 'published'
  ),
  constraint form_configs_id_business_unique unique (id, business_id),
  constraint form_configs_business_public_slug_unique unique (business_id, public_slug),
  constraint form_configs_business_name_version_unique unique (business_id, name, version)
);

-- Campos del formulario, con valores flexibles pero claves estables para exportación.
create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  form_config_id uuid not null,
  field_key text not null,
  label text not null,
  help_text text,
  placeholder text,
  field_type text not null,
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  default_value jsonb,
  is_required boolean not null default false,
  display_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_fields_config_business_fk foreign key (form_config_id, business_id)
    references public.form_configs(id, business_id) on delete cascade,
  constraint form_fields_key_not_blank check (btrim(field_key) <> ''),
  constraint form_fields_label_not_blank check (btrim(label) <> ''),
  constraint form_fields_type_check check (
    field_type in ('text', 'textarea', 'select', 'multiselect', 'boolean', 'date', 'file')
  ),
  constraint form_fields_display_order_check check (display_order > 0),
  constraint form_fields_id_business_unique unique (id, business_id),
  constraint form_fields_config_key_unique unique (form_config_id, field_key),
  constraint form_fields_config_order_unique unique (form_config_id, display_order)
);

-- Solicitud comercial. Los datos propios del sector viven en request_custom_answers.
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  contact_id uuid not null,
  sector_id uuid not null,
  form_config_id uuid,
  reference text not null,
  title text,
  service text not null,
  description text not null,
  status text not null default 'Nuevo',
  urgency text,
  priority smallint,
  source text not null default 'form',
  assigned_to uuid,
  internal_summary text,
  suggested_reply text,
  suggested_questions jsonb not null default '[]'::jsonb,
  next_action text,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_business_sector_fk foreign key (business_id, sector_id)
    references public.businesses(id, sector_id) on delete restrict,
  constraint requests_contact_business_fk foreign key (contact_id, business_id)
    references public.contacts(id, business_id) on delete restrict,
  constraint requests_form_config_business_fk foreign key (form_config_id, business_id)
    references public.form_configs(id, business_id) on delete restrict,
  constraint requests_assigned_to_membership_fk foreign key (business_id, assigned_to)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint requests_reference_not_blank check (btrim(reference) <> ''),
  constraint requests_service_not_blank check (btrim(service) <> ''),
  constraint requests_description_not_blank check (btrim(description) <> ''),
  constraint requests_status_check check (
    status in ('Nuevo', 'En preparación', 'Enviado', 'Seguimiento pendiente', 'Ganado', 'Perdido')
  ),
  constraint requests_source_check check (source in ('form', 'phone', 'email', 'manual', 'import')),
  constraint requests_priority_check check (priority is null or priority between 1 and 3),
  constraint requests_closure_consistency_check check (
    (status = 'Ganado' and won_at is not null and lost_at is null)
    or (status = 'Perdido' and lost_at is not null and won_at is null)
    or (status not in ('Ganado', 'Perdido') and won_at is null and lost_at is null)
  ),
  constraint requests_id_business_unique unique (id, business_id),
  constraint requests_business_reference_unique unique (business_id, reference)
);

-- Respuestas dinámicas, preservando la clave y etiqueta de la versión original.
create table public.request_custom_answers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  request_id uuid not null,
  form_field_id uuid,
  field_key text not null,
  label_snapshot text,
  value_jsonb jsonb not null,
  value_text text,
  created_at timestamptz not null default now(),
  constraint request_answers_request_business_fk foreign key (request_id, business_id)
    references public.requests(id, business_id) on delete cascade,
  constraint request_answers_field_business_fk foreign key (form_field_id, business_id)
    references public.form_fields(id, business_id) on delete restrict,
  constraint request_answers_key_not_blank check (btrim(field_key) <> ''),
  constraint request_answers_request_key_unique unique (request_id, field_key)
);

-- Tareas de seguimiento. La tarea pendiente más próxima se refleja en requests.
create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  request_id uuid not null,
  assigned_to uuid,
  due_at timestamptz not null,
  cadence_hours smallint,
  channel text,
  action_text text not null,
  status text not null default 'pending',
  completed_at timestamptz,
  completed_by uuid,
  completion_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_request_business_fk foreign key (request_id, business_id)
    references public.requests(id, business_id) on delete cascade,
  constraint follow_ups_assigned_to_membership_fk foreign key (business_id, assigned_to)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint follow_ups_completed_by_membership_fk foreign key (business_id, completed_by)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint follow_ups_action_not_blank check (btrim(action_text) <> ''),
  constraint follow_ups_cadence_check check (cadence_hours is null or cadence_hours in (24, 48, 72)),
  constraint follow_ups_channel_check check (
    channel is null or channel in ('call', 'email', 'whatsapp', 'visit', 'internal')
  ),
  constraint follow_ups_status_check check (status in ('pending', 'completed', 'skipped', 'cancelled')),
  constraint follow_ups_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint follow_ups_completed_by_check check (
    completed_by is null or status = 'completed'
  )
);

-- Historial comercial legible. No sustituye a logs técnicos futuros.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  request_id uuid,
  contact_id uuid,
  actor_type text not null default 'system',
  actor_user_id uuid,
  type text not null,
  title text not null,
  detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activities_request_business_fk foreign key (request_id, business_id)
    references public.requests(id, business_id) on delete cascade,
  constraint activities_contact_business_fk foreign key (contact_id, business_id)
    references public.contacts(id, business_id) on delete restrict,
  constraint activities_actor_user_membership_fk foreign key (business_id, actor_user_id)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint activities_subject_check check (request_id is not null or contact_id is not null),
  constraint activities_actor_type_check check (
    actor_type in ('user', 'system', 'public_form', 'automation')
  ),
  constraint activities_type_not_blank check (btrim(type) <> ''),
  constraint activities_title_not_blank check (btrim(title) <> '')
);

-- Solo metadatos de archivos. La futura subida usa Storage privado, nunca base64.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  request_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  source text not null default 'public_form',
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint attachments_request_business_fk foreign key (request_id, business_id)
    references public.requests(id, business_id) on delete cascade,
  constraint attachments_uploaded_by_membership_fk foreign key (business_id, uploaded_by)
    references public.business_users(business_id, user_id) on delete restrict,
  constraint attachments_path_not_blank check (btrim(storage_path) <> ''),
  constraint attachments_name_not_blank check (btrim(file_name) <> ''),
  constraint attachments_mime_not_blank check (btrim(mime_type) <> ''),
  constraint attachments_size_check check (size_bytes >= 0),
  constraint attachments_source_check check (source in ('public_form', 'internal_upload', 'import')),
  constraint attachments_storage_path_unique unique (storage_path)
);

-- Plantillas de mensajes preparadas por negocio. No envían ningún correo.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  sector_id uuid,
  key text not null,
  name text not null,
  channel text not null default 'email',
  subject_template text,
  body_template text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_templates_business_sector_fk foreign key (business_id, sector_id)
    references public.businesses(id, sector_id) on delete restrict,
  constraint email_templates_key_not_blank check (btrim(key) <> ''),
  constraint email_templates_name_not_blank check (btrim(name) <> ''),
  constraint email_templates_body_not_blank check (btrim(body_template) <> ''),
  constraint email_templates_channel_check check (channel = 'email'),
  constraint email_templates_business_key_unique unique (business_id, key)
);

-- Índices operativos mínimos. Los filtros JSONB y de texto completo esperan a datos reales.
create index businesses_sector_id_idx on public.businesses (sector_id);
create index businesses_status_idx on public.businesses (status);
create index business_users_user_id_idx on public.business_users (user_id);
create index business_users_business_active_idx on public.business_users (business_id, is_active);
create index contacts_business_created_at_idx on public.contacts (business_id, created_at desc);
create index contacts_business_email_idx on public.contacts (business_id, lower(email)) where email is not null;
create index form_configs_business_status_idx on public.form_configs (business_id, status);
create unique index form_configs_one_published_default_idx
  on public.form_configs (business_id)
  where is_default and status = 'published';
create index form_fields_business_config_idx on public.form_fields (business_id, form_config_id);
create index requests_business_status_idx on public.requests (business_id, status);
create index requests_business_created_at_idx on public.requests (business_id, created_at desc);
create index requests_business_next_follow_up_idx on public.requests (business_id, next_follow_up_at)
  where archived_at is null;
create index requests_business_contact_idx on public.requests (business_id, contact_id);
create index requests_business_service_idx on public.requests (business_id, service);
create index request_custom_answers_request_idx on public.request_custom_answers (request_id);
create index request_custom_answers_business_idx on public.request_custom_answers (business_id);
create index follow_ups_business_status_due_at_idx on public.follow_ups (business_id, status, due_at);
create index follow_ups_request_idx on public.follow_ups (request_id);
create index activities_business_request_created_at_idx on public.activities (business_id, request_id, created_at desc);
create index activities_business_contact_created_at_idx on public.activities (business_id, contact_id, created_at desc);
create index attachments_business_id_idx on public.attachments (business_id);
create index attachments_request_id_idx on public.attachments (request_id);
create index email_templates_business_active_idx on public.email_templates (business_id, is_active);

-- Nota para la implementación posterior: el panel o backend debe actualizar updated_at
-- en cada modificación y recalcular requests.next_action / next_follow_up_at junto
-- con follow_ups en una única transacción.

