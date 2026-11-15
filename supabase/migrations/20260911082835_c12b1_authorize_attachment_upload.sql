-- C12B1: resolve a public upload capability to one persisted request.
-- The original submission idempotency key is stored and compared only as SHA-256.

create or replace function public.authorize_public_attachment_upload(
  p_business_slug text,
  p_form_slug text,
  p_reference text,
  p_idempotency_key_hash text
)
returns table (business_id uuid, request_id uuid)
language sql
stable
security invoker
set search_path = public, pg_temp
as $c12b1_authorization$
  select business.id, request.id
  from public.businesses as business
  join public.form_configs as form
    on form.business_id = business.id
  join public.public_form_idempotency_keys as submission_key
    on submission_key.business_id = business.id
   and submission_key.form_config_id = form.id
  join public.requests as request
    on submission_key.request_id = request.id
   and request.business_id = business.id
   and request.form_config_id = form.id
  where business.slug = lower(btrim(coalesce(p_business_slug, '')))
    and business.status in ('trial', 'active')
    and form.public_slug = lower(btrim(coalesce(p_form_slug, '')))
    and form.status = 'published'
    and request.reference = upper(btrim(coalesce(p_reference, '')))
    and submission_key.idempotency_key_hash = p_idempotency_key_hash
    and p_idempotency_key_hash ~ '^[0-9a-f]{64}$'
    and submission_key.completed_at is not null
    and submission_key.expires_at > now()
  limit 1;
$c12b1_authorization$;

revoke all on function public.authorize_public_attachment_upload(text, text, text, text) from public;
revoke all on function public.authorize_public_attachment_upload(text, text, text, text) from anon;
revoke all on function public.authorize_public_attachment_upload(text, text, text, text) from authenticated;
grant execute on function public.authorize_public_attachment_upload(text, text, text, text) to service_role;

comment on function public.authorize_public_attachment_upload(text, text, text, text) is
  'Backend-only, read-only validation of a short-lived public attachment upload capability.';

