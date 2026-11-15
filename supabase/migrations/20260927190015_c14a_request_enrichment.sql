-- C14A: robust, backend-only enrichment state on requests.

alter table public.requests
  add column if not exists enrichment_status text not null default 'legacy',
  add column if not exists enrichment_claim_token uuid,
  add column if not exists enrichment_claimed_at timestamptz,
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_attempt_count smallint not null default 0,
  add column if not exists enrichment_next_attempt_at timestamptz;

alter table public.requests
  drop constraint if exists requests_enrichment_attempt_count_check,
  drop constraint if exists requests_enrichment_state_check;

alter table public.requests
  add constraint requests_enrichment_attempt_count_check
    check (enrichment_attempt_count between 0 and 5),
  add constraint requests_enrichment_state_check check (
    (
      enrichment_status = 'legacy'
      and enrichment_claim_token is null
      and enrichment_claimed_at is null
      and enriched_at is null
      and enrichment_next_attempt_at is null
      and enrichment_attempt_count = 0
    )
    or (
      enrichment_status = 'pending'
      and enrichment_claim_token is null
      and enrichment_claimed_at is null
      and enriched_at is null
      and enrichment_next_attempt_at is not null
      and internal_summary is null
      and suggested_reply is null
    )
    or (
      enrichment_status = 'processing'
      and enrichment_claim_token is not null
      and enrichment_claimed_at is not null
      and enriched_at is null
      and enrichment_next_attempt_at is null
      and internal_summary is null
      and suggested_reply is null
    )
    or (
      enrichment_status = 'completed'
      and enrichment_claim_token is null
      and enrichment_claimed_at is null
      and enriched_at is not null
      and enrichment_next_attempt_at is null
      and nullif(btrim(internal_summary), '') is not null
      and nullif(btrim(suggested_reply), '') is not null
    )
    or (
      enrichment_status = 'failed'
      and enrichment_claim_token is null
      and enrichment_claimed_at is null
      and enriched_at is null
      and enrichment_next_attempt_at is null
      and internal_summary is null
      and suggested_reply is null
    )
  );

create index if not exists requests_enrichment_due_idx
  on public.requests (enrichment_next_attempt_at, created_at, id)
  where enrichment_status = 'pending';

create index if not exists requests_enrichment_lease_idx
  on public.requests (enrichment_claimed_at, created_at, id)
  where enrichment_status = 'processing';

create unique index if not exists activities_request_enrichment_generated_unique
  on public.activities (request_id, type)
  where request_id is not null and type = 'request_enrichment_generated';

create or replace function public.prepare_request_enrichment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $c14a_prepare$
begin
  if new.source = 'form' and new.form_config_id is not null then
    new.internal_summary := null;
    new.suggested_reply := null;
    new.enrichment_status := 'pending';
    new.enrichment_claim_token := null;
    new.enrichment_claimed_at := null;
    new.enriched_at := null;
    new.enrichment_attempt_count := 0;
    new.enrichment_next_attempt_at := clock_timestamp();
  end if;
  return new;
end;
$c14a_prepare$;

drop trigger if exists requests_prepare_enrichment on public.requests;
create trigger requests_prepare_enrichment
before insert on public.requests
for each row execute function public.prepare_request_enrichment();

create or replace function public.claim_request_enrichments(
  p_request_id uuid default null,
  p_limit integer default 1,
  p_lease_seconds integer default 900
)
returns table (
  business_id uuid,
  request_id uuid,
  claim_token uuid,
  attempt_count smallint,
  lease_expires_at timestamptz,
  context jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $c14a_claim$
declare
  v_candidate record;
  v_claimed public.requests%rowtype;
begin
  if p_limit is null or p_limit not between 1 and 5 then
    raise exception 'SP_ENRICHMENT_LIMIT_INVALID' using errcode = '22023';
  end if;
  if p_lease_seconds is distinct from 900 then
    raise exception 'SP_ENRICHMENT_LEASE_INVALID' using errcode = '22023';
  end if;

  update public.requests r
  set enrichment_status = 'failed',
      enrichment_claim_token = null,
      enrichment_claimed_at = null,
      enrichment_next_attempt_at = null,
      updated_at = clock_timestamp()
  where (p_request_id is null or r.id = p_request_id)
    and r.enrichment_status = 'processing'
    and r.enrichment_attempt_count >= 5
    and r.enrichment_claimed_at + make_interval(secs => p_lease_seconds) <= clock_timestamp();

  for v_candidate in
    select r.id
    from public.requests r
    where (p_request_id is null or r.id = p_request_id)
      and r.enrichment_attempt_count < 5
      and (
        (r.enrichment_status = 'pending' and r.enrichment_next_attempt_at <= clock_timestamp())
        or (
          r.enrichment_status = 'processing'
          and r.enrichment_claimed_at + make_interval(secs => p_lease_seconds) <= clock_timestamp()
        )
      )
    order by
      case
        when r.enrichment_status = 'pending' then r.enrichment_next_attempt_at
        else r.enrichment_claimed_at + make_interval(secs => p_lease_seconds)
      end,
      r.created_at,
      r.id
    for update skip locked
    limit p_limit
  loop
    update public.requests r
    set enrichment_status = 'processing',
        enrichment_claim_token = gen_random_uuid(),
        enrichment_claimed_at = clock_timestamp(),
        enrichment_attempt_count = r.enrichment_attempt_count + 1,
        enrichment_next_attempt_at = null,
        internal_summary = null,
        suggested_reply = null,
        updated_at = clock_timestamp()
    where r.id = v_candidate.id
    returning r.* into v_claimed;

    business_id := v_claimed.business_id;
    request_id := v_claimed.id;
    claim_token := v_claimed.enrichment_claim_token;
    attempt_count := v_claimed.enrichment_attempt_count;
    lease_expires_at := v_claimed.enrichment_claimed_at + make_interval(secs => p_lease_seconds);
    context := jsonb_build_object(
      'sector', (select s.name from public.sectors s where s.id = v_claimed.sector_id),
      'service', v_claimed.service,
      'description', v_claimed.description,
      'urgency', v_claimed.urgency,
      'answers', coalesce((
        select jsonb_agg(
          jsonb_build_object('label', answer.label_snapshot, 'value', left(answer.value_text, 1000))
          order by answer.id
        )
        from (
          select a.id, a.label_snapshot, a.value_text
          from public.request_custom_answers a
          where a.business_id = v_claimed.business_id
            and a.request_id = v_claimed.id
            and a.value_text is not null
            and a.field_key !~* '(email|correo|phone|telefono|teléfono|nombre|name|contacto)'
            and coalesce(a.label_snapshot, '') !~* '(email|correo|phone|telefono|teléfono|nombre|name|contacto)'
          order by a.id
          limit 20
        ) answer
      ), '[]'::jsonb),
      'customer_text_is_untrusted', true
    );
    return next;
  end loop;
end;
$c14a_claim$;

create or replace function public.complete_request_enrichment(
  p_business_id uuid,
  p_request_id uuid,
  p_claim_token uuid,
  p_internal_summary text,
  p_suggested_reply text
)
returns table (request_id uuid, status text, enriched_at timestamptz)
language plpgsql
volatile
security invoker
set search_path = ''
as $c14a_complete$
declare
  v_status text;
  v_enriched_at timestamptz;
begin
  if char_length(btrim(coalesce(p_internal_summary, ''))) not between 20 and 600
    or char_length(btrim(coalesce(p_suggested_reply, ''))) not between 40 and 1200
    or p_internal_summary ~* '(<\/?[a-z][^>]*>|system[[:space:]]+prompt|developer[[:space:]]+message|api[_ -]?key|service[_ -]?role|authorization[[:space:]]*[:=]|bearer[[:space:]]+|stack[[:space:]]+trace|traceback|sb_secret_|sk-)'
    or p_suggested_reply ~* '(<\/?[a-z][^>]*>|system[[:space:]]+prompt|developer[[:space:]]+message|api[_ -]?key|service[_ -]?role|authorization[[:space:]]*[:=]|bearer[[:space:]]+|stack[[:space:]]+trace|traceback|sb_secret_|sk-)' then
    raise exception 'SP_ENRICHMENT_OUTPUT_INVALID' using errcode = '22023';
  end if;

  update public.requests r
  set internal_summary = regexp_replace(btrim(p_internal_summary), '[[:space:]]+', ' ', 'g'),
      suggested_reply = regexp_replace(btrim(p_suggested_reply), '[[:space:]]+', ' ', 'g'),
      enrichment_status = 'completed',
      enrichment_claim_token = null,
      enrichment_claimed_at = null,
      enrichment_next_attempt_at = null,
      enriched_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where r.business_id = p_business_id
    and r.id = p_request_id
    and r.enrichment_status = 'processing'
    and r.enrichment_claim_token = p_claim_token
    and r.enrichment_claimed_at + interval '15 minutes' > clock_timestamp()
  returning r.enrichment_status, r.enriched_at into v_status, v_enriched_at;

  if not found then
    return;
  end if;

  insert into public.activities (
    business_id, request_id, actor_type, type, title, metadata
  ) values (
    p_business_id,
    p_request_id,
    'automation',
    'request_enrichment_generated',
    'Resumen y respuesta sugerida generados automáticamente.',
    '{"source":"request_enrichment"}'::jsonb
  ) on conflict do nothing;

  return query select p_request_id, v_status, v_enriched_at;
end;
$c14a_complete$;

create or replace function public.fail_request_enrichment(
  p_business_id uuid,
  p_request_id uuid,
  p_claim_token uuid,
  p_error_code text,
  p_retry_at timestamptz default null
)
returns table (request_id uuid, status text, next_attempt_at timestamptz, attempt_count smallint)
language plpgsql
volatile
security invoker
set search_path = ''
as $c14a_fail$
begin
  if p_error_code not in (
    'timeout', 'network', 'rate_limited', 'gateway_5xx', 'gateway_temporary',
    'invalid_output', 'invalid_context', 'configuration'
  ) then
    raise exception 'SP_ENRICHMENT_ERROR_CODE_INVALID' using errcode = '22023';
  end if;
  if p_retry_at is not null and (
    p_error_code not in ('timeout', 'network', 'rate_limited', 'gateway_5xx', 'gateway_temporary')
    or p_retry_at <= clock_timestamp()
  ) then
    raise exception 'SP_ENRICHMENT_RETRY_AT_INVALID' using errcode = '22023';
  end if;

  return query
  update public.requests r
  set enrichment_status = case
        when p_retry_at is not null and r.enrichment_attempt_count < 5 then 'pending'
        else 'failed'
      end,
      enrichment_claim_token = null,
      enrichment_claimed_at = null,
      enrichment_next_attempt_at = case
        when p_retry_at is not null and r.enrichment_attempt_count < 5 then p_retry_at
        else null
      end,
      enriched_at = null,
      internal_summary = null,
      suggested_reply = null,
      updated_at = clock_timestamp()
  where r.business_id = p_business_id
    and r.id = p_request_id
    and r.enrichment_status = 'processing'
    and r.enrichment_claim_token = p_claim_token
    and r.enrichment_claimed_at + interval '15 minutes' > clock_timestamp()
  returning r.id, r.enrichment_status, r.enrichment_next_attempt_at, r.enrichment_attempt_count;
end;
$c14a_fail$;

create or replace function public.submit_public_form_submission_with_enrichment_wake(
  p_business_slug text,
  p_form_slug text,
  p_payload jsonb,
  p_idempotency_key_hash text,
  p_payload_hash text,
  p_requester_hash text,
  p_rate_limit_max integer,
  p_rate_limit_window_seconds integer
)
returns table (reference text, confirmation_text text, was_replayed boolean, request_id uuid)
language plpgsql
volatile
security invoker
set search_path = ''
as $c14a_submit$
declare
  v_submission record;
  v_business_id uuid;
  v_request_id uuid;
begin
  select * into v_submission
  from public.submit_public_form_submission(
    p_business_slug,
    p_form_slug,
    p_payload,
    p_idempotency_key_hash,
    p_payload_hash,
    p_requester_hash,
    p_rate_limit_max,
    p_rate_limit_window_seconds
  );

  select b.id into v_business_id
  from public.businesses b
  where b.slug = lower(btrim(coalesce(p_business_slug, '')));

  select r.id into v_request_id
  from public.requests r
  where r.business_id = v_business_id
    and r.reference = v_submission.reference;

  if v_request_id is null then
    raise exception 'SP_REQUEST_NOT_PERSISTED' using errcode = 'P0001';
  end if;

  return query select
    v_submission.reference,
    v_submission.confirmation_text,
    v_submission.was_replayed,
    v_request_id;
end;
$c14a_submit$;

revoke all on function public.prepare_request_enrichment() from public, anon, authenticated;
revoke execute on function public.claim_request_enrichments(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.complete_request_enrichment(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_request_enrichment(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.submit_public_form_submission_with_enrichment_wake(text, text, jsonb, text, text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.claim_request_enrichments(uuid, integer, integer) to service_role;
grant execute on function public.complete_request_enrichment(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.fail_request_enrichment(uuid, uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.submit_public_form_submission_with_enrichment_wake(text, text, jsonb, text, text, text, integer, integer) to service_role;

comment on function public.claim_request_enrichments(uuid, integer, integer) is
  'Claims due request enrichments atomically with a fixed 15-minute lease and minimal model context.';
comment on function public.complete_request_enrichment(uuid, uuid, uuid, text, text) is
  'Completes an active enrichment claim and creates one idempotent activity.';
comment on function public.fail_request_enrichment(uuid, uuid, uuid, text, timestamptz) is
  'Schedules a bounded transient retry or marks an active enrichment claim failed.';
