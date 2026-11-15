-- Transactional DEV integration test for C15B. All fixtures are rolled back.
begin;

insert into public.requests (
  id, business_id, contact_id, sector_id, form_config_id, reference, title,
  service, description, status, priority, source, won_at, created_at,
  updated_at, enrichment_status, enrichment_attempt_count,
  automatic_follow_up_milestone_hours, next_follow_up_at
)
select
  fixture.id,
  template.business_id,
  template.contact_id,
  template.sector_id,
  template.form_config_id,
  fixture.reference,
  fixture.reference,
  template.service,
  'Fixture ficticia C15B sin PII real.',
  fixture.status,
  fixture.priority,
  'manual',
  case when fixture.status = 'Ganado' then statement_timestamp() end,
  statement_timestamp() - fixture.age,
  statement_timestamp() - fixture.age,
  'legacy',
  0,
  0,
  fixture.next_follow_up_at
from (
  values
    ('15000000-0000-4000-a000-000000000001'::uuid, 'C15B-TX-A-NORMAL', 1, interval '25 hours', 'Nuevo', 2::smallint, null::timestamptz),
    ('15000000-0000-4000-a000-000000000002'::uuid, 'C15B-TX-B-PRIORITY', 1, interval '25 hours', 'Nuevo', 1::smallint, null::timestamptz),
    ('15000000-0000-4000-a000-000000000003'::uuid, 'C15B-TX-C-HUMAN', 1, interval '49 hours', 'Nuevo', 2::smallint, null::timestamptz),
    ('15000000-0000-4000-a000-000000000004'::uuid, 'C15B-TX-D-FUTURE', 1, interval '49 hours', 'Nuevo', 2::smallint, statement_timestamp() + interval '4 hours'),
    ('15000000-0000-4000-a000-000000000005'::uuid, 'C15B-TX-E-TERMINAL', 1, interval '75 hours', 'Ganado', 1::smallint, null::timestamptz),
    ('15000000-0000-4000-a000-000000000006'::uuid, 'C15B-TX-F-DOWNTIME', 2, interval '75 hours', 'Enviado', 2::smallint, null::timestamptz),
    ('15000000-0000-4000-a000-000000000007'::uuid, 'C15B-TX-G-OVERDUE', 1, interval '49 hours', 'Nuevo', 1::smallint, statement_timestamp() - interval '1 hour')
) as fixture(id, reference, tenant_number, age, status, priority, next_follow_up_at)
join lateral (
  select r.business_id, r.contact_id, r.sector_id, r.form_config_id, r.service
  from public.requests r
  where r.business_id = case fixture.tenant_number
    when 1 then '2eb3ce32-aa1c-4e43-85d3-184cfebf7dba'::uuid
    else '4d6aeb60-4a7f-40a9-996c-ffec2edc9104'::uuid
  end
  limit 1
) template on true;

insert into public.activities (
  business_id, request_id, actor_type, type, title, created_at
)
select business_id, id, 'user', 'internal_note', 'Acción humana reciente',
  statement_timestamp() - interval '1 hour'
from public.requests
where id = '15000000-0000-4000-a000-000000000003'::uuid;

insert into public.follow_ups (
  business_id, request_id, due_at, cadence_hours, channel, action_text, status
)
select business_id, id, next_follow_up_at, 48, 'internal',
  'Seguimiento manual ficticio', 'pending'
from public.requests
where id in (
  '15000000-0000-4000-a000-000000000004'::uuid,
  '15000000-0000-4000-a000-000000000007'::uuid
);

select *
from public.process_basic_follow_up_milestones(
  100,
  array[
    '15000000-0000-4000-a000-000000000001'::uuid,
    '15000000-0000-4000-a000-000000000002'::uuid,
    '15000000-0000-4000-a000-000000000003'::uuid,
    '15000000-0000-4000-a000-000000000004'::uuid,
    '15000000-0000-4000-a000-000000000005'::uuid,
    '15000000-0000-4000-a000-000000000006'::uuid,
    '15000000-0000-4000-a000-000000000007'::uuid
  ]
);

do $test$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000001'::uuid
    and type = 'request_follow_up_24h'
    and metadata ->> 'reason_code' = 'no_recent_activity';
  if v_count <> 1 then raise exception 'A normal request did not produce contextual 24h follow-up'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000002'::uuid
    and type = 'request_follow_up_24h'
    and metadata ->> 'reason_code' = 'high_priority_no_recent_activity';
  if v_count <> 1 then raise exception 'B high priority request was not differentiated'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000003'::uuid
    and type like 'request_follow_up_%';
  if v_count <> 0 then raise exception 'C recent human activity did not postpone automation'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000004'::uuid
    and type like 'request_follow_up_%';
  if v_count <> 0 then raise exception 'D future manual follow-up was not respected'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000005'::uuid
    and type like 'request_follow_up_%';
  if v_count <> 0 then raise exception 'E terminal request produced a follow-up'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000006'::uuid
    and type = 'request_follow_up_72h'
    and metadata ->> 'reason_code' = 'no_recent_activity';
  if v_count <> 1 then raise exception 'F downtime catch-up did not jump directly to 72h'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000006'::uuid
    and type in ('request_follow_up_24h', 'request_follow_up_48h');
  if v_count <> 0 then raise exception 'F downtime catch-up created historical burst'; end if;

  select count(*) into v_count
  from public.activities
  where request_id = '15000000-0000-4000-a000-000000000007'::uuid
    and type = 'request_follow_up_48h'
    and metadata ->> 'reason_code' = 'manual_follow_up_overdue';
  if v_count <> 1 then raise exception 'G overdue manual follow-up did not outrank priority'; end if;

  select count(*) into v_count
  from public.activities a
  join public.requests r
    on r.id = a.request_id
   and r.business_id = a.business_id
  where a.request_id in (
    '15000000-0000-4000-a000-000000000001'::uuid,
    '15000000-0000-4000-a000-000000000002'::uuid,
    '15000000-0000-4000-a000-000000000006'::uuid,
    '15000000-0000-4000-a000-000000000007'::uuid
  )
    and a.type like 'request_follow_up_%';
  if v_count <> 4 then raise exception 'I tenant identity mismatch'; end if;
end
$test$;

select *
from public.process_basic_follow_up_milestones(
  100,
  array[
    '15000000-0000-4000-a000-000000000001'::uuid,
    '15000000-0000-4000-a000-000000000002'::uuid,
    '15000000-0000-4000-a000-000000000003'::uuid,
    '15000000-0000-4000-a000-000000000004'::uuid,
    '15000000-0000-4000-a000-000000000005'::uuid,
    '15000000-0000-4000-a000-000000000006'::uuid,
    '15000000-0000-4000-a000-000000000007'::uuid
  ]
);

do $test$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.activities
  where request_id in (
    '15000000-0000-4000-a000-000000000001'::uuid,
    '15000000-0000-4000-a000-000000000002'::uuid,
    '15000000-0000-4000-a000-000000000006'::uuid,
    '15000000-0000-4000-a000-000000000007'::uuid
  )
    and type like 'request_follow_up_%';
  if v_count <> 4 then raise exception 'G replay created duplicate activities'; end if;
end
$test$;

rollback;
