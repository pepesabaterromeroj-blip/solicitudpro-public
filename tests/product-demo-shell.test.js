const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { getSectorFormConfig } = require("../js/sector-presets.js");

const root = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("presents SolicitudPro as a product demo instead of a marketing landing", () => {
  const html = readProjectFile("index.html");

  assert.match(html, /SolicitudPro Demo/);
  assert.match(
    html,
    /Convierte una solicitud de cliente en una oportunidad organizada/
  );
  assert.match(html, /Demo local · datos de ejemplo · no se envían mensajes reales/);
  assert.match(html, /demo\.solicitudpro\.local\/formulario/);
  assert.match(html, /QR demo no funcional/);
  assert.match(html, /<details class="technical-docs"/);
  assert.doesNotMatch(html, /12<\/strong>\s*<small>solicitudes\/semana/);
  assert.doesNotMatch(html, /38%<\/strong>\s*<small>menos tiempo de respuesta/);
});

test("reset demo action only clears the demo storage key", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /id="reset-demo"/);
  assert.match(html, /Reiniciar demo restaura las solicitudes de ejemplo del sector actual/);
  assert.match(script, /function resetDemoData\(\)/);
  assert.match(script, /function getDemoRequests\(\)/);
  assert.match(script, /window\.localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.match(script, /se restauraron las \$\{requests\.length\} solicitudes de ejemplo/);
  assert.doesNotMatch(script, /window\.localStorage\.clear\(\)/);
});

test("keeps v1 navigation, operational follow-ups, and documentation aligned", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");
  const readme = readProjectFile("README.md");
  const projectStatus = readProjectFile("docs/proyecto/ESTADO_PROYECTO.md");
  const roadmap = readProjectFile("docs/proyecto/ROADMAP.md");

  assert.match(html, /id="app-back-button"/);
  assert.match(script, /const ACTIVE_REQUEST_STATUSES/);
  assert.match(script, /function showPreviousView\(\)/);
  assert.match(script, /const activeRequests = requests\.filter/);
  assert.match(script, /appBackButton\.addEventListener\("click", showPreviousView\)/);
  assert.match(readme, /SolicitudPro Demo v1\.0/);
  assert.match(projectStatus, /SolicitudPro Demo v1\.1 sectorial/);
  assert.match(roadmap, /Demo v1\.0/);
  assert.doesNotMatch(readme, /Existe un flujo real en n8n funcionando fuera de esta web/);
});

test("closes the demo with coherent local copy, form fields, and reset state", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");

  assert.match(html, /Automatización futura/);
  assert.doesNotMatch(html, /Automatización actual/);
  assert.doesNotMatch(html, /n8n revisa datos mínimos/);
  assert.match(html, /n8n revisaría los datos mínimos/);
  assert.match(html, /id="sector-form-fields"/);
  assert.match(html, /id="sector-form-submit"/);
  assert.match(script, /function renderSectorForm\(\)/);
  ["reformas", "electricidad", "fontaneria", "academias"].forEach((sectorId) => {
    const fields = getSectorFormConfig(sectorId).fields;
    assert.equal(fields.length, sectorId === "academias" ? 9 : 8);
    assert.equal(fields.find((field) => field.name === "email").required, true);
    assert.match(fields.find((field) => field.name === "email").label, /obligatorio/);
  });
  assert.match(script, /Continuar demo en el panel/);
  assert.match(script, /localTableSearch\.value = ""/);
  assert.match(script, /localTableStatusFilter\.value = "Todos"/);
  assert.match(script, /localTableServiceFilter\.value = "Todos"/);
  assert.match(script, /localTableView = "summary"/);
  assert.match(script, /function renderLocalTableViewToggle\(\)/);
  assert.match(script, /function renderLocalTable\(\)\s*\{[\s\S]*?renderLocalTableViewToggle\(\);/);
  assert.doesNotMatch(script, /getPendingFollowUps\([\s\S]*?\.slice\(0, 4\)/);
  assert.doesNotMatch(detail, /data-action="close-detail"/);
});

test("uses an app shell with compact requests as the primary demo view", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /class="app-sidebar"/);
  assert.match(html, /data-view-target="solicitudes"/);
  assert.match(html, /data-view-target="acceso-cliente"/);
  assert.match(html, /data-view-target="formulario"/);
  assert.match(html, /data-view-target="seguimientos"/);
  assert.match(html, /data-view-target="documentacion-tecnica"/);
  assert.match(html, /data-view="solicitudes"/);
  assert.match(html, /Demo local · datos de ejemplo · no se envían mensajes reales/);
  assert.match(script, /function showView\(viewName, sourceButton = null, options = \{\}\)/);
  assert.match(script, /request-row/);
});

test("keeps complete commercial content in detail tabs instead of the request list", () => {
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");
  const renderRequests = script.slice(
    script.indexOf("function renderRequests()"),
    script.indexOf("function addRequestFromForm")
  );

  assert.match(detail, /Resumen y dudas/);
  assert.match(detail, /data-detail-tab="respuesta"/);
  assert.match(detail, /data-detail-tab="seguimiento"/);
  assert.match(detail, /data-detail-tab="actividad"/);
  assert.doesNotMatch(renderRequests, /request\.internalSummary/);
  assert.doesNotMatch(renderRequests, /request\.suggestedResponse/);
  assert.doesNotMatch(renderRequests, /request\.suggestedQuestions/);
});

test("groups the sidebar navigation and exposes local product-demo views", () => {
  const html = readProjectFile("index.html");

  assert.match(html, /class="app-nav-group"/);
  assert.match(html, /Inicio/);
  assert.match(html, />Contactos</);
  assert.match(html, /Acceso del cliente/);
  assert.match(html, /<summary>Más</);
  assert.match(html, /Personalización por sector/);
  assert.match(html, /data-view="email-negocio"/);
  assert.match(html, /data-email-preview-target="client"/);
  assert.match(html, /data-view="tabla-local"/);
  assert.match(html, /Información de la demo/);
});

test("keeps simulated emails and local table clearly separated from real integrations", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /Demo local · estos emails son ejemplos simulados y no se envían\./);
  assert.match(html, /Datos ficticios guardados solo en este navegador\./);
  assert.match(html, /Confirmación al cliente/);
  assert.match(script, /label: "Cliente"/);
  assert.match(script, /label: "Próxima acción"/);
  assert.match(script, /function renderEmailPreviews\(\)/);
  assert.match(script, /sectorEmailCopy: sectorExperience\?\.emailCopy/);
  assert.match(script, /function renderLocalTable\(\)/);
  assert.doesNotMatch(script, /localStorage\.clear\(\)/);
});

test("keeps final sector copy aligned with the four simulated demos", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");
  const status = readProjectFile("docs/proyecto/ESTADO_PROYECTO.md");

  ["reformas", "electricidad", "fontaneria", "academias"].forEach((sectorId) => {
    assert.match(html, new RegExp(`data-sector-preview="${sectorId}"`));
  });
  assert.match(html, /SolicitudPro mantiene la misma estructura de trabajo/);
  assert.match(html, /Los emails son ejemplos simulados[\s\S]*?no se envían mensajes[\s\S]*?reales/);
  assert.match(html, /no hay backend ni conexión real[\s\S]*?Supabase, n8n, Google Sheets o Gmail/);
  assert.match(script, /function renderSectorPreview\(sectorKey = activeSector/);
  assert.match(status, /SolicitudPro Demo v1\.1 sectorial/);
});

test("guides the demo through a selected request with a commercial pipeline and operational table", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /Recorrido de demo/);
  assert.match(html, /Reforma de cocina - Marta López/);
  assert.doesNotMatch(html, /Gestion de solicitud/);
  assert.match(script, /label: "Referencia"/);
  assert.match(script, /label: "Origen"/);
  assert.match(script, /label: "Fecha próxima acción"/);
  assert.doesNotMatch(script.slice(script.indexOf("complete: ["), script.indexOf("function getLocalTableColumns")), /label: "Ultima actividad"/);
  assert.match(script, /data-action="open-table-detail"/);
  assert.match(script, /let selectedRequestId/);
  assert.match(script, /function selectRequest\(id\)/);
  assert.match(script, /function getSelectedRequest\(\)/);
  assert.match(script, /"En preparación"/);
  assert.match(script, /"Enviado"/);
  assert.match(script, /"Seguimiento pendiente"/);
  assert.match(script, /"Ganado"/);
  assert.match(script, /"Perdido"/);
  assert.match(script, /"Presupuesto enviado": "Enviado"/);
  assert.match(script, /Aceptado: "Ganado"/);
  assert.match(script, /"Cerrado sin exito": "Perdido"/);
});

test("keeps selected-request actions, local form configuration, and readable simulations visible", () => {
  const html = readProjectFile("index.html");
  const css = readProjectFile("css/style.css");
  const script = readProjectFile("js/script.js");

  assert.match(html, /Solicitud seleccionada/);
  assert.match(html, /id="selected-request-nav-label"/);
  assert.match(html, /id="selected-request-status"/);
  assert.match(html, /id="selected-request-next-action"/);
  assert.match(html, /data-action="copy-selected-response"/);
  assert.doesNotMatch(html, /data-detail-tab-target="actividad"/);
  assert.match(html, /Personalización por sector/);
  assert.match(html, /Una misma forma de trabajo, adaptada al sector/);
  assert.match(html, /data-action="select-sector-preview"/);
  assert.match(script, /Academias/);
  assert.match(getSectorFormConfig("academias").description, /No compartas información médica o personal sensible/);
  assert.match(html, /SOL-001 es la referencia corta/);
  assert.match(script, /Negocio demo/);
  assert.doesNotMatch(script, /Equipo de SolicitudPro Demo/);
  assert.match(css, /data-table-view="complete"/);
  assert.match(css, /\[data-column="next-follow-up"\]/);
});

test("presents the local table as a lightweight, editable sheet without external integration", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");

  assert.match(html, /Barra de herramientas de la tabla interna/);
  assert.match(html, /data-action="scroll-local-table"/);
  assert.match(html, /Guardado local/);
  assert.match(html, /class="sheet-column-letters"/);
  assert.match(script, /data-action="change-table-status"/);
  assert.match(script, /data-action="change-table-next-action"/);
  assert.match(script, /data-action="change-table-note"/);
  assert.match(script, /function updateLocalTableField\(/);
  assert.match(detail, /id="detail-active-section"/);
  assert.match(detail, /Navegación secundaria del detalle/);
});

test("keeps the local dashboard, client context, and receipt behind an explicit dev submission mode", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /data-view-target="dashboard"/);
  assert.match(html, /Qué revisar ahora/);
  assert.match(html, /Cómo funciona SolicitudPro/);
  assert.match(html, /Revisar siguiente solicitud/);
  assert.match(html, /data-view-target="clientes"/);
  assert.match(html, /id="clients-list"/);
  assert.match(html, /id="client-profile"/);
  assert.match(html, /data-view="solicitud-recibida"/);
  assert.match(script, /function renderDashboard\(\)/);
  assert.match(script, /function renderClients\(\)/);
  assert.match(script, /function renderClientReceipt\(\)/);
  assert.match(script, /Solicitud recibida/);
  assert.match(script, /function markFollowUpContacted\(/);
  assert.match(script, /data-action="mark-follow-up-contacted"/);
  assert.match(script, /get\("submit"\) === "supabase-dev"/);
  assert.match(
    script,
    /if \(isSupabaseDevSubmissionMode\) \{\s+await submitSectorFormToSupabaseDev\(formValues\);\s+return;/
  );
});

test("keeps Inicio focused on four operational signals and marks missing data separately", () => {
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");

  const dashboard = script.slice(
    script.indexOf("function renderDashboard()"),
    script.indexOf("function renderClients()")
  );

  assert.match(script, /dashboard: \{ title: "Inicio"/);
  assert.match(dashboard, /\["Solicitudes nuevas", newRequests/);
  assert.match(dashboard, /\["Respuestas pendientes", responsePending/);
  assert.match(dashboard, /\["Seguimientos hoy\/vencidos",/);
  assert.match(dashboard, /\["Datos por confirmar", missingInformation/);
  assert.doesNotMatch(dashboard, /Ultima solicitud/);
  assert.doesNotMatch(dashboard, /Proxima accion", nextRequest/);
  assert.match(script, /function getDataPendingLabels\(request, sectorExperience/);
  assert.match(detail, /data-pending-labels/);
});

test("uses one sector-personalization preview and enough varied local examples", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /id="sector-preview"/);
  assert.match(html, /data-action="select-sector-preview"/);
  assert.match(script, /const SECTOR_PREVIEWS/);
  assert.match(script, /function renderSectorPreview\(/);
  assert.equal((script.match(/reference: "SOL-00/g) || []).length, 7);
  ["Marta López", "Javier Ruiz", "Clínica Alba", "Academia Norte", "Taller Ronda", "Cristalería Costa", "Carpintería Roble"].forEach(
    (name) => assert.match(script, new RegExp(`name: "${name}"`))
  );
});

test("keeps client context and the local sheet easy to operate without external services", () => {
  const html = readProjectFile("index.html");
  const css = readProjectFile("css/style.css");
  const script = readProjectFile("js/script.js");

  assert.match(html, /class="clients-inbox-heading"/);
  assert.match(html, /data-action="scroll-local-table"/);
  assert.match(html, /data-scroll-direction="left"/);
  assert.match(html, /data-scroll-direction="right"/);
  assert.match(html, /Emails automáticos simulados/);
  assert.match(html, /data-action="show-email-preview"/);
  assert.match(script, /function syncSelectedClientRequest\(/);
  assert.match(script, /function scrollLocalTable\(/);
  assert.match(css, /\.local-table-scroll-controls/);
  assert.doesNotMatch(css, /\.local-data-table th:nth-child\(1\)/);
});

test("offers a compact local sheet view before the complete editable view", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");

  assert.match(html, /id="local-table-search"/);
  assert.match(html, /id="local-table-status-filter"/);
  assert.match(html, /id="local-table-service-filter"/);
  assert.match(html, /data-local-table-view="summary"/);
  assert.match(html, /data-local-table-view="complete"/);
  assert.match(html, /data-action="export-local-table-csv"/);
  assert.match(script, /let localTableView = "summary"/);
  assert.match(script, /function getVisibleLocalTableRequests\(/);
  assert.match(script, /function exportLocalTableCsv\(/);
  assert.match(script, /left: direction === "left" \? -240 : 240/);
});

test("uses one in-panel request detail view with guided section navigation", () => {
  const html = readProjectFile("index.html");
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");

  assert.match(html, /data-view="detalle-solicitud"/);
  assert.match(html, /id="request-detail-view-content"/);
  assert.match(html, /id="selected-request-status"/);
  assert.match(html, /id="selected-request-next-action"/);
  assert.match(script, /function openRequestDetail\(id, tabName = "solicitud"\)/);
  assert.match(script, /showView\("detalle-solicitud"\)/);
  assert.match(detail, /data-action="detail-previous"/);
  assert.match(detail, /data-action="detail-next"/);
  assert.match(detail, /data-action="back-to-requests"/);
  assert.match(detail, /Datos recibidos/);
  assert.match(detail, /Resumen y dudas/);
});

test("returns from a request detail to the view where it was opened", () => {
  const script = readProjectFile("js/script.js");

  assert.match(script, /let detailReturnView = "solicitudes"/);
  assert.match(script, /detailReturnView = currentView/);
  assert.match(script, /function updateDetailBackButton\(/);
  assert.match(script, /function showPreviousView\(\)/);
  assert.match(script, /showPreviousView\(\)/);
});

test("keeps v1 navigation discoverable and makes the request flow explicit", () => {
  const html = readProjectFile("index.html");
  const css = readProjectFile("css/style.css");
  const script = readProjectFile("js/script.js");
  const detail = readProjectFile("js/request-detail.js");

  assert.match(html, /<details class="app-nav-group" open>\s*<summary>Acceso del cliente<\/summary>/);
  assert.match(html, /<details class="app-nav-group" open>\s*<summary>Más<\/summary>/);
  assert.match(html, /data-view-target="tabla-local">Tabla interna<\/button>/);
  assert.match(html, /class="copy-button view-table-button" type="button" data-view-target="tabla-local">Ver tabla interna<\/button>/);
  assert.match(detail, /id="detail-flow-progress"/);
  assert.match(detail, /data-step-label="Datos"/);
  assert.match(script, /function getBackButtonLabel\(/);
  assert.doesNotMatch(script, /const isSidebarNavigation = sourceButton\?\.matches\("\.app-nav-button\[data-view-target\]"\)/);
  assert.doesNotMatch(script, /viewHistory = \["dashboard"\]/);
  assert.match(script, /viewHistory = \[\.\.\.viewHistory, currentView\]\.slice\(-12\)/);
  assert.match(script, /Siguiente: \$\{sectionLabels\[DETAIL_TABS\[currentIndex \+ 1\]\]\}/);
  assert.match(css, /\.copy-button:hover/);
  assert.match(css, /\.copy-button:active/);
});
