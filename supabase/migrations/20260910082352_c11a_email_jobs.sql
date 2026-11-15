create table public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  request_id uuid not null,
  email_type text not null,
  status text not null default 'pending',
  attempt_count smallint not null default 0,
  available_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint email_jobs_request_business_fk
    foreign key (request_id, business_id)
    references public.requests (id, business_id)
    on delete restrict,
  constraint email_jobs_request_type_unique
    unique (request_id, email_type),
  constraint email_jobs_email_type_check
    check (email_type in ('customer_confirmation', 'business_notification')),
  constraint email_jobs_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint email_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint email_jobs_last_error_check
    check (last_error is null or btrim(last_error) <> ''),
  constraint email_jobs_processing_started_check
    check (status <> 'processing' or processing_started_at is not null),
  constraint email_jobs_sent_at_check
    check ((status = 'sent') = (sent_at is not null)),
  constraint email_jobs_failed_error_check
    check (status <> 'failed' or last_error is not null)
);

create index email_jobs_business_request_idx
  on public.email_jobs (business_id, request_id);

create index email_jobs_pending_idx
  on public.email_jobs (available_at, created_at, id)
  where status = 'pending';

alter table public.email_jobs enable row level security;

revoke all on table public.email_jobs from anon, authenticated;
grant select, insert, update, delete on table public.email_jobs to service_role;

comment on table public.email_jobs is
  'Backend-only queue of email work for later processing by n8n.';
comment on column public.email_jobs.email_type is
  'Supported values: customer_confirmation and business_notification.';
comment on column public.email_jobs.available_at is
  'Earliest time at which a backend worker may claim a pending job.';
comment on column public.email_jobs.last_error is
  'Sanitized operational error for retry control; never stores credentials or secrets.';
