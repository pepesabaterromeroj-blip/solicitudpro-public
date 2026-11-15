(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.RequestDetail = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "Tamaño no disponible";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function createAttachmentList(attachments) {
    const safeAttachments = Array.isArray(attachments) ? attachments : [];

    if (!safeAttachments.length) {
      return "<p>Sin fotos o adjuntos.</p>";
    }

    return `<ul class="detail-list">${safeAttachments
      .map(
        (attachment) =>
          `<li><strong>${escapeHtml(attachment.name)}</strong> <span>${escapeHtml(
            formatFileSize(attachment.size)
          )}</span></li>`
      )
      .join("")}</ul>`;
  }

  function createActivityTimeline(activityHistory) {
    const safeActivityHistory = Array.isArray(activityHistory)
      ? activityHistory
      : [];

    if (!safeActivityHistory.length) {
      return "<p>No hay actividad registrada todavía.</p>";
    }

    return `<ol class="activity-timeline">${safeActivityHistory
      .map(
        (activity) => `
          <li>
            <span>${escapeHtml(activity.date || "Sin fecha")}</span>
            <strong>${escapeHtml(activity.label || "Actividad registrada")}</strong>
            <p>${escapeHtml(activity.detail || "")}</p>
          </li>
        `
      )
      .join("")}</ol>`;
  }

  function filterLocalFollowUps(requests, filter = "pending") {
    const safeRequests = Array.isArray(requests) ? requests : [];
    if (filter === "all") return safeRequests.slice();
    const contacted = filter === "contacted";
    return safeRequests.filter((request) => Boolean(request?.followUpContactedAt) === contacted);
  }

  function markLocalFollowUpContacted(request, nextState) {
    if (!request || request.followUpContactedAt) return { ...request };
    return {
      ...request,
      previousFollowUp: {
        nextFollowUpDate: request.nextFollowUpDate,
        nextFollowUp: request.nextFollowUp,
      },
      contactedFollowUp: {
        nextFollowUpDate: nextState.nextFollowUpDate,
        nextFollowUp: nextState.nextFollowUp,
      },
      followUpContactedAt: nextState.contactedAt,
      nextFollowUpDate: nextState.nextFollowUpDate,
      nextFollowUp: nextState.nextFollowUp,
    };
  }

  function unmarkLocalFollowUpContacted(request) {
    const { followUpContactedAt, previousFollowUp, contactedFollowUp, ...rest } = request || {};
    if (!followUpContactedAt) return rest;
    const wasRecalculated = contactedFollowUp && (
      rest.nextFollowUpDate !== contactedFollowUp.nextFollowUpDate ||
      rest.nextFollowUp !== contactedFollowUp.nextFollowUp
    );
    return {
      ...rest,
      nextFollowUpDate: wasRecalculated ? rest.nextFollowUpDate : previousFollowUp?.nextFollowUpDate || rest.nextFollowUpDate,
      nextFollowUp: wasRecalculated ? rest.nextFollowUp : previousFollowUp?.nextFollowUp || rest.nextFollowUp,
    };
  }

  function createOptions(values, selectedValue) {
    return values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}"${
            value === selectedValue ? " selected" : ""
          }>${escapeHtml(value)}</option>`
      )
      .join("");
  }

  function normalizeRequestEditValues(values) {
    return {
      name: String(values.name || "").trim(),
      email: String(values.email || "").trim(),
      phone: String(values.phone || "").trim(),
      service: String(values.service || "").trim(),
      description: String(values.description || "").trim(),
      budget: String(values.budget || "").trim(),
      urgency: String(values.urgency || "").trim(),
      status: String(values.status || "").trim(),
    };
  }

  function createRequestEditForm(request, options) {
    return `
      <div class="request-detail-heading">
        <div>
          <p class="section-kicker">Editar solicitud</p>
          <h2 id="request-detail-title">Actualizar datos comerciales</h2>
          <p>Los cambios se guardan solo en este navegador.</p>
        </div>
        <button class="detail-close" type="button" data-action="cancel-request-edit">Cancelar</button>
      </div>
      <form class="request-edit-form" data-action="save-request-edit" data-id="${escapeHtml(
        request.id
      )}">
        <div class="request-edit-grid">
          <label>
            Nombre completo
            <input name="name" value="${escapeHtml(request.name)}" required minlength="2" />
          </label>
          <label>
            Correo electrónico
            <input type="email" name="email" value="${escapeHtml(request.email)}" required />
          </label>
          <label>
            Teléfono opcional
            <input type="tel" name="phone" value="${escapeHtml(request.phone)}" pattern="[0-9+() .-]{7,20}" />
          </label>
          <label>
            Tipo de servicio
            <select name="service" required>${createOptions(
              options.services,
              request.service
            )}</select>
          </label>
          <label>
            Presupuesto aproximado
            <select name="budget" required>${createOptions(
              options.budgets,
              request.budget
            )}</select>
          </label>
          <label>
            Urgencia
            <select name="urgency" required>${createOptions(
              options.urgencies,
              request.urgency
            )}</select>
          </label>
          <label>
            Estado comercial
            <select name="status" required>${createOptions(
              options.statuses,
              request.status
            )}</select>
          </label>
          <label class="request-edit-wide">
            Descripción del problema o necesidad
            <textarea name="description" rows="6" required minlength="20">${escapeHtml(
              request.description
            )}</textarea>
          </label>
        </div>
        <p class="request-edit-note" role="status" aria-live="polite"></p>
        <div class="request-edit-actions">
          <button class="button button-primary" type="submit">Guardar cambios</button>
          <button class="button button-secondary" type="button" data-action="cancel-request-edit">Cancelar</button>
        </div>
      </form>
    `;
  }

  function createRequestDetailView(request) {
    const questions = Array.isArray(request.suggestedQuestions)
      ? request.suggestedQuestions
      : [];
    const terminalRequest = ["Ganado", "Perdido"].includes(request.status);
    const followUpAction = terminalRequest
      ? `<span class="follow-up-contacted-badge">Solicitud cerrada</span>`
      : request.followUpContactedAt
        ? `<div class="follow-up-completed-state"><span class="follow-up-contacted-badge">✓ Contactado</span><button class="copy-button follow-up-secondary-action" type="button" data-action="unmark-follow-up-contacted" data-id="${escapeHtml(request.id)}">Desmarcar</button></div>`
        : `<button class="copy-button" type="button" data-action="mark-follow-up-contacted" data-id="${escapeHtml(request.id)}">Marcar contactado</button>`;

    return `
      <div class="request-detail-heading">
        <div>
          <button class="detail-back" type="button" data-action="back-to-requests">Volver a solicitudes</button>
          <p class="section-kicker">Solicitud seleccionada · Detalle de solicitud</p>
          <h2 id="request-detail-title">${escapeHtml(request.reference)} · ${escapeHtml(request.name)}</h2>
          <p>${escapeHtml(request.service)} · ${escapeHtml(request.status)} · ${escapeHtml(request.origin)}</p>
        </div>
        <div class="request-detail-heading-actions">
          <button class="copy-button" type="button" data-action="edit-request" data-id="${escapeHtml(
            request.id
          )}">Editar</button>
        </div>
      </div>
      <div class="request-detail-meta" aria-label="Resumen comercial">
        <span>${escapeHtml(request.budget)}</span>
        <span>${escapeHtml(request.urgency)}</span>
        <span>Entrada: ${escapeHtml(request.formattedCreatedAt)}</span>
        <span>Seguimiento: ${escapeHtml(request.formattedNextFollowUpDate)}</span>
      </div>
      ${Array.isArray(request.dataPendingLabels) && request.dataPendingLabels.length ? `
        <section class="detail-pending-data" data-pending-labels aria-label="Datos pendientes de confirmar">
          <strong>Datos por confirmar</strong>
          <div>${request.dataPendingLabels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>
        </section>
      ` : ""}
      ${Array.isArray(request.sectorTags) && request.sectorTags.length ? `
        <section class="detail-pending-data" data-sector-tags aria-label="Etiquetas de la solicitud">
          <strong>Etiquetas de la solicitud</strong>
          <div>${request.sectorTags.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>
        </section>
      ` : ""}
      <div class="request-detail-tabs" role="tablist" aria-label="Navegación secundaria del detalle">
        <button class="request-detail-tab" type="button" role="tab" id="detail-tab-solicitud" data-detail-tab="solicitud" data-step-label="Datos" aria-controls="detail-panel-solicitud" aria-selected="true">Datos</button>
        <button class="request-detail-tab" type="button" role="tab" id="detail-tab-resumen" data-detail-tab="resumen" data-step-label="Resumen" aria-controls="detail-panel-resumen" aria-selected="false" aria-label="Resumen y dudas">Resumen</button>
        <button class="request-detail-tab" type="button" role="tab" id="detail-tab-respuesta" data-detail-tab="respuesta" data-step-label="Respuesta" aria-controls="detail-panel-respuesta" aria-selected="false">Respuesta</button>
        <button class="request-detail-tab" type="button" role="tab" id="detail-tab-seguimiento" data-detail-tab="seguimiento" data-step-label="Seguimiento" aria-controls="detail-panel-seguimiento" aria-selected="false">Seguimiento</button>
        <button class="request-detail-tab" type="button" role="tab" id="detail-tab-actividad" data-detail-tab="actividad" data-step-label="Actividad" aria-controls="detail-panel-actividad" aria-selected="false">Actividad</button>
      </div>
      <p class="detail-active-section" id="detail-active-section" aria-live="polite">Datos recibidos de ${escapeHtml(request.name)}</p>
      <div class="detail-flow-controls" aria-label="Avanzar por el detalle">
        <button class="copy-button" type="button" data-action="detail-previous">Anterior</button>
        <span id="detail-flow-progress" aria-live="polite">Paso 1 de 5 · Datos</span>
        <button class="copy-button" type="button" data-action="detail-next">Siguiente: Resumen</button>
      </div>
      <div class="request-detail-panels">
      <section class="request-detail-tab-panel" id="detail-panel-solicitud" data-detail-panel="solicitud" role="tabpanel" aria-labelledby="detail-tab-solicitud" aria-hidden="false">
        <div class="request-detail-grid">
          <section>
            <h3>Contacto</h3>
            <p>${escapeHtml(request.email)}</p>
            <p>${escapeHtml(request.phone || "Teléfono no informado")}</p>
          </section>
          <section>
            <h3>Necesidad</h3>
            <p>${escapeHtml(request.description)}</p>
          </section>
          ${Array.isArray(request.sectorDataFields) && request.sectorDataFields.length ? `
            <section>
              <h3>${escapeHtml(request.sectorDataTitle || "Datos del servicio")}</h3>
              <ul class="detail-list">${request.sectorDataFields
                .map(
                  (field) => `<li><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</li>`
                )
                .join("")}</ul>
            </section>
          ` : ""}
          <section class="request-detail-wide">
            <h3>Fotos o adjuntos</h3>
            ${createAttachmentList(request.attachments)}
          </section>
        </div>
      </section>
      <section class="request-detail-tab-panel" id="detail-panel-resumen" data-detail-panel="resumen" role="tabpanel" aria-labelledby="detail-tab-resumen" aria-hidden="true" hidden>
        <div class="request-detail-grid">
          <section>
            <h3>Resumen interno revisable</h3>
            <p>${escapeHtml(request.internalSummary)}</p>
          </section>
          <section>
            <h3>Datos a confirmar</h3>
            <ul class="detail-list">${questions
              .map((question) => `<li>${escapeHtml(question)}</li>`)
              .join("")}</ul>
          </section>
        </div>
      </section>
      <section class="request-detail-tab-panel" id="detail-panel-respuesta" data-detail-panel="respuesta" role="tabpanel" aria-labelledby="detail-tab-respuesta" aria-hidden="true" hidden>
        <div class="request-detail-grid">
          <section class="request-detail-wide">
            <h3>Respuesta sugerida para ${escapeHtml(request.name)}</h3>
            <p class="suggested-response">${escapeHtml(request.suggestedResponse)}</p>
            <div class="copy-row" aria-label="Preparar respuesta desde el detalle">
              <button class="copy-button copy-button-primary" type="button" data-action="copy-message" data-channel="general" data-default-label="Copiar respuesta" data-id="${escapeHtml(
                request.id
              )}">Copiar respuesta</button>
              <button class="copy-button" type="button" data-action="copy-message" data-channel="whatsapp" data-default-label="Copiar WhatsApp" data-id="${escapeHtml(
                request.id
              )}">Copiar WhatsApp</button>
              <button class="copy-button" type="button" data-action="copy-message" data-channel="email" data-default-label="Copiar email" data-id="${escapeHtml(
                request.id
              )}">Copiar email</button>
            </div>
          </section>
        </div>
      </section>
      <section class="request-detail-tab-panel" id="detail-panel-seguimiento" data-detail-panel="seguimiento" role="tabpanel" aria-labelledby="detail-tab-seguimiento" aria-hidden="true" hidden>
        <div class="request-detail-grid">
          <section class="request-detail-wide request-detail-follow-up">
            <h3>Próximo seguimiento</h3>
            <p><strong>${escapeHtml(request.followUpCadence)} | ${escapeHtml(
              request.formattedNextFollowUpDate
            )}:</strong> ${escapeHtml(request.nextFollowUp)}</p>
            ${followUpAction}
          </section>
        </div>
      </section>
      <section class="request-detail-tab-panel" id="detail-panel-actividad" data-detail-panel="actividad" role="tabpanel" aria-labelledby="detail-tab-actividad" aria-hidden="true" hidden>
        <div class="request-detail-grid">
          <section class="request-detail-wide">
            <h3>Historial de actividad</h3>
            ${createActivityTimeline(request.activityHistory)}
          </section>
        </div>
      </section>
      </div>
    `;
  }

  return {
    createRequestDetailView,
    createRequestEditForm,
    normalizeRequestEditValues,
    createActivityTimeline,
    filterLocalFollowUps,
    markLocalFollowUpContacted,
    unmarkLocalFollowUpContacted,
  };
});
