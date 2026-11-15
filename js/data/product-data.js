(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProductData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Public browser configuration already used by the DEV diagnostic panel.
  const SUPABASE_DEV = Object.freeze({
    url: 'https://rinrgjancwvcvpzjyqmu.supabase.co',
    publishableKey: 'sb_publishable_Trr953yZb_IaRjAECzFC8w_3Lzokewg',
  });
  const REQUEST_STATUSES = Object.freeze(['Nuevo', 'En preparación', 'Enviado', 'Seguimiento pendiente', 'Ganado', 'Perdido']);
  const REQUEST_WRITE_FIELDS = 'id,business_id,reference,status,priority,archived_at,won_at,lost_at,updated_at';
  const FOLLOW_UP_WRITE_FIELDS = 'id,business_id,request_id,assigned_to,due_at,cadence_hours,channel,status,action_text,completed_at,completed_by,completion_note,created_at';
  const NOTE_WRITE_FIELDS = 'id,business_id,request_id,actor_type,actor_user_id,type,title,detail,created_at';
  const ACTIVITY_WRITE_FIELDS = 'id,business_id,request_id,actor_type,actor_user_id,type,title,detail,metadata,created_at';
  const INTERNAL_NOTE_MAX_LENGTH = 2000;
  const FOLLOW_UP_ACTION_MAX_LENGTH = 500;
  const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  function readableAnswer(answer) {
    if (typeof answer.value_text === 'string' && answer.value_text.trim()) return answer.value_text.trim();
    const value = answer.value_jsonb;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value) && value.every(item => ['string', 'number', 'boolean'].includes(typeof item))) return value.join(', ');
    return 'Respuesta registrada';
  }

  function createDataService({ fetchImpl = fetch } = {}) {
    let accessToken = null;
    let expiresAt = 0;
    let user = null;
    let businesses = [];

    function signOut() {
      accessToken = null;
      expiresAt = 0;
      user = null;
      businesses = [];
    }

    async function request(path, { method = 'GET', body, auth = true, prefer } = {}) {
      if (auth && (!accessToken || Date.now() >= expiresAt)) {
        signOut();
        throw new Error('SESSION_REQUIRED');
      }
      const tokenAtStart = accessToken;
      const response = await fetchImpl(`${SUPABASE_DEV.url}${path}`, {
        method,
        credentials: 'omit',
        headers: {
          apikey: SUPABASE_DEV.publishableKey,
          ...(auth ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(prefer ? { Prefer: prefer } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 401 || response.status === 403) signOut();
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'SESSION_EXPIRED' : 'READ_FAILED');
      const payload = await response.json().catch(() => { throw new Error('READ_FAILED'); });
      if (auth && tokenAtStart !== accessToken) throw new Error('SESSION_CHANGED');
      return payload;
    }

    async function signIn(email, password) {
      signOut();
      const payload = await request('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: { email, password },
      });
      if (!payload?.access_token || !Number.isFinite(Number(payload.expires_in))) throw new Error('SIGN_IN_FAILED');
      accessToken = payload.access_token;
      expiresAt = Date.now() + Number(payload.expires_in) * 1000;
      try {
        return await session();
      } catch (error) {
        signOut();
        throw error;
      }
    }

    async function session() {
      if (!accessToken) return null;
      try {
        const profile = await request('/auth/v1/user');
        if (!isUuid(profile?.id)) throw new Error('SESSION_EXPIRED');
        user = { id: profile.id, email: profile.email || '' };
        return user;
      } catch (error) {
        signOut();
        throw error;
      }
    }

    async function rows(table, query) {
      const payload = await request(`/rest/v1/${table}?${query.toString()}`);
      if (!Array.isArray(payload)) throw new Error('READ_FAILED');
      return payload;
    }

    function requireBusiness(businessId) {
      if (!accessToken || !user) throw new Error('SESSION_REQUIRED');
      if (!isUuid(businessId) || !businesses.some(item => item.id === businessId)) throw new Error('BUSINESS_NOT_AUTHORIZED');
    }

    async function listBusinesses() {
      if (!accessToken || !user) throw new Error('SESSION_REQUIRED');
      businesses = [];
      const memberships = await rows('business_users', new URLSearchParams({
        select: 'business_id,user_id,is_active,role', user_id: `eq.${user.id}`, is_active: 'eq.true',
      }));
      const ids = memberships.filter(item => item.user_id === user.id && item.is_active === true && isUuid(item.business_id)).map(item => item.business_id);
      if (!ids.length) return [];
      const visible = await rows('businesses', new URLSearchParams({
        select: 'id,name,slug,sector_id', id: `in.(${ids.join(',')})`,
      }));
      businesses = visible.filter(item => ids.includes(item.id));
      return businesses.slice();
    }

    async function listRequests(businessId) {
      requireBusiness(businessId);
      const requests = await rows('requests', new URLSearchParams({
        select: 'id,business_id,contact_id,reference,title,service,status,priority,urgency,created_at,archived_at,next_action,next_follow_up_at,automatic_follow_up_milestone_hours,enrichment_status,internal_summary,suggested_reply',
        business_id: `eq.${businessId}`, order: 'created_at.desc',
      }));
      if (requests.some(item => item.business_id !== businessId)) throw new Error('READ_FAILED');
      const ids = [...new Set(requests.map(item => item.contact_id).filter(isUuid))];
      if (!ids.length) return requests.map(item => ({ ...item, contact: null }));
      const contacts = await rows('contacts', new URLSearchParams({
        select: 'id,business_id,display_name,email,phone', business_id: `eq.${businessId}`, id: `in.(${ids.join(',')})`,
      }));
      if (contacts.some(item => item.business_id !== businessId)) throw new Error('READ_FAILED');
      const byId = new Map(contacts.map(item => [item.id, item]));
      return requests.map(item => ({ ...item, contact: byId.get(item.contact_id) || null }));
    }

    async function listFollowUpContext(businessId) {
      requireBusiness(businessId);
      const [followUps, activities] = await Promise.all([
        rows('follow_ups', new URLSearchParams({
          select: 'id,business_id,request_id,assigned_to,due_at,status,action_text,cadence_hours,channel,completed_at,completed_by,created_at',
          business_id: `eq.${businessId}`, order: 'due_at.asc,created_at.asc',
        })),
        rows('activities', new URLSearchParams({
          select: 'business_id,request_id,type,actor_type,reason_code:metadata->>reason_code,follow_up_id:metadata->>follow_up_id,created_at',
          business_id: `eq.${businessId}`,
          type: 'in.(request_follow_up_24h,request_follow_up_48h,request_follow_up_72h,manual_follow_up_created,manual_follow_up_completed,manual_follow_up_reopened)',
          order: 'created_at.desc',
        })),
      ]);
      if (followUps.some(item => item.business_id !== businessId) ||
          activities.some(item => item.business_id !== businessId)) throw new Error('READ_FAILED');
      return {
        followUps: followUps.map(({ id, business_id, request_id, assigned_to, due_at, status, action_text, cadence_hours, channel, completed_at, completed_by, created_at }) => ({ id, business_id, request_id, assigned_to, due_at, status, action_text, cadence_hours, channel, completed_at, completed_by, created_at })),
        activities: activities.map(({ business_id, request_id, type, actor_type, reason_code, follow_up_id, created_at }) => ({ business_id, request_id, type, actor_type, reason_code, follow_up_id, created_at })),
      };
    }

    async function getRequestCommunications(requestId) {
      if (!accessToken || !user) throw new Error('SESSION_REQUIRED');
      if (!isUuid(requestId)) throw new Error('REQUEST_NOT_AVAILABLE');
      const payload = await request('/rest/v1/rpc/get_request_communications', {
        method: 'POST', body: { p_request_id: requestId },
      });
      if (!Array.isArray(payload)) throw new Error('READ_FAILED');
      return payload.map(({ email_type, status, created_at, sent_at }) => ({ email_type, status, created_at, sent_at }));
    }

    async function updateRequestState(businessId, current, changes) {
      requireBusiness(businessId);
      const status = changes?.status;
      const priority = changes?.priority;
      if (!isUuid(current?.id) || current.business_id !== businessId || !REQUEST_STATUSES.includes(status) ||
          !(priority === null || [1, 2, 3].includes(priority))) throw new Error('INVALID_CHANGE');
      const patch = { status, priority };
      if (status !== current.status) {
        patch.won_at = status === 'Ganado' ? new Date().toISOString() : null;
        patch.lost_at = status === 'Perdido' ? new Date().toISOString() : null;
      }
      const query = new URLSearchParams({ id: `eq.${current.id}`, business_id: `eq.${businessId}`, select: REQUEST_WRITE_FIELDS });
      const payload = await request(`/rest/v1/requests?${query}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || confirmed?.id !== current.id || confirmed.business_id !== businessId ||
          confirmed.status !== status || confirmed.priority !== priority) throw new Error('WRITE_NOT_CONFIRMED');
      return confirmed;
    }

    async function setRequestArchived(businessId, current, archived) {
      requireBusiness(businessId);
      if (!isUuid(current?.id) || current.business_id !== businessId || typeof archived !== 'boolean' ||
          Boolean(current.archived_at) === archived) throw new Error('ARCHIVE_NOT_ALLOWED');
      const patch = { archived_at: archived ? new Date().toISOString() : null };
      const query = new URLSearchParams({ id: `eq.${current.id}`, business_id: `eq.${businessId}`, select: REQUEST_WRITE_FIELDS });
      const payload = await request(`/rest/v1/requests?${query}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || confirmed?.id !== current.id || confirmed.business_id !== businessId ||
          Boolean(confirmed.archived_at) !== archived) throw new Error('WRITE_NOT_CONFIRMED');
      return confirmed;
    }

    async function completeFollowUp(businessId, followUp) {
      requireBusiness(businessId);
      if (!isUuid(followUp?.id) || followUp.business_id !== businessId || followUp.status !== 'pending') throw new Error('FOLLOW_UP_NOT_ALLOWED');
      const patch = { status: 'completed', completed_at: new Date().toISOString(), completed_by: user.id };
      const query = new URLSearchParams({
        id: `eq.${followUp.id}`, business_id: `eq.${businessId}`, status: 'eq.pending', select: FOLLOW_UP_WRITE_FIELDS,
      });
      const payload = await request(`/rest/v1/follow_ups?${query}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || confirmed?.id !== followUp.id || confirmed.business_id !== businessId ||
          confirmed.status !== 'completed' || !confirmed.completed_at) throw new Error('WRITE_NOT_CONFIRMED');
      return confirmed;
    }

    async function recordManualFollowUpActivity(followUp, type) {
      const titles = {
        manual_follow_up_created: 'Seguimiento manual creado',
        manual_follow_up_completed: 'Seguimiento completado',
        manual_follow_up_reopened: 'Seguimiento reabierto',
      };
      const title = titles[type];
      if (!title) throw new Error('FOLLOW_UP_ACTIVITY_INVALID');
      const activity = {
        business_id: followUp.business_id,
        request_id: followUp.request_id,
        actor_type: 'user',
        actor_user_id: user.id,
        type,
        title,
        detail: followUp.action_text,
        metadata: { follow_up_id: followUp.id },
      };
      const query = new URLSearchParams({ select: ACTIVITY_WRITE_FIELDS });
      const payload = await request(`/rest/v1/activities?${query}`, { method: 'POST', body: activity, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || !isUuid(confirmed?.id) || confirmed.business_id !== followUp.business_id ||
          confirmed.request_id !== followUp.request_id || confirmed.actor_type !== 'user' || confirmed.actor_user_id !== user.id ||
          confirmed.type !== type || confirmed.title !== title || confirmed.detail !== followUp.action_text ||
          confirmed.metadata?.follow_up_id !== followUp.id || !confirmed.created_at) throw new Error('FOLLOW_UP_ACTIVITY_NOT_CONFIRMED');
      return confirmed;
    }

    async function createManualFollowUp(businessId, current, values) {
      requireBusiness(businessId);
      const actionText = String(values?.actionText || '').trim();
      const due = new Date(values?.dueAt || '');
      if (!isUuid(current?.id) || current.business_id !== businessId || !actionText || actionText.length > FOLLOW_UP_ACTION_MAX_LENGTH ||
          Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) throw new Error('FOLLOW_UP_INVALID');
      const row = {
        business_id: businessId,
        request_id: current.id,
        assigned_to: user.id,
        due_at: due.toISOString(),
        cadence_hours: null,
        channel: 'internal',
        action_text: actionText,
        status: 'pending',
      };
      const query = new URLSearchParams({ select: FOLLOW_UP_WRITE_FIELDS });
      const payload = await request(`/rest/v1/follow_ups?${query}`, { method: 'POST', body: row, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || !isUuid(confirmed?.id) || confirmed.business_id !== businessId ||
          confirmed.request_id !== current.id || confirmed.assigned_to !== user.id || confirmed.status !== 'pending' ||
          confirmed.action_text !== actionText || Number.isNaN(Date.parse(confirmed.due_at))) throw new Error('WRITE_NOT_CONFIRMED');
      try {
        const activity = await recordManualFollowUpActivity(confirmed, 'manual_follow_up_created');
        return { followUp: confirmed, activity };
      } catch {
        throw new Error('FOLLOW_UP_CREATED_ACTIVITY_FAILED');
      }
    }

    async function completeManualFollowUp(businessId, followUp) {
      const confirmed = await completeFollowUp(businessId, followUp);
      try {
        const activity = await recordManualFollowUpActivity(confirmed, 'manual_follow_up_completed');
        return { followUp: confirmed, activity };
      } catch {
        throw new Error('FOLLOW_UP_COMPLETED_ACTIVITY_FAILED');
      }
    }

    async function reopenManualFollowUp(businessId, followUp, current) {
      requireBusiness(businessId);
      const manual = isUuid(followUp?.assigned_to) && followUp.cadence_hours == null && followUp.channel === 'internal';
      const requestActive = isUuid(current?.id) && current.id === followUp?.request_id && current.business_id === businessId &&
        !current.archived_at && !['Ganado', 'Perdido'].includes(current.status);
      if (!isUuid(followUp?.id) || followUp.business_id !== businessId || followUp.status !== 'completed' || !manual || !requestActive) {
        throw new Error('FOLLOW_UP_NOT_ALLOWED');
      }
      const payload = await request('/rest/v1/rpc/reopen_manual_follow_up', {
        method: 'POST', body: { p_follow_up_id: followUp.id, p_business_id: businessId },
      });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || confirmed?.id !== followUp.id || confirmed.business_id !== businessId ||
          confirmed.request_id !== followUp.request_id || confirmed.status !== 'pending' || confirmed.completed_at !== null ||
          confirmed.completed_by !== null || confirmed.completion_note !== null || confirmed.action_text !== followUp.action_text || confirmed.due_at !== followUp.due_at ||
          confirmed.assigned_to !== followUp.assigned_to) throw new Error('WRITE_NOT_CONFIRMED');
      try {
        const activity = await recordManualFollowUpActivity(confirmed, 'manual_follow_up_reopened');
        return { followUp: confirmed, activity };
      } catch (error) {
        if (['SESSION_REQUIRED', 'SESSION_EXPIRED', 'SESSION_CHANGED'].includes(error?.message)) throw error;
        throw new Error('FOLLOW_UP_REOPENED_ACTIVITY_FAILED');
      }
    }

    async function addInternalNote(businessId, requestId, text) {
      requireBusiness(businessId);
      const detail = String(text || '').trim();
      if (!isUuid(requestId) || !detail || detail.length > INTERNAL_NOTE_MAX_LENGTH) throw new Error('NOTE_NOT_ALLOWED');
      const note = {
        business_id: businessId,
        request_id: requestId,
        actor_type: 'user',
        actor_user_id: user.id,
        type: 'internal_note',
        title: 'Nota interna',
        detail,
      };
      const query = new URLSearchParams({ select: NOTE_WRITE_FIELDS });
      const payload = await request(`/rest/v1/activities?${query}`, { method: 'POST', body: note, prefer: 'return=representation' });
      const confirmed = payload?.[0];
      if (!Array.isArray(payload) || payload.length !== 1 || !isUuid(confirmed?.id) || confirmed.business_id !== businessId ||
          confirmed.request_id !== requestId || confirmed.actor_type !== 'user' || confirmed.actor_user_id !== user.id ||
          confirmed.type !== 'internal_note' || confirmed.title !== 'Nota interna' || confirmed.detail !== detail || !confirmed.created_at) {
        throw new Error('WRITE_NOT_CONFIRMED');
      }
      return confirmed;
    }

    function isCanonicalAttachmentPath(item, businessId, requestId) {
      const prefix = `${businessId}/${requestId}/`;
      const suffix = String(item.storage_path || '').slice(prefix.length);
      return String(item.storage_path || '').startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif|pdf)$/i.test(suffix);
    }

    async function signAttachment(item, businessId, requestId) {
      if (!isCanonicalAttachmentPath(item, businessId, requestId)) throw new Error('READ_FAILED');
      const encodedPath = item.storage_path.split('/').map(encodeURIComponent).join('/');
      const payload = await request(`/storage/v1/object/sign/request-attachments/${encodedPath}`, {
        method: 'POST', body: { expiresIn: 120 },
      });
      if (typeof payload?.signedURL !== 'string') throw new Error('READ_FAILED');
      const signed = new URL(payload.signedURL.startsWith('/object/') ? `${SUPABASE_DEV.url}/storage/v1${payload.signedURL}` : payload.signedURL, SUPABASE_DEV.url);
      if (signed.origin !== SUPABASE_DEV.url || signed.pathname !== `/storage/v1/object/sign/request-attachments/${item.storage_path}` || !signed.searchParams.get('token')) throw new Error('READ_FAILED');
      return signed.href;
    }

    async function getRequestDetail(businessId, requestId) {
      requireBusiness(businessId);
      if (!isUuid(requestId)) throw new Error('REQUEST_NOT_AVAILABLE');

      const requestRows = await rows('requests', new URLSearchParams({
        select: 'id,business_id,contact_id,form_config_id,reference,title,service,description,status,priority,urgency,source,created_at,archived_at,enrichment_status,enriched_at,internal_summary,suggested_reply,next_action,next_follow_up_at,automatic_follow_up_milestone_hours',
        business_id: `eq.${businessId}`, id: `eq.${requestId}`, limit: '1',
      }));
      if (!requestRows.length) return null;
      if (requestRows.length !== 1 || requestRows[0].id !== requestId || requestRows[0].business_id !== businessId) throw new Error('READ_FAILED');
      const requestRow = requestRows[0];

      const [contacts, forms, fields, rawAnswers, rawActivities, rawAttachments] = await Promise.all([
        isUuid(requestRow.contact_id) ? rows('contacts', new URLSearchParams({
          select: 'id,business_id,display_name,email,phone', business_id: `eq.${businessId}`, id: `eq.${requestRow.contact_id}`, limit: '1',
        })) : Promise.resolve([]),
        isUuid(requestRow.form_config_id) ? rows('form_configs', new URLSearchParams({
          select: 'id,business_id,name', business_id: `eq.${businessId}`, id: `eq.${requestRow.form_config_id}`, limit: '1',
        })) : Promise.resolve([]),
        isUuid(requestRow.form_config_id) ? rows('form_fields', new URLSearchParams({
          select: 'id,business_id,form_config_id,label,display_order', business_id: `eq.${businessId}`, form_config_id: `eq.${requestRow.form_config_id}`, is_active: 'eq.true', order: 'display_order.asc',
        })) : Promise.resolve([]),
        rows('request_custom_answers', new URLSearchParams({
          select: 'business_id,request_id,form_field_id,field_key,label_snapshot,value_text,value_jsonb', business_id: `eq.${businessId}`, request_id: `eq.${requestId}`,
        })),
        rows('activities', new URLSearchParams({
          select: 'id,business_id,request_id,actor_type,actor_user_id,type,title,detail,created_at', business_id: `eq.${businessId}`, request_id: `eq.${requestId}`, order: 'created_at.desc',
        })),
        rows('attachments', new URLSearchParams({
          select: 'id,business_id,request_id,storage_path,file_name,mime_type,size_bytes,created_at', business_id: `eq.${businessId}`, request_id: `eq.${requestId}`, deleted_at: 'is.null', order: 'created_at.asc,id.asc',
        })),
      ]);

      if (contacts.some(item => item.business_id !== businessId) ||
          forms.some(item => item.business_id !== businessId) ||
          fields.some(item => item.business_id !== businessId || item.form_config_id !== requestRow.form_config_id) ||
          rawAnswers.some(item => item.business_id !== businessId || item.request_id !== requestId) ||
          rawActivities.some(item => item.business_id !== businessId || item.request_id !== requestId) ||
          rawAttachments.some(item => item.business_id !== businessId || item.request_id !== requestId)) throw new Error('READ_FAILED');
      if (rawAttachments.some(item => !isCanonicalAttachmentPath(item, businessId, requestId))) throw new Error('READ_FAILED');

      const fieldById = new Map(fields.map(item => [item.id, item]));
      const normalizedAnswers = rawAnswers.map((item, index) => {
        const field = fieldById.get(item.form_field_id);
        return {
          label: String(item.label_snapshot || field?.label || 'Campo del formulario'),
          value: readableAnswer(item),
          order: Number.isFinite(Number(field?.display_order)) ? Number(field.display_order) : Number.MAX_SAFE_INTEGER,
          index,
          fieldKey: item.field_key,
        };
      }).sort((a, b) => a.order - b.order || a.index - b.index);
      const zone = normalizedAnswers.find(item => item.fieldKey === 'zona')?.value || null;
      const answers = normalizedAnswers.map(({ label, value }) => ({ label, value }));
      const notes = rawActivities.filter(item => item.type === 'internal_note').map(({ id, actor_type, actor_user_id, type, detail, created_at }) => ({ id, actor_type, actor_user_id, type, detail, created_at }));
      const activities = rawActivities.filter(item => item.type !== 'internal_note').map(({ actor_type, type, title, detail, created_at }) => ({ actor_type, type, title, detail, created_at }));

      const attachments = await Promise.all(rawAttachments.map(async item => {
        let access_url = null;
        try { access_url = await signAttachment(item, businessId, requestId); } catch { /* metadata remains readable */ }
        return { file_name: item.file_name, mime_type: item.mime_type, size_bytes: item.size_bytes, created_at: item.created_at, access_url };
      }));

      let communications = [];
      let communicationsStatus = 'ready';
      try {
        communications = await getRequestCommunications(requestId);
      } catch (error) {
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) throw error;
        communicationsStatus = 'error';
      }

      return {
        request: requestRow,
        contact: contacts[0] || null,
        form: forms[0] ? { name: forms[0].name } : null,
        answers,
        zone,
        activities,
        notes,
        attachments,
        communications,
        communicationsStatus,
      };
    }

    return { signIn, session, signOut, listBusinesses, listRequests, listFollowUpContext, getRequestCommunications, getRequestDetail, updateRequestState, setRequestArchived, completeFollowUp, createManualFollowUp, completeManualFollowUp, reopenManualFollowUp, addInternalNote };
  }

  return { createDataService };
});
