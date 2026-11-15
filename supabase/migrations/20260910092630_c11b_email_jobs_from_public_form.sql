-- C11B: create the two backend-only email jobs atomically with a public request.
-- No recipients, templates, providers, n8n calls, or email sending are added here.

create or replace function public.submit_public_form_submission(
  p_business_slug text,
  p_form_slug text,
  p_payload jsonb,
  p_idempotency_key_hash text,
  p_payload_hash text,
  p_requester_hash text,
  p_rate_limit_max integer,
  p_rate_limit_window_seconds integer
)
returns table (reference text, confirmation_text text, was_replayed boolean)
language plpgsql
security invoker
set search_path = public, pg_temp
as $c11b_submission$
declare
  v_business_id uuid;
  v_form_id uuid;
  v_existing public.public_form_idempotency_keys%rowtype;
  v_created_key boolean;
  v_window_started_at timestamptz;
  v_request_count integer;
  v_reference text;
  v_confirmation_text text;
  v_request_id uuid;
begin
  if p_idempotency_key_hash !~ '^[0-9a-f]{64}$'
    or p_payload_hash !~ '^[0-9a-f]{64}$'
    or p_requester_hash !~ '^[0-9a-f]{64}$'
    or p_rate_limit_max not between 1 and 20
    or p_rate_limit_window_seconds not between 10 and 3600 then
    raise exception 'SP_PROTECTION_INPUT_INVALID' using errcode = 'P0001';
  end if;

  select b.id, f.id
    into v_business_id, v_form_id
  from public.businesses b
  join public.form_configs f on f.business_id = b.id
  where b.slug = lower(btrim(coalesce(p_business_slug, '')))
    and b.status in ('trial', 'active')
    and f.public_slug = lower(btrim(coalesce(p_form_slug, '')))
    and f.status = 'published';

  if not found then
    raise exception 'SP_BUSINESS_OR_FORM_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.public_form_idempotency_keys (
    business_id,
    form_config_id,
    idempotency_key_hash,
    payload_hash,
    expires_at
  ) values (
    v_business_id,
    v_form_id,
    p_idempotency_key_hash,
    p_payload_hash,
    now() + interval '24 hours'
  ) on conflict (business_id, form_config_id, idempotency_key_hash) do nothing;

  v_created_key := found;

  if not v_created_key then
    select * into v_existing
    from public.public_form_idempotency_keys
    where business_id = v_business_id
      and form_config_id = v_form_id
      and idempotency_key_hash = p_idempotency_key_hash
    for update;

    if v_existing.expires_at > now() then
      if v_existing.payload_hash <> p_payload_hash then
        raise exception 'SP_IDEMPOTENCY_PAYLOAD_MISMATCH' using errcode = 'P0001';
      end if;

      if v_existing.request_id is null then
        raise exception 'SP_IDEMPOTENCY_IN_PROGRESS' using errcode = 'P0001';
      end if;

      return query select v_existing.reference, v_existing.confirmation_text, true;
      return;
    end if;

    update public.public_form_idempotency_keys
      set payload_hash = p_payload_hash,
          request_id = null,
          reference = null,
          confirmation_text = null,
          expires_at = now() + interval '24 hours',
          completed_at = null,
          created_at = now()
    where id = v_existing.id;
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_rate_limit_window_seconds)
      * p_rate_limit_window_seconds
  );

  insert into public.public_form_rate_limit_windows (
    business_id,
    form_config_id,
    requester_hash,
    window_started_at,
    request_count,
    last_attempt_at
  ) values (
    v_business_id,
    v_form_id,
    p_requester_hash,
    v_window_started_at,
    1,
    now()
  ) on conflict (business_id, form_config_id, requester_hash, window_started_at)
  do update set request_count = public.public_form_rate_limit_windows.request_count + 1,
                last_attempt_at = now()
  returning request_count into v_request_count;

  if v_request_count > p_rate_limit_max then
    raise exception 'SP_RATE_LIMITED' using errcode = 'P0001';
  end if;

  select submission.reference, submission.confirmation_text
    into v_reference, v_confirmation_text
  from public.submit_public_form_submission(
    p_business_slug,
    p_form_slug,
    p_payload
  ) as submission;

  select r.id into v_request_id
  from public.requests r
  where r.business_id = v_business_id
    and r.reference = v_reference;

  if v_request_id is null then
    raise exception 'SP_REQUEST_NOT_PERSISTED' using errcode = 'P0001';
  end if;

  insert into public.email_jobs (business_id, request_id, email_type)
  values
    (v_business_id, v_request_id, 'customer_confirmation'),
    (v_business_id, v_request_id, 'business_notification')
  on conflict (request_id, email_type) do nothing;

  if (
    select count(*)
    from public.email_jobs ej
    where ej.business_id = v_business_id
      and ej.request_id = v_request_id
      and ej.email_type in ('customer_confirmation', 'business_notification')
  ) <> 2 then
    raise exception 'SP_EMAIL_JOBS_NOT_READY' using errcode = 'P0001';
  end if;

  update public.public_form_idempotency_keys
    set request_id = v_request_id,
        reference = v_reference,
        confirmation_text = v_confirmation_text,
        completed_at = now()
  where business_id = v_business_id
    and form_config_id = v_form_id
    and idempotency_key_hash = p_idempotency_key_hash;

  return query select v_reference, v_confirmation_text, false;
end;
$c11b_submission$;

revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from public;
revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from anon;
revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from authenticated;
grant execute on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) to service_role;
