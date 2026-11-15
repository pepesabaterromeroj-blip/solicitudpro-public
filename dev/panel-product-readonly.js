"use strict";

const SUPABASE_DEV = Object.freeze({
  url: "https://rinrgjancwvcvpzjyqmu.supabase.co",
  publishableKey: "sb_publishable_Trr953yZb_IaRjAECzFC8w_3Lzokewg",
});

const READ_ONLY_TABLES = Object.freeze([
  "requests",
  "contacts",
  "request_custom_answers",
  "follow_ups",
  "activities",
  "businesses",
  "sectors",
  "form_configs",
  "form_fields",
  "attachments",
]);

const REQUEST_FIELDS = "id,business_id,contact_id,sector_id,form_config_id,reference,status,priority,archived_at,created_at,internal_summary,next_action,next_follow_up_at,source";
const REQUEST_DETAIL_FIELDS = "id,business_id,contact_id,sector_id,form_config_id,reference,title,service,description,status,urgency,priority,source,internal_summary,suggested_reply,enrichment_status,enriched_at,automatic_follow_up_milestone_hours,next_action,next_follow_up_at,archived_at,created_at,updated_at,won_at,lost_at";
const FOLLOW_UP_FIELDS = "id,request_id,business_id,due_at,status,action_text,completed_at";
const INTERNAL_NOTE_FIELDS = "id,business_id,request_id,actor_type,actor_user_id,type,title,detail,created_at";
const INTERNAL_NOTE_TYPE = "internal_note";
const INTERNAL_NOTE_TITLE = "Nota interna";
const REQUEST_STATUSES = Object.freeze(['Nuevo', 'En preparación', 'Enviado', 'Seguimiento pendiente', 'Ganado', 'Perdido']);
const CONTACT_FIELDS = "id,business_id,display_name,email,phone";
const state = {
  accessToken: null,
  detail: null,
  detailVersion: 0,
  saving: false,
  loading: false,
  userEmail: "",
  userId: null,
  requests: [],
  contacts: [],
  businesses: [],
  sectors: [],
  answers: [],
  followUps: [],
  activities: [],
  formConfigs: [],
};

const elements = {
  accessScreen: document.querySelector("#access-screen"),
  panelScreen: document.querySelector("#panel-screen"),
  signInForm: document.querySelector("#sign-in-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  signOut: document.querySelector("#sign-out"),
  refresh: document.querySelector("#refresh"),
  userContext: document.querySelector("#user-context"),
  businessContext: document.querySelector("#business-context"),
  message: document.querySelector("#message"),
  search: document.querySelector("#search"),
  businessFilter: document.querySelector("#business-filter"),
  statusFilter: document.querySelector("#status-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  archiveFilter: document.querySelector("#archive-filter"),
  clearFilters: document.querySelector("#clear-filters"),
  filterState: document.querySelector("#filter-state"),
  requestSummary: document.querySelector("#request-summary"),
  requestList: document.querySelector("#request-list"),
  metricVisible: document.querySelector("#metric-visible"),
  metricNew: document.querySelector("#metric-new"),
  metricFollowUp: document.querySelector("#metric-follow-up"),
  metricHigh: document.querySelector("#metric-high"),
  detailDrawer: document.querySelector("#detail-drawer"),
  detailStatus: document.querySelector("#detail-status"),
  detailContent: document.querySelector("#detail-content"),
  closeDetail: document.querySelector("#close-detail"),
  photoDialog: document.querySelector("#photo-dialog"),
  photoImage: document.querySelector("#photo-image"),
  photoTitle: document.querySelector("#photo-title"),
  photoClose: document.querySelector("#photo-close"),
};

const PREVIEW_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
let photoTrigger = null;

function attachmentSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

function attachmentsMarkup(detail) {
  if (detail.attachmentsStatus === 'loading') return '<p class="detail-help" role="status">Cargando adjuntos…</p>';
  if (detail.attachmentsStatus === 'error') return '<p class="attachment-error" role="status">No se pudieron cargar los adjuntos.</p>';
  const items = Array.isArray(detail.attachments) ? detail.attachments : [];
  if (!items.length) return '<p class="detail-help">Esta solicitud no tiene fotos ni archivos adjuntos.</p>';
  const render = item => {
    const image = PREVIEW_IMAGE_TYPES.includes(item.mime_type);
    const type = { 'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/heic': 'HEIC', 'image/heif': 'HEIF', 'application/pdf': 'PDF' }[item.mime_type] || 'Archivo';
    const name = escapeHtml(item.file_name || 'Archivo adjunto');
    return `<li class="attachment-card${image ? '' : ' attachment-file'}">${image && item.previewUrl ? `<img class="attachment-preview" src="${escapeHtml(item.previewUrl)}" alt="Foto adjunta: ${name}" loading="lazy" referrerpolicy="no-referrer">` : ''}<strong>${name}</strong><span class="detail-help">${type} · ${escapeHtml(attachmentSize(item.size_bytes))}</span>${!image && type !== 'PDF' ? '<p class="detail-help">La vista previa no está disponible para este formato.</p>' : ''}${item.accessFailed ? '<p class="attachment-error">No se pudieron cargar los adjuntos.</p>' : ''}<button type="button" class="button button-secondary" data-open-attachment="${escapeHtml(item.id)}" aria-label="${image ? 'Ver foto' : 'Abrir archivo'}: ${name}">${image ? 'Ver foto' : 'Abrir archivo'}</button></li>`;
  };
  const images = items.filter(item => PREVIEW_IMAGE_TYPES.includes(item.mime_type));
  const files = items.filter(item => !PREVIEW_IMAGE_TYPES.includes(item.mime_type));
  return `${images.length ? `<ul class="attachment-grid">${images.map(render).join('')}</ul>` : ''}${files.length ? `<ul class="attachment-files">${files.map(render).join('')}</ul>` : ''}`;
}

async function signAttachment(attachment, request) {
  const token = state.accessToken;
  if (!token || !isUuid(attachment?.id) || !isUuid(request?.id) || !isUuid(request?.business_id) || attachment.request_id !== request.id || attachment.business_id !== request.business_id) throw new Error('ATTACHMENT_NOT_ALLOWED');
  const prefix = `${request.business_id}/${request.id}/`;
  const path = attachment.storage_path;
  if (typeof path !== 'string' || !path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif|pdf)$/.test(path.slice(prefix.length))) throw new Error('ATTACHMENT_NOT_ALLOWED');
  const response = await fetch(`${SUPABASE_DEV.url}/storage/v1/object/sign/request-attachments/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST', credentials: 'omit',
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  if (!response.ok) throw new Error('ATTACHMENT_ACCESS_FAILED');
  const payload = await response.json();
  if (state.accessToken !== token || typeof payload.signedURL !== 'string') throw new Error('ATTACHMENT_ACCESS_FAILED');
  const url = new URL(payload.signedURL.startsWith('/object/') ? `${SUPABASE_DEV.url}/storage/v1${payload.signedURL}` : payload.signedURL, SUPABASE_DEV.url);
  if (url.origin !== SUPABASE_DEV.url || url.pathname !== `/storage/v1/object/sign/request-attachments/${path}` || !url.searchParams.get('token')) throw new Error('ATTACHMENT_ACCESS_FAILED');
  return url.href;
}

async function loadRequestAttachments(request, version) {
  const token = state.accessToken;
  const current = () => state.accessToken === token && state.detailVersion === version && state.detail?.request.id === request.id && state.detail.request.business_id === request.business_id;
  try {
    const rows = await getRows('attachments', `select=id,request_id,business_id,storage_path,file_name,mime_type,size_bytes,created_at&business_id=eq.${encodeURIComponent(request.business_id)}&request_id=eq.${encodeURIComponent(request.id)}&deleted_at=is.null&order=created_at.asc,id.asc`);
    if (!current()) return;
    if (!Array.isArray(rows) || rows.some(item => item.request_id !== request.id || item.business_id !== request.business_id)) throw new Error('ATTACHMENT_READ_FAILED');
    const attachments = await Promise.all(rows.map(async item => {
      if (!PREVIEW_IMAGE_TYPES.includes(item.mime_type)) return item;
      try { return { ...item, previewUrl: await signAttachment(item, request) }; }
      catch { return { ...item, accessFailed: true }; }
    }));
    if (!current()) return;
    state.detail.attachments = attachments;
    state.detail.attachmentsStatus = 'ready';
  } catch {
    if (!current()) return;
    state.detail.attachments = [];
    state.detail.attachmentsStatus = 'error';
  }
  const content = elements.detailContent.querySelector('#attachment-content');
  if (content && current()) content.innerHTML = attachmentsMarkup(state.detail);
}

function clearPhoto() {
  elements.photoImage.removeAttribute('src');
  elements.photoImage.alt = '';
  elements.photoTitle.textContent = '';
}

function closePhoto() {
  if (elements.photoDialog.open) elements.photoDialog.close();
  clearPhoto();
}

async function openAttachment(trigger) {
  const detail = state.detail;
  const token = state.accessToken;
  const version = state.detailVersion;
  const item = detail?.attachments?.find(row => row.id === trigger.dataset.openAttachment);
  if (!item || !token || trigger.disabled) return;
  const image = PREVIEW_IMAGE_TYPES.includes(item.mime_type);
  // Reserve the tab during the gesture to avoid popup blocking after the request.
  const tab = image ? null : window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  trigger.disabled = true;
  try {
    const url = await signAttachment(item, detail.request);
    if (state.accessToken !== token || state.detailVersion !== version) { tab?.close(); return; }
    if (image) {
      photoTrigger = trigger;
      elements.photoTitle.textContent = item.file_name || 'Foto adjunta';
      elements.photoImage.alt = `Foto adjunta: ${item.file_name || 'Imagen de la solicitud'}`;
      elements.photoImage.src = url;
      elements.photoDialog.showModal();
    } else if (tab) tab.location.replace(url);
    else throw new Error('ATTACHMENT_OPEN_FAILED');
  } catch {
    tab?.close();
    if (state.accessToken === token && state.detailVersion === version) showMessage('No se pudieron cargar los adjuntos.', 'error');
  } finally { trigger.disabled = false; }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function humanizeKey(key) {
  return String(key || "dato").replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function answerValue(answer) {
  if (answer.value_text) return answer.value_text;
  if (answer.value_jsonb === null || answer.value_jsonb === undefined) return "Sin respuesta";
  return typeof answer.value_jsonb === "string" ? answer.value_jsonb : JSON.stringify(answer.value_jsonb);
}

function priorityLabel(priority) {
  if (String(priority) === "1") return "Alta";
  if (String(priority) === "2") return "Media";
  if (String(priority) === "3") return "Baja";
  return "Sin prioridad";
}

function isHighPriority(priority) {
  return String(priority) === "1";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function accessTokenSubject(accessToken) {
  const payload = String(accessToken || "").split(".")[1];
  if (!payload) return null;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const subject = JSON.parse(atob(padded)).sub;
    return isUuid(subject) ? subject : null;
  } catch {
    return null;
  }
}

function showMessage(text, type = "") {
  elements.message.textContent = text;
  elements.message.className = `toast ${type}`.trim();
}

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_DEV.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_DEV.publishableKey, "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error("SIGN_IN_FAILED");
  return payload.access_token;
}

async function getRows(table, query = "") {
  if (!READ_ONLY_TABLES.includes(table) || !state.accessToken) throw new Error("READ_ONLY_GUARD");
  const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${state.accessToken}` },
    credentials: "omit",
  });
  if (!response.ok) throw new Error("READ_FAILED");
  return response.json();
}

function buildRequestPatch(request, status, priority) {
  if (!REQUEST_STATUSES.includes(status) || !['none', '1', '2', '3'].includes(priority)) throw new Error('INVALID_CHANGE');
  const patch = { status, priority: priority === 'none' ? null : Number(priority) };
  // Required by the existing closure constraint, not an independent editing action.
  if (status !== request.status) {
    patch.won_at = status === 'Ganado' ? new Date().toISOString() : null;
    patch.lost_at = status === 'Perdido' ? new Date().toISOString() : null;
  }
  return patch;
}

async function updateRequest(request, status, priority) {
  const token = state.accessToken;
  if (!token || !isUuid(request.id) || !isUuid(request.business_id)) throw new Error('WRITE_NOT_ALLOWED');
  const patch = buildRequestPatch(request, status, priority);
  const query = `id=eq.${encodeURIComponent(request.id)}&business_id=eq.${encodeURIComponent(request.business_id)}&select=${encodeURIComponent(REQUEST_DETAIL_FIELDS)}`;
  const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/requests?${query}`, {
    method: 'PATCH', credentials: 'omit',
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('WRITE_FAILED');
  const rows = await response.json();
  if (state.accessToken !== token || !Array.isArray(rows) || rows.length !== 1 || rows[0].id !== request.id || rows[0].business_id !== request.business_id || rows[0].status !== patch.status || rows[0].priority !== patch.priority) throw new Error('WRITE_NOT_CONFIRMED');
  return rows[0];
}

async function completeFollowUp(followUp) {
  const token = state.accessToken;
  if (!token || followUp?.status !== 'pending' || !isUuid(followUp.id) || !isUuid(followUp.business_id)) throw new Error('FOLLOW_UP_NOT_ALLOWED');
  const patch = { status: 'completed', completed_at: new Date().toISOString() };
  const query = `id=eq.${encodeURIComponent(followUp.id)}&business_id=eq.${encodeURIComponent(followUp.business_id)}&select=${encodeURIComponent(FOLLOW_UP_FIELDS)}`;
  const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/follow_ups?${query}`, {
    method: 'PATCH', credentials: 'omit',
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('FOLLOW_UP_WRITE_FAILED');
  const rows = await response.json();
  const confirmed = rows?.[0];
  if (state.accessToken !== token || !Array.isArray(rows) || rows.length !== 1 || confirmed.id !== followUp.id || confirmed.business_id !== followUp.business_id || confirmed.status !== 'completed' || !confirmed.completed_at) throw new Error('FOLLOW_UP_NOT_CONFIRMED');
  return confirmed;
}

async function archiveRequest(request) {
  const token = state.accessToken;
  if (!token || request?.archived_at || !isUuid(request.id) || !isUuid(request.business_id)) throw new Error('ARCHIVE_NOT_ALLOWED');
  const patch = { archived_at: new Date().toISOString() };
  const query = `id=eq.${encodeURIComponent(request.id)}&business_id=eq.${encodeURIComponent(request.business_id)}&select=${encodeURIComponent(REQUEST_DETAIL_FIELDS)}`;
  const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/requests?${query}`, {
    method: 'PATCH', credentials: 'omit',
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error('ARCHIVE_WRITE_FAILED');
  const rows = await response.json();
  const confirmed = rows?.[0];
  if (state.accessToken !== token || !Array.isArray(rows) || rows.length !== 1 || confirmed.id !== request.id || confirmed.business_id !== request.business_id || !confirmed.archived_at) throw new Error('ARCHIVE_NOT_CONFIRMED');
  return confirmed;
}

async function addInternalNote(request, text) {
  const token = state.accessToken;
  const detail = String(text || "").trim();
  const userId = state.userId;
  if (!token || !isUuid(userId) || !isUuid(request?.id) || !isUuid(request?.business_id) || !detail) throw new Error('NOTE_NOT_ALLOWED');
  const note = {
    business_id: request.business_id,
    request_id: request.id,
    actor_type: 'user',
    actor_user_id: userId,
    type: INTERNAL_NOTE_TYPE,
    title: INTERNAL_NOTE_TITLE,
    detail,
  };
  const query = `select=${encodeURIComponent(INTERNAL_NOTE_FIELDS)}`;
  const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/activities?${query}`, {
    method: 'POST', credentials: 'omit',
    headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(note),
  });
  if (!response.ok) throw new Error('NOTE_WRITE_FAILED');
  const rows = await response.json();
  const confirmed = rows?.[0];
  if (state.accessToken !== token || !Array.isArray(rows) || rows.length !== 1 || !isUuid(confirmed?.id) || confirmed.business_id !== note.business_id || confirmed.request_id !== note.request_id || confirmed.actor_type !== note.actor_type || confirmed.actor_user_id !== note.actor_user_id || confirmed.type !== note.type || confirmed.title !== note.title || confirmed.detail !== note.detail || !confirmed.created_at) throw new Error('NOTE_NOT_CONFIRMED');
  return confirmed;
}

async function saveRequestChanges(form) {
  if (state.saving || state.loading || !state.detail || !state.accessToken) return;
  const detail = state.detail;
  const token = state.accessToken;
  const status = form.querySelector('[name=status]').value;
  const priority = form.querySelector('[name=priority]').value;
  state.saving = true;
  form.querySelector('fieldset').disabled = true;
  elements.refresh.disabled = true;
  showMessage('Guardando estado y prioridad…');
  try {
    const confirmed = await updateRequest(detail.request, status, priority);
    state.requests = state.requests.map(row => row.id === confirmed.id ? { ...row, ...confirmed } : row);
    renderFilters();
    renderRequests();
    if (state.detail === detail) renderDetail({ ...detail, request: confirmed });
    showMessage('Estado y prioridad guardados en Supabase dev.', 'success');
  } catch {
    if (state.accessToken === token) {
      if (state.detail === detail) renderDetail(detail);
      showMessage('No se pudo confirmar el guardado. Se mantiene la última lectura confirmada; actualiza antes de reintentar.', 'error');
    }
  } finally {
    state.saving = false;
    elements.refresh.disabled = false;
    if (state.detail && state.accessToken === token) elements.detailContent.querySelector('fieldset').disabled = false;
  }
}

async function saveInternalNote(form) {
  if (state.saving || state.loading || !state.detail || !state.accessToken) return;
  const detail = state.detail;
  const token = state.accessToken;
  const fieldset = form.querySelector('fieldset');
  const noteInput = form.querySelector('[name=note]');
  const text = noteInput.value;
  state.saving = true;
  fieldset.disabled = true;
  elements.refresh.disabled = true;
  showMessage('Guardando nota interna…');
  try {
    const confirmed = await addInternalNote(detail.request, text);
    noteInput.value = '';
    const currentDetail = state.detail;
    if (currentDetail?.request?.id === detail.request.id && currentDetail.request.business_id === detail.request.business_id) {
      const notes = [confirmed, ...currentDetail.notes.filter(item => item.id !== confirmed.id)];
      renderDetail({ ...currentDetail, notes });
    }
    showMessage('Nota interna guardada en Supabase dev.', 'success');
  } catch {
    if (state.accessToken === token) {
      if (state.detail === detail) renderDetail(detail);
      showMessage('No se pudo confirmar la nota. Se mantiene la última lectura confirmada; actualiza antes de reintentar.', 'error');
    }
  } finally {
    state.saving = false;
    elements.refresh.disabled = false;
    const noteEditor = elements.detailContent.querySelector('#internal-note-form fieldset');
    if (noteEditor) noteEditor.disabled = false;
  }
}

async function loadRows() {
  const token = state.accessToken;
  const [requests, contacts, businesses, sectors, answers, followUps, activities, formConfigs] = await Promise.all([
    getRows("requests", `select=${encodeURIComponent(REQUEST_FIELDS)}&order=created_at.desc`),
    getRows("contacts", `select=${encodeURIComponent(CONTACT_FIELDS)}`),
    getRows("businesses", "select=id,name,slug,sector_id"),
    getRows("sectors", "select=id,name,slug"),
    getRows("request_custom_answers", "select=request_id,business_id,field_key,value_text,value_jsonb"),
    getRows("follow_ups", `select=${encodeURIComponent(FOLLOW_UP_FIELDS)}&status=eq.pending`),
    getRows("activities", "select=request_id,business_id,title,type,created_at&order=created_at.desc"),
    getRows("form_configs", "select=id,business_id,name,public_slug"),
  ]);
  if (state.accessToken !== token) throw new Error('SESSION_CHANGED');
  Object.assign(state, { requests, contacts, businesses, sectors, answers, followUps, activities, formConfigs });
}

function findById(rows, id) {
  return rows.find((row) => row.id === id);
}

function requestView(request) {
  const contact = findById(state.contacts, request.contact_id);
  const business = findById(state.businesses, request.business_id);
  const sector = findById(state.sectors, request.sector_id);
  const form = findById(state.formConfigs, request.form_config_id);
  const answers = state.answers.filter((answer) => answer.request_id === request.id && answer.business_id === request.business_id);
  const followUp = state.followUps.find((item) => item.request_id === request.id && item.business_id === request.business_id);
  return { request, contact, business, sector, form, answers, followUp };
}

function renderOptions(element, options, fallback) {
  const current = element.value;
  element.innerHTML = `<option value="">${fallback}</option>${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}`;
  if (options.some((option) => option.value === current)) element.value = current;
}

function renderFilters() {
  const businesses = [...new Map(state.businesses.map((item) => [item.id, item])).values()];
  const statuses = REQUEST_STATUSES;
  renderOptions(elements.businessFilter, businesses.map((item) => ({ value: item.id, label: item.name })), "Todos los permitidos");
  renderOptions(elements.statusFilter, statuses.map((item) => ({ value: item, label: item })), "Todos");
}

function activeFilterLabels() {
  const labels = [];
  if (elements.search.value.trim()) labels.push("búsqueda");
  if (elements.businessFilter.value) labels.push("negocio");
  if (elements.statusFilter.value) labels.push("estado");
  if (elements.priorityFilter.value) labels.push("prioridad");
  if (elements.archiveFilter.value === 'archived') labels.push("archivadas");
  if (elements.archiveFilter.value === 'all') labels.push("todas las solicitudes");
  return labels;
}

function filteredViews() {
  const search = elements.search.value.trim().toLocaleLowerCase("es");
  const businessId = elements.businessFilter.value;
  const status = elements.statusFilter.value;
  const priority = elements.priorityFilter.value;
  const archive = elements.archiveFilter.value || 'active';
  return state.requests.map(requestView).filter((view) => {
    const haystack = `${view.request.reference || ""} ${view.contact?.display_name || ""}`.toLocaleLowerCase("es");
    const matchesPriority = !priority || (priority === "none" ? view.request.priority === null : String(view.request.priority) === priority);
    const matchesArchive = archive === 'all' || (archive === 'archived' ? Boolean(view.request.archived_at) : !view.request.archived_at);
    return (!search || haystack.includes(search)) && (!businessId || view.request.business_id === businessId) && (!status || view.request.status === status) && matchesPriority && matchesArchive;
  });
}

function updateMetrics(views) {
  const now = Date.now();
  const pendingFollowUps = views.filter((view) => view.followUp && (!view.followUp.due_at || new Date(view.followUp.due_at).getTime() <= now)).length;
  elements.metricVisible.textContent = String(views.length);
  elements.metricNew.textContent = String(views.filter((view) => String(view.request.status || "").toLocaleLowerCase("es") === "nuevo").length);
  elements.metricFollowUp.textContent = String(pendingFollowUps);
  elements.metricHigh.textContent = String(views.filter((view) => isHighPriority(view.request.priority)).length);
}

function renderRequests() {
  const views = filteredViews();
  const filters = activeFilterLabels();
  elements.filterState.textContent = filters.length ? `Filtros activos: ${filters.join(", ")}.` : "Sin filtros activos.";
  elements.filterState.classList.toggle("has-filters", Boolean(filters.length));
  elements.requestSummary.textContent = `${views.length} solicitud${views.length === 1 ? "" : "es"} visible${views.length === 1 ? "" : "s"}.`;
  updateMetrics(views);

  if (!views.length) {
    elements.requestList.innerHTML = filters.length
      ? '<div class="empty-state"><h3>No hay resultados para los filtros actuales.</h3><p>Prueba a limpiar filtros para volver a ver las solicitudes permitidas.</p></div>'
      : '<div class="empty-state"><h3>Aún no hay solicitudes disponibles.</h3><p>Cuando existan datos permitidos para este usuario, aparecerán aquí.</p></div>';
    return;
  }

  elements.requestList.innerHTML = views.map((view) => {
    const contactMethods = [view.contact?.email, view.contact?.phone].filter(Boolean).join(" · ") || "Sin contacto disponible";
    const nextAction = view.request.next_action || view.followUp?.action_text || "Sin siguiente acción";
    const priority = priorityLabel(view.request.priority);
    return `<article class="request-row">
      <div><p class="request-reference">${escapeHtml(view.request.reference || "Sin referencia")}</p><h3 class="request-name">${escapeHtml(view.contact?.display_name || "Contacto sin nombre")}</h3><p class="request-secondary">${escapeHtml(contactMethods)}</p></div>
      <div class="request-meta"><span>${escapeHtml(view.business?.name || "Negocio no disponible")}</span><span>${escapeHtml(view.sector?.name || "Sector no disponible")}</span><span>${escapeHtml(formatDate(view.request.created_at))}</span></div>
      <div class="request-meta"><span class="tag">${escapeHtml(view.request.status || "Sin estado")}</span><span class="tag ${priority.toLocaleLowerCase("es")}">Prioridad: ${escapeHtml(priority)}</span>${view.request.archived_at ? '<span class="tag archived">Archivada</span>' : ''}<span title="${escapeHtml(nextAction)}">${escapeHtml(nextAction)}</span></div>
      <button class="button button-secondary" type="button" data-request-detail="${escapeHtml(view.request.id)}">Ver detalle</button>
    </article>`;
  }).join("");
}

function requestedDetailId() {
  const id = new URLSearchParams(window.location.search).get("request");
  return isUuid(id) ? id : null;
}

function updateDetailUrl(requestId = null) {
  const url = new URL(window.location.href);
  const target = requestId ? `${url.pathname}?request=${encodeURIComponent(requestId)}${url.hash}` : `${url.pathname}${url.hash}`;
  window.history.replaceState({}, "", target);
}

function detailState(text, error = false) {
  elements.detailDrawer.hidden = false;
  elements.detailContent.hidden = true;
  elements.detailContent.innerHTML = "";
  elements.detailStatus.textContent = text;
  elements.detailStatus.className = `detail-status${error ? " error" : ""}`;
}

function formatAnswer(answer, fields) {
  const field = fields.find((item) => item.id === answer.form_field_id || item.field_key === answer.field_key);
  return {
    label: answer.label_snapshot || field?.label || humanizeKey(answer.field_key),
    order: field?.display_order ?? Number.MAX_SAFE_INTEGER,
    value: answerValue(answer),
  };
}

function listItems(items, emptyText, render) {
  return items.length ? items.map(render).join("") : `<li>${escapeHtml(emptyText)}</li>`;
}

function enrichmentMarkup(request) {
  const labels = { pending: 'Pendiente', processing: 'Generando', completed: 'Generado', failed: 'No disponible', legacy: 'Solicitud anterior' };
  return `<p><strong>Estado:</strong> ${escapeHtml(labels[request.enrichment_status] || 'No disponible')}</p>
    ${request.enriched_at ? `<p class="detail-help">Generado el ${escapeHtml(formatDate(request.enriched_at))}</p>` : ''}
    <h4>Resumen interno</h4><p class="generated-text">${escapeHtml(request.internal_summary || 'Sin resumen interno disponible.')}</p>
    <h4>Respuesta sugerida · Borrador</h4><p class="detail-help">Respuesta no enviada. Borrador revisable por tu equipo; no se aprueba ni se envía desde esta sección.</p>
    <p class="generated-text suggested-draft">${escapeHtml(request.suggested_reply || 'Sin respuesta sugerida disponible.')}</p>`;
}

function milestoneLabel(hours) {
  return { 0: 'Sin seguimiento automático', 24: '24 h', 48: '48 h', 72: '72 h' }[hours] || 'No disponible';
}

function activityMarkup(item) {
  const followUpTypes = { request_follow_up_24h: 'Seguimiento automático · 24 h', request_follow_up_48h: 'Seguimiento automático · 48 h', request_follow_up_72h: 'Seguimiento automático · 72 h' };
  const reasons = {
    manual_follow_up_overdue: 'Existe un seguimiento manual vencido.',
    high_priority_no_recent_activity: 'Solicitud prioritaria sin actividad humana reciente.',
    no_recent_activity: 'No hay actividad humana reciente.',
  };
  const origin = { automation: 'Automatización', user: 'Acción humana', system: 'Sistema', public_form: 'Formulario público' }[item.actor_type] || 'Origen no disponible';
  const followUp = followUpTypes[item.type];
  const title = followUp || (item.type === 'request_enrichment_generated' ? 'Resumen y respuesta sugerida generados' : item.type === 'request_created' ? 'Solicitud recibida' : item.actor_type === 'user' ? item.title || 'Actividad del equipo' : 'Actividad registrada');
  const text = followUp ? reasons[item.reason_code] || 'Seguimiento recomendado.' : item.actor_type === 'user' ? item.detail || '' : '';
  return `<li><strong>${escapeHtml(title)}</strong><span class="detail-help"><span class="activity-origin">${origin}</span> · ${escapeHtml(formatDate(item.created_at))}</span>${text ? `<p class="generated-text">${escapeHtml(text)}</p>` : ''}</li>`;
}

function communicationsMarkup(detail) {
  if (detail.communicationsStatus === 'loading') return '<p class="detail-help" role="status">Cargando comunicaciones…</p>';
  if (detail.communicationsStatus === 'error') return '<p class="detail-help" role="status">No se pudieron cargar las comunicaciones.</p>';
  const types = { customer_confirmation: 'Confirmación al cliente', business_notification: 'Aviso al negocio' };
  const statuses = { pending: 'Pendiente', processing: 'Enviando', sent: 'Enviado', failed: 'Fallido' };
  const rows = Array.isArray(detail.communications) ? detail.communications : [];
  return `<ul class="detail-list">${listItems(rows, 'No hay comunicaciones registradas para esta solicitud.', row => `<li><strong>${types[row.email_type] || 'Comunicación'}</strong> · ${statuses[row.status] || 'No disponible'}<span class="detail-help">Creada el ${escapeHtml(formatDate(row.created_at))}${row.sent_at ? ` · Enviada el ${escapeHtml(formatDate(row.sent_at))}` : ''}</span></li>`)}</ul>`;
}

async function loadRequestCommunications(request, version) {
  const token = state.accessToken;
  const current = () => state.accessToken === token && state.detailVersion === version && state.detail?.request.id === request.id && state.detail.request.business_id === request.business_id;
  try {
    if (!token || !isUuid(request.id)) throw new Error('COMMUNICATION_READ_FAILED');
    const response = await fetch(`${SUPABASE_DEV.url}/rest/v1/rpc/get_request_communications`, {
      method: 'POST', credentials: 'omit',
      headers: { apikey: SUPABASE_DEV.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_request_id: request.id }),
    });
    if (!response.ok) throw new Error('COMMUNICATION_READ_FAILED');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('COMMUNICATION_READ_FAILED');
    if (!current()) return;
    state.detail.communications = rows.map(({ email_type, status, created_at, sent_at }) => ({ email_type, status, created_at, sent_at }));
    state.detail.communicationsStatus = 'ready';
  } catch {
    if (!current()) return;
    state.detail.communications = [];
    state.detail.communicationsStatus = 'error';
  }
  const content = elements.detailContent.querySelector('#communication-content');
  if (content && current()) content.innerHTML = communicationsMarkup(state.detail);
}

function renderDetail(detail) {
  const normalizedDetail = { ...detail, notes: Array.isArray(detail.notes) ? detail.notes : [] };
  state.detail = normalizedDetail;
  const { request, contact, business, sector, form, fields, answers, followUps, activities, notes, attachments } = normalizedDetail;
  const answerRows = answers.map((answer) => formatAnswer(answer, fields)).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "es"));
  const answersHtml = listItems(answerRows, "Sin respuestas registradas.", (answer) => `<li><strong>${escapeHtml(answer.label)}:</strong> ${escapeHtml(answer.value)}</li>`);
  const followUpsHtml = listItems(followUps, "No hay seguimientos registrados para esta solicitud.", (item) => `<li><strong>${escapeHtml(item.action_text || "Seguimiento")}</strong><span class="detail-help">Fecha prevista: ${escapeHtml(formatDate(item.due_at))}</span>${item.status === 'completed' ? `<span class="detail-help">Completado el: ${escapeHtml(formatDate(item.completed_at))}</span>` : `<span class="detail-help">Estado: ${escapeHtml(item.status || "Sin estado")}</span>`}${item.status === 'pending' ? `<button class="button button-secondary follow-up-complete" type="button" data-complete-follow-up="${escapeHtml(item.id)}">Marcar como completado</button>` : ''}</li>`);
  const activitiesHtml = listItems(activities, "No hay actividad registrada para esta solicitud.", activityMarkup);
  const notesHtml = listItems(notes, "No hay notas internas para esta solicitud.", (item) => {
    const author = item.actor_user_id === state.userId && state.userEmail ? state.userEmail : (isUuid(item.actor_user_id) ? `Usuario ${item.actor_user_id.slice(0, 8)}` : "Usuario del equipo");
    return `<li class="internal-note"><strong>${escapeHtml(item.detail)}</strong><span class="detail-help">${escapeHtml(formatDate(item.created_at))} · ${escapeHtml(author)}</span></li>`;
  });

  elements.detailStatus.textContent = request.archived_at ? `Solicitud archivada el ${formatDate(request.archived_at)}. Sigue disponible para consulta.` : "Datos confirmados. Puedes gestionar estado, prioridad y seguimiento.";
  elements.detailStatus.className = "detail-status";
  elements.detailContent.hidden = false;
  elements.detailContent.innerHTML = `
    <form id="request-update-form" class="request-editor">
      <fieldset ${state.saving || state.loading ? 'disabled' : ''}>
        <legend>Estado y prioridad</legend>
        <label for="edit-status">Estado<select id="edit-status" name="status">${REQUEST_STATUSES.map(status => `<option ${request.status === status ? 'selected' : ''} value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('')}</select></label>
        <label for="edit-priority">Prioridad<select id="edit-priority" name="priority">${[['none','Sin prioridad'],['1','Alta'],['2','Media'],['3','Baja']].map(([value,label]) => `<option ${String(request.priority ?? 'none') === value ? 'selected' : ''} value="${value}">${label}</option>`).join('')}</select></label>
        <button class="button button-primary" type="submit">Guardar cambios</button>
      </fieldset>
      <p class="detail-help">Los cambios se aplican al guardar. El resto del detalle es de solo lectura.</p>
    </form>
    <section class="request-archive"><h3>Archivado</h3>${request.archived_at ? `<p class="detail-help">Archivada el ${escapeHtml(formatDate(request.archived_at))}. No se elimina ni se modifica desde esta fase.</p>` : '<p class="detail-help">Archivar la solicitud la mantiene consultable y no elimina datos.</p><button class="button button-danger" type="button" data-archive-request>Archivar solicitud</button><p class="detail-help">La solicitud dejará de aparecer entre las activas, pero seguirá disponible en “Archivadas”.</p>'}</section>
    <section class="detail-group"><h3>Solicitud</h3><ul class="detail-list">
      <li><strong>Referencia:</strong> ${escapeHtml(request.reference || "Sin referencia")}</li>
      <li><strong>Estado y prioridad:</strong> ${escapeHtml(request.status || "Sin estado")} · ${escapeHtml(priorityLabel(request.priority))}</li>
      <li><strong>Negocio y sector:</strong> ${escapeHtml(business?.name || "No disponible")} · ${escapeHtml(sector?.name || "No disponible")}</li>
      <li><strong>Formulario y origen:</strong> ${escapeHtml(form?.name || "No disponible")} · ${escapeHtml(request.source || "Sin origen")}</li>
      <li><strong>Fecha:</strong> ${escapeHtml(formatDate(request.created_at))}</li>
    </ul></section>
    <section class="detail-group"><h3>Cliente y contacto</h3><ul class="detail-list">
      <li><strong>Nombre:</strong> ${escapeHtml(contact?.display_name || "No disponible")}</li>
      <li><strong>Email:</strong> ${escapeHtml(contact?.email || "No disponible")}</li>
      <li><strong>Teléfono:</strong> ${escapeHtml(contact?.phone || "No disponible")}</li>
    </ul></section>
    <section class="detail-group"><h3>Resumen</h3><ul class="detail-list">
      <li><strong>Servicio:</strong> ${escapeHtml(request.title || request.service || "No disponible")}</li>
      <li><strong>Descripción:</strong> ${escapeHtml(request.description || "Sin descripción")}</li>
      <li><strong>Urgencia:</strong> ${escapeHtml(request.urgency || "No indicada")}</li>
      <li><strong>Siguiente acción:</strong> ${escapeHtml(request.next_action || "Sin siguiente acción disponible")}</li>
    </ul></section>
    <section class="detail-group"><h3>Resumen automático y borrador</h3>${enrichmentMarkup(request)}</section>
    <section class="detail-group"><h3>Respuestas del formulario</h3><ul class="detail-list">${answersHtml}</ul></section>
    <section class="detail-group"><h3>Seguimiento</h3><p><strong>Hito automático:</strong> ${escapeHtml(milestoneLabel(request.automatic_follow_up_milestone_hours))}</p><p class="detail-help">Próxima fecha prevista: ${escapeHtml(request.next_follow_up_at ? formatDate(request.next_follow_up_at) : 'Sin fecha programada')}</p><ul class="detail-list">${followUpsHtml}</ul></section>
    <section class="detail-group"><h3>Notas internas</h3><p class="detail-help">Solo visible para tu equipo.</p><form id="internal-note-form" class="request-editor"><fieldset ${state.saving || state.loading ? 'disabled' : ''}><label for="internal-note">Añadir nota<textarea id="internal-note" name="note" maxlength="1000" required placeholder="Escribe una nota breve para tu equipo"></textarea></label><button class="button button-primary" type="submit">Añadir nota</button></fieldset></form><ul class="detail-list internal-notes-history">${notesHtml}</ul></section>
    <section class="detail-group"><h3>Actividad</h3><ul class="detail-list">${activitiesHtml}</ul></section>
    <section class="detail-group"><h3>Comunicaciones</h3><div id="communication-content" aria-live="polite">${communicationsMarkup(normalizedDetail)}</div></section>
    <section class="detail-group"><h3>Fotos y adjuntos</h3><div id="attachment-content" aria-live="polite">${attachmentsMarkup(normalizedDetail)}</div></section>
    <details class="dev-details"><summary>Información técnica de desarrollo</summary><ul class="detail-list">
      <li><strong>Request ID:</strong> ${escapeHtml(request.id)}</li>
      <li><strong>Business ID:</strong> ${escapeHtml(request.business_id)}</li>
      <li><strong>Form config ID:</strong> ${escapeHtml(request.form_config_id || "No disponible")}</li>
      <li><strong>Contact ID:</strong> ${escapeHtml(request.contact_id || "No disponible")}</li>
    </ul></details>`;
}

async function loadRequestDetail(requestId, syncUrl = true) {
  if (state.saving) return;
  const version = ++state.detailVersion;
  const token = state.accessToken;
  closePhoto();
  state.detail = null;
  if (!isUuid(requestId)) {
    detailState("Solicitud no disponible o no permitida.", true);
    return;
  }
  detailState("Cargando detalle mediante RLS…");
  try {
    const requestRows = await getRows("requests", `select=${encodeURIComponent(REQUEST_DETAIL_FIELDS)}&id=eq.${encodeURIComponent(requestId)}`);
    const request = requestRows[0];
    if (!request) throw new Error("REQUEST_NOT_AVAILABLE");
    const business = `business_id=eq.${encodeURIComponent(request.business_id)}`;
    const [contacts, forms, fields, answers, followUps, activities, notes, businesses, sectors] = await Promise.all([
      getRows("contacts", `select=id,business_id,display_name,email,phone&${business}&id=eq.${encodeURIComponent(request.contact_id)}`),
      getRows("form_configs", `select=id,business_id,name,public_slug&${business}&id=eq.${encodeURIComponent(request.form_config_id)}`),
      getRows("form_fields", `select=id,business_id,form_config_id,field_key,label,field_type,display_order&${business}&form_config_id=eq.${encodeURIComponent(request.form_config_id)}&is_active=eq.true&order=display_order.asc`),
      getRows("request_custom_answers", `select=request_id,business_id,form_field_id,field_key,label_snapshot,value_text,value_jsonb&${business}&request_id=eq.${encodeURIComponent(request.id)}`),
      getRows("follow_ups", `select=${encodeURIComponent(FOLLOW_UP_FIELDS)}&${business}&request_id=eq.${encodeURIComponent(request.id)}&order=due_at.asc`),
      getRows("activities", `select=request_id,business_id,title,type,detail,actor_type,reason_code:metadata->>reason_code,created_at&${business}&request_id=eq.${encodeURIComponent(request.id)}&type=neq.${INTERNAL_NOTE_TYPE}&order=created_at.desc`),
      getRows("activities", `select=${encodeURIComponent(INTERNAL_NOTE_FIELDS)}&${business}&request_id=eq.${encodeURIComponent(request.id)}&type=eq.${INTERNAL_NOTE_TYPE}&order=created_at.desc`),
      getRows("businesses", `select=id,name,slug,sector_id&id=eq.${encodeURIComponent(request.business_id)}`),
      getRows("sectors", `select=id,name,slug&id=eq.${encodeURIComponent(request.sector_id)}`),
    ]);
    if (state.accessToken !== token || state.detailVersion !== version) return;
    renderDetail({ request, contact: contacts[0] || null, form: forms[0] || null, fields, answers, followUps, activities, notes, attachments: [], attachmentsStatus: 'loading', communications: [], communicationsStatus: 'loading', business: businesses[0] || null, sector: sectors[0] || null });
    if (syncUrl) updateDetailUrl(request.id);
    await Promise.all([loadRequestAttachments(request, version), loadRequestCommunications(request, version)]);
  } catch {
    if (state.accessToken === token && state.detailVersion === version) detailState("Solicitud no disponible o no permitida.", true);
  }
}

function closeDetail(syncUrl = true) {
  closePhoto();
  state.detail = null;
  state.detailVersion++;
  elements.detailDrawer.hidden = true;
  elements.detailContent.innerHTML = "";
  if (syncUrl) updateDetailUrl();
}

function resetFilters() {
  elements.search.value = "";
  elements.businessFilter.value = "";
  elements.statusFilter.value = "";
  elements.priorityFilter.value = "";
  elements.archiveFilter.value = "active";
  renderRequests();
}

async function refreshData() {
  if (state.saving || state.loading || !state.accessToken) return;
  const token = state.accessToken;
  state.loading = true;
  elements.refresh.disabled = true;
  const editor = elements.detailContent.querySelector('fieldset');
  if (editor) editor.disabled = true;
  showMessage("Leyendo solicitudes permitidas por RLS…");
  try {
    await loadRows();
    renderFilters();
    renderRequests();
    const businesses = [...new Set(state.businesses.map((item) => item.name).filter(Boolean))];
    elements.businessContext.textContent = businesses.length ? `Mostrando datos permitidos para ${businesses.join(", ")}.` : "No hay negocios disponibles para esta sesión.";
    const detailId = requestedDetailId();
    if (detailId) await loadRequestDetail(detailId, false);
    else closeDetail(false);
    if (state.accessToken === token) showMessage("Datos actualizados desde Supabase dev.", "success");
  } catch {
    if (state.accessToken === token) showMessage("No se han podido cargar los datos de desarrollo. Comprueba la sesión y vuelve a intentarlo.", "error");
  } finally {
    state.loading = false;
    elements.refresh.disabled = false;
    const editor = elements.detailContent.querySelector('fieldset');
    if (editor) editor.disabled = state.saving;
  }
}

elements.signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = elements.password.value;
  if (!password) {
    showMessage("Introduce la contraseña temporal del usuario ficticio.", "error");
    return;
  }
  const button = elements.signInForm.querySelector("button[type=submit]");
  button.disabled = true;
  showMessage("Comprobando el acceso de desarrollo…");
  try {
    const accessToken = await signIn(elements.email.value, password);
    const userId = accessTokenSubject(accessToken);
    if (!userId) throw new Error('SESSION_USER_NOT_AVAILABLE');
    state.accessToken = accessToken;
    state.userId = userId;
    state.userEmail = elements.email.value;
    elements.password.value = "";
    elements.accessScreen.hidden = true;
    elements.panelScreen.hidden = false;
    elements.userContext.textContent = state.userEmail;
    await refreshData();
  } catch {
    state.accessToken = null;
    state.userId = null;
    showMessage("No se ha podido iniciar sesión con ese usuario de desarrollo.", "error");
  } finally {
    button.disabled = false;
  }
});

elements.refresh.addEventListener("click", refreshData);
elements.photoClose.addEventListener('click', closePhoto);
elements.photoDialog.addEventListener('close', () => { clearPhoto(); photoTrigger?.focus(); photoTrigger = null; });
elements.photoImage.addEventListener('error', () => {
  closePhoto();
  showMessage('No se pudieron cargar los adjuntos.', 'error');
});
elements.detailContent.addEventListener('error', event => {
  if (!event.target.classList.contains('attachment-preview')) return;
  event.target.hidden = true;
  const help = event.target.closest('.attachment-card')?.querySelector('.detail-help');
  if (help) help.textContent += ' · Vista previa no disponible. Puedes intentar abrir la foto.';
}, true);
elements.detailContent.addEventListener('click', event => {
  const trigger = event.target.closest('[data-open-attachment]');
  if (trigger) openAttachment(trigger);
});
elements.detailContent.addEventListener('submit', event => {
  if (event.target.id !== 'request-update-form' && event.target.id !== 'internal-note-form') return;
  event.preventDefault();
  if (event.target.id === 'request-update-form') saveRequestChanges(event.target);
  else saveInternalNote(event.target);
});
elements.detailContent.addEventListener('click', async event => {
  const complete = event.target.closest('[data-complete-follow-up]');
  const archive = event.target.closest('[data-archive-request]');
  if ((!complete && !archive) || state.saving || state.loading || !state.detail || !state.accessToken) return;
  const detail = state.detail;
  const token = state.accessToken;
  if (archive && !window.confirm('¿Archivar esta solicitud? No se eliminará y seguirá disponible en el filtro Archivadas.')) return;
  state.saving = true;
  elements.refresh.disabled = true;
  elements.detailContent.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    if (complete) {
      const followUp = detail.followUps.find(item => item.id === complete.dataset.completeFollowUp);
      const confirmed = await completeFollowUp(followUp);
      state.followUps = state.followUps.filter(item => item.id !== confirmed.id);
      const followUps = detail.followUps.map(item => item.id === confirmed.id ? confirmed : item);
      if (state.detail === detail) renderDetail({ ...detail, followUps });
      renderRequests();
      showMessage('Seguimiento marcado como completado en Supabase dev.', 'success');
    } else {
      const confirmed = await archiveRequest(detail.request);
      state.requests = state.requests.map(row => row.id === confirmed.id ? { ...row, ...confirmed } : row);
      renderFilters();
      renderRequests();
      if (state.detail === detail) renderDetail({ ...detail, request: confirmed });
      showMessage('Solicitud archivada en Supabase dev. Sigue disponible en el filtro Archivadas.', 'success');
    }
  } catch {
    if (state.accessToken === token) {
      if (state.detail === detail) renderDetail(detail);
      showMessage('No se pudo confirmar el cambio. Se mantiene la última lectura confirmada; actualiza antes de reintentar.', 'error');
    }
  } finally {
    state.saving = false;
    elements.refresh.disabled = false;
    const editor = elements.detailContent.querySelector('fieldset');
    if (editor) editor.disabled = false;
    elements.detailContent.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
});
elements.clearFilters.addEventListener("click", resetFilters);
[elements.search, elements.businessFilter, elements.statusFilter, elements.priorityFilter, elements.archiveFilter].forEach((element) => element.addEventListener("input", renderRequests));
elements.requestList.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-request-detail]");
  if (trigger) loadRequestDetail(trigger.dataset.requestDetail);
});
elements.closeDetail.addEventListener("click", () => closeDetail());
elements.signOut.addEventListener("click", () => {
  Object.assign(state, { accessToken: null, userEmail: "", userId: null, requests: [], contacts: [], businesses: [], sectors: [], answers: [], followUps: [], activities: [], formConfigs: [] });
  elements.panelScreen.hidden = true;
  elements.accessScreen.hidden = false;
  elements.password.value = "";
  elements.requestList.innerHTML = "";
  resetFilters();
  closeDetail();
  showMessage("Sesión cerrada. No se ha guardado ninguna credencial.", "success");
});
