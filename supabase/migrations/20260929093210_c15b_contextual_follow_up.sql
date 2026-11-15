-- C15B: contextual deterministic decisions on top of C15A milestones.

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
      milestone.target_milestone,
      case
        when coalesce(follow_up_context.has_overdue_manual_follow_up, false)
          then 'manual_follow_up_overdue'
        when r.priority = 1
          then 'high_priority_no_recent_activity'
        else 'no_recent_activity'
      end as reason_code
    from public.requests r
    cross join lateral (
      select case
        when r.created_at <= statement_timestamp() - interval '72 hours' then 72
        when r.created_at <= statement_timestamp() - interval '48 hours' then 48
        when r.created_at <= statement_timestamp() - interval '24 hours' then 24
        else 0
      end::smallint as target_milestone
    ) milestone
    left join lateral (
      select
        bool_or(
          f.status = 'pending'
          and f.due_at > statement_timestamp()
        ) as has_future_manual_follow_up,
        bool_or(
          f.status = 'pending'
          and f.due_at <= statement_timestamp()
        ) as has_overdue_manual_follow_up,
        max(f.completed_at) filter (
          where f.status = 'completed'
        ) as last_completed_follow_up_at
      from public.follow_ups f
      where f.request_id = r.id
        and f.business_id = r.business_id
    ) follow_up_context on true
    left join lateral (
      select max(a.created_at) as last_relevant_human_activity_at
      from public.activities a
      where a.request_id = r.id
        and a.business_id = r.business_id
        and a.actor_type = 'user'
        and a.type <> 'request_created'
    ) activity_context on true
    cross join lateral (
      select greatest(
        r.last_contacted_at,
        follow_up_context.last_completed_follow_up_at,
        activity_context.last_relevant_human_activity_at
      ) as last_relevant_human_action_at
    ) human_context
    where r.archived_at is null
      and r.status in (
        'Nuevo',
        U&'En preparaci\00F3n',
        'Enviado',
        'Seguimiento pendiente'
      )
      and (p_request_ids is null or r.id = any(p_request_ids))
      and milestone.target_milestone > r.automatic_follow_up_milestone_hours
      and not (
        coalesce(r.next_follow_up_at > statement_timestamp(), false)
        or coalesce(follow_up_context.has_future_manual_follow_up, false)
      )
      and (
        human_context.last_relevant_human_action_at is null
        or human_context.last_relevant_human_action_at <=
          statement_timestamp() - interval '24 hours'
      )
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
    returning r.id, r.business_id, c.target_milestone, c.reason_code
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
      case a.reason_code
        when 'manual_follow_up_overdue' then format(
          'Seguimiento recomendado: existe un seguimiento manual vencido (%s h).',
          a.target_milestone
        )
        when 'high_priority_no_recent_activity' then format(
          'Seguimiento recomendado: solicitud prioritaria sin actividad humana reciente (%s h).',
          a.target_milestone
        )
        else format(
          'Seguimiento recomendado: han pasado %s h sin nuevos avances.',
          a.target_milestone
        )
      end,
      jsonb_build_object(
        'milestone_hours', a.target_milestone,
        'reason_code', a.reason_code
      )
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

comment on function public.process_basic_follow_up_milestones(integer, uuid[]) is
  'Atomically applies C15A milestones with C15B contextual postponement and reason selection.';
