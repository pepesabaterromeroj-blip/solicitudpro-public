-- SolicitudPro: borrador local de RLS para revisión humana.
-- No se ha ejecutado. Depende de que 001_initial_schema.sql exista y de Supabase Auth.
-- No habilita formularios públicos: esos inserts deberán pasar por un backend seguro.

-- Todas las tablas expuestas de la primera migración quedan protegidas por RLS.
alter table public.sectors enable row level security;
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_users enable row level security;
alter table public.contacts enable row level security;
alter table public.form_configs enable row level security;
alter table public.form_fields enable row level security;
alter table public.requests enable row level security;
alter table public.request_custom_answers enable row level security;
alter table public.follow_ups enable row level security;
alter table public.activities enable row level security;
alter table public.attachments enable row level security;
alter table public.email_templates enable row level security;

-- Catálogo global: lectura solo para usuarios autenticados; no hay escritura cliente.
create policy "authenticated users can read sectors"
  on public.sectors for select to authenticated
  using (true);

-- Cada identidad solo puede consultar y cambiar su propio perfil.
-- La creación de perfiles puede venir de un flujo de alta controlado.
create policy "users can read their profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "users can create their profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

create policy "users can update their profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Esta política evita recursión: cada usuario solo lee sus propias membresías.
-- El alta, cambio de rol y baja de miembros se hará por provisión controlada en MVP.
create policy "users can read their active business memberships"
  on public.business_users for select to authenticated
  using (user_id = (select auth.uid()));

-- Los negocios se aprovisionan en servidor. Los miembros activos pueden verlos;
-- owner y member pueden actualizar datos comerciales, no crear ni borrar tenants.
create policy "active members can read their businesses"
  on public.businesses for select to authenticated
  using (
    exists (
      select 1
      from public.business_users membership
      where membership.business_id = businesses.id
        and membership.user_id = (select auth.uid())
        and membership.is_active
    )
  );

create policy "owners and members can update their businesses"
  on public.businesses for update to authenticated
  using (
    exists (
      select 1
      from public.business_users membership
      where membership.business_id = businesses.id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('owner', 'member')
    )
  )
  with check (
    exists (
      select 1
      from public.business_users membership
      where membership.business_id = businesses.id
        and membership.user_id = (select auth.uid())
        and membership.is_active
        and membership.role in ('owner', 'member')
    )
  );

-- business_settings
create policy "active members can read business settings"
  on public.business_settings for select to authenticated
  using (
    exists (
      select 1 from public.business_users membership
      where membership.business_id = business_settings.business_id
        and membership.user_id = (select auth.uid()) and membership.is_active
    )
  );

create policy "owners and members can insert business settings"
  on public.business_settings for insert to authenticated
  with check (
    (updated_by is null or updated_by = (select auth.uid()))
    and exists (
      select 1 from public.business_users membership
      where membership.business_id = business_settings.business_id
        and membership.user_id = (select auth.uid()) and membership.is_active
        and membership.role in ('owner', 'member')
    )
  );

create policy "owners and members can update business settings"
  on public.business_settings for update to authenticated
  using (
    exists (
      select 1 from public.business_users membership
      where membership.business_id = business_settings.business_id
        and membership.user_id = (select auth.uid()) and membership.is_active
        and membership.role in ('owner', 'member')
    )
  )
  with check (
    (updated_by is null or updated_by = (select auth.uid()))
    and exists (
      select 1 from public.business_users membership
      where membership.business_id = business_settings.business_id
        and membership.user_id = (select auth.uid()) and membership.is_active
        and membership.role in ('owner', 'member')
    )
  );

-- Datos operativos con business_id. Los viewers únicamente coinciden en políticas SELECT.
create policy "active members can read contacts"
  on public.contacts for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = contacts.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert contacts"
  on public.contacts for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = contacts.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update contacts"
  on public.contacts for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = contacts.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = contacts.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read form configs"
  on public.form_configs for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = form_configs.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert form configs"
  on public.form_configs for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = form_configs.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update form configs"
  on public.form_configs for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = form_configs.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = form_configs.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read form fields"
  on public.form_fields for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = form_fields.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert form fields"
  on public.form_fields for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = form_fields.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update form fields"
  on public.form_fields for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = form_fields.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = form_fields.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read requests"
  on public.requests for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = requests.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert requests"
  on public.requests for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = requests.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update requests"
  on public.requests for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = requests.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = requests.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read request answers"
  on public.request_custom_answers for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = request_custom_answers.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert request answers"
  on public.request_custom_answers for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = request_custom_answers.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update request answers"
  on public.request_custom_answers for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = request_custom_answers.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = request_custom_answers.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read follow ups"
  on public.follow_ups for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = follow_ups.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert follow ups"
  on public.follow_ups for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = follow_ups.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update follow ups"
  on public.follow_ups for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = follow_ups.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (
    (completed_by is null or completed_by = (select auth.uid()))
    and exists (select 1 from public.business_users membership where membership.business_id = follow_ups.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member'))
  );

create policy "active members can read activities"
  on public.activities for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = activities.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert activities"
  on public.activities for insert to authenticated
  with check (
    actor_type = 'user'
    and actor_user_id = (select auth.uid())
    and exists (select 1 from public.business_users membership where membership.business_id = activities.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member'))
  );

create policy "active members can read attachments"
  on public.attachments for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = attachments.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert attachments"
  on public.attachments for insert to authenticated
  with check (
    (uploaded_by is null or uploaded_by = (select auth.uid()))
    and exists (select 1 from public.business_users membership where membership.business_id = attachments.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member'))
  );
create policy "owners and members can update attachments"
  on public.attachments for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = attachments.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = attachments.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

create policy "active members can read email templates"
  on public.email_templates for select to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = email_templates.business_id and membership.user_id = (select auth.uid()) and membership.is_active));
create policy "owners and members can insert email templates"
  on public.email_templates for insert to authenticated
  with check (exists (select 1 from public.business_users membership where membership.business_id = email_templates.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));
create policy "owners and members can update email templates"
  on public.email_templates for update to authenticated
  using (exists (select 1 from public.business_users membership where membership.business_id = email_templates.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')))
  with check (exists (select 1 from public.business_users membership where membership.business_id = email_templates.business_id and membership.user_id = (select auth.uid()) and membership.is_active and membership.role in ('owner', 'member')));

-- No se crean políticas DELETE en este borrador: el MVP conserva solicitudes,
-- actividad y adjuntos mediante archived_at o deleted_at.
-- Tampoco hay políticas anon. El formulario público deberá usar un endpoint o
-- función segura posterior que derive business_id desde la URL pública validada.
