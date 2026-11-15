-- Run only on DEV. Existing fictitious memberships/requests; all changes roll back.
begin;
create temporary table c18b_context on commit drop as
select a.user_id as owner_a, a.business_id as business_a, ra.id as request_a,
       rb.id as request_b
from public.business_users a
join public.requests ra on ra.business_id = a.business_id
join public.requests rb on rb.business_id <> a.business_id
where a.is_active and a.role = 'owner'
  and exists (select 1 from public.email_jobs e where e.request_id = ra.id)
  and exists (select 1 from public.email_jobs e where e.request_id = rb.id)
  and not exists (select 1 from public.business_users b where b.user_id = a.user_id and b.business_id = rb.business_id and b.is_active)
order by ra.created_at desc, rb.created_at desc limit 1;
do $$ begin
  if not exists (select 1 from c18b_context) then raise exception 'Missing controlled two-tenant DEV data'; end if;
  if exists (select 1 from pg_proc p where p.oid = 'public.get_request_communications(uuid)'::regprocedure and p.provolatile <> 's') then raise exception 'RPC must be stable'; end if;
end $$;
grant select on c18b_context to authenticated;
select set_config('request.jwt.claim.sub', (select owner_a::text from c18b_context), true);
set local role authenticated;
do $$ declare v record; v_keys text[]; begin
  if not exists (select 1 from public.get_request_communications((select request_a from c18b_context))) then raise exception 'Own communications missing'; end if;
  for v in select * from public.get_request_communications((select request_a from c18b_context)) loop
    select array_agg(k order by k) into v_keys from jsonb_object_keys(to_jsonb(v)) k;
    if v_keys <> array['created_at','email_type','sent_at','status'] then raise exception 'Unexpected exposed fields'; end if;
  end loop;
  if exists (select 1 from public.get_request_communications((select request_b from c18b_context))) then raise exception 'Cross-tenant leak'; end if;
  if exists (select 1 from public.get_request_communications('00000000-0000-4000-8000-000000000000')) then raise exception 'Unknown request leak'; end if;
  if exists (select 1 from public.get_request_communications(null)) then raise exception 'Null request leak'; end if;
  begin
    perform 1 from public.email_jobs limit 1;
    raise exception 'Direct email_jobs access allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Simulate inactive membership within this transaction, without modifying Auth.
update public.business_users b set is_active = false from c18b_context c
where b.user_id = c.owner_a and b.business_id = c.business_a;
set local role authenticated;
do $$ begin
  if exists (select 1 from public.get_request_communications((select request_a from c18b_context))) then raise exception 'Inactive membership leak'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.get_request_communications('00000000-0000-4000-8000-000000000000')) then raise exception 'Missing identity leak'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.get_request_communications('00000000-0000-4000-8000-000000000000');
    raise exception 'Anon EXECUTE allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'C18B SQL: authorized, four fields, cross-tenant, missing, inactive, direct access and anon checks passed; rollback complete' as result;
