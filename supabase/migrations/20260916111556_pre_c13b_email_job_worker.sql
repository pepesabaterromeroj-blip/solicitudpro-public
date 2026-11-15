-- PRE-C13B: backend-only lease/claim contract for a future email worker.
-- No provider call or email delivery is introduced here.
-- Version aligned with the migration recorded in Supabase DEV.

alter table public.email_jobs
  add column claim_token uuid,
  add column lease_expires_at timestamptz;

-- A pre-PRE-C13B processing row cannot own a valid claim because tokens did
-- not exist yet. Return it to the queue before enforcing the new invariant.
update public.email_jobs
set status = 'pending',
    processing_started_at = null,
    available_at = least(available_at, clock_timestamp()),
    updated_at = clock_timestamp()
where status = 'processing';

alter table public.email_jobs
  add constraint email_jobs_claim_state_check
    check (
      (
        status = 'processing'
        and claim_token is not null
        and lease_expires_at is not null
        and processing_started_at is not null
        and lease_expires_at > processing_started_at
      )
      or
      (
        status <> 'processing'
        and claim_token is null
        and lease_expires_at is null
      )
    );

create index email_jobs_expired_lease_idx
  on public.email_jobs (lease_expires_at, created_at, id)
  where status = 'processing';

create function public.claim_email_jobs(
  p_limit integer default 1,
  p_lease_seconds integer default 300
)
returns table (
  job_id uuid,
  email_type text,
  attempt_count smallint,
  lease_expires_at timestamptz,
  claim_token uuid,
  delivery_id uuid,
  context jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $pre_c13b_claim$
declare
  v_candidate record;
  v_claimed public.email_jobs%rowtype;
begin
  if p_limit is null or p_limit not between 1 and 10 then
    raise exception 'SP_EMAIL_WORKER_LIMIT_INVALID' using errcode = '22023';
  end if;

  if p_lease_seconds is null or p_lease_seconds not between 30 and 3600 then
    raise exception 'SP_EMAIL_WORKER_LEASE_INVALID' using errcode = '22023';
  end if;

  for v_candidate in
    select ej.id
    from public.email_jobs ej
    where (
        ej.status = 'pending'
        and ej.available_at <= clock_timestamp()
      )
      or (
        ej.status = 'processing'
        and ej.lease_expires_at <= clock_timestamp()
      )
    order by
      case when ej.status = 'pending' then ej.available_at else ej.lease_expires_at end,
      ej.created_at,
      ej.id
    for update skip locked
    limit p_limit
  loop
    update public.email_jobs ej
    set status = 'processing',
        attempt_count = ej.attempt_count + 1,
        processing_started_at = clock_timestamp(),
        claim_token = gen_random_uuid(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        sent_at = null,
        updated_at = clock_timestamp()
    where ej.id = v_candidate.id
    returning ej.* into v_claimed;

    job_id := v_claimed.id;
    email_type := v_claimed.email_type;
    attempt_count := v_claimed.attempt_count;
    lease_expires_at := v_claimed.lease_expires_at;
    claim_token := v_claimed.claim_token;
    delivery_id := v_claimed.id;
    context := public.get_email_job_context(v_claimed.id);
    return next;
  end loop;
end;
$pre_c13b_claim$;

create function public.resolve_email_job_sent(
  p_job_id uuid,
  p_claim_token uuid
)
returns table (
  job_id uuid,
  status text,
  sent_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $pre_c13b_sent$
  update public.email_jobs ej
  set status = 'sent',
      sent_at = clock_timestamp(),
      last_error = null,
      claim_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where ej.id = p_job_id
    and ej.claim_token = p_claim_token
    and ej.status = 'processing'
    and ej.lease_expires_at > clock_timestamp()
  returning ej.id, ej.status, ej.sent_at;
$pre_c13b_sent$;

create function public.resolve_email_job_failed(
  p_job_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retry_at timestamptz default null
)
returns table (
  job_id uuid,
  status text,
  available_at timestamptz,
  last_error text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $pre_c13b_failed$
begin
  if nullif(btrim(p_error), '') is null or length(p_error) > 500 then
    raise exception 'SP_EMAIL_WORKER_ERROR_INVALID' using errcode = '22023';
  end if;

  if p_retry_at is not null and p_retry_at <= clock_timestamp() then
    raise exception 'SP_EMAIL_WORKER_RETRY_AT_INVALID' using errcode = '22023';
  end if;

  return query
  update public.email_jobs ej
  set status = case when p_retry_at is null then 'failed' else 'pending' end,
      available_at = coalesce(p_retry_at, ej.available_at),
      sent_at = null,
      last_error = btrim(p_error),
      claim_token = null,
      lease_expires_at = null,
      updated_at = clock_timestamp()
  where ej.id = p_job_id
    and ej.claim_token = p_claim_token
    and ej.status = 'processing'
    and ej.lease_expires_at > clock_timestamp()
  returning ej.id, ej.status, ej.available_at, ej.last_error;
end;
$pre_c13b_failed$;

revoke execute on function public.claim_email_jobs(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.resolve_email_job_sent(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.resolve_email_job_failed(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.claim_email_jobs(integer, integer)
  to service_role;
grant execute on function public.resolve_email_job_sent(uuid, uuid)
  to service_role;
grant execute on function public.resolve_email_job_failed(uuid, uuid, text, timestamptz)
  to service_role;

comment on column public.email_jobs.claim_token is
  'Opaque token for the current processing lease; replaced on every claim and cleared on resolution.';
comment on column public.email_jobs.lease_expires_at is
  'Expiration of the current processing lease; expired jobs may be claimed with a new token.';
comment on function public.claim_email_jobs(integer, integer) is
  'Atomically claims due or expired email jobs with FOR UPDATE SKIP LOCKED and returns normalized C11C context.';
comment on function public.resolve_email_job_sent(uuid, uuid) is
  'Marks an actively leased email job sent only when job id and current claim token match.';
comment on function public.resolve_email_job_failed(uuid, uuid, text, timestamptz) is
  'Marks a current claim failed terminally, or returns it to pending at a future retry time.';
