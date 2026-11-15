(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document && new URLSearchParams(root.location.search).get('mode') !== 'local' &&
      new URLSearchParams(root.location.search).get('submit') !== 'supabase-dev') root.RealProductDemo = api.initialize(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUSES = ['Nuevo', 'En preparación', 'Enviado', 'Seguimiento pendiente', 'Ganado', 'Perdido'];
  const preferenceKey = 'solicitudpro:active-business-id';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const dateLocale = () => typeof document !== 'undefined' && document.documentElement?.lang === 'en' ? 'en-GB' : 'es-ES';
  const noDateLabel = () => dateLocale() === 'en-GB' ? 'No date' : 'Sin fecha';
  const dateLabel = value => {
    if (!value) return noDateLabel();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? noDateLabel() : new Intl.DateTimeFormat(dateLocale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };
  const dateTimeLabel = value => {
    if (!value) return noDateLabel();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? noDateLabel() : new Intl.DateTimeFormat(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  async function copySuggestedReply(reply, writeText) {
    if (typeof reply !== 'string' || !reply.trim() || typeof writeText !== 'function') return false;
    return (await writeText(reply)) !== false;
  }

  const copyFeedbackMessage = copied => copied ? 'Copiada' : 'No se pudo copiar.';
  const followUpPartialMessage = reopened => `El seguimiento se ${reopened ? 'reabrió' : 'completó'}, pero no pudo registrarse en Actividad. La lista se ha actualizado.`;

  function resetPageScroll(target) {
    if (typeof target?.scrollTo === 'function') target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  async function writeClipboard(root, text) {
    if (root.navigator?.clipboard && root.isSecureContext) {
      await root.navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = root.document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    root.document.body.appendChild(textarea);
    try {
      textarea.select();
      return root.document.execCommand('copy') === true;
    } finally {
      textarea.remove();
    }
  }

  function chooseBusiness(businesses, storedId) {
    if (!Array.isArray(businesses) || !businesses.length) return null;
    return businesses.find(item => item.id === storedId) || businesses[0];
  }

  function renderRequestRows(rows) {
    return rows.map(row => `<article class="request-card request-row${row.archived_at ? ' is-archived' : ''}" data-id="${escapeHtml(row.id)}">
      <div class="request-row-main">
        <div class="request-row-customer"><h3>${escapeHtml(row.contact?.display_name || row.reference)}</h3><p>${escapeHtml(row.reference)}${row.contact?.email ? ` · ${escapeHtml(row.contact.email)}` : ''}</p>${row.archived_at ? '<span class="request-archive-badge">Archivada</span>' : ''}</div>
        <div class="request-row-field"><span>Servicio</span><strong>${escapeHtml(row.service || 'No informado')}</strong>${row.urgency ? `<p>Urgencia: ${escapeHtml(row.urgency)}</p>` : ''}</div>
        <div class="request-row-field"><span>Prioridad</span><strong>${escapeHtml(priorityLabel(row.priority))}</strong></div>
        <div class="request-row-field"><span>Recibida</span><strong>${escapeHtml(dateLabel(row.created_at))}</strong></div>
        <div class="request-row-status"><span>Estado</span><strong>${escapeHtml(row.status)}</strong></div>
        <div class="request-row-action"><button class="copy-button" type="button" data-action="open-detail" data-id="${escapeHtml(row.id)}">Ver detalle</button></div>
      </div></article>`).join('');
  }

  function renderBasicDetail(row) {
    return `<div class="section-heading"><p class="section-kicker">Solicitud real</p><h2>${escapeHtml(row.reference)}</h2><p>Detalle completo disponible en C18C-2.</p></div>
      <dl class="real-basic-detail">
        <div><dt>Contacto</dt><dd>${escapeHtml(row.contact?.display_name || 'No disponible')}</dd></div>
        <div><dt>Email</dt><dd>${escapeHtml(row.contact?.email || 'No informado')}</dd></div>
        <div><dt>Teléfono</dt><dd>${escapeHtml(row.contact?.phone || 'No informado')}</dd></div>
        <div><dt>Servicio</dt><dd>${escapeHtml(row.service || 'No informado')}</dd></div>
        <div><dt>Estado</dt><dd>${escapeHtml(row.status)}</dd></div>
        <div><dt>Prioridad</dt><dd>${row.priority == null ? 'Sin prioridad' : escapeHtml(row.priority)}</dd></div>
        <div><dt>Fecha</dt><dd>${escapeHtml(dateLabel(row.created_at))}</dd></div>
      </dl><button class="copy-button" type="button" data-real-back>Volver a Solicitudes</button>`;
  }

  const enrichmentLabels = Object.freeze({ pending: 'Pendiente', processing: 'Generando', completed: 'Generado', failed: 'No disponible', legacy: 'Solicitud anterior' });
  const activityLabels = Object.freeze({
    request_created: 'Solicitud recibida',
    request_enrichment_generated: 'Resumen y respuesta sugerida generados',
    request_follow_up_24h: 'Seguimiento automático · 24 h',
    request_follow_up_48h: 'Seguimiento automático · 48 h',
    request_follow_up_72h: 'Seguimiento automático · 72 h',
    manual_follow_up_created: 'Seguimiento manual creado',
    manual_follow_up_completed: 'Seguimiento completado',
    manual_follow_up_reopened: 'Seguimiento reabierto',
  });
  const originLabels = Object.freeze({ user: 'Acción humana', automation: 'Automatización', system: 'Sistema', public_form: 'Formulario público' });
  const priorityLabel = value => ({ 1: 'Alta', 2: 'Media', 3: 'Baja' })[value] || 'Sin prioridad';
  const milestoneLabel = value => ({ 0: 'Sin seguimiento automático', 24: '24 h', 48: '48 h', 72: '72 h' })[Number(value)] || 'Sin seguimiento automático';
  const followUpReasonLabel = value => ({
    manual_follow_up_overdue: 'Existe un seguimiento manual vencido.',
    high_priority_no_recent_activity: 'Solicitud prioritaria sin actividad humana reciente.',
    no_recent_activity: 'No hay actividad humana reciente.',
  })[value] || 'Seguimiento recomendado.';
  const communicationTypeLabels = Object.freeze({ customer_confirmation: 'Confirmación al cliente', business_notification: 'Aviso al negocio' });
  const communicationStatusLabels = Object.freeze({ pending: 'Pendiente', processing: 'Enviando', sent: 'Enviado', failed: 'Fallido' });
  const priorityOptions = Object.freeze([{ value: '', label: 'Sin prioridad' }, { value: '1', label: 'Alta' }, { value: '2', label: 'Media' }, { value: '3', label: 'Baja' }]);
  const fileSizeLabel = value => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 1) return 'Tamaño no disponible';
    if (bytes >= 1048576) return `${(bytes / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
  };

  function projectContacts(requests) {
    const groups = new Map();
    for (const request of Array.isArray(requests) ? requests : []) {
      const contact = request.contact;
      const id = contact?.id || `request:${request.id}`;
      const existing = groups.get(id) || {
        id,
        display_name: contact?.display_name || 'Contacto no identificado',
        email: contact?.email || '',
        phone: contact?.phone || '',
        requests: [],
      };
      existing.requests.push(request);
      groups.set(id, existing);
    }
    return [...groups.values()].map(item => {
      const sorted = item.requests.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      const latest = sorted[0] || null;
      return { ...item, requests: sorted, request_count: sorted.length, latest_request: latest, latest_at: latest?.created_at || null };
    }).sort((a, b) => String(b.latest_at || '').localeCompare(String(a.latest_at || '')));
  }

  function calculateDashboardMetrics(requests, context, now = new Date()) {
    const requestRows = Array.isArray(requests) ? requests : [];
    const today = Number.isNaN(now.getTime()) ? '' : now.toISOString().slice(0, 10);
    const due = (Array.isArray(context?.followUps) ? context.followUps : []).filter(item =>
      item.status === 'pending' && String(item.due_at || '').slice(0, 10) <= today
    ).length;
    return {
      new_requests: requestRows.filter(item => item.status === 'Nuevo' && !item.archived_at).length,
      active_requests: requestRows.filter(item => !item.archived_at && !['Ganado', 'Perdido'].includes(item.status)).length,
      high_priority: requestRows.filter(item => item.priority === 1 && !item.archived_at).length,
      follow_ups_due: due,
    };
  }

  function renderDashboard(metrics) {
    const rows = [
      ['Solicitudes nuevas', metrics.new_requests, 'Pendientes de primera revisión'],
      ['Solicitudes activas', metrics.active_requests, 'No archivadas ni cerradas'],
      ['Prioridad alta', metrics.high_priority, 'Requieren atención'],
      ['Seguimientos hoy/vencidos', metrics.follow_ups_due, 'Tareas pendientes hasta hoy'],
    ];
    return rows.map(([label, value, detail]) => `<article class="dashboard-metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join('');
  }

  function renderFollowUpRows(requests, context, filter = 'pending') {
    const followUps = Array.isArray(context?.followUps) ? context.followUps : [];
    const activities = Array.isArray(context?.activities) ? context.activities : [];
    const rows = (Array.isArray(requests) ? requests : []).flatMap(request => {
      const tasks = followUps.filter(item => item.request_id === request.id);
      const activeTasks = tasks.filter(item => ['pending', 'completed'].includes(item.status));
      const visibleTasks = activeTasks.filter(item => filter === 'all' || (filter === 'contacted' ? item.status === 'completed' : item.status === 'pending'));
      const reason = activities.find(item => item.request_id === request.id && item.reason_code) || null;
      const hasPendingTask = activeTasks.some(item => item.status === 'pending');
      const automaticContext = filter !== 'contacted' && !hasPendingTask && (request.next_follow_up_at || Number(request.automatic_follow_up_milestone_hours || 0) !== 0);
      const rowsForRequest = automaticContext ? [...visibleTasks, null] : visibleTasks;
      return rowsForRequest.map(task => {
        const contacted = task?.status === 'completed';
        const status = contacted ? '✓ Contactado' : task ? 'Pendiente' : 'Contexto automático';
        const manualTask = Boolean(task?.assigned_to && task.cadence_hours == null && task.channel === 'internal');
        const canReopen = contacted && manualTask &&
          !request.archived_at && !['Ganado', 'Perdido'].includes(request.status);
        return `<article class="follow-up-card">
        <div class="follow-up-main"><span class="follow-up-priority">${escapeHtml(status)}</span><span class="follow-up-cadence">${escapeHtml(milestoneLabel(request.automatic_follow_up_milestone_hours))}</span>
        <h4>${escapeHtml(request.contact?.display_name || request.reference)}</h4><p><strong>${escapeHtml(request.reference)}</strong> · ${escapeHtml(request.title || request.service || 'Servicio no informado')}</p>
        <p>${contacted ? 'Contactado' : 'Próxima fecha'}: ${escapeHtml(task ? dateTimeLabel(contacted ? task.completed_at : task.due_at) : dateLabel(request.next_follow_up_at))}</p><p>${escapeHtml(task?.action_text || 'Seguimiento recomendado')}</p>${reason ? `<p>${escapeHtml(followUpReasonLabel(reason.reason_code))}</p>` : ''}
        <small>Origen: ${task ? (manualTask ? 'Manual' : 'Planificado por el sistema') : 'Automático'} · Estado de solicitud: ${escapeHtml(request.status || 'No disponible')}</small></div>
        <div class="follow-up-actions">${task?.status === 'pending' ? `<button class="copy-button" type="button" data-real-complete-follow-up="${escapeHtml(task.id)}">Marcar como completado</button>` : ''}${canReopen ? `<button class="copy-button follow-up-secondary-action" type="button" data-real-reopen-follow-up="${escapeHtml(task.id)}">Desmarcar</button>` : ''}<button class="copy-button" type="button" data-real-open-detail="${escapeHtml(request.id)}">Ver solicitud</button></div>
      </article>`;
      });
    });
    return rows.length ? rows.join('') : '<p class="empty-state compact-empty">No hay seguimientos reales registrados para este negocio.</p>';
  }

  function renderManualFollowUpComposer(requests) {
    const rows = (Array.isArray(requests) ? requests : []).filter(item => !item.archived_at);
    if (!rows.length) return '<section class="manual-follow-up-composer"><h3>+ Añadir seguimiento</h3><p class="real-detail-meta">Necesitas una solicitud activa para crear una tarea.</p></section>';
    const options = rows.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.reference)} · ${escapeHtml(item.contact?.display_name || item.title || item.service || 'Solicitud')}</option>`).join('');
    return `<section class="manual-follow-up-composer"><h3>+ Añadir seguimiento</h3><p class="real-detail-meta">Crea una tarea interna con una fecha prevista.</p><form data-real-follow-up-create><label>Solicitud<select name="request_id" required>${options}</select></label><label>Tarea<input name="action_text" type="text" maxlength="500" required placeholder="Ej. Llamar al cliente para pedir fotos"></label><label>Fecha prevista<input name="due_at" type="datetime-local" required></label><button class="button button-primary" type="submit">Añadir seguimiento</button></form><p class="real-action-feedback" data-real-follow-up-feedback role="status" aria-live="polite"></p></section>`;
  }

  function renderContactRows(contacts) {
    const rows = Array.isArray(contacts) ? contacts : [];
    return rows.length ? rows.map(contact => `<article class="client-row">
      <div class="client-row-identity"><strong>${escapeHtml(contact.display_name)}</strong><span>${escapeHtml(contact.email || contact.phone || 'Datos de contacto no informados')}</span></div>
      <div class="client-row-request"><span>Última solicitud</span><strong>${escapeHtml(contact.latest_request?.reference || 'No disponible')}</strong></div>
      <div class="client-row-status"><span>Fecha</span><strong>${escapeHtml(dateLabel(contact.latest_at))}</strong></div>
      <span class="client-row-count">${escapeHtml(contact.request_count)} solicitud${contact.request_count === 1 ? '' : 'es'}</span>
      ${contact.latest_request ? `<button class="copy-button client-row-action" type="button" data-real-open-detail="${escapeHtml(contact.latest_request.id)}">Ver última solicitud</button>` : ''}
    </article>`).join('') : '<p class="empty-state">No hay contactos reales para este negocio.</p>';
  }

  function communicationsMarkup(communications, status) {
    if (status === 'error') return '<p class="real-detail-empty">No se pudieron cargar las comunicaciones.</p>';
    const rows = Array.isArray(communications) ? communications : [];
    return rows.length ? rows.map(item => `<li><strong>${escapeHtml(communicationTypeLabels[item.email_type] || 'Comunicación')}</strong><span>${escapeHtml(communicationStatusLabels[item.status] || 'No disponible')} · Creada ${escapeHtml(dateLabel(item.created_at))}${item.sent_at ? ` · Enviada ${escapeHtml(dateLabel(item.sent_at))}` : ''}</span></li>`).join('') : '<li class="real-detail-empty">Sin comunicaciones registradas.</li>';
  }

  function renderFullDetail(detail) {
    const request = detail.request || {};
    const contact = detail.contact || {};
    const answers = Array.isArray(detail.answers) ? detail.answers : [];
    const activities = Array.isArray(detail.activities) ? detail.activities : [];
    const notes = Array.isArray(detail.notes) ? detail.notes : [];
    const attachments = Array.isArray(detail.attachments) ? detail.attachments : [];
    const communications = Array.isArray(detail.communications) ? detail.communications : [];
    const followUps = Array.isArray(detail.followUps) ? detail.followUps : [];
    const answersHtml = answers.length ? answers.map(item => `<li><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.value)}</p></li>`).join('') : '<li class="real-detail-empty">Sin respuestas registradas.</li>';
    const activitiesHtml = activities.length ? activities.map(item => {
      const known = activityLabels[item.type];
      const title = known || (item.actor_type === 'user' ? item.title || 'Actividad del equipo' : 'Actividad registrada');
      const text = item.actor_type === 'user' ? item.detail : '';
      return `<li><span>${escapeHtml(originLabels[item.actor_type] || 'Origen no disponible')} · ${escapeHtml(dateLabel(item.created_at))}</span><strong>${escapeHtml(title)}</strong>${text ? `<p>${escapeHtml(text)}</p>` : ''}</li>`;
    }).join('') : '<li class="real-detail-empty">Sin actividad registrada.</li>';
    const notesHtml = notes.length ? notes.map(item => `<li><strong>${escapeHtml(item.detail || 'Nota interna')}</strong><span>${escapeHtml(dateLabel(item.created_at))}</span></li>`).join('') : '<li class="real-detail-empty">Sin notas internas.</li>';
    const attachmentsHtml = attachments.length ? attachments.map(item => `<li><strong>${escapeHtml(item.file_name || 'Archivo adjunto')}</strong><span>${escapeHtml(item.mime_type || 'Tipo no disponible')} · ${escapeHtml(fileSizeLabel(item.size_bytes))} · ${escapeHtml(dateLabel(item.created_at))}</span>${item.access_url ? `<a class="copy-button" href="${escapeHtml(item.access_url)}" target="_blank" rel="noopener noreferrer">Abrir archivo</a>` : '<span>Acceso temporal no disponible.</span>'}</li>`).join('') : '<li class="real-detail-empty">Sin archivos adjuntos.</li>';
    const enrichment = enrichmentLabels[request.enrichment_status] || 'No disponible';
    const statusOptions = STATUSES.map(status => `<option value="${escapeHtml(status)}"${request.status === status ? ' selected' : ''}>${escapeHtml(status)}</option>`).join('');
    const prioritySelect = priorityOptions.map(item => `<option value="${item.value}"${String(request.priority ?? '') === item.value ? ' selected' : ''}>${item.label}</option>`).join('');
    const archiveLabel = request.archived_at ? 'Restaurar solicitud' : 'Archivar solicitud';
    const suggestedReply = typeof request.suggested_reply === 'string' ? request.suggested_reply : '';
    const suggestedReplyHtml = suggestedReply.trim()
      ? `<p class="real-detail-draft">${escapeHtml(suggestedReply)}</p><div class="real-copy-response-row"><button class="copy-button copy-button-primary" type="button" data-real-copy-response>Copiar respuesta</button><span class="real-action-feedback" data-real-copy-feedback role="status" aria-live="polite"></span></div>`
      : '<p class="real-detail-draft">Sin respuesta sugerida disponible.</p>';
    const manualFollowUpsHtml = followUps.length ? followUps.map(item => {
      const canReopen = item.status === 'completed' && item.assigned_to && item.cadence_hours == null && item.channel === 'internal' &&
        !request.archived_at && !['Ganado', 'Perdido'].includes(request.status);
      return `<li><strong>${escapeHtml(item.action_text || 'Seguimiento manual')}</strong><span>Manual · ${item.status === 'completed' ? `Completado ${escapeHtml(dateTimeLabel(item.completed_at))}` : `Pendiente · ${escapeHtml(dateTimeLabel(item.due_at))}`}</span>${item.status === 'pending' ? `<button class="copy-button" type="button" data-real-complete-follow-up="${escapeHtml(item.id)}">Marcar como completado</button>` : ''}${canReopen ? `<button class="copy-button follow-up-secondary-action" type="button" data-real-reopen-follow-up="${escapeHtml(item.id)}">Desmarcar</button>` : ''}</li>`;
    }).join('') : '<li class="real-detail-empty">No hay seguimientos manuales para esta solicitud.</li>';

    return `<header class="real-detail-hero"><div><p class="section-kicker">Solicitud real</p><h2>${escapeHtml(request.reference || 'Solicitud')} · ${escapeHtml(contact.display_name || 'Contacto no disponible')}</h2><p>${escapeHtml(request.title || request.service || 'Servicio no informado')}</p></div><dl class="real-detail-hero-meta"><div><dt>Estado</dt><dd>${escapeHtml(request.status || 'No disponible')}</dd></div><div><dt>Prioridad</dt><dd>${escapeHtml(priorityLabel(request.priority))}</dd></div><div><dt>Fecha</dt><dd>${escapeHtml(dateLabel(request.created_at))}</dd></div></dl></header>
      <div class="real-detail-layout">
        <div class="real-detail-top-grid">
          <section class="real-detail-section real-detail-overview"><h3>Solicitud y contacto</h3><div class="real-detail-overview-grid"><div><h4>Solicitud</h4><dl class="real-basic-detail"><div><dt>Servicio</dt><dd>${escapeHtml(request.title || request.service || 'No informado')}</dd></div>${detail.zone ? `<div><dt>Zona</dt><dd>${escapeHtml(detail.zone)}</dd></div>` : ''}<div><dt>Urgencia</dt><dd>${escapeHtml(request.urgency || 'No indicada')}</dd></div><div><dt>Necesidad</dt><dd class="real-detail-prewrap">${escapeHtml(request.description || 'Sin descripción disponible')}</dd></div></dl></div><div><h4>Contacto</h4><dl class="real-basic-detail"><div><dt>Nombre</dt><dd>${escapeHtml(contact.display_name || 'No disponible')}</dd></div><div><dt>Email</dt><dd>${escapeHtml(contact.email || 'No informado')}</dd></div><div><dt>Teléfono</dt><dd>${escapeHtml(contact.phone || 'No informado')}</dd></div></dl></div></div></section>
          <section class="real-detail-section real-detail-actions real-detail-management"><h3>Gestión</h3><form data-real-request-update><fieldset><legend class="sr-only">Cambiar estado y prioridad</legend><label>Estado<select name="status">${statusOptions}</select></label><label>Prioridad<select name="priority">${prioritySelect}</select></label><button class="button button-primary" type="submit">Cambiar estado y prioridad</button></fieldset></form><p class="real-action-feedback" data-real-action-feedback role="status" aria-live="polite"></p><button class="button ${request.archived_at ? 'button-secondary' : 'button-danger'}" type="button" data-real-archive-request data-archived="${request.archived_at ? 'true' : 'false'}">${archiveLabel}</button><p class="real-detail-meta">${request.archived_at ? 'La solicitud volverá a las vistas activas.' : 'La solicitud seguirá disponible y podrá restaurarse.'}</p></section>
        </div>
        <section class="real-detail-section real-detail-form"><h3>${escapeHtml(detail.form?.name || 'Respuestas del formulario')}</h3><ul class="real-detail-list">${answersHtml}</ul></section>
        <section class="real-detail-section real-detail-enrichment"><div class="real-detail-section-heading"><div><h3>Resumen interno y respuesta sugerida</h3><p class="real-detail-meta">Estado: ${escapeHtml(enrichment)}${request.enriched_at ? ` · Generado el ${escapeHtml(dateLabel(request.enriched_at))}` : ''}</p></div></div><div class="real-detail-enrichment-grid"><div><h4>Resumen interno</h4><p class="real-detail-prewrap">${escapeHtml(request.internal_summary || 'Sin resumen interno disponible.')}</p></div><div><h4>Respuesta sugerida · Borrador</h4><p class="real-detail-meta">No enviada ni aprobada. Es una propuesta revisable y de solo lectura.</p>${suggestedReplyHtml}</div></div></section>
        <div class="real-detail-work-grid">
          <section class="real-detail-section"><h3>Notas internas</h3><p class="real-detail-meta">Solo visible para tu equipo.</p><form data-real-note-form><label for="real-internal-note">Nueva nota</label><textarea id="real-internal-note" name="note" maxlength="2000" required></textarea><button class="button button-primary" type="submit">Añadir nota</button></form><p class="real-action-feedback" data-real-note-feedback role="status" aria-live="polite"></p><ul class="real-detail-list real-detail-notes">${notesHtml}</ul></section>
          <section class="real-detail-section"><h3>Seguimiento</h3><p class="real-detail-meta">Tareas manuales</p><ul class="real-detail-list">${manualFollowUpsHtml}</ul><p class="real-action-feedback" data-real-follow-up-detail-feedback role="status" aria-live="polite"></p><h4>Historial automático</h4><dl class="real-basic-detail"><div><dt>Hito automático</dt><dd>${escapeHtml(milestoneLabel(request.automatic_follow_up_milestone_hours))}</dd></div><div><dt>Próxima fecha prevista</dt><dd>${escapeHtml(dateLabel(request.next_follow_up_at))}</dd></div><div><dt>Contexto</dt><dd>${escapeHtml(request.next_action || 'Sin siguiente acción registrada')}</dd></div></dl></section>
        </div>
        <div class="real-detail-history-grid">
          <section class="real-detail-section"><h3>Actividad</h3><ol class="activity-timeline">${activitiesHtml}</ol></section>
          <div class="real-detail-support-column"><section class="real-detail-section"><h3>Comunicaciones</h3><ul class="real-detail-list">${communicationsMarkup(communications, detail.communicationsStatus)}</ul></section><section class="real-detail-section"><h3>Adjuntos</h3><ul class="real-detail-list real-detail-attachments">${attachmentsHtml}</ul></section></div>
        </div>
      </div><button class="copy-button" type="button" data-real-back>Volver a Solicitudes</button>`;
  }

  async function confirmedWrite(write, refresh) {
    const confirmed = await write();
    await refresh(confirmed);
    return confirmed;
  }

  function initialize(root) {
    const document = root.document;
    const service = root.ProductData.createDataService();
    const $ = selector => document.querySelector(selector);
    const access = $('#real-access');
    const shell = $('.app-shell');
    const message = $('#real-access-message');
    const list = $('#requests-list');
    const count = $('#request-count');
    const statusFilter = $('#status-filter');
    const serviceFilter = $('#service-filter');
    const search = $('#request-search');
    const selector = $('#real-business-selector');
    const context = $('#real-business-context');
    const pending = $('#real-pending-view');
    const detail = $('#request-detail-view-content');
    const dashboardMetrics = $('#dashboard-metrics');
    const dashboardAlerts = $('#dashboard-alerts');
    const dashboardNext = $('#dashboard-next-action');
    const followUpList = $('#follow-up-list');
    const followUpCount = $('#follow-up-count');
    const followUpFilterControls = $('#follow-up-state-filter');
    const clientsList = $('#clients-list');
    const clientProfile = $('#client-profile');
    let businesses = [];
    let activeBusiness = null;
    let allRequests = [];
    let followUpContext = { followUps: [], activities: [] };
    let selectedRequest = null;
    let loadVersion = 0;
    let detailVersion = 0;
    let currentView = 'solicitudes';
    let followUpStateFilter = 'pending';
    let writeInFlight = false;

    function savedBusinessId() {
      try { return root.localStorage.getItem(preferenceKey); } catch { return null; }
    }
    function saveBusinessId(id) {
      try { root.localStorage.setItem(preferenceKey, id); } catch { /* preference is optional */ }
    }
    function clearBusinessId() {
      try { root.localStorage.removeItem(preferenceKey); } catch { /* preference is optional */ }
    }
    function setAccess(text, error = false) {
      message.textContent = text;
      message.classList.toggle('is-error', error);
    }
    function showSignedOut(text) {
      ++loadVersion;
      ++detailVersion;
      service.signOut();
      businesses = [];
      activeBusiness = null;
      allRequests = [];
      followUpContext = { followUps: [], activities: [] };
      selectedRequest = null;
      shell.hidden = true;
      access.hidden = false;
      $('#real-sign-in').hidden = false;
      setAccess(text);
      list.replaceChildren();
      count.textContent = '0';
    }
    function showShell() {
      access.hidden = true;
      shell.hidden = false;
      $('#real-session-tools').hidden = false;
      $('#selected-request-nav').hidden = true;
      $('#reset-demo').hidden = true;
      $('#reset-demo-note').hidden = true;
      $('.sector-change-link').hidden = true;
      $('.demo-status').textContent = 'Supabase DEV · datos reales';
      $('.site-footer').textContent = 'SolicitudPro Demo · datos autorizados de Supabase DEV.';
      document.querySelectorAll('.dashboard-local-badge').forEach(item => item.setAttribute('hidden', ''));
      $('#status-summary').hidden = true;
      $('.follow-up-overview').hidden = true;
    }
    function renderFilters() {
      const previousStatus = statusFilter.value;
      const previousService = serviceFilter.value;
      statusFilter.innerHTML = '<option value="Todos">Todos los estados</option>' + STATUSES.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      const services = [...new Set(allRequests.map(item => item.service).filter(Boolean))].sort();
      serviceFilter.innerHTML = '<option value="Todos">Todos los servicios</option>' + services.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
      statusFilter.value = STATUSES.includes(previousStatus) ? previousStatus : 'Todos';
      serviceFilter.value = services.includes(previousService) ? previousService : 'Todos';
    }
    function renderList() {
      if (!activeBusiness) return;
      const query = search.value.trim().toLocaleLowerCase('es');
      const visible = allRequests.filter(row =>
        (statusFilter.value === 'Todos' || row.status === statusFilter.value) &&
        (serviceFilter.value === 'Todos' || row.service === serviceFilter.value) &&
        (!query || [row.reference, row.service, row.contact?.display_name, row.contact?.email, row.contact?.phone].some(value => String(value || '').toLocaleLowerCase('es').includes(query)))
      );
      count.textContent = String(visible.length);
      list.innerHTML = visible.length ? renderRequestRows(visible) : '<p class="empty-state">No hay solicitudes para este negocio y filtros.</p>';
    }
    function renderDashboardView() {
      const metrics = calculateDashboardMetrics(allRequests, followUpContext);
      dashboardMetrics.innerHTML = renderDashboard(metrics);
      const alerts = [];
      if (metrics.new_requests) alerts.push(`${metrics.new_requests} solicitud${metrics.new_requests === 1 ? '' : 'es'} nueva${metrics.new_requests === 1 ? '' : 's'} por revisar.`);
      if (metrics.high_priority) alerts.push(`${metrics.high_priority} solicitud${metrics.high_priority === 1 ? '' : 'es'} de prioridad alta.`);
      if (metrics.follow_ups_due) alerts.push(`${metrics.follow_ups_due} seguimiento${metrics.follow_ups_due === 1 ? '' : 's'} pendiente${metrics.follow_ups_due === 1 ? '' : 's'} para hoy o vencido${metrics.follow_ups_due === 1 ? '' : 's'}.`);
      dashboardAlerts.innerHTML = alerts.length ? alerts.map(item => `<p>${escapeHtml(item)}</p>`).join('') : '<p class="dashboard-clear-state">No hay alertas activas en los datos reales.</p>';
      const next = followUpContext.followUps.find(item => item.status === 'pending');
      const request = next && allRequests.find(item => item.id === next.request_id);
      dashboardNext.innerHTML = request ? `<div class="dashboard-next-action-content"><h3>${escapeHtml(request.contact?.display_name || request.reference)}</h3><p>${escapeHtml(next.action_text || 'Seguimiento pendiente')}</p><small>${escapeHtml(request.reference)} · ${escapeHtml(dateLabel(next.due_at))}</small><button class="copy-button" type="button" data-real-open-detail="${escapeHtml(request.id)}">Revisar solicitud</button></div>` : '<h3>Sin tareas pendientes</h3><p>No hay seguimientos reales pendientes para este negocio.</p>';
    }
    function renderFollowUpsView() {
      const pendingCount = followUpContext.followUps.filter(item => item.status === 'pending').length;
      const contactedCount = followUpContext.followUps.filter(item => item.status === 'completed').length;
      const countLabels = {
        pending: `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}`,
        contacted: `${contactedCount} contactado${contactedCount === 1 ? '' : 's'}`,
        all: `${followUpContext.followUps.filter(item => ['pending', 'completed'].includes(item.status)).length} seguimientos`,
      };
      followUpCount.textContent = countLabels[followUpStateFilter];
      followUpFilterControls?.querySelectorAll('[data-follow-up-filter]').forEach(button => {
        const active = button.dataset.followUpFilter === followUpStateFilter;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      followUpList.innerHTML = renderManualFollowUpComposer(allRequests) + `<div class="manual-follow-up-list">${renderFollowUpRows(allRequests, followUpContext, followUpStateFilter)}</div>`;
    }
    function renderContactsView() {
      const contacts = projectContacts(allRequests);
      clientsList.innerHTML = renderContactRows(contacts);
      clientProfile.innerHTML = contacts.length ? '<p class="section-kicker">Datos reales</p><h3>Contactos autorizados</h3><p>La lista agrupa únicamente por el identificador real del contacto. Abre su última solicitud para consultar el detalle.</p>' : '<p>No hay contactos disponibles.</p>';
    }
    function navigate(viewName, sourceButton) {
      if (!activeBusiness && viewName !== 'solicitudes') return;
      const supportedViews = ['dashboard', 'solicitudes', 'seguimientos', 'clientes'];
      const supported = supportedViews.includes(viewName) || (viewName === 'detalle-solicitud' && selectedRequest);
      const target = supported ? viewName : 'real-pending';
      document.querySelectorAll('[data-view]').forEach(view => {
        const active = view.dataset.view === target;
        view.hidden = !active;
        view.classList.toggle('is-active', active);
      });
      const navView = supported ? viewName : viewName;
      document.querySelectorAll('[data-view-target]').forEach(button => {
        const active = button.dataset.viewTarget === navView && (sourceButton ? button === sourceButton : true);
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      });
      pending.querySelector('h2').textContent = `${({ dashboard: 'Inicio', seguimientos: 'Seguimientos', clientes: 'Contactos', formulario: 'Formulario del cliente', 'tabla-local': 'Tabla interna', 'acceso-cliente': 'Acceso del cliente' })[viewName] || 'Sección'} pendiente`;
      const titles = { dashboard: 'Inicio', solicitudes: 'Solicitudes', seguimientos: 'Seguimientos', clientes: 'Contactos', 'detalle-solicitud': 'Detalle de solicitud' };
      $('#view-title').textContent = supported ? titles[viewName] : pending.querySelector('h2').textContent;
      $('#view-kicker').textContent = supported ? 'Supabase DEV' : 'Próxima integración';
      $('#app-back-button').hidden = target !== 'detalle-solicitud';
      currentView = target;
      if (target === 'dashboard') renderDashboardView();
      if (target === 'solicitudes') renderList();
      if (target === 'seguimientos') renderFollowUpsView();
      if (target === 'clientes') renderContactsView();
      resetPageScroll(root);
    }
    async function openDetail(id) {
      const row = allRequests.find(item => item.id === id);
      if (!row) return;
      const version = ++detailVersion;
      const businessAtStart = activeBusiness;
      selectedRequest = row;
      detail.innerHTML = `<div class="section-heading"><p class="section-kicker">Solicitud real</p><h2>${escapeHtml(row.reference)}</h2></div><p class="empty-state" role="status">Cargando detalle…</p>`;
      $('#selected-request-nav').hidden = false;
      $('#selected-request-nav-label').textContent = `${row.reference} · ${row.contact?.display_name || 'Contacto no disponible'}`;
      $('#selected-request-status').textContent = `Estado: ${row.status}`;
      $('#selected-request-next-action').textContent = 'Detalle real en modo lectura';
      navigate('detalle-solicitud');
      try {
        const complete = await service.getRequestDetail(businessAtStart.id, id);
        if (version !== detailVersion || activeBusiness?.id !== businessAtStart.id || selectedRequest?.id !== id) return;
        if (!complete) {
          detail.innerHTML = '<p class="empty-state" role="alert">Solicitud no disponible.</p><button class="copy-button" type="button" data-real-back>Volver a Solicitudes</button>';
          return;
        }
        selectedRequest = { ...row, ...complete.request, contact: complete.contact };
        complete.followUps = followUpContext.followUps.filter(item => item.request_id === id);
        detail.innerHTML = renderFullDetail(complete);
      } catch (error) {
        if (version !== detailVersion) return;
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) return showSignedOut('Sesión expirada. Inicia sesión de nuevo.');
        detail.innerHTML = '<p class="empty-state" role="alert">No se pudo cargar el detalle. Inténtalo de nuevo.</p><button class="copy-button" type="button" data-real-back>Volver a Solicitudes</button>';
      }
    }

    function setDetailFeedback(selector, text, error = false) {
      const target = detail.querySelector(selector);
      if (!target) return;
      target.textContent = text;
      target.classList.toggle('is-error', error);
    }

    async function refreshDetailAfterWrite(requestId) {
      await loadRequests();
      await openDetail(requestId);
    }

    async function runDetailWrite(control, feedbackSelector, writingText, successText, write) {
      if (writeInFlight || !activeBusiness || !selectedRequest) return;
      const requestId = selectedRequest.id;
      writeInFlight = true;
      control.disabled = true;
      setDetailFeedback(feedbackSelector, writingText);
      try {
        await confirmedWrite(write, () => refreshDetailAfterWrite(requestId));
        setDetailFeedback(feedbackSelector, successText);
      } catch (error) {
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) return showSignedOut('Sesión expirada. Inicia sesión de nuevo.');
        if (error.message === 'FOLLOW_UP_COMPLETED_ACTIVITY_FAILED' || error.message === 'FOLLOW_UP_REOPENED_ACTIVITY_FAILED') {
          await refreshDetailAfterWrite(requestId);
          setDetailFeedback(feedbackSelector, followUpPartialMessage(error.message === 'FOLLOW_UP_REOPENED_ACTIVITY_FAILED'), true);
          return;
        }
        control.disabled = false;
        setDetailFeedback(feedbackSelector, 'No se pudo confirmar el cambio. Se mantiene la última lectura confirmada.', true);
      } finally {
        writeInFlight = false;
      }
    }
    async function loadRequests() {
      const version = ++loadVersion;
      ++detailVersion;
      allRequests = [];
      followUpContext = { followUps: [], activities: [] };
      selectedRequest = null;
      $('#selected-request-nav').hidden = true;
      detail.replaceChildren();
      navigate('solicitudes');
      list.innerHTML = '<p class="empty-state">Cargando solicitudes…</p>';
      count.textContent = '0';
      try {
        const [rows, contextRows] = await Promise.all([
          service.listRequests(activeBusiness.id),
          service.listFollowUpContext(activeBusiness.id),
        ]);
        if (version !== loadVersion) return;
        allRequests = rows;
        followUpContext = contextRows;
        renderFilters();
        renderList();
      } catch (error) {
        if (version !== loadVersion) return;
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) return showSignedOut('Sesión expirada. Inicia sesión de nuevo.');
        allRequests = [];
        followUpContext = { followUps: [], activities: [] };
        list.innerHTML = '<p class="empty-state" role="alert">No se pudieron cargar las solicitudes. Inténtalo de nuevo.</p>';
      }
    }
    async function selectBusiness(id) {
      activeBusiness = chooseBusiness(businesses, id);
      if (!activeBusiness) return;
      saveBusinessId(activeBusiness.id);
      selector.value = activeBusiness.id;
      context.textContent = activeBusiness.name;
      await loadRequests();
    }
    async function afterSignIn() {
      businesses = await service.listBusinesses();
      showShell();
      if (!businesses.length) {
        clearBusinessId();
        activeBusiness = null;
        selector.hidden = true;
        context.textContent = 'No tienes negocios activos autorizados.';
        list.innerHTML = '<p class="empty-state">No hay negocios disponibles para esta sesión.</p>';
        navigate('solicitudes');
        return;
      }
      selector.innerHTML = businesses.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('');
      selector.hidden = businesses.length < 2;
      const preferred = savedBusinessId();
      const chosen = chooseBusiness(businesses, preferred);
      if (preferred && preferred !== chosen.id) clearBusinessId();
      await selectBusiness(chosen.id);
    }

    $('#sector-selector').hidden = true;
    showSignedOut('Comprobando sesión…');
    service.session().then(user => {
      if (!user) showSignedOut('Inicia sesión para ver solicitudes reales.');
      else return afterSignIn();
    }).catch(() => showSignedOut('No se pudo validar la sesión. Inicia sesión de nuevo.'));
    $('#real-sign-in').addEventListener('submit', async event => {
      event.preventDefault();
      const submit = $('#real-sign-in button[type=submit]');
      submit.disabled = true;
      setAccess('Validando sesión…');
      try {
        await service.signIn($('#real-email').value.trim(), $('#real-password').value);
        $('#real-password').value = '';
        await afterSignIn();
      } catch {
        showSignedOut('No se pudo iniciar sesión o cargar los negocios autorizados.');
      } finally { submit.disabled = false; }
    });
    $('#real-sign-out').addEventListener('click', () => showSignedOut('Sesión cerrada.'));
    $('#real-refresh').addEventListener('click', () => { if (activeBusiness) loadRequests(); });
    selector.addEventListener('change', () => selectBusiness(selector.value));
    $('#app-back-button').addEventListener('click', () => { if (currentView === 'detalle-solicitud') { ++detailVersion; navigate('solicitudes'); } });
    detail.addEventListener('submit', event => {
      const updateForm = event.target.closest('[data-real-request-update]');
      const noteForm = event.target.closest('[data-real-note-form]');
      if (!updateForm && !noteForm) return;
      event.preventDefault();
      if (writeInFlight || !activeBusiness || !selectedRequest) return;
      const businessId = activeBusiness.id;
      const requestAtStart = selectedRequest;
      if (updateForm) {
        const status = updateForm.querySelector('[name=status]').value;
        const rawPriority = updateForm.querySelector('[name=priority]').value;
        const priority = rawPriority === '' ? null : Number(rawPriority);
        runDetailWrite(updateForm.querySelector('button[type=submit]'), '[data-real-action-feedback]', 'Guardando…', 'Estado y prioridad actualizados.', () =>
          service.updateRequestState(businessId, requestAtStart, { status, priority }));
      } else {
        const textarea = noteForm.querySelector('[name=note]');
        runDetailWrite(noteForm.querySelector('button[type=submit]'), '[data-real-note-feedback]', 'Guardando nota…', 'Nota interna añadida.', () =>
          service.addInternalNote(businessId, requestAtStart.id, textarea.value));
      }
    });
    detail.addEventListener('click', async event => {
      if (event.target.closest('[data-real-back]')) { ++detailVersion; navigate('solicitudes'); return; }
      const copyResponse = event.target.closest('[data-real-copy-response]');
      if (copyResponse && selectedRequest) {
        const feedback = detail.querySelector('[data-real-copy-feedback]');
        copyResponse.disabled = true;
        try {
          const copied = await copySuggestedReply(selectedRequest.suggested_reply, value => writeClipboard(root, value));
          if (feedback) feedback.textContent = copyFeedbackMessage(copied);
        } catch {
          if (feedback) feedback.textContent = 'No se pudo copiar.';
        } finally {
          copyResponse.disabled = false;
        }
        return;
      }
      const completeFollowUp = event.target.closest('[data-real-complete-follow-up]');
      if (completeFollowUp && !writeInFlight && activeBusiness && selectedRequest) {
        const followUp = followUpContext.followUps.find(item => item.id === completeFollowUp.dataset.realCompleteFollowUp && item.request_id === selectedRequest.id && item.status === 'pending');
        if (followUp) runDetailWrite(completeFollowUp, '[data-real-follow-up-detail-feedback]', 'Completando seguimiento…', 'Seguimiento completado.', () => service.completeManualFollowUp(activeBusiness.id, followUp));
        return;
      }
      const reopenFollowUp = event.target.closest('[data-real-reopen-follow-up]');
      if (reopenFollowUp && !writeInFlight && activeBusiness && selectedRequest) {
        const followUp = followUpContext.followUps.find(item => item.id === reopenFollowUp.dataset.realReopenFollowUp && item.request_id === selectedRequest.id && item.status === 'completed');
        if (followUp) runDetailWrite(reopenFollowUp, '[data-real-follow-up-detail-feedback]', 'Reabriendo seguimiento…', 'Seguimiento reabierto.', () => service.reopenManualFollowUp(activeBusiness.id, followUp, selectedRequest));
        return;
      }
      const archive = event.target.closest('[data-real-archive-request]');
      if (!archive || writeInFlight || !activeBusiness || !selectedRequest) return;
      const restoring = archive.dataset.archived === 'true';
      if (!restoring && !root.confirm('¿Archivar esta solicitud? Seguirá disponible y podrá restaurarse.')) return;
      const businessId = activeBusiness.id;
      const requestAtStart = selectedRequest;
      runDetailWrite(archive, '[data-real-action-feedback]', restoring ? 'Restaurando…' : 'Archivando…', restoring ? 'Solicitud restaurada.' : 'Solicitud archivada.', () =>
        service.setRequestArchived(businessId, requestAtStart, !restoring));
    });
    followUpList.addEventListener('submit', async event => {
      const form = event.target.closest('[data-real-follow-up-create]');
      if (!form) return;
      event.preventDefault();
      if (writeInFlight || !activeBusiness) return;
      const request = allRequests.find(item => item.id === form.querySelector('[name=request_id]').value && item.business_id === activeBusiness.id);
      const button = form.querySelector('button[type=submit]');
      const feedback = form.parentElement.querySelector('[data-real-follow-up-feedback]');
      if (!request) { feedback.textContent = 'Selecciona una solicitud disponible.'; feedback.classList.add('is-error'); return; }
      writeInFlight = true;
      button.disabled = true;
      feedback.textContent = 'Guardando seguimiento…';
      feedback.classList.remove('is-error');
      try {
        await service.createManualFollowUp(activeBusiness.id, request, { actionText: form.querySelector('[name=action_text]').value, dueAt: form.querySelector('[name=due_at]').value });
        await loadRequests();
        navigate('seguimientos');
        followUpList.insertAdjacentHTML('afterbegin', '<p class="real-action-feedback" role="status">Seguimiento añadido.</p>');
      } catch (error) {
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) return showSignedOut('Sesión expirada. Inicia sesión de nuevo.');
        if (error.message === 'FOLLOW_UP_CREATED_ACTIVITY_FAILED') {
          await loadRequests(); navigate('seguimientos');
          followUpList.insertAdjacentHTML('afterbegin', '<p class="real-action-feedback is-error" role="alert">El seguimiento se guardó, pero no pudo registrarse en Actividad. La lista se ha actualizado.</p>');
        } else {
          button.disabled = false;
          feedback.textContent = error.message === 'FOLLOW_UP_INVALID' ? 'Revisa la tarea y utiliza una fecha futura válida.' : 'No se pudo guardar el seguimiento.';
          feedback.classList.add('is-error');
        }
      } finally { writeInFlight = false; }
    });
    [dashboardNext, followUpList, clientsList].forEach(container => container.addEventListener('click', async event => {
      const button = event.target.closest('[data-real-open-detail]');
      if (button) openDetail(button.dataset.realOpenDetail);
      const complete = event.target.closest('[data-real-complete-follow-up]');
      const reopen = event.target.closest('[data-real-reopen-follow-up]');
      if ((!complete && !reopen) || writeInFlight || !activeBusiness) return;
      const followUp = followUpContext.followUps.find(item => item.id === (complete?.dataset.realCompleteFollowUp || reopen?.dataset.realReopenFollowUp) && item.status === (reopen ? 'completed' : 'pending'));
      if (!followUp) return;
      const request = allRequests.find(item => item.id === followUp.request_id && item.business_id === activeBusiness.id);
      if (!request) return;
      writeInFlight = true;
      const control = reopen || complete;
      control.disabled = true;
      try {
        await confirmedWrite(() => reopen ? service.reopenManualFollowUp(activeBusiness.id, followUp, request) : service.completeManualFollowUp(activeBusiness.id, followUp), async () => { await loadRequests(); navigate('seguimientos'); });
        followUpList.insertAdjacentHTML('afterbegin', `<p class="real-action-feedback" role="status">${reopen ? 'Seguimiento reabierto.' : 'Seguimiento completado.'}</p>`);
      } catch (error) {
        if (/SESSION_REQUIRED|SESSION_EXPIRED|SESSION_CHANGED/.test(error.message)) return showSignedOut('Sesión expirada. Inicia sesión de nuevo.');
        if (error.message === 'FOLLOW_UP_COMPLETED_ACTIVITY_FAILED' || error.message === 'FOLLOW_UP_REOPENED_ACTIVITY_FAILED') {
          await loadRequests(); navigate('seguimientos');
          followUpList.insertAdjacentHTML('afterbegin', `<p class="real-action-feedback is-error" role="alert">${followUpPartialMessage(Boolean(reopen))}</p>`);
        } else {
          control.disabled = false;
          followUpList.insertAdjacentHTML('afterbegin', `<p class="real-action-feedback is-error" role="alert">No se pudo ${reopen ? 'reabrir' : 'confirmar'} el seguimiento.</p>`);
        }
      } finally { writeInFlight = false; }
    }));
    followUpFilterControls?.addEventListener('click', event => {
      const button = event.target.closest('[data-follow-up-filter]');
      if (!button || !['pending', 'contacted', 'all'].includes(button.dataset.followUpFilter)) return;
      followUpStateFilter = button.dataset.followUpFilter;
      renderFollowUpsView();
    });
    document.querySelectorAll('[data-action="open-selected-detail"]').forEach(button => button.addEventListener('click', () => { if (selectedRequest) openDetail(selectedRequest.id); }));
    document.querySelectorAll('[data-action="copy-selected-response"], [data-detail-tab-target="seguimiento"]').forEach(button => { button.hidden = true; });
    return { navigate, renderList, openDetail };
  }

  return { chooseBusiness, renderRequestRows, renderBasicDetail, renderFullDetail, milestoneLabel, followUpReasonLabel, projectContacts, calculateDashboardMetrics, renderDashboard, renderManualFollowUpComposer, renderFollowUpRows, renderContactRows, confirmedWrite, copySuggestedReply, copyFeedbackMessage, followUpPartialMessage, writeClipboard, resetPageScroll, initialize };
});
