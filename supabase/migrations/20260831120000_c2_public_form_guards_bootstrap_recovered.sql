-- SolicitudPro C2: bootstrap recuperado de las protecciones del formulario público.
-- Fuente demostrable: docs/proyecto/sql/006_public_form_rate_limit_idempotency.sql.
-- La RPC histórica de ese archivo queda excluida porque fue sustituida por C11B.
-- IF NOT EXISTS permite registrar este bootstrap en un DEV donde las tablas ya existen.

create table if not exists public.public_form_rate_limit_windows (
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

create table if not exists public.public_form_idempotency_keys (
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
