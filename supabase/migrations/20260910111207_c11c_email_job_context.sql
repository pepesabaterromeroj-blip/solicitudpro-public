-- C11C: expose a normalized, read-only context for one backend email job.
-- The function does not claim jobs, update queue state, render HTML, or send email.

create function public.get_email_job_context(p_email_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $c11c_context$
  select jsonb_build_object(
    'job', jsonb_build_object(
      'id', ej.id,
      'email_type', ej.email_type,
      'status', ej.status,
      'request_id', ej.request_id,
      'business_id', ej.business_id
    ),
    'recipient_email', case
      when ej.email_type = 'customer_confirmation' then c.email
      when ej.email_type = 'business_notification' then b.contact_email
      else null
    end,
    'business', jsonb_build_object(
      'name', b.name,
      'sector', s.name,
      'contact_email', b.contact_email
    ),
    'customer', jsonb_build_object(
      'name', c.display_name,
      'email', c.email,
      'phone', c.phone
    ),
    'request', jsonb_build_object(
      'reference', r.reference,
      'created_at', r.created_at,
      'service', r.service,
      'form_name', coalesce(fc.title, fc.name, r.service),
      'description', r.description,
      'urgency', r.urgency,
      'priority', r.priority
    ),
    'answers', answers.items
  )
  from public.email_jobs ej
  join public.requests r
    on r.id = ej.request_id
   and r.business_id = ej.business_id
  join public.businesses b
    on b.id = r.business_id
  join public.sectors s
    on s.id = r.sector_id
  join public.contacts c
    on c.id = r.contact_id
   and c.business_id = r.business_id
  left join public.form_configs fc
    on fc.id = r.form_config_id
   and fc.business_id = r.business_id
  cross join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'label', coalesce(nullif(btrim(a.label_snapshot), ''), ff.label),
          'value', case
            when jsonb_typeof(a.value_jsonb) = 'string'
              then a.value_jsonb #>> '{}'
            when jsonb_typeof(a.value_jsonb) = 'boolean'
              then case when (a.value_jsonb #>> '{}')::boolean then 'Sí' else 'No' end
            when jsonb_typeof(a.value_jsonb) = 'array'
              then coalesce((
                select string_agg(answer_value.value, ', ' order by answer_value.ordinality)
                from jsonb_array_elements_text(a.value_jsonb)
                  with ordinality as answer_value(value, ordinality)
              ), '')
            when jsonb_typeof(a.value_jsonb) = 'number'
              then a.value_jsonb #>> '{}'
            when jsonb_typeof(a.value_jsonb) = 'null'
              then ''
            else '[Dato estructurado no mostrable]'
          end
        )
        order by ff.display_order, a.created_at, a.id
      ),
      '[]'::jsonb
    ) as items
    from public.request_custom_answers a
    left join public.form_fields ff
      on ff.id = a.form_field_id
     and ff.business_id = a.business_id
    where a.request_id = r.id
      and a.business_id = r.business_id
  ) answers
  where ej.id = p_email_job_id;
$c11c_context$;

revoke execute on function public.get_email_job_context(uuid) from public;
revoke execute on function public.get_email_job_context(uuid) from anon;
revoke execute on function public.get_email_job_context(uuid) from authenticated;
grant execute on function public.get_email_job_context(uuid) to service_role;

comment on function public.get_email_job_context(uuid) is
  'Returns the normalized backend-only email context for one job; null when the job does not exist.';
