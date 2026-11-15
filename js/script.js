const {
  getSectorFromSearch,
  getSectorExperience,
  getSectorFormConfig,
  createSectorRequestPayload,
  getSectorPreset,
  getSectorRequestSeeds,
  getSectorStorageKey,
} = window.SectorPresets;
const isRealProductMode = new URLSearchParams(window.location.search).get("mode") !== "local" &&
  new URLSearchParams(window.location.search).get("submit") !== "supabase-dev";
const sectorRoute = getSectorFromSearch(window.location.search);
let activeSector = sectorRoute.activeSector;
const activeSectorStorageKey = getSectorStorageKey(activeSector);
const isSupabaseDevSubmissionMode =
  new URLSearchParams(window.location.search).get("submit") === "supabase-dev";
const SUPABASE_DEV_SUBMISSION_ENDPOINT =
  "https://rinrgjancwvcvpzjyqmu.supabase.co/functions/v1/receive-public-form/api/public/forms";
const SUPABASE_DEV_FORM_CONFIGS = Object.freeze({
  reformas: {
    businessSlug: "reformas-demo-dev",
    formSlug: "solicitud",
    answerFields: {
      tipoReforma: "tipo_reforma",
      zona: "zona",
      description: "descripcion",
      plazoDeseado: "plazo",
    },
  },
  electricidad: {
    businessSlug: "electricidad-demo-dev",
    formSlug: "solicitud",
    answerFields: {
      tipoTrabajo: "tipo_trabajo",
      riesgoUrgencia: "riesgo_urgencia",
      zona: "zona",
      description: "descripcion",
    },
  },
  fontaneria: {
    businessSlug: "fontaneria-demo-dev",
    formSlug: "solicitud",
    answerFields: {
      tipoIncidencia: "tipo_incidencia",
      aguaActivaUrgencia: "agua_activa_urgencia",
      zona: "zona",
      description: "descripcion",
    },
  },
  climatizacion: {
    businessSlug: "climatizacion-demo-dev",
    formSlug: "solicitud",
    answerFields: {
      tipoTrabajo: "tipo_trabajo",
      urgencia: "urgencia",
      zona: "zona",
      tipoEquipo: "tipo_equipo",
      description: "descripcion",
    },
  },
  cristaleria: {
    businessSlug: "cristaleria-demo-dev",
    formSlug: "solicitud",
    answerFields: {
      tipoTrabajo: "tipo_trabajo",
      urgencia: "urgencia",
      zona: "zona",
      medidasAproximadas: "medidas_aproximadas",
      description: "descripcion",
    },
  },
  academias: {
    businessSlug: "academia-demo-dev",
    formSlug: "clases",
    answerFields: {
      materia: "materia",
      disponibilidad: "disponibilidad",
    },
  },
});
let activeSupabaseDevSubmission = null;
let selectedPublicFiles = [];
let activeAttachmentRetryContext = null;

const STATUSES = [
  "Nuevo",
  "En preparación",
  "Enviado",
  "Seguimiento pendiente",
  "Ganado",
  "Perdido",
];
const ACTIVE_REQUEST_STATUSES = STATUSES.filter(
  (status) => !["Ganado", "Perdido"].includes(status)
);

const STORAGE_KEY = activeSectorStorageKey;
const {
  createAttachmentItems,
  retryFailedAttachments,
  uploadAttachmentsSequentially,
  validateAttachmentSelection,
} = window.PublicFormAttachments;
const FOLLOW_UP_RULE_VERSION = 3;
const { createFollowUpPlan } = window.FollowUpRules;
const {
  createRequestDetailView,
  createRequestEditForm,
  normalizeRequestEditValues,
  filterLocalFollowUps,
  markLocalFollowUpContacted,
  unmarkLocalFollowUpContacted,
} = window.RequestDetail;
const EDIT_OPTIONS = {
  statuses: STATUSES,
  services: [
    "Reformas",
    "Electricidad",
    "Fontanería",
    "Cristalería",
    "Carpintería",
    "Taller",
    "Clínica",
    "Peluquería",
    "Academia",
    "Entrenador personal",
    "Comercio local",
  ],
  budgets: [
    "Menos de 300 EUR",
    "300 - 1.000 EUR",
    "1.000 - 3.000 EUR",
    "Más de 3.000 EUR",
    "No lo sabe todavía",
  ],
  urgencies: ["Hoy", "Esta semana", "Este mes", "Sin prisa"],
};

const SECTOR_PREVIEWS = {
  reformas: {
    title: "Reformas",
    fields: ["Fotos", "Medidas", "Zona", "Disponibilidad para visita", "Presupuesto orientativo"],
    problem: "Evita empezar un presupuesto sin saber el alcance, el espacio o si hace falta una visita.",
    example: "Quiero reformar un baño pequeño y revisar una humedad. Puedo recibir una visita por la tarde.",
    response: "Gracias por la información. Para preparar una orientación, revisaremos las fotos y confirmaremos las medidas y la visita.",
    followUp: "Confirmar medidas aproximadas y disponibilidad para visitar el espacio.",
  },
  electricidad: {
    title: "Electricidad",
    fields: ["Tipo de trabajo", "Urgencia o riesgo", "Zona", "Foto opcional", "Disponibilidad"],
    problem: "Prioriza con claridad una avería o posible riesgo frente a una visita que puede planificarse.",
    example: "El cuadro eléctrico salta al conectar varios equipos en la cocina y necesito una revisión segura.",
    response: "Revisaremos la prioridad y confirmaremos el siguiente paso sin pedir que se manipule la instalación.",
    followUp: "Confirmar disponibilidad y coordinar una revisión eléctrica segura.",
  },
  fontaneria: {
    title: "Fontanería",
    fields: ["Tipo de incidencia", "Agua activa o urgencia", "Zona", "Foto opcional", "Disponibilidad"],
    problem: "Ayuda a distinguir una fuga activa de una visita que puede organizarse con más calma.",
    example: "Hay una fuga bajo el fregadero y quiero confirmar si se puede revisar esta tarde.",
    response: "Revisaremos la urgencia y confirmaremos el siguiente paso sin retrasar el contacto por una foto.",
    followUp: "Confirmar si el agua sigue activa y el horario de acceso para la visita.",
  },
  climatizacion: {
    title: "Climatización",
    fields: ["Tipo de trabajo", "Urgencia", "Zona", "Tipo de equipo", "Foto opcional"],
    problem: "Ordena las averías, instalaciones y visitas antes de preparar un presupuesto o una revisión.",
    example: "El equipo no enfría y necesito revisar una instalación de aire acondicionado en casa.",
    response: "Revisaremos el equipo, la urgencia y la zona para confirmar la visita o el siguiente paso.",
    followUp: "Confirmar tipo de equipo, disponibilidad y si el problema sigue activo.",
  },
  cristaleria: {
    title: "Cristalerías",
    fields: ["Tipo de trabajo", "Urgencia", "Zona", "Medidas aproximadas", "Foto opcional"],
    problem: "Recoge medidas, fotos y urgencia antes de valorar una rotura, una mampara o un cerramiento.",
    example: "Necesito sustituir un cristal roto y valorar una ventana con medidas aproximadas.",
    response: "Revisaremos las medidas, la urgencia y las fotos simuladas para preparar el siguiente paso.",
    followUp: "Confirmar medidas, acceso y si hay una rotura que requiera visita prioritaria.",
  },
  academias: {
    title: "Academias",
    fields: ["Materia", "Nivel", "Objetivo", "Modalidad", "Disponibilidad"],
    problem: "Evita respuestas genéricas y ayuda a proponer una clase que encaje con el alumno y su horario.",
    example: "Busco apoyo de matemáticas para 4.º de ESO y puedo asistir dos tardes por semana.",
    response: "Revisaremos materia, nivel y disponibilidad para proponerte la opción que mejor encaje.",
    followUp: "Confirmar horario, modalidad y fecha de inicio preferida.",
  },
};

const EDIT_FIELD_LABELS = {
  name: "nombre",
  email: "email",
  phone: "teléfono",
  service: "servicio",
  description: "necesidad",
  budget: "presupuesto",
  urgency: "urgencia",
  status: "estado",
};

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(baseDate, days) {
  const date = new Date(`${baseDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function todayIso() {
  return toIsoDate(new Date());
}

function formatDate(dateIso) {
  if (!dateIso) {
    return document.documentElement.lang === "en" ? "No date" : "Sin fecha";
  }

  return new Intl.DateTimeFormat(document.documentElement.lang === "en" ? "en-GB" : "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    }).format(new Date(`${dateIso}T12:00:00`));
}

function createActivity(date, label, detail, type = "note") {
  return {
    date,
    type,
    label,
    detail,
  };
}

function createDefaultFollowUpDate(request, baseDate = request.createdAt || todayIso()) {
  const plan = createFollowUpPlan(request);
  return addDaysIso(baseDate, plan.hours / 24);
}

const demoRequests = [
  {
    id: createId(),
    name: "Marta López",
    email: "marta.lopez@example.com",
    phone: "+34 612 345 678",
    service: "Reformas",
    description:
      "Quiere reformar un baño pequeño, cambiar plato de ducha, mueble y revisar humedades en una pared.",
    budget: "1.000 - 3.000 EUR",
    urgency: "Este mes",
    status: "Nuevo",
    origin: "Formulario",
    reference: "SOL-001",
    createdAt: addDaysIso(todayIso(), -1),
    attachments: [
      {
        name: "baño-humedad-demo.jpg",
        type: "image/jpeg",
        size: 184000,
      },
    ],
  },
  {
    id: createId(),
    name: "Javier Ruiz",
    email: "javier.ruiz@example.com",
    phone: "",
    service: "Electricidad",
    description:
      "Necesita revisar el cuadro eléctrico de un local y preparar enchufes nuevos para una zona de trabajo.",
    budget: "300 - 1.000 EUR",
    urgency: "Esta semana",
    status: "En preparación",
    origin: "WhatsApp",
    reference: "SOL-002",
    createdAt: addDaysIso(todayIso(), -2),
    attachments: [],
  },
  {
    id: createId(),
    name: "Clínica Alba",
    email: "recepcion@clinicaalba.example.com",
    phone: "+34 910 000 111",
    service: "Clínica",
    description:
      "Solicitan información para automatizar recordatorios de citas y seguimiento de pacientes que no confirman.",
    budget: "No lo sabe todavía",
    urgency: "Sin prisa",
    status: "Seguimiento pendiente",
    origin: "Llamada",
    reference: "SOL-003",
    createdAt: addDaysIso(todayIso(), -4),
    attachments: [],
  },
  {
    id: createId(),
    name: "Academia Norte",
    email: "hola@academianorte.example.com",
    phone: "+34 611 220 330",
    service: "Academia",
    description: "Necesitan organizar solicitudes de clases de refuerzo para secundaria y responder mejor a las familias interesadas.",
    budget: "300 - 1.000 EUR",
    urgency: "Este mes",
    status: "Enviado",
    origin: "Email",
    reference: "SOL-004",
    createdAt: addDaysIso(todayIso(), -5),
    attachments: [],
  },
  {
    id: createId(),
    name: "Taller Ronda",
    email: "recepcion@tallerronda.example.com",
    phone: "+34 633 101 202",
    service: "Taller",
    description: "Quieren ordenar consultas de revisiones y averías de vehículos que ahora llegan por llamadas y WhatsApp.",
    budget: "1.000 - 3.000 EUR",
    urgency: "Esta semana",
    status: "Ganado",
    origin: "Formulario",
    reference: "SOL-005",
    createdAt: addDaysIso(todayIso(), -6),
    attachments: [],
  },
  {
    id: createId(),
    name: "Cristalería Costa",
    email: "presupuestos@cristaleriacosta.example.com",
    phone: "",
    service: "Cristalería",
    description: "Solicitan una valoración para mejorar la entrada de presupuestos de cristales a medida y cambios de ventanas.",
    budget: "No lo sabe todavía",
    urgency: "Sin prisa",
    status: "Perdido",
    origin: "WhatsApp",
    reference: "SOL-006",
    createdAt: addDaysIso(todayIso(), -8),
    attachments: [],
  },
  {
    id: createId(),
    name: "Carpintería Roble",
    email: "contacto@carpinteriaroble.example.com",
    phone: "+34 644 450 550",
    service: "Carpintería",
    description: "Quieren recibir fotos, medidas y disponibilidad antes de responder a peticiones de muebles a medida.",
    budget: "300 - 1.000 EUR",
    urgency: "Esta semana",
    status: "En preparación",
    origin: "Llamada",
    reference: "SOL-007",
    createdAt: addDaysIso(todayIso(), -3),
    attachments: [],
  },
];

demoRequests.forEach((request) => {
  request.nextFollowUpDate = createDefaultFollowUpDate(request);
  request.followUpRuleVersion = FOLLOW_UP_RULE_VERSION;
  request.activityHistory = [
    createActivity(
      request.createdAt,
      "Solicitud creada",
      "Entrada de ejemplo disponible en el panel demo.",
      "created"
    ),
  ];
});

function getDemoRequests() {
  return getSectorRequestSeeds(activeSector).map((request) => ({
    ...request,
    attachments: request.attachments.map((attachment) => ({ ...attachment })),
    customAnswers: { ...request.customAnswers },
    activityHistory: request.activityHistory.map((activity) => ({ ...activity })),
  }));
}

let requests = isRealProductMode ? [] : loadRequests();
let selectedRequestId = getDefaultSelectedRequestId();
let selectedClientKey = null;
let followUpStateFilter = "pending";
let localTableView = "summary";
let currentView = "dashboard";
let detailReturnView = "solicitudes";
let viewHistory = [];

const form = document.querySelector("#request-form");
const requestsList = document.querySelector("#requests-list");
const requestCount = document.querySelector("#request-count");
const formNote = document.querySelector("#form-note");
const formTitle = document.querySelector("#form-title");
const formDescription = document.querySelector("#form-description");
const sectorFormFields = document.querySelector("#sector-form-fields");
const sectorFormSubmit = document.querySelector("#sector-form-submit");
const supabaseDevFormNotice = document.querySelector("#supabase-dev-form-notice");
const statusFilter = document.querySelector("#status-filter");
const serviceFilter = document.querySelector("#service-filter");
const requestSearch = document.querySelector("#request-search");
const statusSummary = document.querySelector("#status-summary");
const followUpList = document.querySelector("#follow-up-list");
const followUpCount = document.querySelector("#follow-up-count");
const followUpFilterControls = document.querySelector("#follow-up-state-filter");
const copyShareLinkButton = document.querySelector("#copy-share-link");
const shareLink = document.querySelector("#share-link");
const shareLinkNote = document.querySelector("#share-link-note");
const requestDetailDialog = document.querySelector("#request-detail-dialog");
const requestDetailContent = document.querySelector("#request-detail-content");
const requestDetailViewContent = document.querySelector("#request-detail-view-content");
const resetDemoButtons = Array.from(document.querySelectorAll("[data-action='reset-demo']"));
const resetDemoNote = document.querySelector("#reset-demo-note");
const appViews = Array.from(document.querySelectorAll("[data-view]"));
const viewButtons = Array.from(document.querySelectorAll("[data-view-target]"));
const detailNavigationButtons = Array.from(document.querySelectorAll("[data-detail-tab-target]"));
const technicalNavigationButtons = Array.from(document.querySelectorAll("[data-doc-target]"));
const navGroups = Array.from(document.querySelectorAll(".app-nav-group"));
const viewTitle = document.querySelector("#view-title");
const viewKicker = document.querySelector("#view-kicker");
const appBackButton = document.querySelector("#app-back-button");
const mobileMenuToggle = document.querySelector("#mobile-menu-toggle");
const appSidebar = document.querySelector("#app-sidebar");
const sidebarScrim = document.querySelector("#sidebar-scrim");
const followUpSummaryCount = document.querySelector("#follow-up-summary-count");
const clientEmailPreview = document.querySelector("#client-email-preview");
const businessEmailPreview = document.querySelector("#business-email-preview");
const localTableBody = document.querySelector("#local-table-body");
const localTableWrap = document.querySelector("#local-table-wrap");
const localTableLetters = document.querySelector("#local-table-letters");
const localTableHead = document.querySelector("#local-table-head");
const localTableSearch = document.querySelector("#local-table-search");
const localTableStatusFilter = document.querySelector("#local-table-status-filter");
const localTableServiceFilter = document.querySelector("#local-table-service-filter");
const localTableSaveStatus = document.querySelector("#local-table-save-status");
const selectedRequestContext = document.querySelector("#selected-request-context");
const selectedRequestNav = document.querySelector("#selected-request-nav");
const selectedRequestNavLabel = document.querySelector("#selected-request-nav-label");
const selectedRequestStatus = document.querySelector("#selected-request-status");
const selectedRequestNextAction = document.querySelector("#selected-request-next-action");
const dashboardMetrics = document.querySelector("#dashboard-metrics");
const dashboardAlerts = document.querySelector("#dashboard-alerts");
const dashboardNextAction = document.querySelector("#dashboard-next-action");
const clientsList = document.querySelector("#clients-list");
const clientProfile = document.querySelector("#client-profile");
const clientReceipt = document.querySelector("#client-receipt");
const sectorPreview = document.querySelector("#sector-preview");
const appShell = document.querySelector(".app-shell");
const sectorSelector = document.querySelector("#sector-selector");
const sectorSelectorNotice = document.querySelector("#sector-selector-notice");

const VIEW_META = {
  dashboard: { title: "Inicio", kicker: "Trabajo de hoy" },
  solicitudes: { title: "Solicitudes", kicker: "Panel interno" },
  clientes: { title: "Contactos", kicker: "Contactos" },
  "acceso-cliente": { title: "Acceso del cliente", kicker: "Formulario público" },
  "recorrido-demo": { title: "Recorrido de demo", kicker: "Solicitud protagonista" },
  "formulario-publico": { title: "Formulario público", kicker: "Acceso del cliente" },
  formulario: { title: "Formulario del cliente", kicker: "Entrada de solicitud" },
  "solicitud-recibida": { title: "Solicitud recibida", kicker: "Vista cliente" },
  "detalle-solicitud": { title: "Detalle de solicitud", kicker: "Solicitud seleccionada" },
  seguimientos: { title: "Seguimientos", kicker: "Seguimiento comercial" },
  "estados-comerciales": { title: "Estados comerciales", kicker: "Panel interno" },
  "email-negocio": { title: "Emails automáticos simulados", kicker: "Automatización simulada" },
  "tabla-local": { title: "Tabla interna", kicker: "Datos locales" },
  "google-sheets-futuro": { title: "Google Sheets futuro", kicker: "Opción futura" },
  "panel-futuro": { title: "Panel interno futuro", kicker: "Opción futura" },
  sectores: { title: "Personalización por sector", kicker: "Configuración demo" },
  "campos-formulario": { title: "Campos del formulario", kicker: "Configuración demo" },
  "documentacion-tecnica": { title: "Información de la demo", kicker: "Zona secundaria" },
};

let activeDetailContainer = requestDetailViewContent;
const DETAIL_TABS = ["solicitud", "resumen", "respuesta", "seguimiento", "actividad"];
const LOCAL_TABLE_COLUMNS = {
  summary: [
    { key: "reference", label: "Referencia" },
    { key: "name", label: "Cliente" },
    { key: "service", label: "Servicio" },
    { key: "status", label: "Estado" },
    { key: "nextFollowUp", label: "Próxima acción" },
    { key: "nextFollowUpDate", label: "Fecha próxima acción" },
    { key: "action", label: "Acción" },
  ],
  complete: [
    { key: "reference", label: "Referencia" },
    { key: "name", label: "Cliente" },
    { key: "contact", label: "Contacto" },
    { key: "service", label: "Servicio" },
    { key: "origin", label: "Origen" },
    { key: "urgency", label: "Urgencia" },
    { key: "status", label: "Estado" },
    { key: "createdAt", label: "Entrada" },
    { key: "nextFollowUp", label: "Próxima acción" },
    { key: "nextFollowUpDate", label: "Fecha próxima acción" },
    { key: "internalNote", label: "Nota interna" },
    { key: "action", label: "Acción" },
  ],
};

function loadRequests() {
  if (!activeSector || !STORAGE_KEY) {
    return [];
  }

  try {
    const storedRequests = window.localStorage.getItem(STORAGE_KEY);

    if (!storedRequests) {
      return getDemoRequests();
    }

    const parsedRequests = JSON.parse(storedRequests);

    if (!Array.isArray(parsedRequests)) {
      return getDemoRequests();
    }

    const sectorRequests = parsedRequests.filter(
      (request) => request && request.sector === activeSector
    );
    const normalizedRequests = sectorRequests.length
      ? sectorRequests.map(normalizeRequest)
      : getDemoRequests();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedRequests));
    return normalizedRequests;
  } catch {
    return getDemoRequests();
  }
}

function normalizeRequest(request) {
  const normalizedRequest = {
    ...request,
    sector: activeSector,
    status: normalizeStatus(request.status),
    service: normalizeService(request.service),
    origin: request.origin || "Formulario",
    reference: request.reference || `SOL-${String(request.id || "000").slice(-5).toUpperCase()}`,
    createdAt: request.createdAt || todayIso(),
    attachments: Array.isArray(request.attachments) ? request.attachments : [],
    activityHistory: normalizeActivityHistory(request),
  };

  return {
    ...normalizedRequest,
    nextFollowUpDate:
      request.followUpRuleVersion === FOLLOW_UP_RULE_VERSION &&
      request.nextFollowUpDate
        ? request.nextFollowUpDate
        : createDefaultFollowUpDate(normalizedRequest),
    followUpRuleVersion: FOLLOW_UP_RULE_VERSION,
  };
}

function normalizeStatus(status) {
  const legacyStatuses = {
    Revisado: "En preparación",
    Pendiente: "Seguimiento pendiente",
    "Falta información": "En preparación",
    "Falta informacion": "En preparación",
    "En preparacion": "En preparación",
    "Presupuesto enviado": "Enviado",
    Aceptado: "Ganado",
    "Cerrado sin éxito": "Perdido",
    "Cerrado sin exito": "Perdido",
  };

  return legacyStatuses[status] || (STATUSES.includes(status) ? status : "Nuevo");
}

function normalizeService(service) {
  const legacyServices = {
    Fontaneria: "Fontanería",
    Cristaleria: "Cristalería",
    Carpinteria: "Carpintería",
    Clinica: "Clínica",
    Peluqueria: "Peluquería",
  };

  return legacyServices[service] || service || "Reformas";
}

function normalizeActivityHistory(request) {
  if (Array.isArray(request.activityHistory) && request.activityHistory.length) {
    return request.activityHistory.map((activity) =>
      createActivity(
        activity.date || request.createdAt || todayIso(),
        activity.label || "Actividad registrada",
        activity.detail || "",
        activity.type || "note"
      )
    );
  }

  return [
    createActivity(
      request.createdAt || todayIso(),
      "Solicitud creada",
      "Registro inicial importado en la demo local.",
      "created"
    ),
  ];
}

function addActivity(request, label, detail, type = "note") {
  request.activityHistory = [
    createActivity(todayIso(), label, detail, type),
    ...(Array.isArray(request.activityHistory) ? request.activityHistory : []),
  ].slice(0, 8);
}

function getEditedFieldLabels(request, values) {
  return Object.keys(EDIT_FIELD_LABELS).filter(
    (field) => String(request[field] || "") !== String(values[field] || "")
  );
}

function saveRequests() {
  if (isRealProductMode) return;
  if (!STORAGE_KEY) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch {
    formNote.textContent =
      "Solicitud actualizada, pero el navegador no pudo guardarla de forma persistente.";
  }
}

function closeMobileMenu() {
  appSidebar.classList.remove("is-open");
  sidebarScrim.classList.remove("is-visible");
  mobileMenuToggle.setAttribute("aria-expanded", "false");
}

function updateAppBackButton() {
  if (!appBackButton) {
    return;
  }

  const targetView = viewHistory.at(-1) || "dashboard";
  const isHome = currentView === "dashboard";
  const label = getBackButtonLabel(targetView);

  appBackButton.hidden = isHome;
  appBackButton.disabled = isHome;
  appBackButton.textContent = label;
  appBackButton.setAttribute("aria-label", label);
}

function getBackButtonLabel(viewName) {
  if (viewName === "formulario") {
    return "← Volver al formulario";
  }

  const labels = {
    dashboard: "Inicio",
    solicitudes: "Solicitudes",
    seguimientos: "Seguimientos",
    clientes: "Contactos",
    "tabla-local": "Tabla interna",
    formulario: "el formulario",
    "acceso-cliente": "Acceso del cliente",
  };
  const label = labels[viewName] || VIEW_META[viewName]?.title;

  return label ? `← Volver a ${label}` : "← Volver";
}

function showPreviousView() {
  if (isRealProductMode) return window.RealProductDemo?.navigate("solicitudes");
  const targetView = viewHistory.pop() || "dashboard";
  showView(targetView, null, { recordHistory: false });
}

function showView(viewName, sourceButton = null, options = {}) {
  if (isRealProductMode) return window.RealProductDemo?.navigate(viewName, sourceButton);
  const viewMeta = VIEW_META[viewName];

  if (!viewMeta) {
    return;
  }

  const recordHistory = options.recordHistory !== false;
  if (recordHistory && currentView !== viewName) {
    if (viewName === "dashboard") {
      viewHistory = [];
    } else {
      viewHistory = [...viewHistory, currentView].slice(-12);
    }
  }

  appViews.forEach((view) => {
    const isActive = view.dataset.view === viewName;
    view.hidden = !isActive;
    view.classList.toggle("is-active", isActive);
  });

  const activeNavButton = sourceButton?.closest(".app-nav-group")
    ? sourceButton
    : null;

  viewButtons.forEach((button) => {
    const isActive = activeNavButton
      ? button === activeNavButton
      : button.dataset.viewTarget === viewName;
    button.classList.toggle("is-active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const activeGroup = (activeNavButton || viewButtons.find(
    (button) => button.dataset.viewTarget === viewName
  ))?.closest(".app-nav-group");

  if (activeGroup) {
    activeGroup.open = true;
  }

  viewTitle.textContent = viewMeta.title;
  viewKicker.textContent = viewMeta.kicker;
  currentView = viewName;
  updateAppBackButton();
  closeMobileMenu();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function resetDemoData() {
  if (isRealProductMode) return;
  if (!STORAGE_KEY) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    if (resetDemoNote) {
      resetDemoNote.textContent =
        "No se pudo limpiar el guardado local, pero puedes recargar la página.";
    }
    return;
  }

  requests = getDemoRequests();
  selectedRequestId = getDefaultSelectedRequestId();
  selectedClientKey = null;
  form.reset();
  selectedPublicFiles = [];
  document.querySelector("#attachment-preview")?.replaceChildren();
  formNote.textContent = "";
  statusFilter.value = "Todos";
  serviceFilter.value = "Todos";
  requestSearch.value = "";
  localTableSearch.value = "";
  localTableStatusFilter.value = "Todos";
  localTableServiceFilter.value = "Todos";
  localTableView = "summary";

  if (requestDetailDialog.open) {
    requestDetailDialog.close();
  }

  viewHistory = [];
  showView("dashboard", null, { recordHistory: false });
  renderRequests();

  if (resetDemoNote) {
    resetDemoNote.textContent = `Demo reiniciada: se restauraron las ${requests.length} solicitudes de ejemplo en este navegador.`;
  }
}

function getActiveFormConfig() {
  return getSectorFormConfig(activeSector);
}

function getFormFieldConfig(fieldName) {
  return getActiveFormConfig()?.fields.find((field) => field.name === fieldName) || null;
}

function getFieldErrorId(fieldName) {
  return `form-${fieldName}-error`;
}

function setFieldError(field, message) {
  const errorElement = document.querySelector(`#${getFieldErrorId(field.name)}`);

  field.setAttribute("aria-invalid", message ? "true" : "false");

  if (errorElement) {
    errorElement.textContent = message;
  }
}

function validateField(field) {
  const fieldConfig = getFormFieldConfig(field.name);

  if (!fieldConfig) {
    return true;
  }

  const value = String(field.value || "").trim();
  let message = "";

  if (fieldConfig.type === "file") {
    message = validateAttachmentSelection(selectedPublicFiles);
  } else if (fieldConfig.required && !value) {
    message = `Indica ${fieldConfig.label.toLowerCase()}.`;
  } else if (fieldConfig.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    message = "Escribe un correo válido, por ejemplo cliente@email.com.";
  } else if (fieldConfig.type === "tel" && value && !/^[0-9+() .-]{7,20}$/.test(value)) {
    message = "Usa solo números, espacios, +, guiones o paréntesis.";
  } else if (fieldConfig.minLength && value.length < fieldConfig.minLength) {
    message = `Añade al menos ${fieldConfig.minLength} caracteres.`;
  }

  setFieldError(field, message);
  return !message;
}

function validateRequestForm() {
  const formConfig = getActiveFormConfig();

  if (!formConfig) {
    return false;
  }

  const fields = formConfig.fields
    .map((fieldConfig) => form.elements[fieldConfig.name])
    .filter(Boolean);
  const isValid = fields.map(validateField).every(Boolean);

  if (!isValid) {
    const firstInvalidField = fields.find(
      (field) => field.getAttribute("aria-invalid") === "true"
    );

    formNote.textContent =
      "Revisa los campos marcados antes de continuar.";

    if (firstInvalidField) {
      firstInvalidField.focus();
    }
  }

  return isValid;
}

function renderSectorFormField(field) {
  const errorId = getFieldErrorId(field.name);
  const helpId = field.help ? `form-${field.name}-help` : "";
  const describedBy = [helpId, errorId].filter(Boolean).join(" ");
  const required = field.required ? " required" : "";
  const fullWidthClass = field.fullWidth ? " full-width" : "";
  const helpMarkup = field.help
    ? `<small class="field-help" id="${helpId}">${escapeHtml(field.help)}</small>`
    : "";
  const errorMarkup = `<span class="field-error" id="${errorId}"></span>`;

  if (field.type === "select") {
    return `
      <label class="${fullWidthClass.trim()}">
        ${escapeHtml(field.label)}
        <select name="${field.name}" aria-describedby="${describedBy}"${required}>
          <option value="">Selecciona una opción</option>
          ${field.options
            .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
            .join("")}
        </select>
        ${helpMarkup}
        ${errorMarkup}
      </label>
    `;
  }

  if (field.type === "textarea") {
    return `
      <label class="${fullWidthClass.trim()}">
        ${escapeHtml(field.label)}
        <textarea name="${field.name}" rows="5" placeholder="${escapeHtml(field.placeholder || "")}" aria-describedby="${describedBy}"${required}></textarea>
        ${helpMarkup}
        ${errorMarkup}
      </label>
    `;
  }

  if (field.type === "file") {
    return `
      <div class="attachment-field${fullWidthClass}">
        <label for="attachments">${escapeHtml(field.label)}</label>
        <input type="file" name="${field.name}" id="attachments" accept="${escapeHtml(field.accept || "image/*")}"${field.multiple ? " multiple" : ""} aria-describedby="${describedBy}" />
        ${helpMarkup}${errorMarkup}
        <div class="attachment-preview" id="attachment-preview" aria-live="polite"></div>
      </div>
    `;
  }

  return `
    <label class="${fullWidthClass.trim()}">
      ${escapeHtml(field.label)}
      <input type="${field.type}" name="${field.name}" placeholder="${escapeHtml(field.placeholder || "")}" aria-describedby="${describedBy}"${required} />
      ${helpMarkup}
      ${errorMarkup}
    </label>
  `;
}

function renderSectorForm() {
  const formConfig = getActiveFormConfig();

  if (!formConfig || !sectorFormFields) {
    return;
  }

  formTitle.textContent = formConfig.title;
  formDescription.textContent = formConfig.description;
  sectorFormSubmit.textContent = formConfig.submitLabel;
  sectorFormSubmit.disabled = false;
  selectedPublicFiles = [];
  sectorFormFields.innerHTML = formConfig.fields.map(renderSectorFormField).join("");
  formNote.textContent = "";

  if (!isSupabaseDevSubmissionMode) {
    supabaseDevFormNotice.hidden = true;
    return;
  }

  supabaseDevFormNotice.hidden = false;

  if (SUPABASE_DEV_FORM_CONFIGS[activeSector]) {
    supabaseDevFormNotice.textContent =
      "Modo desarrollo · Envío a Supabase dev · Datos ficticios";
    sectorFormSubmit.textContent = "Enviar solicitud a Supabase dev";
    return;
  }

  supabaseDevFormNotice.textContent = getSupabaseDevUnavailableSectorMessage();
  sectorFormSubmit.disabled = true;
}

function getSupabaseDevUnavailableSectorMessage() {
  return "Este sector aún no está conectado en C6.";
}

function getSupabaseDevSubmissionConfig() {
  if (!isSupabaseDevSubmissionMode) {
    return null;
  }

  return SUPABASE_DEV_FORM_CONFIGS[activeSector] || null;
}

function createSupabaseDevIdempotencyKey() {
  const uniquePart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `demo-sectorial-dev-${uniquePart}`;
}

function setSupabaseDevSubmissionBusy(isBusy) {
  sectorFormSubmit.disabled = isBusy;
  sectorFormSubmit.textContent = isBusy
    ? "Guardando solicitud de prueba..."
    : "Enviar solicitud a Supabase dev";
}

function createSupabaseDevPayload(formValues, config) {
  const answers = Object.fromEntries(
    Object.entries(config.answerFields)
      .map(([localKey, fieldKey]) => [fieldKey, formValues[localKey]])
      .filter(([, value]) => typeof value === "string" && value.trim())
  );

  return {
    contact: {
      display_name: formValues.name?.trim(),
      email: formValues.email?.trim(),
      phone: formValues.phone?.trim(),
    },
    answers,
    metadata: {
      source: "sector_demo_dev",
      sector: activeSector,
    },
    privacy_notice_version: "demo-sectorial-dev-2026-09",
  };
}

function renderSupabaseDevReceipt(submission, config, attachmentItems = []) {
  clientReceipt.innerHTML = `
    <p class="section-kicker">Modo desarrollo · Supabase dev</p>
    <span class="client-receipt-status">Guardada para pruebas</span>
    <h2 id="client-receipt-title">Solicitud recibida</h2>
    <p>${escapeHtml(submission.message || "Hemos recibido tu solicitud.")}</p>
    <div class="client-receipt-details">
      <span><strong>Referencia:</strong> ${escapeHtml(submission.reference || "Pendiente")}</span>
      <span><strong>Sector:</strong> ${escapeHtml(getSectorPreset(activeSector)?.label || activeSector)}</span>
      <span><strong>Formulario:</strong> ${escapeHtml(config.formSlug)}</span>
    </div>
    <div class="public-attachment-upload" id="public-attachment-upload-status" aria-live="polite"></div>
    <p class="simulation-notice">Solicitud guardada en Supabase dev con datos ficticios. No se ha enviado ningún email ni se ha activado ninguna automatización.</p>
  `;

  renderAttachmentUploadStatus(attachmentItems);
}

function getAttachmentStatusLabel(status) {
  return {
    pending: "Pendiente",
    uploading: "Subiendo...",
    success: "Enviado",
    error: "No se pudo subir",
  }[status] || "Pendiente";
}

function renderAttachmentUploadStatus(items) {
  const container = document.querySelector("#public-attachment-upload-status");

  if (!container || !items.length) {
    return;
  }

  const failedCount = items.filter((item) => item.status === "error").length;
  const pendingCount = items.filter((item) => ["pending", "uploading"].includes(item.status)).length;
  const allSuccessful = items.every((item) => item.status === "success");
  const summary = allSuccessful
    ? "Solicitud y archivos enviados correctamente."
    : failedCount && !pendingCount
      ? "Tu solicitud se ha enviado correctamente, pero no se pudieron subir algunos archivos."
      : "Tu solicitud ya está guardada. Estamos enviando los archivos.";

  container.innerHTML = `
    <p class="public-attachment-upload-summary">${summary}</p>
    <ul class="public-attachment-upload-list">
      ${items.map((item) => `
        <li data-status="${item.status}">
          <span class="public-attachment-upload-name">${escapeHtml(item.file.name)}</span>
          <span class="public-attachment-upload-state">${getAttachmentStatusLabel(item.status)}</span>
        </li>
      `).join("")}
    </ul>
    ${failedCount && !pendingCount ? '<button class="button button-secondary public-attachment-retry" type="button" data-action="retry-public-attachments">Reintentar archivos fallidos</button>' : ""}
  `;
}

async function submitSectorFormToSupabaseDev(formValues) {
  const config = getSupabaseDevSubmissionConfig();

  if (!config) {
    formNote.textContent = getSupabaseDevUnavailableSectorMessage();
    return;
  }

  const payload = createSupabaseDevPayload(formValues, config);
  const filesToUpload = [...selectedPublicFiles];
  const payloadFingerprint = JSON.stringify(payload);
  const canReplayActiveSubmission =
    activeSupabaseDevSubmission?.sector === activeSector &&
    activeSupabaseDevSubmission?.payloadFingerprint === payloadFingerprint;
  const idempotencyKey = canReplayActiveSubmission
    ? activeSupabaseDevSubmission.key
    : createSupabaseDevIdempotencyKey();

  activeSupabaseDevSubmission = {
    key: idempotencyKey,
    sector: activeSector,
    payloadFingerprint,
  };
  setSupabaseDevSubmissionBusy(true);
  formNote.textContent = "";

  try {
    const response = await fetch(
      `${SUPABASE_DEV_SUBMISSION_ENDPOINT}/${encodeURIComponent(config.businessSlug)}/${encodeURIComponent(config.formSlug)}/requests`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: payloadFingerprint,
      }
    );
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      formNote.textContent =
        response.status === 429
          ? "Hay demasiados intentos de prueba. Espera un momento antes de volver a enviarla."
          : "No se pudo guardar la solicitud de prueba. Revisa los datos e inténtalo de nuevo.";
      return;
    }

    activeSupabaseDevSubmission = null;
    form.reset();
    selectedPublicFiles = [];
    document.querySelector("#attachment-preview")?.replaceChildren();
    formNote.textContent = "Solicitud guardada en Supabase dev.";
    const attachmentItems = createAttachmentItems(filesToUpload);
    renderSupabaseDevReceipt(responseBody, config, attachmentItems);
    showView("solicitud-recibida");

    if (attachmentItems.length) {
      const uploadContext = {
        endpoint: SUPABASE_DEV_SUBMISSION_ENDPOINT,
        businessSlug: config.businessSlug,
        formSlug: config.formSlug,
        reference: responseBody.reference,
        idempotencyKey,
        fetchImpl: window.fetch.bind(window),
        onStatusChange: renderAttachmentUploadStatus,
      };

      if (!responseBody.reference) {
        attachmentItems.forEach((item) => {
          item.status = "error";
          item.error = "No se pudo subir este archivo.";
        });
        renderAttachmentUploadStatus(attachmentItems);
        activeAttachmentRetryContext = null;
        return;
      }

      activeAttachmentRetryContext = { items: attachmentItems, uploadContext };
      await uploadAttachmentsSequentially(attachmentItems, uploadContext);

      if (attachmentItems.every((item) => item.status === "success")) {
        activeAttachmentRetryContext = null;
      }
    }
  } catch {
    formNote.textContent = "No se pudo conectar con Supabase dev. Inténtalo de nuevo.";
  } finally {
    setSupabaseDevSubmissionBusy(false);
  }
}

function createInternalSummary(request, sectorExperience = getSectorExperience(request.sector, request)) {
  if (sectorExperience) {
    return sectorExperience.internalSummary;
  }

  const phoneText = request.phone ? "con teléfono disponible" : "sin teléfono informado";
  const attachmentText =
    request.attachments && request.attachments.length
      ? ` | Adjuntos: ${request.attachments.length} imagen(es) para revisar.`
      : "";
  return `${request.service} | ${request.urgency} | Presupuesto: ${request.budget} | Cliente ${phoneText}.${attachmentText} Revisar detalles y confirmar alcance antes de preparar presupuesto final.`;
}

function getServiceReplyDetails(service) {
  const templates = {
    Reformas: {
      context: "revisar medidas, estado actual y alcance de la reforma",
      questions: [
        "medidas aproximadas del espacio",
        "fotos del estado actual",
        "fecha ideal para la visita",
      ],
    },
    "Fontanería": {
      context: "entender el origen del problema y si hay riesgo de fuga",
      questions: [
        "zona afectada",
        "desde cuando ocurre",
        "si puedes cerrar la llave de paso",
      ],
    },
    Electricidad: {
      context: "valorar seguridad, potencia y puntos eléctricos necesarios",
      questions: [
        "tipo de instalación",
        "fotos del cuadro o zona afectada",
        "horario disponible para revisar",
      ],
    },
    "Clínica": {
      context: "entender el servicio solicitado y coordinar disponibilidad",
      questions: [
        "motivo principal de la consulta",
        "franja horaria preferida",
        "si es primera visita o seguimiento",
      ],
    },
    "Peluquería": {
      context: "confirmar servicio, duración aproximada y disponibilidad",
      questions: [
        "servicio exacto",
        "largo o estado actual",
        "día y hora preferidos",
      ],
    },
    Academia: {
      context: "entender objetivo, nivel y disponibilidad del alumno",
      questions: [
        "nivel actual",
        "objetivo principal",
        "días disponibles para clase",
      ],
    },
    "Entrenador personal": {
      context: "preparar una primera orientación según objetivo y disponibilidad",
      questions: [
        "objetivo principal",
        "experiencia previa",
        "días disponibles para entrenar",
      ],
    },
    "Comercio local": {
      context: "confirmar producto, cantidad y plazo de entrega o recogida",
      questions: [
        "producto concreto",
        "cantidad aproximada",
        "fecha en la que lo necesitas",
      ],
    },
  };

  return (
    templates[service] || {
      context: "entender mejor la necesidad antes de preparar una propuesta",
      questions: [
        "datos clave del servicio",
        "plazo deseado",
        "cualquier condicion importante",
      ],
    }
  );
}

function getSuggestedQuestions(request, sectorExperience = getSectorExperience(request.sector, request)) {
  if (sectorExperience) {
    return sectorExperience.suggestedQuestions;
  }

  const serviceDetails = getServiceReplyDetails(request.service);
  const questions = [...serviceDetails.questions];

  if (request.attachments && request.attachments.length) {
    questions.push("confirmar si las fotos muestran todo lo importante");
  }

  return questions.slice(0, 4);
}

function createSuggestedResponse(request, sectorExperience = getSectorExperience(request.sector, request)) {
  if (sectorExperience) {
    return sectorExperience.suggestedResponse;
  }

  const serviceDetails = getServiceReplyDetails(request.service);
  const suggestedQuestions = getSuggestedQuestions(request).join(", ");

  return `Hola ${request.name}, gracias por contactar con nosotros. Hemos recibido tu solicitud sobre ${request.service.toLowerCase()} y la vamos a revisar. Por lo que nos indicas: "${request.description}", el primer paso será ${serviceDetails.context}. Para poder orientarte mejor, necesitaríamos confirmar: ${suggestedQuestions}. Con esos datos podremos prepararte una primera estimación y decirte el siguiente paso.`;
}

function createPreparedMessage(request, channel = "general") {
  const enrichedRequest = enrichRequest(request);

  if (channel === "email") {
    return [
      `Asunto: Hemos recibido tu solicitud sobre ${enrichedRequest.service}`,
      "",
      enrichedRequest.suggestedResponse,
      "",
      `Datos de referencia: urgencia ${enrichedRequest.urgency}, presupuesto ${enrichedRequest.budget}.`,
    ].join("\n");
  }

  if (channel === "whatsapp") {
    return `${enrichedRequest.suggestedResponse}\n\nReferencia: ${enrichedRequest.service} | ${enrichedRequest.urgency}`;
  }

  return enrichedRequest.suggestedResponse;
}

function createNextFollowUp(request) {
  return getSectorExperience(request.sector, request)?.nextAction || createFollowUpPlan(request).action;
}

function enrichRequest(request) {
  const followUpPlan = createFollowUpPlan(request);
  const sectorExperience = getSectorExperience(request.sector, request);

  return {
    ...request,
    internalSummary: createInternalSummary(request, sectorExperience),
    suggestedResponse: createSuggestedResponse(request, sectorExperience),
    suggestedQuestions: getSuggestedQuestions(request, sectorExperience),
    sectorEmailCopy: sectorExperience?.emailCopy || null,
    nextFollowUp: request.nextFollowUp || sectorExperience?.nextAction || createNextFollowUp(request),
    followUpCadence: followUpPlan.label,
    dataPendingLabels: getDataPendingLabels(request, sectorExperience),
    sectorTags: sectorExperience?.sectorTags || [],
    sectorDataTitle: sectorExperience?.detailTitle || "Datos del servicio",
    sectorDataFields: sectorExperience?.detailFields || [],
    formattedCreatedAt: formatDate(request.createdAt),
    formattedNextFollowUpDate: formatDate(request.nextFollowUpDate),
  };
}

function getDataPendingLabels(request, sectorExperience = getSectorExperience(request.sector, request)) {
  if (sectorExperience) {
    return sectorExperience.dataPendingLabels;
  }

  const labels = [];
  const service = normalizeSearchText(request.service);
  const attachments = Array.isArray(request.attachments) ? request.attachments : [];

  if (!request.phone) labels.push("Sin teléfono");
  if (request.budget === "No lo sabe todavía") labels.push("Rango por confirmar");
  if (["reformas", "electricidad", "fontaneria", "cristaleria", "carpinteria"].includes(service) && !attachments.length) {
    labels.push("Foto pendiente");
  }
  if (request.status === "En preparación" && !labels.length) labels.push("Datos por confirmar");

  return labels;
}

function renderSectorPreview(sectorKey = activeSector || "reformas") {
  if (!sectorPreview) return;

  const sector = SECTOR_PREVIEWS[sectorKey] || SECTOR_PREVIEWS.reformas;
  sectorPreview.innerHTML = `
    <article class="sector-preview-card">
      <div>
        <p class="section-kicker">${escapeHtml(sector.title)}</p>
        <h3>Datos que conviene pedir</h3>
        <div class="sector-preview-fields">${sector.fields.map((field) => `<span>${escapeHtml(field)}</span>`).join("")}</div>
        <p><strong>Qué resuelve:</strong> ${escapeHtml(sector.problem)}</p>
      </div>
      <div class="sector-preview-example">
        <h3>Ejemplo de solicitud</h3>
        <p>${escapeHtml(sector.example)}</p>
        <h3>Respuesta y seguimiento</h3>
        <p>${escapeHtml(sector.response)}</p>
        <p><strong>Próxima acción:</strong> ${escapeHtml(sector.followUp)}</p>
      </div>
    </article>
  `;

  document.querySelectorAll("[data-action='select-sector-preview']").forEach((button) => {
    const isActive = button.dataset.sectorPreview === sectorKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRequestSearchText(request) {
  return normalizeSearchText(
    [
      request.name,
      request.email,
      request.phone,
      request.service,
      request.description,
      request.budget,
      request.urgency,
      request.status,
      getAttachmentSummary(request.attachments),
    ].join(" ")
  );
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

function getAttachmentSummary(attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  if (!safeAttachments.length) {
    return "Sin adjuntos";
  }

  return safeAttachments.map((attachment) => attachment.name).join(" ");
}

function getAttachmentMetadata(fileList) {
  return Array.from(fileList || []).map((file) => ({
    name: file.name,
    type: file.type || "image/*",
    size: file.size,
  }));
}

function renderAttachmentPreview() {
  const attachmentInput = form.elements.attachments;
  const attachmentPreview = document.querySelector("#attachment-preview");

  if (!attachmentInput || !attachmentPreview) {
    return;
  }

  const incomingFiles = Array.from(attachmentInput.files || []);
  const combinedFiles = [...selectedPublicFiles, ...incomingFiles];
  const message = validateAttachmentSelection(combinedFiles);

  if (!message) {
    selectedPublicFiles = combinedFiles;
  }

  setFieldError(attachmentInput, message);
  attachmentInput.value = "";

  attachmentPreview.innerHTML = selectedPublicFiles
    .map(
      (file, index) => `
        <div class="attachment-preview-item">
          <span class="attachment-preview-copy">
            <strong>${escapeHtml(file.name)}</strong>
            <small>${escapeHtml(formatFileSize(file.size))}</small>
          </span>
          <button class="copy-button attachment-remove-button" type="button" data-action="remove-public-attachment" data-index="${index}" aria-label="Eliminar ${escapeHtml(file.name)}">Eliminar</button>
        </div>
      `
    )
    .join("");
}

function renderAttachmentList(attachments) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];

  if (!safeAttachments.length) {
    return "";
  }

  return `
    <div class="request-field request-field-wide">
      <span>Fotos o adjuntos</span>
      <ul class="attachment-list">
        ${safeAttachments
          .map(
            (attachment) => `
              <li>
                <strong>${escapeHtml(attachment.name)}</strong>
                <span>${escapeHtml(formatFileSize(attachment.size))}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    </div>
  `;
}

function getFilteredRequests() {
  const searchTerm = normalizeSearchText(requestSearch.value.trim());

  return requests.filter((request) => {
    const matchesStatus = statusFilter.value === "Todos" || request.status === statusFilter.value;
    const matchesService =
      serviceFilter.value === "Todos" || request.service === serviceFilter.value;
    const matchesSearch =
      !searchTerm || getRequestSearchText(request).includes(searchTerm);

    return matchesStatus && matchesService && matchesSearch;
  });
}

function getStatusCounts() {
  return STATUSES.reduce((counts, status) => {
    counts[status] = requests.filter((request) => request.status === status).length;
    return counts;
  }, {});
}

function getClientKey(request) {
  return normalizeSearchText(request.email || request.name || request.id);
}

function getClientGroups() {
  const groups = new Map();

  requests.forEach((request) => {
    const key = getClientKey(request);
    const group = groups.get(key) || { key, requests: [] };
    group.requests.push(enrichRequest(request));
    groups.set(key, group);
  });

  return [...groups.values()]
    .map((group) => {
      const sortedRequests = [...group.requests].sort((first, second) =>
        second.createdAt.localeCompare(first.createdAt)
      );
      return { ...group, latestRequest: sortedRequests[0], requests: sortedRequests };
    })
    .sort((first, second) => second.latestRequest.createdAt.localeCompare(first.latestRequest.createdAt));
}

function renderDashboard() {
  const today = todayIso();
  const activeRequests = requests.filter((request) =>
    ACTIVE_REQUEST_STATUSES.includes(request.status)
  );
  const newRequests = requests.filter((request) => request.status === "Nuevo").length;
  const responsePending = requests.filter((request) =>
    ["Nuevo", "En preparación"].includes(request.status)
  ).length;
  const followUpsToday = activeRequests.filter((request) => request.nextFollowUpDate === today).length;
  const overdueFollowUps = activeRequests.filter((request) => request.nextFollowUpDate < today).length;
  const missingInformation = requests.filter((request) => getDataPendingLabels(request).length).length;
  const nextRequest = getPendingFollowUps()[0];

  dashboardMetrics.innerHTML = [
    ["Solicitudes nuevas", newRequests, "Por revisar"],
    ["Respuestas pendientes", responsePending, "Preparar o revisar"],
    ["Seguimientos hoy/vencidos", followUpsToday + overdueFollowUps, `${followUpsToday} hoy · ${overdueFollowUps} vencidos`],
    ["Datos por confirmar", missingInformation, "Revisar contacto"],
  ]
    .map(
      ([label, value, detail]) => `
        <article class="dashboard-metric-card">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
          <small>${escapeHtml(detail)}</small>
        </article>
      `
    )
    .join("");

  const alerts = [];
  if (responsePending) alerts.push(`${responsePending} solicitud${responsePending === 1 ? "" : "es"} sin respuesta preparada.`);
  if (overdueFollowUps) alerts.push(`${overdueFollowUps} seguimiento${overdueFollowUps === 1 ? "" : "s"} vencido${overdueFollowUps === 1 ? "" : "s"}.`);
  if (missingInformation) alerts.push(`${missingInformation} solicitud${missingInformation === 1 ? "" : "es"} con datos por confirmar.`);

  dashboardAlerts.innerHTML = alerts.length
    ? alerts.map((alert) => `<p>${escapeHtml(alert)}</p>`).join("")
    : "<p class=\"dashboard-clear-state\">No hay alertas activas en los datos de ejemplo.</p>";

  dashboardNextAction.innerHTML = nextRequest
    ? `<div class="dashboard-next-action-content"><h3>${escapeHtml(nextRequest.name)}</h3><p>${escapeHtml(nextRequest.nextFollowUp)}</p><small>${escapeHtml(nextRequest.service)} · ${escapeHtml(nextRequest.formattedNextFollowUpDate)}</small><button class="copy-button" type="button" data-action="open-dashboard-request" data-id="${escapeHtml(nextRequest.id)}">Revisar siguiente solicitud</button></div>`
    : "<h3>Todo al día</h3><p>No hay una próxima acción pendiente en esta demo.</p>";
}

function renderClients() {
  const clients = getClientGroups();

  if (!clients.length) {
    clientsList.innerHTML = "<p class=\"empty-state\">No hay contactos en esta demo local.</p>";
    clientProfile.innerHTML = "<p>Selecciona un contacto para ver su historial.</p>";
    return;
  }

  if (!clients.some((client) => client.key === selectedClientKey)) {
    selectedClientKey = getClientKey(getSelectedRequest() || clients[0].latestRequest);
  }

  clientsList.innerHTML = clients
    .map((client) => {
      return `
        <article class="client-row ${client.key === selectedClientKey ? "is-selected" : ""}">
          <div class="client-row-identity"><strong>${escapeHtml(client.latestRequest.name)}</strong><span>${escapeHtml(client.latestRequest.phone || client.latestRequest.email)}</span></div>
          <div class="client-row-request"><span>Última solicitud</span><strong>${escapeHtml(client.latestRequest.service)}</strong></div>
          <div class="client-row-status"><span>Estado</span><strong>${escapeHtml(client.latestRequest.status)}</strong></div>
          <span class="client-row-count">${client.requests.length} solicitud${client.requests.length === 1 ? "" : "es"}</span>
          <button class="copy-button client-row-action" type="button" data-action="select-client" data-client-key="${escapeHtml(client.key)}">Ver ficha</button>
        </article>
      `;
    })
    .join("");

  const selectedClient = clients.find((client) => client.key === selectedClientKey) || clients[0];
  const latestActivity = selectedClient.latestRequest.activityHistory?.[0];
  clientProfile.innerHTML = `
    <p class="section-kicker">Contacto seleccionado</p>
    <h3>${escapeHtml(selectedClient.latestRequest.name)}</h3>
    <p>${escapeHtml(selectedClient.latestRequest.email)}</p>
    <p>${escapeHtml(selectedClient.latestRequest.phone || "Teléfono no informado")}</p>
    <div class="client-profile-summary">
      <span>${selectedClient.requests.length} solicitud${selectedClient.requests.length === 1 ? "" : "es"}</span>
      <span>${escapeHtml(selectedClient.latestRequest.status)}</span>
    </div>
    <p><strong>Última actividad:</strong> ${escapeHtml(latestActivity?.label || "Sin actividad")}</p>
    <p><strong>Próxima acción:</strong> ${escapeHtml(selectedClient.latestRequest.nextFollowUp)}</p>
    <button class="copy-button" type="button" data-action="open-client-request" data-id="${escapeHtml(selectedClient.latestRequest.id)}">Ver última solicitud</button>
  `;
}

function syncSelectedClientRequest(clientKey) {
  const client = getClientGroups().find((item) => item.key === clientKey);

  if (!client) {
    return;
  }

  selectedClientKey = client.key;
  selectRequest(client.latestRequest.id);
  renderRequests();
}

function renderClientReceipt() {
  const request = getSelectedRequest();
  const formConfig = getActiveFormConfig();

  if (!request) {
    clientReceipt.innerHTML = "<p>No hay una solicitud disponible para mostrar.</p>";
    return;
  }

  clientReceipt.innerHTML = `
    <p class="section-kicker">Vista cliente · Demo local</p>
    <span class="client-receipt-status">En revisión</span>
    <h2 id="client-receipt-title">Solicitud recibida</h2>
    <p>Gracias, ${escapeHtml(request.name)}. ${escapeHtml(formConfig?.confirmationText || "Hemos recibido tu solicitud y revisaremos los datos antes de responderte.")}</p>
    <div class="client-receipt-details">
      <span><strong>Referencia:</strong> ${escapeHtml(request.reference)}</span>
      <span><strong>Servicio:</strong> ${escapeHtml(request.service)}</span>
      <span><strong>Próximo paso:</strong> Te contactaremos cuando revisemos la solicitud.</span>
    </div>
    <p class="simulation-notice">Demo local: no se envía ningún email ni se comparte información real.</p>
    <button class="button button-secondary" type="button" data-view-target="solicitudes">Continuar demo en el panel</button>
  `;
}

function getFollowUpPriority(request) {
  const today = todayIso();

  if (request.nextFollowUpDate < today) {
    return {
      label: "Vencido",
      className: "is-overdue",
    };
  }

  if (request.nextFollowUpDate === today) {
    return {
      label: "Hoy",
      className: "is-due-today",
    };
  }

  return {
      label: "Próximo",
    className: "is-upcoming",
  };
}

function getFollowUpRequests() {
  return requests
    .filter((request) => ACTIVE_REQUEST_STATUSES.includes(request.status))
    .map(enrichRequest)
    .sort((first, second) =>
      first.nextFollowUpDate.localeCompare(second.nextFollowUpDate)
    );
}

function getPendingFollowUps() {
  return filterLocalFollowUps(getFollowUpRequests(), "pending");
}

function renderFollowUpStateFilter() {
  followUpFilterControls?.querySelectorAll("[data-follow-up-filter]").forEach((button) => {
    const active = button.dataset.followUpFilter === followUpStateFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderFollowUpInbox() {
  const allFollowUps = getFollowUpRequests();
  const followUps = filterLocalFollowUps(allFollowUps, followUpStateFilter);
  const pendingCount = filterLocalFollowUps(allFollowUps, "pending").length;
  const contactedCount = filterLocalFollowUps(allFollowUps, "contacted").length;
  const countLabels = {
    pending: `${pendingCount} pendientes`,
    contacted: `${contactedCount} contactados`,
    all: `${allFollowUps.length} seguimientos`,
  };
  followUpCount.textContent = countLabels[followUpStateFilter];
  renderFollowUpStateFilter();

  if (followUpSummaryCount) {
    followUpSummaryCount.textContent = `${pendingCount} pendientes`;
  }

  if (!followUps.length) {
    const emptyLabels = {
      pending: "No hay seguimientos pendientes.",
      contacted: "Todavía no hay seguimientos contactados.",
      all: "No hay seguimientos activos.",
    };
    followUpList.innerHTML = `<p class="empty-state compact-empty">${emptyLabels[followUpStateFilter]}</p>`;
    return;
  }

  followUpList.innerHTML = followUps
    .map((request) => {
      const contacted = Boolean(request.followUpContactedAt);
      const priority = contacted
        ? { label: "✓ Contactado", className: "is-contacted" }
        : getFollowUpPriority(request);

      return `
        <article class="follow-up-card ${priority.className}">
          <div class="follow-up-main">
            <span class="follow-up-priority">${escapeHtml(priority.label)}</span>
            <span class="follow-up-cadence">${escapeHtml(request.followUpCadence)}</span>
            <h4>${escapeHtml(request.name)}</h4>
            <p><strong>${escapeHtml(request.formattedNextFollowUpDate)}:</strong> ${escapeHtml(
              request.nextFollowUp
            )}</p>
            <small>${escapeHtml(request.service)} | ${escapeHtml(request.status)} | ${escapeHtml(
              request.urgency
            )}</small>
          </div>
          <div class="follow-up-actions" aria-label="Acciones de seguimiento">
            <button class="copy-button" type="button" data-action="focus-request" data-id="${escapeHtml(
              request.id
            )}">Ver solicitud</button>
            <button class="copy-button" type="button" data-action="copy-message" data-channel="whatsapp" data-default-label="Copiar WhatsApp" data-id="${escapeHtml(
              request.id
            )}">Copiar WhatsApp</button>
            ${contacted
              ? `<button class="copy-button follow-up-secondary-action" type="button" data-action="unmark-follow-up-contacted" data-id="${escapeHtml(request.id)}">Desmarcar</button>`
              : `<button class="copy-button" type="button" data-action="mark-follow-up-contacted" data-id="${escapeHtml(request.id)}">Marcar contactado</button>`}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStatusSummary() {
  const statusCounts = getStatusCounts();

  statusSummary.innerHTML = STATUSES.map(
    (status) => `
      <button
        class="status-summary-card ${statusFilter.value === status ? "is-active" : ""}"
        type="button"
        data-status="${escapeHtml(status)}"
        aria-pressed="${statusFilter.value === status ? "true" : "false"}"
      >
        <span>${escapeHtml(status)}</span>
        <strong>${statusCounts[status]}</strong>
      </button>
    `
  ).join("");
}

function renderFilters() {
  const selectedStatus = statusFilter.value;
  const selectedService = serviceFilter.value;
  const services = [...new Set(requests.map((request) => request.service))].sort();

  statusFilter.innerHTML = [
    `<option value="Todos">Todos los estados</option>`,
    ...STATUSES.map((status) => `<option value="${status}">${status}</option>`),
  ].join("");

  serviceFilter.innerHTML = [
    `<option value="Todos">Todos los servicios</option>`,
    ...services.map((service) => `<option value="${escapeHtml(service)}">${escapeHtml(service)}</option>`),
  ].join("");

  statusFilter.value = STATUSES.includes(selectedStatus) ? selectedStatus : "Todos";
  serviceFilter.value = services.includes(selectedService) ? selectedService : "Todos";
}

function getPreviewRequest() {
  const request = getSelectedRequest();
  return request ? enrichRequest(request) : null;
}

function getSelectedRequest() {
  return requests.find((request) => request.id === selectedRequestId) || requests[0] || null;
}

function getDefaultSelectedRequestId() {
  const featuredRequestId = getSectorPreset(activeSector)?.featuredRequestId;

  return requests.find((request) => request.id === featuredRequestId)?.id || requests[0]?.id || null;
}

function selectRequest(id) {
  if (!requests.some((request) => request.id === id)) {
    return;
  }

  selectedRequestId = id;
  const request = enrichRequest(getSelectedRequest());
  selectedClientKey = getClientKey(request);

  if (selectedRequestContext) {
    selectedRequestContext.textContent = `${request.name} · ${request.service} · ${request.status}`;
  }

  if (selectedRequestNav) {
    selectedRequestNav.hidden = false;
  }

  if (selectedRequestNavLabel) {
    selectedRequestNavLabel.textContent = `${request.reference} · ${request.name}`;
  }

  if (selectedRequestStatus) {
    selectedRequestStatus.textContent = `Estado: ${request.status}`;
  }

  if (selectedRequestNextAction) {
    selectedRequestNextAction.textContent = `Próxima acción: ${request.formattedNextFollowUpDate}`;
  }
}

function renderEmailPreviews() {
  const request = getPreviewRequest();

  if (!request) {
    const emptyMessage = "<p>No hay solicitudes disponibles para esta simulación local.</p>";
    clientEmailPreview.innerHTML = emptyMessage;
    businessEmailPreview.innerHTML = emptyMessage;
    return;
  }

  const emailCopy = request.sectorEmailCopy || {
    businessSubject: `Nueva solicitud de ${request.name}`,
    businessIntro: "Nueva solicitud recibida. Revisa los datos antes de preparar una respuesta.",
    businessDetails: [["Servicio", request.service], ["Urgencia", request.urgency]],
    clientSubject: "Hemos recibido tu solicitud",
    clientBody: "Gracias por contactar. Hemos recibido tu solicitud y te responderemos tras revisar los detalles.",
  };
  const businessDetails = emailCopy.businessDetails
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`)
    .join("");

  clientEmailPreview.innerHTML = `
    <div class="simulation-email-meta">
      <span><strong>Para:</strong> ${escapeHtml(request.email)}</span>
      <span><strong>Asunto:</strong> ${escapeHtml(emailCopy.clientSubject)}</span>
    </div>
    <div class="simulation-email-body">
      <p>Hola ${escapeHtml(request.name)},</p>
      <p>${escapeHtml(emailCopy.clientBody)}</p>
      <p>Referencia: ${escapeHtml(request.reference)} · ${escapeHtml(request.service)}</p>
      <p>Equipo de Negocio demo</p>
    </div>
  `;

  businessEmailPreview.innerHTML = `
    <div class="simulation-email-meta">
      <span><strong>Para:</strong> equipo del negocio</span>
      <span><strong>Asunto:</strong> ${escapeHtml(emailCopy.businessSubject)}</span>
    </div>
    <div class="simulation-email-body simulation-email-grid">
      <section><h3>Datos recibidos</h3><p><strong>${escapeHtml(request.reference)}</strong> · ${escapeHtml(request.name)}</p><p>${escapeHtml(request.service)} · ${escapeHtml(request.urgency)} · ${escapeHtml(request.origin)}</p></section>
      <section><h3>Datos del sector</h3><p>${escapeHtml(emailCopy.businessIntro)}</p><ul class="detail-list">${businessDetails}</ul></section>
      <section><h3>Resumen interno</h3><p>${escapeHtml(createShortText(request.internalSummary, 110))}</p></section>
      <section><h3>Respuesta sugerida</h3><p>${escapeHtml(createShortText(request.suggestedResponse, 170))}</p></section>
      <section class="simulation-email-status"><h3>Estado y seguimiento</h3><p><strong>${escapeHtml(request.status)}</strong> · ${escapeHtml(request.formattedNextFollowUpDate)}</p><p>${escapeHtml(request.nextFollowUp)}</p></section>
    </div>
  `;
}

function showEmailPreview(target) {
  const normalizedTarget = target === "client" ? "client" : "business";
  document.querySelectorAll("[data-email-preview-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.emailPreviewPanel !== normalizedTarget;
  });
  document.querySelectorAll("[data-action='show-email-preview']").forEach((button) => {
    const isActive = button.dataset.emailPreviewTarget === normalizedTarget;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function createShortText(value, limit) {
  const text = String(value || "").trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

function getLocalTableColumns() {
  return LOCAL_TABLE_COLUMNS[localTableView] || LOCAL_TABLE_COLUMNS.summary;
}

function getVisibleLocalTableRequests() {
  const searchValue = normalizeSearchText(localTableSearch?.value);
  const statusValue = localTableStatusFilter?.value || "Todos";
  const serviceValue = localTableServiceFilter?.value || "Todos";

  return requests
    .map(enrichRequest)
    .filter((request) => {
      const matchesSearch = !searchValue || getRequestSearchText(request).includes(searchValue);
      const matchesStatus = statusValue === "Todos" || request.status === statusValue;
      const matchesService = serviceValue === "Todos" || request.service === serviceValue;
      return matchesSearch && matchesStatus && matchesService;
    });
}

function renderLocalTableFilters() {
  const services = [...new Set(requests.map((request) => request.service))].sort();
  const selectedStatus = localTableStatusFilter?.value || "Todos";
  const selectedService = localTableServiceFilter?.value || "Todos";

  if (localTableStatusFilter) {
    localTableStatusFilter.innerHTML = [
      '<option value="Todos">Todos los estados</option>',
      ...STATUSES.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`),
    ].join("");
    localTableStatusFilter.value = STATUSES.includes(selectedStatus) ? selectedStatus : "Todos";
  }

  if (localTableServiceFilter) {
    localTableServiceFilter.innerHTML = [
      '<option value="Todos">Todos los servicios</option>',
      ...services.map((service) => `<option value="${escapeHtml(service)}">${escapeHtml(service)}</option>`),
    ].join("");
    localTableServiceFilter.value = services.includes(selectedService) ? selectedService : "Todos";
  }
}

function renderLocalTableViewToggle() {
  document.querySelectorAll("[data-action='set-local-table-view']").forEach((button) => {
    const isActive = button.dataset.localTableView === localTableView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getLocalTableCell(column, request) {
  const latestActivity = request.activityHistory?.[0];

  if (column.key === "status") {
    return `<td data-column="status"><select class="sheet-cell-control" aria-label="Estado de ${escapeHtml(request.name)}" data-action="change-table-status" data-id="${escapeHtml(request.id)}">${STATUSES.map((status) => `<option value="${escapeHtml(status)}" ${status === request.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></td>`;
  }

  if (column.key === "nextFollowUp") {
    return `<td data-column="next-follow-up"><input class="sheet-cell-control sheet-cell-action" type="text" aria-label="Próxima acción de ${escapeHtml(request.name)}" data-action="change-table-next-action" data-id="${escapeHtml(request.id)}" value="${escapeHtml(request.nextFollowUp)}" /></td>`;
  }

  if (column.key === "internalNote") {
    return `<td data-column="internal-note"><input class="sheet-cell-control sheet-cell-note" type="text" aria-label="Nota interna de ${escapeHtml(request.name)}" data-action="change-table-note" data-id="${escapeHtml(request.id)}" value="${escapeHtml(request.internalNote || "")}" placeholder="Añadir nota" /></td>`;
  }

  if (column.key === "action") {
    return `<td data-column="action"><button class="copy-button" type="button" data-action="open-table-detail" data-id="${escapeHtml(request.id)}">Ver detalle</button></td>`;
  }

  const values = {
    reference: request.reference,
    name: request.name,
    contact: `${request.email}${request.phone ? `\n${request.phone}` : ""}`,
    service: request.service,
    origin: request.origin,
    urgency: request.urgency,
    createdAt: request.formattedCreatedAt,
    nextFollowUpDate: request.formattedNextFollowUpDate,
    activity: latestActivity?.label || "Sin actividad",
  };
  const value = String(values[column.key] || "");
  return `<td data-column="${escapeHtml(column.key)}">${escapeHtml(value).replace("\n", "<br>")}</td>`;
}

function renderLocalTable() {
  const columns = getLocalTableColumns();
  localTableWrap.dataset.tableView = localTableView;
  renderLocalTableViewToggle();
  renderLocalTableFilters();
  localTableLetters.innerHTML = `<tr><th></th>${columns.map((_, index) => `<th>${String.fromCharCode(65 + index)}</th>`).join("")}</tr>`;
  localTableHead.innerHTML = `<tr><th scope="col" class="sheet-row-header">#</th>${columns.map((column) => `<th scope="col" data-column="${escapeHtml(column.key)}">${escapeHtml(column.label)}</th>`).join("")}</tr>`;

  const visibleRequests = getVisibleLocalTableRequests();

  if (!visibleRequests.length) {
    localTableBody.innerHTML = `<tr><td colspan="${columns.length + 1}">No hay solicitudes que coincidan con estos filtros.</td></tr>`;
    return;
  }

  localTableBody.innerHTML = visibleRequests
    .map((request, index) => `
      <tr class="${request.id === selectedRequestId ? "is-selected" : ""}">
        <th class="sheet-row-number" scope="row">${index + 1}</th>
        ${columns.map((column) => getLocalTableCell(column, request)).join("")}
      </tr>
    `)
    .join("");
}

function updateLocalTableField(id, field, value) {
  const request = requests.find((item) => item.id === id);

  if (!request) {
    return;
  }

  if (field === "status") {
    updateRequestStatus(id, value);
    if (localTableSaveStatus) localTableSaveStatus.textContent = "Cambios guardados";
    return;
  }

  const cleanValue = String(value || "").trim();
  const isNextAction = field === "nextFollowUp";

  if (!isNextAction && field !== "internalNote") {
    return;
  }

  request[field] = cleanValue;
  selectRequest(id);
  addActivity(
    request,
    isNextAction ? "Próxima acción actualizada" : "Nota interna actualizada",
    isNextAction ? cleanValue || "Sin próxima acción definida." : cleanValue || "Nota interna eliminada.",
    "note"
  );
  saveRequests();
  if (localTableSaveStatus) localTableSaveStatus.textContent = "Cambios guardados";
  renderRequests();
}

function scrollLocalTable(direction) {
  if (!localTableWrap) {
    return;
  }

  localTableWrap.scrollBy({ left: direction === "left" ? -240 : 240, behavior: "smooth" });
}

function exportLocalTableCsv() {
  const columns = getLocalTableColumns();
  const csvRows = [
    columns.map((column) => column.label),
    ...getVisibleLocalTableRequests().map((request) => {
      const activity = request.activityHistory?.[0]?.label || "Sin actividad";
      const values = {
        reference: request.reference,
        name: request.name,
        contact: [request.email, request.phone].filter(Boolean).join(" · "),
        service: request.service,
        origin: request.origin,
        urgency: request.urgency,
        status: request.status,
        createdAt: request.formattedCreatedAt,
        nextFollowUp: request.nextFollowUp,
        nextFollowUpDate: request.formattedNextFollowUpDate,
        activity,
        internalNote: request.internalNote || "",
        action: "Ver detalle en SolicitudPro Demo",
      };
      return columns.map((column) => values[column.key] || "");
    }),
  ];
  const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "solicitudpro-solicitudes-demo.csv";
  link.click();
  URL.revokeObjectURL(url);
  if (localTableSaveStatus) localTableSaveStatus.textContent = "CSV local preparado";
}

function renderRequests() {
  if (isRealProductMode) return window.RealProductDemo?.renderList();
  selectRequest(getSelectedRequest()?.id);
  renderFilters();
  renderStatusSummary();
  renderFollowUpInbox();
  renderEmailPreviews();
  renderLocalTable();
  renderDashboard();
  renderClients();
  renderClientReceipt();

  const filteredRequests = getFilteredRequests();
  const enrichedRequests = filteredRequests.map(enrichRequest);
  requestCount.textContent = filteredRequests.length;

  if (enrichedRequests.length === 0) {
    requestsList.innerHTML =
      '<p class="empty-state">No hay solicitudes que coincidan con la búsqueda o los filtros activos.</p>';
    return;
  }

  requestsList.innerHTML = enrichedRequests
    .map(
      (request) => `
        <article class="request-card request-row ${request.id === selectedRequestId ? "is-selected" : ""}" id="request-${escapeHtml(request.id)}" data-id="${escapeHtml(
          request.id
        )}">
          <div class="request-row-main">
            <div class="request-row-customer">
              <h3>${escapeHtml(request.name)}</h3>
              <p>${escapeHtml(request.email)}${request.phone ? ` | ${escapeHtml(request.phone)}` : ""}</p>
              ${request.sectorTags.length ? `<div class="request-pending-tags">${request.sectorTags.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}
            </div>
            <div class="request-row-field">
              <span>Servicio</span>
              <strong>${escapeHtml(request.service)}</strong>
            </div>
            <div class="request-row-field">
              <span>Urgencia</span>
              <strong>${escapeHtml(request.urgency)}</strong>
            </div>
            <div class="request-row-field">
              <span>Próxima acción</span>
              <strong>${escapeHtml(request.formattedNextFollowUpDate)}</strong>
              <p>${escapeHtml(request.followUpCadence)}</p>
            </div>
            <div class="request-row-status">
              <label>
                Estado
              <select data-action="change-status" data-id="${request.id}">
                ${STATUSES.map(
                  (status) =>
                    `<option value="${status}" ${
                      status === request.status ? "selected" : ""
                    }>${status}</option>`
                ).join("")}
              </select>
              </label>
            </div>
            <div class="request-row-action">
              <button class="copy-button" type="button" data-action="open-detail" data-id="${escapeHtml(
                request.id
              )}">Ver detalle</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function addRequestFromForm(event) {
  event.preventDefault();
  if (isRealProductMode) return;

  if (!validateRequestForm()) {
    return;
  }

  const formData = new FormData(form);
  const formValues = Object.fromEntries(formData.entries());

  if (isSupabaseDevSubmissionMode) {
    await submitSectorFormToSupabaseDev(formValues);
    return;
  }

  const requestPayload = createSectorRequestPayload(activeSector, formValues, requests);

  if (!requestPayload) {
    return;
  }

  const createdAt = todayIso();
  const attachments = getAttachmentMetadata(selectedPublicFiles);
  const sectorExperience = getSectorExperience(activeSector, {
    ...requestPayload,
    attachments,
  });
  const newRequest = {
    id: createId(),
    sector: activeSector,
    name: requestPayload.name,
    email: requestPayload.email,
    phone: requestPayload.phone,
    service: requestPayload.service,
    description: requestPayload.description,
    budget: requestPayload.budget,
    urgency: requestPayload.urgency,
    customAnswers: requestPayload.customAnswers,
    attachments,
    status: "Nuevo",
    origin: "Formulario",
    reference: requestPayload.reference,
    createdAt,
    followUpRuleVersion: FOLLOW_UP_RULE_VERSION,
    activityHistory: [
      createActivity(
        createdAt,
        "Solicitud creada",
        sectorExperience?.createdActivity || "Entrada desde el formulario demo.",
        "created"
      ),
    ],
  };
  newRequest.nextFollowUpDate = createDefaultFollowUpDate(newRequest);

  requests.unshift(newRequest);
  selectRequest(newRequest.id);
  saveRequests();
  statusFilter.value = "Todos";
  serviceFilter.value = "Todos";
  requestSearch.value = "";
  renderRequests();
  form.reset();
  selectedPublicFiles = [];
  document.querySelector("#attachment-preview")?.replaceChildren();
  formNote.textContent = "Solicitud demo añadida y guardada en este navegador.";
  showView("solicitud-recibida");

  const newRequestCard = document.getElementById(`request-${newRequest.id}`);

  if (newRequestCard) {
    newRequestCard.scrollIntoView({ behavior: "smooth", block: "center" });
    newRequestCard.classList.add("is-highlighted");
    window.setTimeout(() => newRequestCard.classList.remove("is-highlighted"), 1800);
  }
}

function updateRequestStatus(id, status) {
  if (isRealProductMode) return;
  const request = requests.find((item) => item.id === id);

  if (!request) {
    return;
  }

  request.status = status;
  request.nextFollowUp = createNextFollowUp(request);
  selectRequest(id);
  request.nextFollowUpDate = createDefaultFollowUpDate(request, todayIso());
  request.followUpRuleVersion = FOLLOW_UP_RULE_VERSION;
  addActivity(request, "Estado actualizado", `Nuevo estado: ${status}.`, "status");
  saveRequests();
  renderRequests();
}

function markFollowUpContacted(id) {
  if (isRealProductMode) return;
  const request = requests.find((item) => item.id === id);

  if (!request) {
    return;
  }

  const contacted = markLocalFollowUpContacted(request, {
    contactedAt: new Date().toISOString(),
    nextFollowUpDate: addDaysIso(todayIso(), 3),
    nextFollowUp: getSectorExperience(request.sector, request)?.contactedAction ||
      "Revisar si el cliente necesita algún detalle adicional.",
  });
  Object.assign(request, contacted);
  request.followUpRuleVersion = FOLLOW_UP_RULE_VERSION;
  selectRequest(id);
  addActivity(
    request,
    "Seguimiento marcado como contactado",
    "Contacto registrado en la demo local. Nueva revisión programada en 72 h.",
    "follow-up"
  );
  saveRequests();
  renderRequests();
}

function unmarkFollowUpContacted(id) {
  if (isRealProductMode) return;
  const request = requests.find((item) => item.id === id);

  if (!request?.followUpContactedAt) {
    return;
  }

  const restored = unmarkLocalFollowUpContacted(request);
  delete request.followUpContactedAt;
  delete request.previousFollowUp;
  Object.assign(request, restored);
  selectRequest(id);
  addActivity(
    request,
    "Seguimiento desmarcado",
    "Se revirtió el contacto anterior en la demo local.",
    "follow-up"
  );
  saveRequests();
  renderRequests();
}

async function copyPreparedMessage(id, button) {
  if (isRealProductMode) return;
  const originalRequest = requests.find((item) => item.id === id);

  if (!originalRequest) {
    return;
  }

  const message = createPreparedMessage(originalRequest, button.dataset.channel);
  const defaultLabel = button.dataset.defaultLabel || button.textContent;

  try {
    await copyText(message);
    button.textContent = "Copiada";
    window.setTimeout(() => {
      button.textContent = defaultLabel;
    }, 1600);
  } catch {
    button.textContent = "No se pudo copiar.";
    window.setTimeout(() => {
      button.textContent = defaultLabel;
    }, 2000);
  }
}

function focusRequest(id) {
  openRequestDetail(id, "seguimiento");
}

function getDetailReturnLabel(viewName) {
  const labels = {
    dashboard: "Inicio",
    solicitudes: "Solicitudes",
    seguimientos: "Seguimientos",
    clientes: "Contactos",
    "tabla-local": "Tabla interna",
  };

  return labels[viewName] || VIEW_META[viewName]?.title || "Solicitudes";
}

function updateDetailBackButton(container) {
  const backButton = container?.querySelector("[data-action='back-to-requests']");

  if (backButton) {
    const label = `← Volver a ${getDetailReturnLabel(detailReturnView)}`;
    backButton.textContent = label;
    backButton.setAttribute("aria-label", label);
  }
}

function openRequestDetail(id, tabName = "solicitud") {
  if (isRealProductMode) return window.RealProductDemo?.openDetail(id);
  const request = requests.find((item) => item.id === id);

  if (!request) {
    return;
  }

  selectRequest(id);
  if (currentView !== "detalle-solicitud") {
    detailReturnView = currentView;
  }
  activeDetailContainer = requestDetailViewContent;
  activeDetailContainer.innerHTML = createRequestDetailView(enrichRequest(request));
  activeDetailContainer.dataset.requestName = request.name;
  updateDetailBackButton(activeDetailContainer);
  showDetailTab(tabName, activeDetailContainer);
  showView("detalle-solicitud");
  activeDetailContainer.focus({ preventScroll: true });
}

function openRequestEdit(id, container = activeDetailContainer) {
  if (isRealProductMode) return;
  const request = requests.find((item) => item.id === id);

  if (!request) {
    return;
  }

  activeDetailContainer = container;
  activeDetailContainer.innerHTML = createRequestEditForm(request, EDIT_OPTIONS);
  activeDetailContainer.querySelector("input[name='name']").focus();
}

function showDetailTab(tabName, container = activeDetailContainer) {
  const detailTabs = container.querySelectorAll("[data-detail-tab]");
  const detailPanels = container.querySelectorAll("[data-detail-panel]");
  let selectedTab = null;

  detailTabs.forEach((tab) => {
    const isSelected = tab.dataset.detailTab === tabName;
    tab.setAttribute("aria-selected", String(isSelected));
    if (isSelected) selectedTab = tab;
  });

  detailPanels.forEach((panel) => {
    const isActive = panel.dataset.detailPanel === tabName;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  const activeSection = container.querySelector("#detail-active-section");
  const sectionLabels = {
    solicitud: "Datos recibidos",
    resumen: "Resumen y dudas",
    respuesta: "Respuesta sugerida",
    seguimiento: "Seguimiento",
    actividad: "Actividad",
  };

  if (activeSection) {
    activeSection.textContent = `${sectionLabels[tabName] || "Solicitud"} de ${container.dataset.requestName || "la solicitud seleccionada"}`;
  }

  const currentIndex = DETAIL_TABS.indexOf(tabName);
  const previousButton = container.querySelector("[data-action='detail-previous']");
  const nextButton = container.querySelector("[data-action='detail-next']");
  const progress = container.querySelector("#detail-flow-progress");

  if (progress) {
    progress.textContent = `Paso ${currentIndex + 1} de ${DETAIL_TABS.length} · ${sectionLabels[tabName] || "Solicitud"}`;
  }

  if (previousButton) {
    previousButton.disabled = currentIndex <= 0;
  }

  if (nextButton) {
    const nextTab = DETAIL_TABS[currentIndex + 1];
    const nextButtonHadFocus = document.activeElement === nextButton;
    if (!nextTab && nextButtonHadFocus) selectedTab?.focus({ preventScroll: true });
    nextButton.hidden = !nextTab;
    nextButton.disabled = !nextTab;
    nextButton.textContent = nextTab
      ? `Siguiente: ${sectionLabels[DETAIL_TABS[currentIndex + 1]]}`
      : "Siguiente";
  }
}

function saveRequestEdit(formElement, container = activeDetailContainer) {
  if (isRealProductMode) return;
  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    return;
  }

  const request = requests.find((item) => item.id === formElement.dataset.id);

  if (!request) {
    return;
  }

  const values = normalizeRequestEditValues(
    Object.fromEntries(new FormData(formElement).entries())
  );
  const editedFields = getEditedFieldLabels(request, values);
  Object.assign(request, values);
  request.status = normalizeStatus(request.status);
  request.nextFollowUp = createNextFollowUp(request);
  selectRequest(request.id);
  request.nextFollowUpDate = createDefaultFollowUpDate(request, todayIso());
  request.followUpRuleVersion = FOLLOW_UP_RULE_VERSION;

  if (editedFields.length) {
    addActivity(
      request,
      "Solicitud editada",
      `Campos actualizados: ${editedFields
        .map((field) => EDIT_FIELD_LABELS[field])
        .join(", ")}.`,
      "edit"
    );
  }

  saveRequests();
  renderRequests();
  activeDetailContainer = container;
  activeDetailContainer.innerHTML = createRequestDetailView(enrichRequest(request));
  activeDetailContainer.dataset.requestName = request.name;
  showDetailTab("solicitud", activeDetailContainer);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", addRequestFromForm);
form.setAttribute("novalidate", "");

form.addEventListener("input", (event) => {
  const field = event.target;

  if (!getFormFieldConfig(field.name)) {
    return;
  }

  validateField(field);

  if (!form.querySelector("[aria-invalid='true']")) {
    formNote.textContent = "";
  }
});

form.addEventListener("focusout", (event) => {
  const field = event.target;

  if (getFormFieldConfig(field.name)) {
    validateField(field);
  }
});

form.addEventListener("change", (event) => {
  if (event.target.name === "attachments") {
    renderAttachmentPreview();
  }
});

form.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-action='remove-public-attachment']");

  if (!removeButton) {
    return;
  }

  selectedPublicFiles.splice(Number(removeButton.dataset.index), 1);
  renderAttachmentPreview();
});

clientReceipt.addEventListener("click", async (event) => {
  const retryButton = event.target.closest("[data-action='retry-public-attachments']");

  if (!retryButton || !activeAttachmentRetryContext) {
    return;
  }

  retryButton.disabled = true;
  await retryFailedAttachments(
    activeAttachmentRetryContext.items,
    activeAttachmentRetryContext.uploadContext
  );

  if (activeAttachmentRetryContext.items.every((item) => item.status === "success")) {
    activeAttachmentRetryContext = null;
  }
});

statusFilter.addEventListener("change", renderRequests);
serviceFilter.addEventListener("change", renderRequests);
requestSearch.addEventListener("input", renderRequests);
localTableSearch.addEventListener("input", renderLocalTable);
localTableStatusFilter.addEventListener("change", renderLocalTable);
localTableServiceFilter.addEventListener("change", renderLocalTable);

statusSummary.addEventListener("click", (event) => {
  const card = event.target.closest("[data-status]");

  if (!card) {
    return;
  }

  statusFilter.value = statusFilter.value === card.dataset.status ? "Todos" : card.dataset.status;
  renderRequests();
});

requestsList.addEventListener("change", (event) => {
  const control = event.target.closest("[data-action='change-status']");

  if (control) {
    updateRequestStatus(control.dataset.id, control.value);
  }
});

requestsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='copy-message']");
  const detailButton = event.target.closest("[data-action='open-detail']");

  if (button) {
    copyPreparedMessage(button.dataset.id, button);
  }

  if (detailButton) {
    openRequestDetail(detailButton.dataset.id);
  }
});

localTableBody.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-action='open-table-detail']");

  if (detailButton) {
    openRequestDetail(detailButton.dataset.id);
  }
});

localTableBody.addEventListener("change", (event) => {
  const control = event.target.closest("[data-action]");

  if (!control) {
    return;
  }

  const fieldByAction = {
    "change-table-status": "status",
    "change-table-next-action": "nextFollowUp",
    "change-table-note": "internalNote",
  };
  const field = fieldByAction[control.dataset.action];

  if (field) {
    updateLocalTableField(control.dataset.id, field, control.value);
  }
});

function handleRequestDetailClick(event, container) {
  const closeButton = event.target.closest("[data-action='close-detail']");
  const backButton = event.target.closest("[data-action='back-to-requests']");
  const copyButton = event.target.closest("[data-action='copy-message']");
  const editButton = event.target.closest("[data-action='edit-request']");
  const cancelEditButton = event.target.closest("[data-action='cancel-request-edit']");
  const detailTab = event.target.closest("[data-detail-tab]");
  const previousButton = event.target.closest("[data-action='detail-previous']");
  const nextButton = event.target.closest("[data-action='detail-next']");
  const contactedButton = event.target.closest("[data-action='mark-follow-up-contacted']");
  const unmarkContactedButton = event.target.closest("[data-action='unmark-follow-up-contacted']");

  if (detailTab) {
    showDetailTab(detailTab.dataset.detailTab, container);
  }

  if (closeButton) {
    if (container === requestDetailContent) {
      requestDetailDialog.close();
    } else {
      showPreviousView();
    }
  }

  if (backButton) {
    showPreviousView();
  }

  if (copyButton) {
    copyPreparedMessage(copyButton.dataset.id, copyButton);
  }

  if (contactedButton) {
    markFollowUpContacted(contactedButton.dataset.id);
    openRequestDetail(contactedButton.dataset.id, "seguimiento");
    return;
  }

  if (unmarkContactedButton) {
    unmarkFollowUpContacted(unmarkContactedButton.dataset.id);
    openRequestDetail(unmarkContactedButton.dataset.id, "seguimiento");
    return;
  }

  if (editButton) {
    openRequestEdit(editButton.dataset.id, container);
  }

  if (cancelEditButton) {
    openRequestDetail(
      cancelEditButton.closest("form")?.dataset.id ||
        container.querySelector("[data-id]")?.dataset.id
    );
  }

  if (previousButton || nextButton) {
    const activeTab = container.querySelector("[data-detail-tab][aria-selected='true']")?.dataset.detailTab;
    const currentIndex = DETAIL_TABS.indexOf(activeTab);
    const nextIndex = previousButton ? currentIndex - 1 : currentIndex + 1;

    if (DETAIL_TABS[nextIndex]) {
      showDetailTab(DETAIL_TABS[nextIndex], container);
    }
  }

  if (event.target === requestDetailDialog && container === requestDetailContent) {
    requestDetailDialog.close();
  }
}

function handleRequestDetailSubmit(event, container) {
  const editForm = event.target.closest("[data-action='save-request-edit']");

  if (!editForm) {
    return;
  }

  event.preventDefault();
  saveRequestEdit(editForm, container);
}

requestDetailDialog.addEventListener("click", (event) => handleRequestDetailClick(event, requestDetailContent));
requestDetailDialog.addEventListener("submit", (event) => handleRequestDetailSubmit(event, requestDetailContent));
requestDetailViewContent.addEventListener("click", (event) => handleRequestDetailClick(event, requestDetailViewContent));
requestDetailViewContent.addEventListener("submit", (event) => handleRequestDetailSubmit(event, requestDetailViewContent));

followUpList.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-action='copy-message']");
  const focusButton = event.target.closest("[data-action='focus-request']");
  const contactedButton = event.target.closest("[data-action='mark-follow-up-contacted']");
  const unmarkContactedButton = event.target.closest("[data-action='unmark-follow-up-contacted']");

  if (copyButton) {
    copyPreparedMessage(copyButton.dataset.id, copyButton);
  }

  if (focusButton) {
    focusRequest(focusButton.dataset.id);
  }

  if (contactedButton) {
    markFollowUpContacted(contactedButton.dataset.id);
  }

  if (unmarkContactedButton) {
    unmarkFollowUpContacted(unmarkContactedButton.dataset.id);
  }
});

followUpFilterControls?.addEventListener("click", (event) => {
  if (isRealProductMode) return;
  const button = event.target.closest("[data-follow-up-filter]");
  if (!button || !["pending", "contacted", "all"].includes(button.dataset.followUpFilter)) return;
  followUpStateFilter = button.dataset.followUpFilter;
  renderFollowUpInbox();
});

dashboardNextAction.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-action='open-dashboard-request']");

  if (detailButton) {
    openRequestDetail(detailButton.dataset.id || getPendingFollowUps()[0]?.id, "seguimiento");
  }
});

clientsList.addEventListener("click", (event) => {
  const clientButton = event.target.closest("[data-action='select-client']");

  if (clientButton) {
    syncSelectedClientRequest(clientButton.dataset.clientKey);
  }
});

document.addEventListener("click", (event) => {
  const emailPreviewButton = event.target.closest("[data-action='show-email-preview']");
  const tableScrollButton = event.target.closest("[data-action='scroll-local-table']");
  const tableViewButton = event.target.closest("[data-action='set-local-table-view']");
  const exportTableButton = event.target.closest("[data-action='export-local-table-csv']");
  const sectorPreviewButton = event.target.closest("[data-action='select-sector-preview']");

  if (emailPreviewButton) {
    showEmailPreview(emailPreviewButton.dataset.emailPreviewTarget);
  }

  if (tableScrollButton) {
    scrollLocalTable(tableScrollButton.dataset.scrollDirection);
  }

  if (tableViewButton) {
    localTableView = tableViewButton.dataset.localTableView === "complete" ? "complete" : "summary";
    localTableWrap.scrollLeft = 0;
    renderLocalTable();
  }

  if (exportTableButton) {
    exportLocalTableCsv();
  }

  if (sectorPreviewButton) {
    renderSectorPreview(sectorPreviewButton.dataset.sectorPreview);
  }
});

clientProfile.addEventListener("click", (event) => {
  const requestButton = event.target.closest("[data-action='open-client-request']");

  if (requestButton) {
    openRequestDetail(requestButton.dataset.id);
  }
});

copyShareLinkButton.addEventListener("click", async () => {
  try {
    await copyText(shareLink.textContent.trim());
    shareLinkNote.textContent =
      "Enlace demo copiado. En una versión real sería la URL pública del formulario.";
  } catch {
    shareLinkNote.textContent =
      "No se pudo copiar automáticamente. Puedes seleccionar el enlace manualmente.";
  }
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.viewTarget, button));
});

appBackButton.addEventListener("click", showPreviousView);

detailNavigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const request = getSelectedRequest();

    if (request) {
      openRequestDetail(request.id, button.dataset.detailTabTarget);
    }
  });
});

document.querySelectorAll("[data-action='open-selected-detail']").forEach((button) => {
  button.addEventListener("click", () => {
    const request = getSelectedRequest();

    if (request) {
      openRequestDetail(request.id, button.dataset.detailTabTarget || "solicitud");
    }
  });
});

document.querySelectorAll("[data-action='copy-selected-response']").forEach((button) => {
  button.addEventListener("click", () => {
    const request = getSelectedRequest();

    if (request) {
      copyPreparedMessage(request.id, button);
    }
  });
});

technicalNavigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const technicalDocs = document.querySelector(".technical-docs");
    const target = document.querySelector(`#${button.dataset.docTarget}`);

    if (technicalDocs) {
      technicalDocs.open = true;
    }

    window.setTimeout(() => target?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  });
});

mobileMenuToggle.addEventListener("click", () => {
  const isOpen = appSidebar.classList.toggle("is-open");
  sidebarScrim.classList.toggle("is-visible", isOpen);
  mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
});

sidebarScrim.addEventListener("click", closeMobileMenu);

resetDemoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    resetDemoData();
    closeMobileMenu();
  });
});

function initializeSectorDemo() {
  if (isRealProductMode) {
    sectorSelector.hidden = true;
    appShell.hidden = true;
    return;
  }
  const canLoadDemo = Boolean(activeSector && activeSectorStorageKey);

  if (!canLoadDemo) {
    appShell.hidden = true;
    sectorSelector.hidden = false;
    sectorSelectorNotice.hidden = !sectorRoute.selection.notice;
    sectorSelectorNotice.textContent = sectorRoute.selection.notice;
    return;
  }

  document.body.dataset.activeSector = activeSector;
  sectorSelector.hidden = true;
  appShell.hidden = false;
  renderSectorForm();
  showView("dashboard");
  renderRequests();
  renderSectorPreview();
}

document.addEventListener("solicitudpro:languagechange", () => {
  if (isRealProductMode || !activeSector) return;
  renderSectorForm();
  renderDashboard();
  renderRequests();
  renderFollowUpInbox();
  renderClients();
  renderEmailPreviews();
  renderLocalTable();
  updateSelectedRequestNav();
});

initializeSectorDemo();
