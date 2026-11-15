(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root?.document) root.SolicitudProI18n = api.initialize(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LANGUAGE_STORAGE_KEY = "solicitudpro-demo-language";
  const SUPPORTED_LANGUAGES = new Set(["es", "en"]);

  // This is deliberately a local product glossary, not a machine-translation layer.
  const EN = Object.freeze({
    "Inicio": "Home", "Solicitudes": "Requests", "Seguimientos": "Follow-ups", "Contactos": "Contacts",
    "TRABAJO": "WORK", "SOLICITUD SELECCIONADA": "SELECTED REQUEST", "Solicitud seleccionada · Detalle de solicitud": "Selected request · Request detail", "SOLICITUD SELECCIONADA · DETALLE DE SOLICITUD": "SELECTED REQUEST · REQUEST DETAIL", "ACCESO DEL CLIENTE": "CUSTOMER ACCESS", "MÁS": "MORE", "TRABAJO DE HOY": "TODAY'S WORK", "ATENCIÓN": "ATTENTION", "SIGUIENTE PASO": "NEXT STEP", "ACCIONES RÁPIDAS": "QUICK ACTIONS", "RECORRIDO DE DEMO": "DEMO JOURNEY",
    "Solicitud seleccionada": "Selected request", "Acceso del cliente": "Customer access", "Más": "More",
    "Personalización por sector": "Sector customization", "Tabla interna": "Internal table",
    "Emails automáticos simulados": "Simulated automated emails", "Información de la demo": "Demo information",
    "Reiniciar demo": "Reset demo", "Reiniciar demo restaura las solicitudes de ejemplo del sector actual guardadas en este navegador.": "Resetting the demo restores the current sector's sample requests stored in this browser.", "Cambiar demo sectorial": "Change sector demo", "Cerrar menú": "Close menu",
    "Menú": "Menu", "Trabajo de hoy": "Today's work", "Panel interno": "Internal dashboard",
    "Qué revisar ahora": "What needs attention", "Prioriza solicitudes, respuestas y seguimientos antes de que una oportunidad se quede sin atender.": "Prioritize requests, replies, and follow-ups before an opportunity is missed.",
    "Datos ficticios locales": "Local sample data", "Atención": "Attention", "Alertas activas": "Active alerts",
    "Ver solicitudes": "View requests", "Siguiente paso": "Next step", "Acciones rápidas": "Quick actions",
    "Revisar solicitudes nuevas": "Review new requests", "Preparar respuesta": "Prepare reply", "Ver seguimientos": "View follow-ups", "Probar como cliente": "Try as customer", "Abrir detalle": "Open detail", "Compartir formulario": "Share form",
    "Recorrido de demo": "Demo journey", "Cómo funciona SolicitudPro": "How SolicitudPro works",
    "Una solicitud entra, se revisa, se responde y queda preparada para el siguiente contacto.": "A request comes in, is reviewed, receives a reply, and is ready for the next follow-up.",
    "Cliente envía solicitud": "Customer submits a request", "Datos y dudas ordenados": "Details and questions organized", "Respuesta preparada": "Reply prepared", "Seguimiento claro": "Clear follow-up", "Revisar siguiente solicitud": "Review next request",
    "De una solicitud a un siguiente paso claro": "From a request to a clear next step", "Recorre una oportunidad ficticia de principio a fin. Todo ocurre solo en esta demo local.": "Follow a fictional opportunity from start to finish. Everything happens inside this local demo.",
    "Solicitud protagonista": "Featured request", "Abrir solicitud seleccionada": "Open selected request", "El cliente envía el formulario": "The customer submits the form", "Comparte un enlace o QR y recibe los datos ordenados.": "Share a link or QR code and receive organized details.",
    "Ver formulario": "View form", "La solicitud entra al panel": "The request reaches the dashboard", "El negocio ve contacto, servicio, origen, urgencia y próxima acción.": "The business sees contact, service, source, urgency, and next action.",
    "Se revisan los datos": "The details are reviewed", "Los detalles y adjuntos se consultan dentro de la solicitud seleccionada.": "Details and attachments are available inside the selected request.", "Ver datos recibidos": "View received details", "Se prepara la respuesta": "The reply is prepared", "El resumen interno y la respuesta sugerida se revisan antes de copiarla.": "The internal summary and suggested reply are reviewed before copying.", "Ver respuesta sugerida": "View suggested reply", "Se organiza el seguimiento": "The follow-up is organized", "El estado comercial y la próxima acción evitan que la oportunidad se pierda.": "The sales status and next action help prevent the opportunity from being lost.", "Ver seguimiento": "View follow-up",
    "Paso 1": "Step 1", "Formulario público del negocio": "Public business form", "Este es el enlace que el negocio podría enviar a sus clientes o colocar junto a un QR.": "This is the link the business could send to customers or place next to a QR code.",
    "QR demo no funcional": "Non-functional demo QR", "Bloque visual para explicar el acceso al formulario.": "Visual placeholder that explains form access.", "Enlace simulado del formulario": "Sample form link", "Copiar enlace demo": "Copy demo link", "El cliente abre el enlace y rellena la solicitud.": "The customer opens the link and completes the request.", "La solicitud aparece en el panel interno del negocio.": "The request appears in the business dashboard.", "El QR y el enlace son simulados: no publican datos reales.": "The QR code and link are simulated: they do not publish real data.", "Demo local: el enlace y el QR son solo visuales.": "Local demo: the link and QR code are visual only.",
    "Acceso preparado": "Ready access", "Una página sencilla para que el cliente deje los datos necesarios antes de que el negocio revise la oportunidad.": "A simple page for customers to provide the details the business needs before reviewing the opportunity.", "Comparte un único acceso": "Share one access point", "El enlace y el QR ayudan a usar el mismo formulario desde WhatsApp, una web o un mostrador.": "The link and QR code make the same form available from WhatsApp, a website, or a counter.", "Recibe datos ordenados": "Receive organized details", "Nombre, contacto, servicio, urgencia y descripción llegan preparados para revisar sin copiar mensajes a mano.": "Name, contact details, service, urgency, and description arrive ready to review without copying messages by hand.", "Ver formulario del cliente": "View customer form",
    "Entrada de solicitud": "Request intake", "Formulario del cliente": "Customer form", "Enviar solicitud demo": "Submit demo request", "Solicitud recibida": "Request received", "Detalle de solicitud": "Request detail", "Solicitudes recibidas": "Received requests", "solicitudes": "requests",
    "Convierte una solicitud de cliente en una oportunidad organizada, con respuesta sugerida y seguimiento. Aquí el negocio revisa estados y próximas acciones desde un único lugar.": "Turn a customer request into an organized opportunity with a suggested reply and follow-up. The business reviews statuses and next actions in one place.",
    "Seguimientos pendientes": "Pending follow-ups", "Revisa las próximas acciones sin cargar toda la bandeja en esta vista.": "Review next actions without loading the entire inbox in this view.", "pendientes": "pending", "Ver tabla interna": "View internal table", "Buscar solicitud": "Search requests", "Nombre, servicio, teléfono o necesidad": "Name, service, phone, or need", "Estado": "Status", "Todos los estados": "All statuses", "Servicio": "Service", "Todos los servicios": "All services",
    "Contactos y solicitudes asociadas": "Contacts and related requests", "Consulta el contacto, su última solicitud y la próxima acción sin convertir la demo en un CRM complejo.": "View the contact, latest request, and next action without turning the demo into a complex CRM.", "Contactos recientes": "Recent contacts", "Última solicitud y estado": "Latest request and status",
    "Estados comerciales": "Sales statuses", "Una forma común de saber en qué punto está cada oportunidad y qué acción necesita después.": "A shared way to know where every opportunity stands and what action it needs next.", "Nuevo": "New", "Entrada pendiente de primera revisión.": "Waiting for initial review.", "En preparación": "In preparation", "El negocio está revisando alcance y presupuesto.": "The business is reviewing the scope and estimate.", "Enviado": "Sent", "Propuesta o presupuesto compartido con el cliente.": "Proposal or estimate shared with the customer.", "Seguimiento pendiente": "Follow-up pending", "Hay que retomar el contacto o resolver una duda.": "Contact needs to be resumed or a question resolved.", "Ganado": "Won", "Oportunidad confirmada por el negocio.": "Opportunity confirmed by the business.", "Perdido": "Lost", "Solicitud cerrada sin continuar el proceso.": "Request closed without continuing the process.",
    "Emails simulados": "Simulated emails", "Emails automáticos simulados": "Simulated automated emails", "Dos ejemplos locales adaptados a la demo sectorial: aviso interno y confirmación al cliente.": "Two local examples adapted to the sector demo: an internal notification and a customer confirmation.", "Demo local · estos emails son ejemplos simulados y no se envían.": "Local demo · these emails are simulated examples and are not sent.", "Previsualizaciones de email": "Email previews", "Email interno al negocio": "Internal business email", "Confirmación al cliente": "Customer confirmation",
    "Datos locales": "Local data", "Tabla interna de solicitudes": "Internal request table", "Datos ficticios guardados solo en este navegador.": "Sample data stored only in this browser.", "Demo local · no conecta con Google Sheets": "Local demo · does not connect to Google Sheets", "Guardado local": "Saved locally", "Buscar": "Search", "Todos": "All", "Filtros de la hoja local": "Local sheet filters", "Barra de herramientas de la tabla interna": "Internal table toolbar", "Buscar en la hoja local": "Search local sheet", "Filtrar por estado": "Filter by status",
    "Resumen y dudas": "Summary and questions", "Datos": "Details", "Resumen": "Summary", "Respuesta": "Reply", "Seguimiento": "Follow-up", "Actividad": "Activity", "Volver": "Back", "← Volver a Solicitudes": "← Back to requests", "Ver detalle": "View details", "Copiar respuesta": "Copy reply", "Copiada": "Copied", "No se pudo copiar.": "Could not copy.",
    "Prioridad": "Priority", "Alta": "High", "Media": "Medium", "Baja": "Low", "Sin prioridad": "No priority", "Urgencia": "Urgency", "Recibida": "Received", "Fecha": "Date", "Origen": "Source", "Referencia": "Reference", "Próxima acción": "Next action", "Cliente": "Customer", "Contacto": "Contact", "Teléfono": "Phone", "Email": "Email", "Descripción": "Description", "Necesidad": "Need", "Adjuntos": "Attachments", "Abrir archivo": "Open file", "Sin archivos adjuntos.": "No attachments.",
    "No informado": "Not provided", "No disponible": "Unavailable", "Sin fecha": "No date", "Sin respuestas registradas.": "No answers recorded.", "Sin actividad registrada.": "No activity recorded.", "Sin comunicaciones registradas.": "No communications recorded.", "Sin respuesta sugerida disponible.": "No suggested reply available.", "Nota interna": "Internal note", "Añadir nota": "Add note", "Guardar nota": "Save note", "Cancelar": "Cancel", "Cerrar": "Close", "Actualizar": "Refresh", "Salir": "Sign out", "Negocio": "Business", "Negocio activo": "Active business",
    "Pendiente": "Pending", "Completado": "Completed", "Marcar como completado": "Mark as completed", "Desmarcar": "Mark as pending", "Añadir seguimiento": "Add follow-up", "Solicitud": "Request", "Tarea": "Task", "Fecha prevista": "Due date", "Añadir seguimiento": "Add follow-up", "No hay seguimientos reales registrados para este negocio.": "No real follow-ups are recorded for this business.", "No hay contactos reales para este negocio.": "There are no real contacts for this business.", "Ver solicitud": "View request", "Ver última solicitud": "View latest request", "Última solicitud": "Latest request", "Próxima fecha": "Next date", "Contactado": "Contacted", "Manual": "Manual", "Automático": "Automatic", "Acción humana": "Human action", "Automatización": "Automation", "Sistema": "System", "Formulario público": "Public form",
    "Solicitud real": "Live request", "Cambiar estado": "Change status", "Cambiar prioridad": "Change priority", "Archivar solicitud": "Archive request", "Restaurar solicitud": "Restore request", "Archivada": "Archived", "Actividad registrada": "Recorded activity", "Actividad del equipo": "Team activity", "Solicitud recibida": "Request received", "Seguimiento manual creado": "Manual follow-up created", "Seguimiento completado": "Follow-up completed", "Seguimiento reabierto": "Follow-up reopened", "Respuesta sugerida": "Suggested reply", "Comunicaciones": "Communications", "Archivos": "Files", "Notas internas": "Internal notes",
    "Demo local · datos de ejemplo · no se envían mensajes reales": "Local demo · sample data · no real messages are sent", "SolicitudPro Demo · datos ficticios guardados solo en este navegador.": "SolicitudPro Demo · sample data stored only in this browser.",
    "Solicitudes nuevas": "New requests", "Por revisar": "To review", "Respuestas pendientes": "Pending replies", "Preparar o revisar": "Prepare or review", "Seguimientos hoy/vencidos": "Follow-ups due today/overdue", "hoy": "today", "vencidos": "overdue", "Datos por confirmar": "Details to confirm", "Revisar contacto": "Review contact", "solicitudes sin respuesta preparada.": "requests without a prepared reply.", "seguimiento vencido.": "overdue follow-up.", "solicitudes con datos por confirmar.": "requests with details to confirm.",
    "Confirmar la fecha de visita y el horario de acceso al local.": "Confirm the visit date and premises access time.", "Reformas": "Renovations", "Electricidad": "Electrical", "Fontanería": "Plumbing", "Climatización": "Climate control", "Cristalerías": "Glazing", "Academias": "Education",
    "En preparación": "In preparation", "Enviado": "Sent", "Seguimiento pendiente": "Follow-up pending", "Ganado": "Won", "Perdido": "Lost",
    "Convierte una solicitud de cliente en una oportunidad organizada, con respuesta sugerida y seguimiento. Aquí el negocio revisa estados y próximas acciones desde un único lugar.": "Turn a customer request into an organized opportunity, with a suggested reply and follow-up. The business reviews statuses and next actions in one place.", "4 pendientes": "4 pending", "pendientes": "pending", "Resumen de seguimientos": "Follow-up summary", "Filtros del panel de solicitudes": "Request dashboard filters", "Indicadores por estado del pipeline": "Pipeline status indicators", "Zona confirmada": "Area confirmed", "Este mes": "This month", "Esta semana": "This week", "Sin prisa": "No rush", "Cerrado": "Closed",
    "No hay alertas activas en los datos de ejemplo.": "There are no active alerts in the sample data.", "Todo al día": "All caught up", "No hay una próxima acción pendiente en esta demo.": "There is no pending next action in this demo.", "No hay contactos en esta demo local.": "There are no contacts in this local demo.", "Selecciona un contacto para ver su historial.": "Select a contact to view their history.", "Ver ficha": "View profile", "Contacto seleccionado": "Selected contact", "Teléfono no informado": "Phone not provided", "Última actividad:": "Latest activity:", "Sin actividad": "No activity", "No hay una solicitud disponible para mostrar.": "There is no request available to show.", "Vista cliente · Demo local": "Customer view · Local demo", "En revisión": "Under review", "Próximo paso:": "Next step:", "Te contactaremos cuando revisemos la solicitud.": "We will contact you once we have reviewed the request.", "Demo local: no se envía ningún email ni se comparte información real.": "Local demo: no email is sent and no real information is shared.", "Continuar demo en el panel": "Continue the demo in the dashboard",
    "Vencido": "Overdue", "Hoy": "Today", "Próximo": "Upcoming", "contactados": "contacted", "seguimientos": "follow-ups", "No hay seguimientos pendientes.": "There are no pending follow-ups.", "Todavía no hay seguimientos contactados.": "There are no contacted follow-ups yet.", "No hay seguimientos activos.": "There are no active follow-ups.", "Acciones de seguimiento": "Follow-up actions", "Copiar WhatsApp": "Copy WhatsApp", "Marcar contactado": "Mark as contacted", "Acciones de seguimiento": "Follow-up actions",
    "Seguimiento comercial": "Sales follow-up", "SEGUIMIENTO COMERCIAL": "SALES FOLLOW-UP", "Próximas oportunidades a recuperar": "Upcoming opportunities to recover", "Acciones sugeridas por estado y urgencia para no perder solicitudes pendientes.": "Suggested actions by status and urgency, so pending requests do not slip away.", "Filtrar seguimientos por estado": "Filter follow-ups by status", "Contactados": "Contacted", "Pedir medidas aproximadas de la cocina y fotografías del espacio.": "Ask for approximate kitchen dimensions and photos of the space.", "Confirmar si la propuesta encaja con su fecha de mudanza.": "Confirm whether the proposal fits their move-in date.", "Reformas | Seguimiento pendiente | Esta semana": "Renovations | Follow-up pending | This week", "Reformas | En preparación | Esta semana": "Renovations | In preparation | This week", "Reformas | Nuevo | Este mes": "Renovations | New | This month", "Reformas | Enviado | Este mes": "Renovations | Sent | This month",
    "Editar solicitud": "Edit request", "Actualizar datos comerciales": "Update sales details", "Los cambios se guardan solo en este navegador.": "Changes are saved only in this browser.", "Nombre completo": "Full name", "Correo electrónico": "Email address", "Teléfono opcional": "Optional phone", "Tipo de servicio": "Service type", "Presupuesto aproximado": "Estimated budget", "Estado comercial": "Sales status", "Descripción del problema o necesidad": "Problem or need description", "Guardar cambios": "Save changes", "Solicitud cerrada": "Request closed", "Volver a solicitudes": "Back to requests", "Editar": "Edit", "Resumen comercial": "Sales summary", "Entrada:": "Received:", "Datos pendientes de confirmar": "Details to confirm", "Etiquetas de la solicitud": "Request tags", "Navegación secundaria del detalle": "Request detail navigation", "Datos recibidos de": "Details received from", "Avanzar por el detalle": "Progress through request detail", "Anterior": "Previous", "Siguiente: Resumen": "Next: Summary", "Contacto": "Contact", "Necesidad": "Need", "Datos del servicio": "Service details", "Fotos o adjuntos": "Photos or attachments", "Sin fotos o adjuntos.": "No photos or attachments.", "Resumen interno revisable": "Reviewable internal summary", "Datos a confirmar": "Details to confirm", "Respuesta sugerida para": "Suggested reply for", "Preparar respuesta desde el detalle": "Prepare reply from detail", "Copiar email": "Copy email", "Próximo seguimiento": "Next follow-up", "Historial de actividad": "Activity history", "No hay actividad registrada todavía.": "No activity has been recorded yet.", "Actividad registrada": "Recorded activity", "Tamaño no disponible": "Size unavailable"
    ,"Formulario": "Form", "Llamada": "Phone call", "Datos recibidos": "Received details", "Paso 1 de 5 · Datos": "Step 1 of 5 · Details", "Siguiente: Resumen y dudas": "Next: Summary and questions", "Datos de la reforma": "Renovation details", "Tipo de reforma:": "Renovation type:", "Zona:": "Area:", "Medidas aproximadas:": "Approximate dimensions:", "Disponibilidad para visita:": "Availability for a visit:", "Baño": "Bathroom", "Cocina": "Kitchen", "Centro": "City center", "Norte": "North", "Sur": "South", "Este": "East", "Pendientes": "Pending", "Facilitadas": "Provided", "Tardes": "Afternoons", "Por confirmar": "To confirm", "No necesaria": "Not needed", "Pendiente": "Pending", "Realizada": "Completed", "Medidas pendientes": "Dimensions pending", "Plazo por confirmar": "Timing to confirm", "Quiere reformar un baño pequeño: cambiar plato de ducha, mueble y revisar una humedad junto a la ventana.": "Wants to renovate a small bathroom: replace the shower tray and furniture, and inspect damp near the window.", "Revisar fotos y confirmar disponibilidad para una visita.": "Review photos and confirm availability for a visit.", "Solicitud recibida": "Request received", "Entrada de ejemplo disponible en la demo local.": "Sample request available in the local demo.", "Respuesta sugerida de Lucía Santos": "Suggested reply for Lucía Santos", "Respuesta sugerida para Lucía Santos": "Suggested reply for Lucía Santos", "Hola Lucía Santos, gracias por contactar. Hemos recibido la información sobre la reforma. Para poder orientarte mejor, nos vendría bien confirmar algunos detalles como fotos, medidas aproximadas y disponibilidad para una visita. Con eso podremos prepararte una respuesta más ajustada.": "Hi Lucía Santos, thanks for getting in touch. We have received the information about your renovation. To guide you better, we would like to confirm a few details such as photos, approximate dimensions, and availability for a visit. This will help us prepare a more accurate reply.", "Paso 3 de 5 · Respuesta sugerida": "Step 3 of 5 · Suggested reply", "Siguiente: Seguimiento": "Next: Follow-up"
  });

  // Sector-specific copy kept local so every demo variation remains usable in English.
  const SECTOR_EN = Object.freeze({
    "Trabajo": "Work", "Sectores de ejemplo": "Example sectors", "SolicitudPro para reformas": "SolicitudPro for renovation businesses", "SolicitudPro para electricistas": "SolicitudPro for electricians", "SolicitudPro para fontaneros": "SolicitudPro for plumbers", "SolicitudPro para climatización": "SolicitudPro for climate control", "SolicitudPro para cristalerías": "SolicitudPro for glazing businesses", "SolicitudPro para academias": "SolicitudPro for education businesses",
    "Solicitudes con fotos, medidas, visitas y presupuestos.": "Requests with photos, measurements, visits, and estimates.", "Averías, instalaciones, urgencias y revisiones.": "Faults, installations, urgent jobs, and inspections.", "Fugas, atascos, termos e incidencias urgentes.": "Leaks, blockages, water heaters, and urgent incidents.", "Aire acondicionado, instalaciones, averías y mantenimiento.": "Air conditioning, installations, faults, and maintenance.", "Cristales, ventanas, mamparas y cerramientos.": "Glass, windows, shower screens, and enclosures.", "Materias, niveles, horarios y modalidad.": "Subjects, levels, schedules, and format.",
    "Cuéntanos tu reforma": "Tell us about your renovation", "Cuéntanos qué ocurre": "Tell us what happened", "Cuéntanos la incidencia": "Tell us about the issue", "Cuéntanos qué necesitas": "Tell us what you need", "Encuentra la clase que necesitas": "Find the class you need", "No necesitas conocer medidas exactas. Cuéntanos qué quieres cambiar y añade fotos si las tienes.": "You do not need exact measurements. Tell us what you want to change and add photos if you have them.", "Describe qué ocurre y dónde. Si hay humo, chispas, olor a quemado o cables expuestos, no dependas del formulario para una emergencia.": "Describe what happened and where. If there is smoke, sparks, a burning smell, or exposed wires, do not rely on this form in an emergency.", "Indica qué ocurre y si el agua sigue saliendo. Una foto ayuda, pero no retrases la solicitud para subirla.": "Tell us what happened and whether water is still running. A photo helps, but do not delay your request to upload one.", "Indica si necesitas instalación, reparación o mantenimiento y cuéntanos qué equipo tienes. Las fotos son simuladas y no se suben.": "Tell us whether you need installation, repair, or maintenance and what equipment you have. Photos are simulated and are not uploaded.", "Indica el trabajo, las medidas aproximadas y si hay urgencia. Las fotos son simuladas y no se suben.": "Tell us about the work, approximate measurements, and urgency. Photos are simulated and are not uploaded.", "Indica la materia, el nivel y los horarios que mejor encajan. No compartas información médica o personal sensible.": "Tell us the subject, level, and schedules that work best. Do not share medical or sensitive personal information.",
    "Enviar solicitud de reforma": "Submit renovation request", "Enviar solicitud eléctrica": "Submit electrical request", "Enviar solicitud de fontanería": "Submit plumbing request", "Enviar solicitud de climatización": "Submit climate-control request", "Enviar solicitud de cristalería": "Submit glazing request", "Enviar solicitud de clases": "Submit class request", "Fotos o archivos (opcional)": "Photos or files (optional)", "Correo electrónico obligatorio": "Email address required", "Teléfono recomendable": "Phone recommended", "Zona o municipio": "Area or municipality", "Descripción breve": "Short description", "Plazo deseado": "Desired timeframe", "Urgencia o riesgo": "Urgency or risk", "Urgencia o agua activa": "Urgency or active water", "Tipo de incidencia": "Issue type", "Tipo de equipo": "Equipment type", "¿Qué necesitas?": "What do you need?", "¿Es urgente?": "Is it urgent?", "Describe el problema o instalación": "Describe the problem or installation", "Describe el trabajo": "Describe the work", "Materia": "Subject", "Nivel": "Level", "Objetivo": "Goal", "Modalidad": "Format", "Disponibilidad": "Availability",
    "Baño": "Bathroom", "Cocina": "Kitchen", "Reforma integral": "Full renovation", "Reforma parcial": "Partial renovation", "Local comercial": "Commercial premises", "Suelo o pintura": "Flooring or painting", "Avería eléctrica": "Electrical fault", "Instalación de enchufes": "Socket installation", "Iluminación": "Lighting", "Cuadro eléctrico": "Electrical panel", "Boletín o certificado": "Certificate or compliance document", "Fuga": "Leak", "Desagüe atascado": "Blocked drain", "Grifo o cisterna": "Tap or cistern", "Tubería": "Pipework", "Calentador": "Water heater", "Instalación de aire acondicionado": "Air-conditioning installation", "Reparación / avería": "Repair / fault", "Mantenimiento": "Maintenance", "Equipo no enfría": "Equipment is not cooling", "Ruido o fuga": "Noise or leak", "Presupuesto para varios splits": "Estimate for several split units", "Split pared": "Wall-mounted split", "Conductos": "Ducted system", "Cassette": "Cassette unit", "Varios splits": "Several split units", "Cristal roto": "Broken glass", "Cambio de cristal / ventana": "Glass / window replacement", "Mampara": "Shower screen", "Espejo": "Mirror", "Cerramiento": "Enclosure", "Presupuesto con medidas": "Estimate with measurements", "Matemáticas": "Mathematics", "Inglés": "English", "Lengua": "Language", "Física y química": "Physics and chemistry", "Valenciano": "Valencian", "Preparación PAU/EBAU": "University entrance preparation", "Informática": "Computer science", "Primaria": "Primary school", "ESO": "Secondary school", "Bachillerato": "Sixth-form", "FP": "Vocational training", "Universidad": "University", "Adultos": "Adults", "Examen oficial": "Official exam", "Refuerzo": "Extra support", "Recuperación": "Catch-up", "Preparar examen": "Exam preparation", "Mejorar conversación": "Conversation practice", "Apoyo continuo": "Ongoing support", "Presencial": "In person", "Indistinta": "Either",
    "Lo antes posible": "As soon as possible", "En las próximas semanas": "Within the next few weeks", "En 1-3 meses": "In 1–3 months", "Más adelante": "Later", "Solo quiero orientación": "I only need guidance", "Riesgo inmediato": "Immediate risk", "24-48 horas": "24–48 hours", "Agua activa": "Active water", "No lo sé": "I do not know", "Sin prisa": "No rush", "Hemos recibido tu solicitud": "We have received your request", "Hemos recibido tu solicitud.": "We have received your request.", "Solicitud creada": "Request created", "Solicitud recibida": "Request received", "Solicitud cerrada": "Request closed", "Registro inicial importado en la demo local.": "Initial record imported into the local demo.", "Adjuntas en la demo": "Attached in the demo", "Sin fotos adjuntas": "No photos attached", "Foto opcional": "Optional photo", "Foto pendiente": "Photo pending", "Medidas por confirmar": "Measurements to confirm", "Horario pendiente": "Schedule pending", "Modalidad por confirmar": "Format to confirm", "Nivel confirmado": "Level confirmed", "Objetivo definido": "Goal defined", "Respuesta lista": "Reply ready", "Datos listos para revisar": "Details ready to review", "Datos listos para valorar": "Details ready for an estimate", "Datos suficientes para contactar": "Enough details to make contact", "Equipo por confirmar": "Equipment to confirm", "Riesgo por confirmar": "Risk to confirm", "Urgencia por confirmar": "Urgency to confirm", "Zona por confirmar": "Area to confirm", "Zona afectada": "Affected area", "Zona afectada por confirmar": "Affected area to confirm", "Acceso por confirmar": "Access to confirm", "Daño activo": "Active damage", "Agua o daño activo": "Water or active damage", "Visita recomendada": "Visit recommended", "Prioridad alta": "High priority", "Rotura prioritaria": "Priority breakage", "Revisión pendiente": "Review pending", "Encaje de clase pendiente": "Class fit pending",
    "Tipo de reforma": "Renovation type", "Tipo de trabajo": "Job type", "Tipo de espacio": "Space type", "Zona": "Area", "Zona o municipio": "Area or municipality", "Medidas aproximadas": "Approximate measurements", "Disponibilidad para visita": "Availability for a visit", "Plazo por confirmar": "Timeframe to confirm", "Disponibilidad": "Availability", "Urgencia": "Urgency", "Fotos": "Photos", "Visita": "Visit", "Trabajo": "Job", "Equipo": "Equipment", "Teléfono necesario": "Phone needed", "Teléfono": "Phone", "Teléfono no informado": "Phone not provided", "Por confirmar": "To confirm", "No lo sabe todavía": "Not sure yet",
    "Confirmar si hay corte de luz y coordinar una revisión segura.": "Confirm whether there is a power cut and coordinate a safe inspection.", "Confirmar disponibilidad y preparar una revisión eléctrica segura.": "Confirm availability and prepare a safe electrical inspection.", "Confirmar acceso, disponibilidad y si la incidencia continúa activa.": "Confirm access, availability, and whether the issue is still active.", "Confirmar tipo de equipo, acceso y disponibilidad para visita o presupuesto.": "Confirm equipment type, access, and availability for a visit or estimate.", "Revisar medidas aproximadas y confirmar si hace falta visita para valorar el trabajo.": "Review approximate measurements and confirm whether a visit is needed to assess the job.", "Confirmar nivel, disponibilidad y preferencia de modalidad.": "Confirm level, availability, and preferred format.", "Revisar fotos y confirmar disponibilidad para una visita.": "Review photos and confirm availability for a visit.", "Pedir medidas aproximadas de la cocina y fotografías del espacio.": "Ask for approximate kitchen measurements and photos of the space.", "Confirmar la fecha de visita y el horario de acceso al local.": "Confirm the visit date and premises access time.", "Proponer grupos de tarde y confirmar el nivel aproximado.": "Suggest afternoon groups and confirm the approximate level.", "Consultar si quiere reservar plaza en el grupo de preparación.": "Ask whether they would like to reserve a place in the preparation group.", "Revisar si el horario de tarde sigue disponible para esta solicitud.": "Check whether the afternoon schedule is still available for this request.", "Revisar si el horario y la modalidad siguen encajando para proponer una clase.": "Check whether the schedule and format still work for proposing a class."
  });

  function normalizeLanguage(value) { return SUPPORTED_LANGUAGES.has(value) ? value : null; }

  function resolveDemoLanguage({ search = "", stored = "", languages = [] } = {}) {
    const explicit = new URLSearchParams(search).get("lang");
    if (normalizeLanguage(explicit)) return explicit;
    if (normalizeLanguage(stored)) return stored;
    const preferred = Array.isArray(languages) ? languages : [];
    return preferred.some(language => String(language).toLowerCase().startsWith("es")) ? "es" : "en";
  }

  function buildLanguageUrl(rawUrl, language) {
    const url = new URL(rawUrl, "http://localhost");
    url.searchParams.set("lang", normalizeLanguage(language) || "en");
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function createTranslator(language) {
    const active = normalizeLanguage(language) || "en";
    return text => active === "es" ? String(text ?? "") : ((EN[String(text ?? "")] || SECTOR_EN[String(text ?? "")] || String(text ?? "")));
  }

  function translateInterpolatedText(source, translate) {
    const leading = source.match(/^\s*/u)?.[0] || "";
    const trailing = source.match(/\s*$/u)?.[0] || "";
    const core = source.trim();
    const normalized = core.replace(/\s+/gu, " ");
    const direct = translate(normalized);
    if (direct !== normalized) return `${leading}${direct}${trailing}`;
    return `${leading}${core
      .replace(/SOLICITUD SELECCIONADA · DETALLE DE SOLICITUD/gu, "SELECTED REQUEST · REQUEST DETAIL")
      .replace(/^Urgencia:\s*/u, "Urgency: ")
      .replace(/^Próxima acción:\s*/u, "Next action: ")
      .replace(/^Estado:\s*/u, "Status: ")
      .replace(/^Origen:\s*/u, "Source: ")
      .replace(/^Creada\s+/u, "Created ")
      .replace(/^Enviada\s+/u, "Sent ")
      .replace(/^Completado\s+/u, "Completed ")
      .replace(/^Pendiente\s+·\s*/u, "Pending · ")
      .replace(/^Manual\s+·\s*/u, "Manual · ")
      .replace(/^Datos recibidos de\s+/u, "Details received from ")
      .replace(/^Respuesta sugerida de\s+/u, "Suggested reply for ")
      .replace(/^Seguimiento de\s+/u, "Follow-up for ")
      .replace(/^Paso (\d+) de (\d+) · Datos(?: recibidos)?$/u, "Step $1 of $2 · Details")
      .replace(/^Paso (\d+) de (\d+) · Respuesta sugerida$/u, "Step $1 of $2 · Suggested reply")
      .replace(/^Paso (\d+) de (\d+) · Seguimiento$/u, "Step $1 of $2 · Follow-up")
      .replace(/^Siguiente: Resumen y dudas$/u, "Next: Summary and questions")
      .replace(/^Siguiente: Seguimiento$/u, "Next: Follow-up")
      .replace(/^Siguiente: Actividad$/u, "Next: Activity")
      .replace(/^Entrada:\s*/u, "Received: ")
      .replace(/^Seguimiento:\s*/u, "Follow-up: ")
      .replace(/^← Volver a Inicio$/u, "← Back to Home")
      .replace(/^(\d+) hoy · (\d+) vencidos$/u, "$1 today · $2 overdue")
      .replace(/^(\d+) solicitudes sin respuesta preparada\.$/u, "$1 requests without a prepared reply.")
      .replace(/^(\d+) seguimiento vencido\.$/u, "$1 overdue follow-up.")
      .replace(/^(\d+) seguimientos vencidos\.$/u, "$1 overdue follow-ups.")
      .replace(/^(\d+) solicitudes con datos por confirmar\.$/u, "$1 requests with details to confirm.")
      .replace(/Convierte una solicitud de cliente en una oportunidad organizada,[\s\S]*?desde un único lugar\./u, "Turn a customer request into an organized opportunity with a suggested reply and follow-up. The business reviews statuses and next actions in one place.")
      .replace(/\bNuevo\b/gu, "New")
      .replace(/\bEn preparación\b/gu, "In preparation")
      .replace(/\bSeguimiento pendiente\b/gu, "Follow-up pending")
      .replace(/\bGanado\b/gu, "Won")
      .replace(/\bPerdido\b/gu, "Lost")
      .replace(/\bAlta\b/gu, "High")
      .replace(/\bMedia\b/gu, "Medium")
      .replace(/\bBaja\b/gu, "Low")
      .replace(/\bFormulario\b/gu, "Form")
      .replace(/\bReformas\b/gu, "Renovations")
      .replace(/\bEsta semana\b/gu, "This week")
      .replace(/\bEste mes\b/gu, "This month")
      .replace(/\bene\.?\b/gu, "Jan")
      .replace(/\bfeb\.?\b/gu, "Feb")
      .replace(/\bmar\.?\b/gu, "Mar")
      .replace(/\babr\.?\b/gu, "Apr")
      .replace(/\bmay\.?\b/gu, "May")
      .replace(/\bjun\.?\b/gu, "Jun")
      .replace(/\bjul\.?\b/gu, "Jul")
      .replace(/\bago\.?\b/gu, "Aug")
      .replace(/\bsept\.?\b/gu, "Sep")
      .replace(/\boct\.?\b/gu, "Oct")
      .replace(/\bnov\.?\b/gu, "Nov")
      .replace(/\bdic\.?\b/gu, "Dec")}${trailing}`;
  }

  function initialize(window) {
    const document = window.document;
    const current = () => document.documentElement.lang || "es";
    const translate = text => translateInterpolatedText(String(text ?? ""), createTranslator(current()));
    let observer = null;

    function applyElement(element) {
      if (!element || element.closest?.("script, style") || current() === "es") return;
      for (const attribute of ["placeholder", "title", "aria-label", "value"]) {
        if (!element.hasAttribute?.(attribute)) continue;
        const value = element.getAttribute(attribute);
        const sourceAttribute = `data-i18n-source-${attribute}`;
        if (!element.hasAttribute(sourceAttribute)) element.setAttribute(sourceAttribute, value);
        element.setAttribute(attribute, translate(element.getAttribute(sourceAttribute)));
      }
      for (const node of element.childNodes || []) {
        if (node.nodeType !== window.Node.TEXT_NODE || !node.nodeValue.trim()) continue;
        if (!node.__solicitudProI18nSource) node.__solicitudProI18nSource = node.nodeValue;
        node.nodeValue = translate(node.__solicitudProI18nSource);
      }
      for (const child of element.children || []) applyElement(child);
    }

    function restoreElement(element) {
      if (!element || element.closest?.("script, style")) return;
      for (const attribute of ["placeholder", "title", "aria-label", "value"]) {
        const sourceAttribute = `data-i18n-source-${attribute}`;
        if (element.hasAttribute?.(sourceAttribute)) element.setAttribute(attribute, element.getAttribute(sourceAttribute));
      }
      for (const node of element.childNodes || []) {
        if (node.nodeType === window.Node.TEXT_NODE && node.__solicitudProI18nSource) node.nodeValue = node.__solicitudProI18nSource;
      }
      for (const child of element.children || []) restoreElement(child);
    }

    function updateSelector(language) {
      document.querySelectorAll("[data-demo-language]").forEach(button => {
        const selected = button.dataset.demoLanguage === language;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }

    function setLanguage(language, { persist = true, replaceUrl = true } = {}) {
      const next = normalizeLanguage(language) || "en";
      restoreElement(document.body);
      document.documentElement.lang = next;
      document.documentElement.dir = "ltr";
      if (next === "en") applyElement(document.body);
      document.title = next === "en" ? "SolicitudPro Demo" : "Demo de SolicitudPro";
      updateSelector(next);
      if (persist) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      if (replaceUrl && window.history?.replaceState) window.history.replaceState({}, "", buildLanguageUrl(window.location.href, next));
      document.dispatchEvent(new window.CustomEvent("solicitudpro:languagechange", { detail: { language: next } }));
      return next;
    }

    function mountSelector() {
      if (document.getElementById("demo-language-selector")) return;
      const target = document.querySelector(".app-topbar-actions") || document.querySelector("header") || document.body;
      const control = document.createElement("div");
      control.id = "demo-language-selector";
      control.className = "demo-language-selector";
      control.setAttribute("aria-label", "Language selector");
      control.innerHTML = '<button type="button" data-demo-language="es" aria-pressed="false">ES</button><span aria-hidden="true">|</span><button type="button" data-demo-language="en" aria-pressed="false">EN</button>';
      control.addEventListener("click", event => {
        const language = event.target.closest("[data-demo-language]")?.dataset.demoLanguage;
        if (language) setLanguage(language);
      });
      target.prepend(control);
    }

    function start() {
      mountSelector();
      const language = resolveDemoLanguage({
        search: window.location.search,
        stored: window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
        languages: window.navigator.languages?.length ? window.navigator.languages : [window.navigator.language],
      });
      setLanguage(language, { persist: Boolean(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)), replaceUrl: true });
      observer = new window.MutationObserver(records => {
        if (current() !== "en") return;
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === window.Node.ELEMENT_NODE) applyElement(node);
          if (node.nodeType === window.Node.TEXT_NODE && node.parentElement) applyElement(node.parentElement);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
    return { LANGUAGE_STORAGE_KEY, resolveDemoLanguage, buildLanguageUrl, createTranslator, setLanguage, translate };
  }

  return { LANGUAGE_STORAGE_KEY, resolveDemoLanguage, buildLanguageUrl, createTranslator, initialize };
});
