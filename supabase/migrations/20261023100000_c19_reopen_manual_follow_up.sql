-- C19: reapertura segura y atómica de seguimientos manuales completados.
-- La función usa los permisos/RLS del usuario autenticado y no permite alterar
-- seguimientos automáticos ni solicitudes archivadas o comercialmente cerradas.

create function public.reopen_manual_follow_up(
  p_follow_up_id uuid,
  p_business_id uuid
)
returns setof public.follow_ups
language sql
volatile
security invoker
set search_path = ''
as $c19_reopen_manual_follow_up$
  update public.follow_ups f
  set status = 'pending',
      completed_at = null,
      completed_by = null,
      completion_note = null,
      updated_at = clock_timestamp()
  from public.requests r
  where f.id = p_follow_up_id
    and f.business_id = p_business_id
    and f.status = 'completed'
    and f.assigned_to is not null
    and f.cadence_hours is null
    and f.channel = 'internal'
    and r.id = f.request_id
    and r.business_id = f.business_id
    and r.archived_at is null
    and r.status not in ('Ganado', 'Perdido')
  returning f.*;
$c19_reopen_manual_follow_up$;

revoke execute on function public.reopen_manual_follow_up(uuid, uuid)
  from public, anon;
grant execute on function public.reopen_manual_follow_up(uuid, uuid)
  to authenticated;

comment on function public.reopen_manual_follow_up(uuid, uuid) is
  'Reopens one completed manual follow-up for an active request using caller RLS; automatic C15 follow-ups are excluded.';
