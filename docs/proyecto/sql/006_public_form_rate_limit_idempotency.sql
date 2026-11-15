-- SolicitudPro: protecciones mínimas para recepción pública en desarrollo.
-- Solo el endpoint de servidor (service_role) puede usar estas tablas y funciones.
-- No almacena IP, claves de idempotencia ni payloads en claro.

create table public.public_form_rate_limit_windows (
  business_id uuid not null references public.businesses(id) on delete cascade,
  form_config_id uuid not null,
  requester_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (business_id, form_config_id, requester_hash, window_started_at),
  constraint public_form_rate_limit_form_business_fk foreign key (form_config_id, business_id)
    references public.form_configs(id, business_id) on delete cascade,
  constraint public_form_rate_limit_hash_check check (requester_hash ~ '^[0-9a-f]{64}$'),
  constraint public_form_rate_limit_count_check check (request_count > 0)
);

create table public.public_form_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  form_config_id uuid not null,
  idempotency_key_hash text not null,
  payload_hash text not null,
  request_id uuid,
  reference text,
  confirmation_text text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint public_form_idempotency_form_business_fk foreign key (form_config_id, business_id)
    references public.form_configs(id, business_id) on delete cascade,
  constraint public_form_idempotency_request_business_fk foreign key (request_id, business_id)
    references public.requests(id, business_id) on delete restrict,
  constraint public_form_idempotency_key_hash_check check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  constraint public_form_idempotency_payload_hash_check check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint public_form_idempotency_expiry_check check (expires_at > created_at),
  constraint public_form_idempotency_completed_check check (
    (request_id is null and reference is null and completed_at is null)
    or (request_id is not null and reference is not null and completed_at is not null)
  ),
  constraint public_form_idempotency_unique unique (business_id, form_config_id, idempotency_key_hash)
);

alter table public.public_form_rate_limit_windows enable row level security;
alter table public.public_form_idempotency_keys enable row level security;

-- La operación de tres argumentos de C1 mantiene la creación de datos.
-- Esta envoltura añade límites e idempotencia sin duplicar esa lógica.
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
as $c2_submission$
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
$c2_submission$;

revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from public;
revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from anon;
revoke all on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) from authenticated;
grant execute on function public.submit_public_form_submission(text, text, jsonb, text, text, text, integer, integer) to service_role;
