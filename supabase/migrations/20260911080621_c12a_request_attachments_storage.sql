-- C12A: private Storage base and hardened metadata for request attachments.
-- Existing public.attachments, attachments_request_business_fk, and
-- attachments_storage_path_unique are reused. No upload flow is added here.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'request-attachments',
  'request-attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]::text[]
);

alter table public.attachments
  drop constraint attachments_size_check;

alter table public.attachments
  add constraint attachments_size_check
    check (size_bytes between 1 and 10485760) not valid,
  add constraint attachments_allowed_mime_check
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'application/pdf'
      )
    ) not valid,
  add constraint attachments_storage_path_check
    check (
      storage_path ~ (
        '^' || business_id::text || '/' || request_id::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' ||
        '\.(jpg|jpeg|png|webp|heic|heif|pdf)$'
      )
    ) not valid,
  add constraint attachments_mime_extension_check
    check (
      case mime_type
        when 'image/jpeg' then lower(storage_path) ~ '\.(jpg|jpeg)$'
        when 'image/png' then lower(storage_path) ~ '\.png$'
        when 'image/webp' then lower(storage_path) ~ '\.webp$'
        when 'image/heic' then lower(storage_path) ~ '\.heic$'
        when 'image/heif' then lower(storage_path) ~ '\.heif$'
        when 'application/pdf' then lower(storage_path) ~ '\.pdf$'
        else false
      end
    ) not valid;

drop index public.attachments_request_id_idx;

create index attachments_request_business_fk_idx
  on public.attachments (request_id, business_id);

alter table public.attachments enable row level security;

drop policy if exists "active members can read attachments"
  on public.attachments;
drop policy if exists "owners and members can insert attachments"
  on public.attachments;
drop policy if exists "owners and members can update attachments"
  on public.attachments;

create policy "active members can read canonical request attachments"
  on public.attachments
  for select
  to authenticated
  using (
    deleted_at is null
    and storage_path ~ (
      '^' || business_id::text || '/' || request_id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' ||
      '\.(jpg|jpeg|png|webp|heic|heif|pdf)$'
    )
    and exists (
      select 1
      from public.business_users membership
      where membership.business_id = attachments.business_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
    )
  );

revoke all on table public.attachments from anon;
revoke all on table public.attachments from authenticated;
grant select on table public.attachments to authenticated;
grant select, insert, update, delete on table public.attachments to service_role;

create policy "active members can read request attachment objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and exists (
      select 1
      from public.attachments attachment
      join public.business_users membership
        on membership.business_id = attachment.business_id
       and membership.user_id = (select auth.uid())
       and membership.is_active
      where attachment.storage_path = storage.objects.name
        and attachment.deleted_at is null
        and (storage.foldername(storage.objects.name))[1] =
          attachment.business_id::text
        and (storage.foldername(storage.objects.name))[2] =
          attachment.request_id::text
    )
  );

comment on table public.attachments is
  'Metadata for files stored in the private request-attachments bucket; binaries are never stored in PostgreSQL.';
comment on column public.attachments.file_name is
  'Original user-facing filename kept only as metadata; never used as the physical Storage object name.';
comment on column public.attachments.storage_path is
  'Canonical path: {business_id}/{request_id}/{file_uuid}.{allowed_extension}.';
comment on constraint attachments_size_check on public.attachments is
  'Enforced for new or changed rows; historical zero-byte DEV fixtures predate C12A.';
comment on constraint attachments_storage_path_check on public.attachments is
  'Enforced for new or changed rows; historical DEV fixture paths predate C12A and are excluded from authenticated reads.';
