-- Read-only panel projection. email_jobs remains inaccessible directly.
create function public.get_request_communications(p_request_id uuid)
returns table (email_type text, status text, created_at timestamptz, sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $c18b$
  select e.email_type, e.status, e.created_at, e.sent_at
  from public.email_jobs e
  join public.requests r on r.id = e.request_id and r.business_id = e.business_id
  where r.id = p_request_id
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.business_users membership
      where membership.business_id = r.business_id
        and membership.user_id = (select auth.uid())
        and membership.is_active
    )
  order by e.created_at asc, e.email_type asc;
$c18b$;

revoke all on function public.get_request_communications(uuid) from public, anon, authenticated;
grant execute on function public.get_request_communications(uuid) to authenticated;
comment on function public.get_request_communications(uuid) is
  'C18B: minimal communication status for active request-business members. No writes or direct email_jobs grants.';
