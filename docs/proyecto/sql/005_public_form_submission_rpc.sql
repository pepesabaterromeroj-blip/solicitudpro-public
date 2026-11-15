-- SolicitudPro: operación transaccional para formularios públicos.
-- Diseñada para llamarse exclusivamente desde un endpoint de servidor con el
-- rol service_role. No concede permisos anon ni modifica políticas RLS.

create or replace function public.submit_public_form_submission(
  p_business_slug text,
  p_form_slug text,
  p_payload jsonb
)
returns table (reference text, confirmation_text text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $submission$
declare
  v_business_id uuid;
  v_sector_id uuid;
  v_sector_slug text;
  v_business_name text;
  v_form_id uuid;
  v_form_name text;
  v_confirmation_text text;
  v_contact jsonb;
  v_answers jsonb;
  v_value jsonb;
  v_field record;
  v_field_key text;
  v_text text;
  v_email text;
  v_phone text;
  v_contact_name text;
  v_contact_id uuid;
  v_matching_contacts uuid[];
  v_request_id uuid;
  v_reference text;
  v_reference_prefix text;
  v_reference_sequence integer;
  v_service text;
  v_description text;
  v_urgency text;
  v_next_follow_up_at timestamptz := now() + interval '24 hours';
begin
  if jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 32768 then
    raise exception 'SP_PAYLOAD_INVALID' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_payload) as payload_key
    where payload_key not in ('contact', 'answers', 'metadata', 'privacy_notice_version')
  ) then
    raise exception 'SP_PAYLOAD_INVALID' using errcode = 'P0001';
  end if;

  select b.id, b.sector_id, s.slug, b.name
    into v_business_id, v_sector_id, v_sector_slug, v_business_name
  from public.businesses b
  join public.sectors s on s.id = b.sector_id and s.is_active
  where b.slug = lower(btrim(coalesce(p_business_slug, '')))
    and b.status in ('trial', 'active')
  for update of b;

  if not found then
    raise exception 'SP_BUSINESS_OR_FORM_NOT_FOUND' using errcode = 'P0001';
  end if;

  select f.id, f.name, f.confirmation_text
    into v_form_id, v_form_name, v_confirmation_text
  from public.form_configs f
  where f.business_id = v_business_id
    and f.public_slug = lower(btrim(coalesce(p_form_slug, '')))
    and f.status = 'published';

  if not found then
    raise exception 'SP_BUSINESS_OR_FORM_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_contact := p_payload -> 'contact';
  v_answers := p_payload -> 'answers';

  if jsonb_typeof(v_contact) <> 'object' or jsonb_typeof(v_answers) <> 'object' then
    raise exception 'SP_PAYLOAD_INVALID' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_contact) as contact_key
    where contact_key not in ('display_name', 'email', 'phone')
  ) then
    raise exception 'SP_CONTACT_INVALID' using errcode = 'P0001';
  end if;

  v_contact_name := nullif(btrim(v_contact ->> 'display_name'), '');
  v_email := nullif(lower(btrim(v_contact ->> 'email')), '');
  v_phone := nullif(regexp_replace(coalesce(v_contact ->> 'phone', ''), '[^0-9+]', '', 'g'), '');

  if v_contact_name is null
    or char_length(v_contact_name) > 160
    or (v_email is null and v_phone is null)
    or (v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
    or (v_phone is not null and (char_length(v_phone) < 7 or char_length(v_phone) > 32)) then
    raise exception 'SP_CONTACT_INVALID' using errcode = 'P0001';
  end if;

  for v_field_key in select jsonb_object_keys(v_answers)
  loop
    if not exists (
      select 1
      from public.form_fields ff
      where ff.business_id = v_business_id
        and ff.form_config_id = v_form_id
        and ff.field_key = v_field_key
        and ff.is_active
    ) then
      raise exception 'SP_UNKNOWN_FIELD' using errcode = 'P0001';
    end if;
  end loop;

  for v_field in
    select ff.id, ff.field_key, ff.label, ff.field_type, ff.options, ff.is_required
    from public.form_fields ff
    where ff.business_id = v_business_id
      and ff.form_config_id = v_form_id
      and ff.is_active
    order by ff.display_order
  loop
    v_value := v_answers -> v_field.field_key;

    if v_value is null or v_value = 'null'::jsonb then
      if v_field.is_required then
        raise exception 'SP_FIELD_REQUIRED' using errcode = 'P0001';
      end if;
      continue;
    end if;

    if v_field.field_type in ('text', 'textarea', 'select', 'date') then
      if jsonb_typeof(v_value) <> 'string' then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;

      v_text := btrim(v_value #>> '{}');
      if v_text = ''
        or char_length(v_text) > (case when v_field.field_type = 'textarea' then 5000 else 500 end) then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;

      if v_field.field_type = 'date' then
        begin
          perform v_text::date;
        exception when others then
          raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
        end;
      end if;

      if v_field.field_type = 'select'
        and jsonb_typeof(v_field.options) = 'array'
        and jsonb_array_length(v_field.options) > 0
        and not exists (
          select 1 from jsonb_array_elements_text(v_field.options) as allowed(option_value)
          where allowed.option_value = v_text
        ) then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;
    elsif v_field.field_type = 'multiselect' then
      if jsonb_typeof(v_value) <> 'array'
        or jsonb_array_length(v_value) = 0
        or jsonb_array_length(v_value) > 20
        or exists (
          select 1 from jsonb_array_elements(v_value) as answer(item)
          where jsonb_typeof(answer.item) <> 'string'
        ) then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;

      if jsonb_typeof(v_field.options) = 'array'
        and jsonb_array_length(v_field.options) > 0
        and exists (
          select 1 from jsonb_array_elements_text(v_value) as answer(option_value)
          where not exists (
            select 1 from jsonb_array_elements_text(v_field.options) as allowed(option_value)
            where allowed.option_value = answer.option_value
          )
        ) then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;
    elsif v_field.field_type = 'boolean' then
      if jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
      end if;
    elsif v_field.field_type = 'file' then
      raise exception 'SP_FILE_UPLOAD_NOT_AVAILABLE' using errcode = 'P0001';
    else
      raise exception 'SP_FIELD_INVALID' using errcode = 'P0001';
    end if;
  end loop;

  select array_agg(c.id order by c.created_at)
    into v_matching_contacts
  from public.contacts c
  where c.business_id = v_business_id
    and (
      (v_email is not null and lower(c.email) = v_email)
      or (v_phone is not null and regexp_replace(coalesce(c.phone, ''), '[^0-9+]', '', 'g') = v_phone)
    );

  if coalesce(array_length(v_matching_contacts, 1), 0) = 1 then
    v_contact_id := v_matching_contacts[1];
  else
    insert into public.contacts (
      business_id,
      display_name,
      email,
      phone,
      source,
      privacy_notice_version
    ) values (
      v_business_id,
      v_contact_name,
      v_email,
      v_phone,
      'form',
      nullif(btrim(p_payload ->> 'privacy_notice_version'), '')
    ) returning id into v_contact_id;
  end if;

  v_reference_prefix := case v_sector_slug
    when 'reformas' then 'REF'
    when 'electricidad' then 'ELE'
    when 'fontaneria' then 'FON'
    when 'climatizacion' then 'CLI'
    when 'cristaleria' then 'CRI'
    when 'academias' then 'ACA'
    else 'SOL'
  end;

  select coalesce(max((substring(r.reference from ('^' || v_reference_prefix || '-([0-9]+)$')))::integer), 0) + 1
    into v_reference_sequence
  from public.requests r
  where r.business_id = v_business_id
    and r.reference ~ ('^' || v_reference_prefix || '-[0-9]+$');

  v_reference := v_reference_prefix || '-' || lpad(v_reference_sequence::text, 3, '0');
  v_service := coalesce(
    nullif(v_answers ->> 'service', ''),
    nullif(v_answers ->> 'tipo_reforma', ''),
    nullif(v_answers ->> 'tipo_trabajo', ''),
    nullif(v_answers ->> 'tipo_incidencia', ''),
    nullif(v_answers ->> 'materia', ''),
    v_form_name
  );
  v_description := coalesce(
    nullif(v_answers ->> 'descripcion', ''),
    'Solicitud recibida desde el formulario público.'
  );
  v_urgency := coalesce(
    nullif(v_answers ->> 'urgencia', ''),
    nullif(v_answers ->> 'riesgo_urgencia', ''),
    nullif(v_answers ->> 'agua_activa_urgencia', '')
  );

  insert into public.requests (
    business_id,
    contact_id,
    sector_id,
    form_config_id,
    reference,
    title,
    service,
    description,
    status,
    urgency,
    source,
    internal_summary,
    suggested_reply,
    suggested_questions,
    next_action,
    next_follow_up_at
  ) values (
    v_business_id,
    v_contact_id,
    v_sector_id,
    v_form_id,
    v_reference,
    v_form_name || ' · ' || v_contact_name,
    v_service,
    v_description,
    'Nuevo',
    v_urgency,
    'form',
    'Solicitud recibida desde el formulario público de ' || v_business_name || '. Revisar la información antes de contactar.',
    'Hola ' || split_part(v_contact_name, ' ', 1) || ', hemos recibido tu solicitud. Revisaremos la información y te contactaremos para confirmar el siguiente paso.',
    '[]'::jsonb,
    'Revisar la solicitud y contactar',
    v_next_follow_up_at
  ) returning id into v_request_id;

  for v_field in
    select ff.id, ff.field_key, ff.label
    from public.form_fields ff
    where ff.business_id = v_business_id
      and ff.form_config_id = v_form_id
      and ff.is_active
    order by ff.display_order
  loop
    v_value := v_answers -> v_field.field_key;
    if v_value is not null and v_value <> 'null'::jsonb then
      insert into public.request_custom_answers (
        business_id,
        request_id,
        form_field_id,
        field_key,
        label_snapshot,
        value_jsonb,
        value_text
      ) values (
        v_business_id,
        v_request_id,
        v_field.id,
        v_field.field_key,
        v_field.label,
        v_value,
        case when jsonb_typeof(v_value) = 'string' then v_value #>> '{}' else v_value::text end
      );
    end if;
  end loop;

  insert into public.follow_ups (
    business_id,
    request_id,
    due_at,
    cadence_hours,
    channel,
    action_text,
    status
  ) values (
    v_business_id,
    v_request_id,
    v_next_follow_up_at,
    24,
    'internal',
    'Revisar la solicitud recibida y contactar',
    'pending'
  );

  insert into public.activities (
    business_id,
    request_id,
    contact_id,
    actor_type,
    type,
    title,
    metadata
  ) values (
    v_business_id,
    v_request_id,
    v_contact_id,
    'public_form',
    'request_created',
    'Solicitud recibida desde el formulario público',
    jsonb_build_object('source', 'public_form', 'form_slug', p_form_slug)
  );

  return query select v_reference, v_confirmation_text;
end;
$submission$;

-- Una función SECURITY INVOKER no evita RLS ni queda abierta a la Data API.
-- El endpoint de servidor la invocará con service_role; ningún cliente público
-- recibe ese secreto ni permiso para ejecutarla.
revoke all on function public.submit_public_form_submission(text, text, jsonb) from public;
revoke all on function public.submit_public_form_submission(text, text, jsonb) from anon;
revoke all on function public.submit_public_form_submission(text, text, jsonb) from authenticated;
grant execute on function public.submit_public_form_submission(text, text, jsonb) to service_role;
