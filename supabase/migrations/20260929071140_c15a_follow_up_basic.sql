-- C15A: basic internal follow-up milestones at 24, 48 and 72 hours.

alter table public.requests
  add column if not exists automatic_follow_up_milestone_hours smallint not null default 0;

alter table public.requests
  drop constraint if exists requests_automatic_follow_up_milestone_check,
  add constraint requests_automatic_follow_up_milestone_check
    check (automatic_follow_up_milestone_hours in (0, 24, 48, 72));

create index if not exists requests_basic_follow_up_due_idx
  on public.requests (created_at, id)
  where archived_at is null
    and automatic_follow_up_milestone_hours < 72
    and status in ('Nuevo', U&'En preparaci\00F3n', 'Enviado', 'Seguimiento pendiente');

create unique index if not exists activities_request_follow_up_milestone_unique
  on public.activities (request_id, type)
  where request_id is not null
    and type in (
      'request_follow_up_24h',
      'request_follow_up_48h',
      'request_follow_up_72h'
    );

create or replace function public.process_basic_follow_up_milestones(
  p_limit integer default 100,
  p_request_ids uuid[] default null
)
returns table (
  processed_count integer,
  milestone_24h_count integer,
  milestone_48h_count integer,
  milestone_72h_count integer
)
language sql
security invoker
set search_path = ''
as $function$
  with candidates as materialized (
    select
      r.id,
      r.business_id,
      case
        when r.created_at <= statement_timestamp() - interval '72 hours' then 72
        when r.created_at <= statement_timestamp() - interval '48 hours' then 48
        when r.created_at <= statement_timestamp() - interval '24 hours' then 24
        else 0
      end::smallint as target_milestone
    from public.requests r
    where r.archived_at is null
      and r.status in ('Nuevo', U&'En preparaci\00F3n', 'Enviado', 'Seguimiento pendiente')
      and (p_request_ids is null or r.id = any(p_request_ids))
      and r.automatic_follow_up_milestone_hours < case
        when r.created_at <= statement_timestamp() - interval '72 hours' then 72
        when r.created_at <= statement_timestamp() - interval '48 hours' then 48
        when r.created_at <= statement_timestamp() - interval '24 hours' then 24
        else 0
      end
    order by r.created_at, r.id
    limit greatest(1, least(coalesce(p_limit, 100), 500))
    for update of r skip locked
  ),
  advanced as (
    update public.requests r
    set automatic_follow_up_milestone_hours = c.target_milestone,
        updated_at = statement_timestamp()
    from candidates c
    where r.id = c.id
      and r.business_id = c.business_id
      and r.automatic_follow_up_milestone_hours < c.target_milestone
    returning r.id, r.business_id, c.target_milestone
  ),
  inserted as (
    insert into public.activities (
      business_id,
      request_id,
      actor_type,
      type,
      title,
      metadata
    )
    select
      a.business_id,
      a.id,
      'automation',
      case a.target_milestone
        when 24 then 'request_follow_up_24h'
        when 48 then 'request_follow_up_48h'
        else 'request_follow_up_72h'
      end,
      format(
        U&'Seguimiento autom\00E1tico: la solicitud lleva %s h pendiente.',
        a.target_milestone
      ),
      jsonb_build_object('milestone_hours', a.target_milestone)
    from advanced a
    on conflict (request_id, type) where request_id is not null and type in (
      'request_follow_up_24h',
      'request_follow_up_48h',
      'request_follow_up_72h'
    ) do nothing
    returning request_id
  )
  select
    count(*)::integer,
    count(*) filter (where target_milestone = 24)::integer,
    count(*) filter (where target_milestone = 48)::integer,
    count(*) filter (where target_milestone = 72)::integer
  from advanced
  cross join lateral (select count(*) from inserted) persisted;
$function$;

revoke execute on function public.process_basic_follow_up_milestones(integer, uuid[])
  from public, anon, authenticated;
grant execute on function public.process_basic_follow_up_milestones(integer, uuid[])
  to service_role;

comment on column public.requests.automatic_follow_up_milestone_hours is
  'Highest basic automatic internal follow-up milestone persisted for this request: 0, 24, 48 or 72 hours.';
comment on function public.process_basic_follow_up_milestones(integer, uuid[]) is
  'Atomically advances active requests to their highest due basic follow-up milestone and creates one idempotent internal activity.';
