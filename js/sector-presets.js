(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SectorPresets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SECTOR_PRESETS = Object.freeze({
    reformas: Object.freeze({
      id: "reformas",
      label: "Reformas",
      title: "SolicitudPro para reformas",
      description: "Solicitudes con fotos, medidas, visitas y presupuestos.",
      featuredRequestId: "reformas-001",
    }),
    electricidad: Object.freeze({
      id: "electricidad",
      label: "Electricidad",
      title: "SolicitudPro para electricistas",
      description: "Averías, instalaciones, urgencias y revisiones.",
      featuredRequestId: "electricidad-001",
    }),
    fontaneria: Object.freeze({
      id: "fontaneria",
      label: "Fontanería",
      title: "SolicitudPro para fontaneros",
      description: "Fugas, atascos, termos e incidencias urgentes.",
      featuredRequestId: "fontaneria-001",
    }),
    academias: Object.freeze({
      id: "academias",
      label: "Academias",
      title: "SolicitudPro para academias",
      description: "Materias, niveles, horarios y modalidad.",
      featuredRequestId: "academias-001",
    }),
    climatizacion: Object.freeze({
      id: "climatizacion",
      label: "Climatización",
      title: "SolicitudPro para climatización",
      description: "Aire acondicionado, instalaciones, averías y mantenimiento.",
      featuredRequestId: "climatizacion-001",
    }),
    cristaleria: Object.freeze({
      id: "cristaleria",
      label: "Cristalerías",
      title: "SolicitudPro para cristalerías",
      description: "Cristales, ventanas, mamparas y cerramientos.",
      featuredRequestId: "cristaleria-001",
    }),
  });

  function toIsoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function getRelativeDate(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
  }

  function createRequestSeed(sector, values) {
    const createdAt = getRelativeDate(values.createdDaysAgo);

    return {
      id: values.id,
      sector,
      reference: values.reference,
      name: values.name,
      email: values.email,
      phone: values.phone,
      service: values.service,
      description: values.description,
      budget: values.budget,
      urgency: values.urgency,
      status: values.status,
      origin: values.origin,
      createdAt,
      nextFollowUp: values.nextFollowUp,
      nextFollowUpDate: getRelativeDate(values.followUpInDays),
      followUpRuleVersion: 3,
      attachments: values.attachments || [],
      customAnswers: values.customAnswers,
      activityHistory: [
        {
          date: createdAt,
          type: "created",
          label: "Solicitud recibida",
          detail: "Entrada de ejemplo disponible en la demo local.",
        },
      ],
    };
  }

  function createClimatizacionSeeds() {
    return [
      ["CLI-001", "Sofía Marín", "Instalación de aire acondicionado", "Esta semana", "Quiere presupuesto para instalar aire acondicionado en salón y habitación.", "Split pared", "Valencia", "Nuevo", "Formulario", "Confirmar potencia, ubicación de los equipos y disponibilidad para visita."],
      ["CLI-002", "Oficina Llevant", "Equipo no enfría", "Hoy", "El equipo del despacho funciona pero no enfría desde esta mañana.", "Split pared", "Paterna", "En preparación", "WhatsApp", "Llamar para confirmar si hay aviso de error, ruido o fuga antes de la revisión."],
      ["CLI-003", "Marcos Vidal", "Mantenimiento", "Este mes", "Solicita mantenimiento preventivo de dos equipos antes de la temporada de calor.", "Dos splits", "Valencia", "Enviado", "Email", "Confirmar si quiere reservar una fecha de mantenimiento."],
      ["CLI-004", "Cafetería Alba", "Ruido o fuga", "Esta semana", "Una unidad interior hace ruido y ha dejado una pequeña marca de agua.", "Cassette", "Burjassot", "Seguimiento pendiente", "Llamada", "Confirmar si el goteo continúa y coordinar acceso al local."],
      ["CLI-005", "Irene Ferrer", "Presupuesto para varios splits", "Sin prisa", "Ha aceptado una propuesta para climatizar un piso con tres estancias.", "Tres splits", "Valencia", "Ganado", "Formulario", "Preparar visita técnica para concretar la instalación acordada."],
    ].map(([reference, name, tipoTrabajo, urgency, description, tipoEquipo, zona, status, origin, nextFollowUp], index) =>
      createRequestSeed("climatizacion", {
        id: `climatizacion-00${index + 1}`,
        reference,
        name,
        email: `${name.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, ".")}@example.com`,
        phone: `+34 610 440 0${index + 1}`,
        service: "Climatización",
        description,
        budget: index === 0 || index === 4 ? "1.000 - 3.000 EUR" : "300 - 1.000 EUR",
        urgency,
        status,
        origin,
        createdDaysAgo: -(index + 1),
        followUpInDays: index === 3 ? -1 : index + 1,
        nextFollowUp,
        attachments: index === 0 || index === 3 ? [{ name: `climatizacion-demo-${index + 1}.jpg`, type: "image/jpeg", size: 148000 + index * 9000 }] : [],
        customAnswers: { tipoTrabajo, urgencia: urgency, zona, tipoEquipo },
      })
    );
  }

  function createCristaleriaSeeds() {
    return [
      ["CRI-001", "Laura Soler", "Cambio de cristal / ventana", "Lo antes posible", "Necesita presupuesto para sustituir un cristal y valorar cambio de ventana.", "120 x 90 cm", "Valencia", "Nuevo", "Formulario", "Revisar medidas y confirmar si hace falta visita para valorar el hueco."],
      ["CRI-002", "Comunidad Azahar", "Cristal roto", "Hoy", "Hay un cristal roto en el portal y piden una solución segura para la zona común.", "90 x 200 cm", "Mislata", "En preparación", "Llamada", "Confirmar medidas aproximadas, acceso y si la zona está asegurada."],
      ["CRI-003", "Pablo Esteve", "Mampara", "Esta semana", "Quiere cambiar una mampara de ducha y necesita orientación sobre medidas y acabado.", "140 x 195 cm", "Valencia", "Enviado", "WhatsApp", "Consultar si puede enviar medidas o una foto del baño."],
      ["CRI-004", "Local Naranjo", "Cerramiento", "Este mes", "Solicita presupuesto para cerrar una terraza de local con vidrio y perfiles.", "Pendientes", "Alboraia", "Seguimiento pendiente", "Email", "Coordinar una visita para tomar medidas y valorar el cerramiento."],
      ["CRI-005", "Marta Sáez", "Espejo", "Sin prisa", "Ha confirmado el cambio de un espejo a medida para el recibidor.", "100 x 70 cm", "Valencia", "Ganado", "Formulario", "Preparar la toma final de medidas antes de fabricar el espejo."],
    ].map(([reference, name, tipoTrabajo, urgency, description, medidasAproximadas, zona, status, origin, nextFollowUp], index) =>
      createRequestSeed("cristaleria", {
        id: `cristaleria-00${index + 1}`,
        reference,
        name,
        email: `${name.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, ".")}@example.com`,
        phone: `+34 620 550 0${index + 1}`,
        service: "Cristalerías",
        description,
        budget: index === 3 ? "Más de 3.000 EUR" : "300 - 1.000 EUR",
        urgency,
        status,
        origin,
        createdDaysAgo: -(index + 1),
        followUpInDays: index === 3 ? -1 : index + 1,
        nextFollowUp,
        attachments: index < 3 ? [{ name: `cristaleria-demo-${index + 1}.jpg`, type: "image/jpeg", size: 136000 + index * 11000 }] : [],
        customAnswers: { tipoTrabajo, urgencia: urgency, zona, medidasAproximadas },
      })
    );
  }

  const SECTOR_REQUEST_SEEDS = Object.freeze({
    reformas: Object.freeze([
      createRequestSeed("reformas", {
        id: "reformas-001",
        reference: "REF-001",
        name: "Lucía Santos",
        email: "lucia.santos@example.com",
        phone: "+34 612 448 071",
        service: "Reformas",
        description: "Quiere reformar un baño pequeño: cambiar plato de ducha, mueble y revisar una humedad junto a la ventana.",
        budget: "1.000 - 3.000 EUR",
        urgency: "Este mes",
        status: "Nuevo",
        origin: "Formulario",
        createdDaysAgo: -1,
        followUpInDays: 1,
        nextFollowUp: "Revisar fotos y confirmar disponibilidad para una visita.",
        attachments: [{ name: "bano-humedad-demo.jpg", type: "image/jpeg", size: 184000 }],
        customAnswers: { tipoReforma: "Baño", zona: "Centro", medidas: "Pendientes", visita: "Tardes" },
      }),
      createRequestSeed("reformas", {
        id: "reformas-002",
        reference: "REF-002",
        name: "Pedro Campos",
        email: "pedro.campos@example.com",
        phone: "+34 623 991 284",
        service: "Reformas",
        description: "Solicita una primera orientación para renovar la cocina, con nuevos frentes, encimera y puntos de luz.",
        budget: "3.000 - 8.000 EUR",
        urgency: "Esta semana",
        status: "En preparación",
        origin: "WhatsApp",
        createdDaysAgo: -2,
        followUpInDays: 0,
        nextFollowUp: "Pedir medidas aproximadas de la cocina y fotografías del espacio.",
        customAnswers: { tipoReforma: "Cocina", zona: "Norte", medidas: "Pendientes", visita: "Por confirmar" },
      }),
      createRequestSeed("reformas", {
        id: "reformas-003",
        reference: "REF-003",
        name: "Elena Martín",
        email: "elena.martin@example.com",
        phone: "+34 644 120 518",
        service: "Reformas",
        description: "Necesita pintar y cambiar el suelo laminado de dos habitaciones antes de mudarse a la vivienda.",
        budget: "1.000 - 3.000 EUR",
        urgency: "Este mes",
        status: "Enviado",
        origin: "Formulario",
        createdDaysAgo: -4,
        followUpInDays: 2,
        nextFollowUp: "Confirmar si la propuesta encaja con su fecha de mudanza.",
        customAnswers: { tipoReforma: "Suelo y pintura", zona: "Este", medidas: "Facilitadas", visita: "No necesaria" },
      }),
      createRequestSeed("reformas", {
        id: "reformas-004",
        reference: "REF-004",
        name: "Local Pinar",
        email: "gestion@localpinar.example.com",
        phone: "+34 633 741 208",
        service: "Reformas",
        description: "Quiere adaptar un pequeño local comercial con pintura, división ligera y revisión de accesos.",
        budget: "Más de 3.000 EUR",
        urgency: "Esta semana",
        status: "Seguimiento pendiente",
        origin: "Llamada",
        createdDaysAgo: -6,
        followUpInDays: -1,
        nextFollowUp: "Confirmar la fecha de visita y el horario de acceso al local.",
        customAnswers: { tipoReforma: "Local comercial", zona: "Centro", medidas: "Pendientes", visita: "Pendiente" },
      }),
      createRequestSeed("reformas", {
        id: "reformas-005",
        reference: "REF-005",
        name: "Álvaro Ríos",
        email: "alvaro.rios@example.com",
        phone: "+34 698 550 029",
        service: "Reformas",
        description: "Solicitó presupuesto para renovar una terraza y ya ha confirmado la propuesta de trabajo.",
        budget: "1.000 - 3.000 EUR",
        urgency: "Sin prisa",
        status: "Ganado",
        origin: "Email",
        createdDaysAgo: -9,
        followUpInDays: 3,
        nextFollowUp: "Preparar los datos de inicio del trabajo acordado.",
        customAnswers: { tipoReforma: "Terraza", zona: "Sur", medidas: "Facilitadas", visita: "Realizada" },
      }),
    ]),
    electricidad: Object.freeze([
      createRequestSeed("electricidad", {
        id: "electricidad-001",
        reference: "ELE-001",
        name: "Diego Vega",
        email: "diego.vega@example.com",
        phone: "+34 611 742 605",
        service: "Electricidad",
        description: "El cuadro eléctrico salta al conectar varios equipos en la cocina y necesita una revisión sin manipular la instalación.",
        budget: "300 - 1.000 EUR",
        urgency: "Hoy",
        status: "Nuevo",
        origin: "WhatsApp",
        createdDaysAgo: 0,
        followUpInDays: 0,
        nextFollowUp: "Confirmar si hay corte de luz y coordinar una revisión segura.",
        attachments: [{ name: "cuadro-electrico-demo.jpg", type: "image/jpeg", size: 151000 }],
        customAnswers: { tipoTrabajo: "Avería eléctrica", riesgo: "Sin daños visibles", espacio: "Vivienda", zona: "Centro" },
      }),
      createRequestSeed("electricidad", {
        id: "electricidad-002",
        reference: "ELE-002",
        name: "Comunidad Olmo",
        email: "administracion@comunidadolmo.example.com",
        phone: "+34 900 121 883",
        service: "Electricidad",
        description: "Pide presupuesto para instalar iluminación con sensores en el portal y las zonas comunes del edificio.",
        budget: "1.000 - 3.000 EUR",
        urgency: "Este mes",
        status: "En preparación",
        origin: "Formulario",
        createdDaysAgo: -2,
        followUpInDays: 1,
        nextFollowUp: "Solicitar fotografías de las zonas comunes y confirmar acceso.",
        customAnswers: { tipoTrabajo: "Iluminación", riesgo: "No aplica", espacio: "Comunidad", zona: "Oeste" },
      }),
      createRequestSeed("electricidad", {
        id: "electricidad-003",
        reference: "ELE-003",
        name: "Nuria López",
        email: "nuria.lopez@example.com",
        phone: "+34 620 118 933",
        service: "Electricidad",
        description: "Necesita añadir enchufes y revisar dos puntos de luz en un despacho que está reorganizando.",
        budget: "300 - 1.000 EUR",
        urgency: "Esta semana",
        status: "Enviado",
        origin: "Email",
        createdDaysAgo: -4,
        followUpInDays: 2,
        nextFollowUp: "Consultar si quiere reservar una fecha para la instalación.",
        customAnswers: { tipoTrabajo: "Enchufes e iluminación", riesgo: "No aplica", espacio: "Vivienda", zona: "Norte" },
      }),
      createRequestSeed("electricidad", {
        id: "electricidad-004",
        reference: "ELE-004",
        name: "Local Marea",
        email: "hola@localmarea.example.com",
        phone: "+34 635 440 779",
        service: "Electricidad",
        description: "Solicita una revisión del cuadro eléctrico del local antes de ampliar la potencia de varios equipos.",
        budget: "300 - 1.000 EUR",
        urgency: "Esta semana",
        status: "Seguimiento pendiente",
        origin: "Llamada",
        createdDaysAgo: -6,
        followUpInDays: -1,
        nextFollowUp: "Confirmar si necesita boletín o certificado tras la revisión.",
        customAnswers: { tipoTrabajo: "Revisión de cuadro", riesgo: "Por confirmar", espacio: "Local", zona: "Sur" },
      }),
      createRequestSeed("electricidad", {
        id: "electricidad-005",
        reference: "ELE-005",
        name: "Pilar Vidal",
        email: "pilar.vidal@example.com",
        phone: "+34 610 788 410",
        service: "Electricidad",
        description: "Pidió una certificación para una instalación antigua, pero finalmente ha elegido otra alternativa.",
        budget: "Menos de 300 EUR",
        urgency: "Sin prisa",
        status: "Perdido",
        origin: "Formulario",
        createdDaysAgo: -10,
        followUpInDays: 3,
        nextFollowUp: "Cerrar el seguimiento comercial de esta solicitud.",
        customAnswers: { tipoTrabajo: "Boletín o certificado", riesgo: "No aplica", espacio: "Vivienda", zona: "Este" },
      }),
    ]),
    fontaneria: Object.freeze([
      createRequestSeed("fontaneria", {
        id: "fontaneria-001",
        reference: "FON-001",
        name: "Carmen Soler",
        email: "carmen.soler@example.com",
        phone: "+34 609 424 907",
        service: "Fontanería",
        description: "Tiene una fuga activa bajo el fregadero de la cocina y quiere una visita para evitar que siga mojando el mueble.",
        budget: "Menos de 300 EUR",
        urgency: "Hoy",
        status: "Nuevo",
        origin: "Formulario",
        createdDaysAgo: 0,
        followUpInDays: 0,
        nextFollowUp: "Confirmar acceso a la vivienda y disponibilidad para una visita urgente.",
        attachments: [{ name: "fuga-fregadero-demo.jpg", type: "image/jpeg", size: 132000 }],
        customAnswers: { tipoIncidencia: "Fuga", aguaActiva: "Sí", espacio: "Vivienda", zona: "Centro" },
      }),
      createRequestSeed("fontaneria", {
        id: "fontaneria-002",
        reference: "FON-002",
        name: "Raúl Pardo",
        email: "raul.pardo@example.com",
        phone: "+34 628 312 760",
        service: "Fontanería",
        description: "Solicita ayuda por un atasco recurrente en el fregadero de un piso que tiene alquilado.",
        budget: "Menos de 300 EUR",
        urgency: "Esta semana",
        status: "En preparación",
        origin: "WhatsApp",
        createdDaysAgo: -2,
        followUpInDays: 1,
        nextFollowUp: "Confirmar si el agua desagua y el horario de acceso al piso.",
        customAnswers: { tipoIncidencia: "Atasco", aguaActiva: "No", espacio: "Vivienda", zona: "Norte" },
      }),
      createRequestSeed("fontaneria", {
        id: "fontaneria-003",
        reference: "FON-003",
        name: "Irene Cid",
        email: "irene.cid@example.com",
        phone: "+34 617 991 603",
        service: "Fontanería",
        description: "Quiere sustituir un termo eléctrico antiguo y ha enviado la información básica de la instalación actual.",
        budget: "300 - 1.000 EUR",
        urgency: "Este mes",
        status: "Enviado",
        origin: "Email",
        createdDaysAgo: -4,
        followUpInDays: 2,
        nextFollowUp: "Consultar si desea reservar la sustitución del termo.",
        customAnswers: { tipoIncidencia: "Cambio de termo", aguaActiva: "No", espacio: "Vivienda", zona: "Este" },
      }),
      createRequestSeed("fontaneria", {
        id: "fontaneria-004",
        reference: "FON-004",
        name: "David Luna",
        email: "david.luna@example.com",
        phone: "+34 632 775 120",
        service: "Fontanería",
        description: "Solicita presupuesto para reparar una tubería en el baño antes de instalar un nuevo mueble.",
        budget: "300 - 1.000 EUR",
        urgency: "Esta semana",
        status: "Seguimiento pendiente",
        origin: "Llamada",
        createdDaysAgo: -6,
        followUpInDays: -1,
        nextFollowUp: "Confirmar medidas y si puede enviar una foto de la zona afectada.",
        customAnswers: { tipoIncidencia: "Tubería", aguaActiva: "Por confirmar", espacio: "Vivienda", zona: "Oeste" },
      }),
      createRequestSeed("fontaneria", {
        id: "fontaneria-005",
        reference: "FON-005",
        name: "Alba Serra",
        email: "alba.serra@example.com",
        phone: "+34 615 083 402",
        service: "Fontanería",
        description: "Ha aceptado la propuesta para cambiar grifería y revisar una pequeña pérdida en el baño.",
        budget: "300 - 1.000 EUR",
        urgency: "Sin prisa",
        status: "Ganado",
        origin: "Formulario",
        createdDaysAgo: -9,
        followUpInDays: 3,
        nextFollowUp: "Preparar la visita acordada para realizar el trabajo.",
        customAnswers: { tipoIncidencia: "Grifería", aguaActiva: "No", espacio: "Vivienda", zona: "Sur" },
      }),
    ]),
    academias: Object.freeze([
      createRequestSeed("academias", {
        id: "academias-001",
        reference: "ACA-001",
        name: "Paula Fernández",
        email: "paula.fernandez@example.com",
        phone: "+34 604 222 148",
        service: "Academia",
        description: "Busca apoyo de matemáticas para 4.º de ESO con el objetivo de preparar el próximo examen.",
        budget: "Menos de 300 EUR",
        urgency: "Esta semana",
        status: "Nuevo",
        origin: "Formulario",
        createdDaysAgo: -1,
        followUpInDays: 1,
        nextFollowUp: "Confirmar nivel, disponibilidad y preferencia de modalidad.",
        customAnswers: { materia: "Matemáticas", nivel: "4.º de ESO", objetivo: "Preparar examen", modalidad: "Presencial" },
      }),
      createRequestSeed("academias", {
        id: "academias-002",
        reference: "ACA-002",
        name: "Marcos Arias",
        email: "marcos.arias@example.com",
        phone: "+34 688 419 620",
        service: "Academia",
        description: "Quiere clases de inglés para adulto enfocadas a conversación y necesita conocer los horarios disponibles.",
        budget: "300 - 1.000 EUR",
        urgency: "Este mes",
        status: "En preparación",
        origin: "WhatsApp",
        createdDaysAgo: -2,
        followUpInDays: 1,
        nextFollowUp: "Proponer grupos de tarde y confirmar el nivel aproximado.",
        customAnswers: { materia: "Inglés", nivel: "Adulto", objetivo: "Conversación", modalidad: "Presencial" },
      }),
      createRequestSeed("academias", {
        id: "academias-003",
        reference: "ACA-003",
        name: "Laura Gómez",
        email: "laura.gomez@example.com",
        phone: "+34 632 001 873",
        service: "Academia",
        description: "Solicita información para preparar la PAU/EBAU con clases de refuerzo y planificación semanal.",
        budget: "300 - 1.000 EUR",
        urgency: "Este mes",
        status: "Enviado",
        origin: "Email",
        createdDaysAgo: -4,
        followUpInDays: 2,
        nextFollowUp: "Consultar si quiere reservar plaza en el grupo de preparación.",
        customAnswers: { materia: "Preparación PAU/EBAU", nivel: "Bachillerato", objetivo: "Acceso a la universidad", modalidad: "Mixta" },
      }),
      createRequestSeed("academias", {
        id: "academias-004",
        reference: "ACA-004",
        name: "Inés Roca",
        email: "ines.roca@example.com",
        phone: "+34 610 221 992",
        service: "Academia",
        description: "Busca refuerzo de primaria y necesita confirmar si hay disponibilidad dos tardes por semana.",
        budget: "Menos de 300 EUR",
        urgency: "Sin prisa",
        status: "Seguimiento pendiente",
        origin: "Llamada",
        createdDaysAgo: -6,
        followUpInDays: -1,
        nextFollowUp: "Revisar si el horario de tarde sigue disponible para esta solicitud.",
        customAnswers: { materia: "Refuerzo general", nivel: "Primaria", objetivo: "Mejorar hábitos de estudio", modalidad: "Presencial" },
      }),
      createRequestSeed("academias", {
        id: "academias-005",
        reference: "ACA-005",
        name: "Carlos Bernal",
        email: "carlos.bernal@example.com",
        phone: "+34 655 992 744",
        service: "Academia",
        description: "Consultó por preparación online de un examen oficial, pero ha aplazado la decisión para más adelante.",
        budget: "300 - 1.000 EUR",
        urgency: "Sin prisa",
        status: "Perdido",
        origin: "Formulario",
        createdDaysAgo: -10,
        followUpInDays: 3,
        nextFollowUp: "Cerrar el seguimiento y conservar el contacto de forma local.",
        customAnswers: { materia: "Examen oficial", nivel: "Adulto", objetivo: "Certificación", modalidad: "Online" },
      }),
    ]),
    climatizacion: Object.freeze(createClimatizacionSeeds()),
    cristaleria: Object.freeze(createCristaleriaSeeds()),
  });

  function cloneRequestSeed(request) {
    return {
      ...request,
      attachments: request.attachments.map((attachment) => ({ ...attachment })),
      customAnswers: { ...request.customAnswers },
      activityHistory: request.activityHistory.map((activity) => ({ ...activity })),
    };
  }

  function getSectorRequestSeeds(sectorId) {
    const seeds = SECTOR_REQUEST_SEEDS[sectorId];
    return seeds ? seeds.map(cloneRequestSeed) : [];
  }

  function getAnswerValue(request, keys) {
    const answers = request?.customAnswers || {};
    const possibleKeys = Array.isArray(keys) ? keys : [keys];

    for (const key of possibleKeys) {
      const value = String(answers[key] || "").trim();
      if (value) {
        return value;
      }
    }

    return "";
  }

  function isPendingValue(value) {
    return !value || /pendiente|por confirmar|no lo sabe/i.test(value);
  }

  function hasAttachments(request) {
    return Array.isArray(request?.attachments) && request.attachments.length > 0;
  }

  function withMaximumQuestions(questions) {
    return questions.filter(Boolean).slice(0, 4);
  }

  const SECTOR_INTERNAL_CONFIGS = Object.freeze({
    reformas: {
      detailTitle: "Datos de la reforma",
      detailFields: [
        { label: "Tipo de reforma", keys: "tipoReforma" },
        { label: "Zona", keys: "zona" },
        { label: "Plazo deseado", keys: "plazoDeseado" },
        { label: "Medidas aproximadas", keys: "medidas" },
        { label: "Disponibilidad para visita", keys: "visita" },
      ],
      getSummary(request) {
        const type = getAnswerValue(request, "tipoReforma") || "reforma";
        const zone = getAnswerValue(request, "zona") || "zona por confirmar";
        const measures = getAnswerValue(request, "medidas");
        const visit = getAnswerValue(request, "visita");
        return `Solicitud de ${type.toLowerCase()} en ${zone}. ${measures ? `Medidas: ${measures}.` : "Faltan medidas aproximadas."} ${visit ? `Visita: ${visit}.` : "Conviene confirmar si necesita una visita antes de valorar el trabajo."}`;
      },
      getPendingLabels(request) {
        const labels = [];
        if (!hasAttachments(request)) labels.push("Foto pendiente");
        if (isPendingValue(getAnswerValue(request, "medidas"))) labels.push("Medidas pendientes");
        if (isPendingValue(getAnswerValue(request, "visita"))) labels.push("Visita pendiente");
        if (isPendingValue(getAnswerValue(request, "plazoDeseado"))) labels.push("Plazo por confirmar");
        if (request.budget === "No lo sabe todavía") labels.push("Presupuesto orientativo pendiente");
        return labels;
      },
      getTags(request) {
        const pending = this.getPendingLabels(request);
        const zone = getAnswerValue(request, "zona");
        if (!pending.length) return ["Solicitud lista para valorar"];
        return zone ? ["Zona confirmada"] : [];
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Podrías enviarnos alguna foto del estado actual?",
          "¿Tienes medidas aproximadas del baño, cocina o estancia?",
          "¿En qué plazo te gustaría empezar la reforma?",
          "¿Quieres que valoremos una visita para ver el trabajo?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por contactar. Hemos recibido la información sobre la reforma. Para poder orientarte mejor, nos vendría bien confirmar algunos detalles como fotos, medidas aproximadas y disponibilidad para una visita. Con eso podremos prepararte una respuesta más ajustada.`;
      },
      getNextAction(request) {
        if (!hasAttachments(request)) return "Pedir fotos del estado actual y confirmar medidas aproximadas.";
        return "Confirmar disponibilidad para una visita y preparar la primera valoración.";
      },
      getContactedAction() {
        return "Revisar si el cliente puede confirmar fotos, medidas o fecha de visita.";
      },
      getCreatedActivity() {
        return "Solicitud de reforma creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const type = getAnswerValue(request, "tipoReforma") || "Reforma por concretar";
        const zone = getAnswerValue(request, "zona") || "Zona por confirmar";
        const deadline = getAnswerValue(request, "plazoDeseado") || "Plazo por confirmar";
        const visit = getAnswerValue(request, "visita") || "Visita por confirmar";
        return {
          businessSubject: `Nueva solicitud de reforma: ${request.reference}`,
          businessIntro: "Nueva solicitud de reforma recibida. Revisa fotos, medidas aproximadas y disponibilidad para visita antes de preparar una respuesta.",
          businessDetails: [
            ["Tipo de reforma", type],
            ["Zona", zone],
            ["Plazo", deadline],
            ["Fotos", hasAttachments(request) ? "Adjuntas en la demo" : "Sin fotos adjuntas"],
            ["Visita", visit],
          ],
          clientSubject: "Hemos recibido tu solicitud de reforma",
          clientBody: "Hemos recibido tu solicitud de reforma. Revisaremos la información y te contactaremos para concretar el siguiente paso. Si faltan fotos, medidas o una visita, te lo indicaremos antes de preparar una valoración.",
        };
      },
    },
    electricidad: {
      detailTitle: "Datos de la solicitud eléctrica",
      detailFields: [
        { label: "Tipo de trabajo", keys: "tipoTrabajo" },
        { label: "Urgencia o riesgo", keys: ["riesgoUrgencia", "riesgo"] },
        { label: "Tipo de espacio", keys: "espacio" },
        { label: "Zona", keys: "zona" },
      ],
      getSummary(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "solicitud eléctrica";
        const risk = getAnswerValue(request, ["riesgoUrgencia", "riesgo"]) || "riesgo por confirmar";
        const zone = getAnswerValue(request, "zona") || "zona por confirmar";
        return `${work} en ${zone}. Prioridad indicada: ${risk}. Revisar la seguridad y coordinar el contacto antes de programar una revisión técnica.`;
      },
      getPendingLabels(request) {
        const labels = [];
        const risk = getAnswerValue(request, ["riesgoUrgencia", "riesgo"]);
        if (isPendingValue(risk)) labels.push("Riesgo por confirmar");
        if (!request.phone) labels.push("Teléfono necesario");
        return labels;
      },
      getTags(request) {
        const tags = [];
        const risk = getAnswerValue(request, ["riesgoUrgencia", "riesgo"]);
        if (/riesgo inmediato|hoy/i.test(risk) || request.urgency === "Hoy") tags.push("Urgente");
        if (!hasAttachments(request)) tags.push("Foto opcional");
        if (request.status === "En preparación") tags.push("Revisión pendiente");
        if (!this.getPendingLabels(request).length) tags.push("Datos suficientes para contactar");
        return tags;
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Hay chispas, olor a quemado, humo o cables expuestos?",
          "¿El problema afecta a toda la vivienda o local, o solo a una zona?",
          "¿Desde cuándo ocurre?",
          "¿Qué disponibilidad tienes para que te llamemos o revisemos el caso?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por avisarnos. Hemos recibido tu solicitud eléctrica. Por seguridad, no manipules cables ni el cuadro eléctrico si hay riesgo. Vamos a revisar la prioridad y te contactaremos para confirmar el siguiente paso.`;
      },
      getNextAction(request) {
        const risk = getAnswerValue(request, ["riesgoUrgencia", "riesgo"]);
        if (/riesgo inmediato|hoy/i.test(risk) || request.urgency === "Hoy") return "Llamar cuanto antes para confirmar la seguridad y coordinar una revisión técnica.";
        return "Confirmar disponibilidad y preparar una revisión eléctrica segura.";
      },
      getContactedAction() {
        return "Confirmar disponibilidad y si la incidencia sigue afectando a la instalación.";
      },
      getCreatedActivity() {
        return "Solicitud eléctrica creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "Trabajo eléctrico por concretar";
        const risk = getAnswerValue(request, ["riesgoUrgencia", "riesgo"]) || "Riesgo por confirmar";
        const zone = getAnswerValue(request, "zona") || "Zona por confirmar";
        return {
          businessSubject: `Nueva solicitud eléctrica: ${request.reference}`,
          businessIntro: "Nueva solicitud eléctrica recibida. Revisa el tipo de trabajo, la urgencia, el posible riesgo, la zona y el teléfono antes de coordinar una acción segura.",
          businessDetails: [
            ["Tipo de trabajo", work],
            ["Urgencia o riesgo", risk],
            ["Zona", zone],
            ["Teléfono", request.phone || "Por confirmar"],
            ["Próxima acción", request.nextFollowUp || "Confirmar disponibilidad para una revisión segura"],
          ],
          clientSubject: "Hemos recibido tu solicitud eléctrica",
          clientBody: "Hemos recibido tu solicitud eléctrica. Revisaremos la prioridad y te contactaremos para confirmar el siguiente paso. Si hay humo, chispas, olor a quemado o cables expuestos, no manipules la instalación y busca ayuda urgente.",
        };
      },
    },
    fontaneria: {
      detailTitle: "Datos de la incidencia",
      detailFields: [
        { label: "Tipo de incidencia", keys: "tipoIncidencia" },
        { label: "Urgencia o agua activa", keys: ["aguaActivaUrgencia", "aguaActiva"] },
        { label: "Tipo de espacio", keys: "espacio" },
        { label: "Zona afectada", keys: "zona" },
      ],
      getSummary(request) {
        const issue = getAnswerValue(request, "tipoIncidencia") || "incidencia de fontanería";
        const water = getAnswerValue(request, ["aguaActivaUrgencia", "aguaActiva"]) || "estado del agua por confirmar";
        const zone = getAnswerValue(request, "zona") || "zona por confirmar";
        return `${issue} en ${zone}. Estado indicado: ${water}. Confirmar si el problema sigue activo y coordinar acceso para la visita.`;
      },
      getPendingLabels(request) {
        const labels = [];
        const water = getAnswerValue(request, ["aguaActivaUrgencia", "aguaActiva"]);
        if (isPendingValue(water)) labels.push("Urgencia por confirmar");
        if (request.status === "En preparación") labels.push("Acceso por confirmar");
        return labels;
      },
      getTags(request) {
        const tags = [];
        const water = getAnswerValue(request, ["aguaActivaUrgencia", "aguaActiva"]);
        if (/sigue saliendo agua|daño activo|^sí$/i.test(water) || request.urgency === "Hoy") tags.push("Agua activa");
        if (/daño activo/i.test(water)) tags.push("Daño activo");
        if (!hasAttachments(request)) tags.push("Foto opcional");
        if (!this.getPendingLabels(request).length) tags.push("Visita recomendada");
        return tags;
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Sigue saliendo agua ahora mismo?",
          "¿La incidencia está en cocina, baño, termo, tubería u otra zona?",
          "¿Hay riesgo de que afecte a vecinos o a otra estancia?",
          "¿Qué disponibilidad tienes para una visita?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por contactar. Hemos recibido tu incidencia de fontanería. Vamos a revisar la urgencia y, si sigue saliendo agua o hay daño activo, priorizaremos el contacto para confirmar visita o siguiente paso. Una foto puede ayudar, pero no retrases el contacto por subirla.`;
      },
      getNextAction(request) {
        const water = getAnswerValue(request, ["aguaActivaUrgencia", "aguaActiva"]);
        if (/sigue saliendo agua|daño activo|^sí$/i.test(water) || request.urgency === "Hoy") return "Llamar cuanto antes para confirmar si el agua sigue activa y coordinar acceso para una visita urgente.";
        return "Confirmar acceso, disponibilidad y si la incidencia continúa activa.";
      },
      getContactedAction() {
        return "Revisar si la incidencia sigue activa y confirmar el horario de acceso.";
      },
      getCreatedActivity() {
        return "Solicitud de fontanería creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const issue = getAnswerValue(request, "tipoIncidencia") || "Incidencia por concretar";
        const water = getAnswerValue(request, ["aguaActivaUrgencia", "aguaActiva"]) || "Estado por confirmar";
        const zone = getAnswerValue(request, "zona") || "Zona afectada por confirmar";
        return {
          businessSubject: `Nueva incidencia de fontanería: ${request.reference}`,
          businessIntro: "Nueva incidencia de fontanería recibida. Revisa el tipo de incidencia, si hay agua o daño activo, la zona afectada y la disponibilidad antes de confirmar la próxima acción.",
          businessDetails: [
            ["Tipo de incidencia", issue],
            ["Agua o daño activo", water],
            ["Zona afectada", zone],
            ["Disponibilidad", "Por confirmar"],
            ["Próxima acción", request.nextFollowUp || "Confirmar si la incidencia sigue activa"],
          ],
          clientSubject: "Hemos recibido tu incidencia de fontanería",
          clientBody: "Hemos recibido tu incidencia de fontanería. Si sigue saliendo agua o hay daño activo, priorizaremos el contacto para confirmar el siguiente paso. Una foto puede ayudar, pero no retrases el contacto por subirla.",
        };
      },
    },
    climatizacion: {
      detailTitle: "Datos de climatización",
      detailFields: [
        { label: "Tipo de trabajo", keys: "tipoTrabajo" },
        { label: "Urgencia", keys: "urgencia" },
        { label: "Zona", keys: "zona" },
        { label: "Tipo de equipo", keys: "tipoEquipo" },
      ],
      getSummary(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "solicitud de climatización";
        const zone = getAnswerValue(request, "zona") || "zona por confirmar";
        const equipment = getAnswerValue(request, "tipoEquipo") || "equipo por confirmar";
        return `${work} en ${zone}. Equipo: ${equipment}. Revisar urgencia, acceso y si hace falta visita antes de preparar la propuesta.`;
      },
      getPendingLabels(request) {
        const labels = [];
        if (isPendingValue(getAnswerValue(request, "tipoEquipo"))) labels.push("Equipo por confirmar");
        if (!hasAttachments(request)) labels.push("Foto opcional");
        return labels;
      },
      getTags(request) {
        const tags = [];
        if (/hoy|urgente/i.test(getAnswerValue(request, "urgencia")) || request.urgency === "Hoy") tags.push("Prioridad alta");
        if (!this.getPendingLabels(request).length) tags.push("Datos listos para revisar");
        return tags;
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Es una instalación nueva, una avería o un mantenimiento?",
          "¿Qué tipo de equipo tienes o quieres instalar?",
          "¿El equipo no enfría, hace ruido o muestra algún aviso?",
          "¿Qué disponibilidad tienes para una visita o llamada?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por contactar. Hemos recibido tu solicitud de climatización. Revisaremos el tipo de equipo, la urgencia y la zona para confirmar el siguiente paso, visita o presupuesto.`;
      },
      getNextAction(request) {
        if (/hoy|urgente/i.test(getAnswerValue(request, "urgencia")) || request.urgency === "Hoy") return "Llamar para confirmar la incidencia y coordinar una revisión prioritaria.";
        return "Confirmar tipo de equipo, acceso y disponibilidad para visita o presupuesto.";
      },
      getContactedAction() {
        return "Confirmar si el equipo sigue con la incidencia y concretar la visita o llamada.";
      },
      getCreatedActivity() {
        return "Solicitud de climatización creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "Trabajo por concretar";
        const equipment = getAnswerValue(request, "tipoEquipo") || "Equipo por confirmar";
        return {
          businessSubject: `Nueva solicitud de climatización: ${request.reference}`,
          businessIntro: "Nueva solicitud de climatización recibida. Revisa el trabajo, la urgencia, la zona, el equipo y la disponibilidad antes de programar una visita o preparar un presupuesto.",
          businessDetails: [["Trabajo", work], ["Equipo", equipment], ["Zona", getAnswerValue(request, "zona") || "Por confirmar"], ["Urgencia", getAnswerValue(request, "urgencia") || "Por confirmar"]],
          clientSubject: "Hemos recibido tu solicitud de climatización",
          clientBody: "Hemos recibido tu solicitud de climatización. Revisaremos la información y te contactaremos para confirmar el siguiente paso, visita o presupuesto.",
        };
      },
    },
    cristaleria: {
      detailTitle: "Datos de cristalería",
      detailFields: [
        { label: "Tipo de trabajo", keys: "tipoTrabajo" },
        { label: "Urgencia", keys: "urgencia" },
        { label: "Zona", keys: "zona" },
        { label: "Medidas aproximadas", keys: "medidasAproximadas" },
      ],
      getSummary(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "solicitud de cristalería";
        const measures = getAnswerValue(request, "medidasAproximadas") || "medidas por confirmar";
        const zone = getAnswerValue(request, "zona") || "zona por confirmar";
        return `${work} en ${zone}. Medidas: ${measures}. Revisar fotos, medidas y si hace falta visita antes de preparar el presupuesto.`;
      },
      getPendingLabels(request) {
        const labels = [];
        if (isPendingValue(getAnswerValue(request, "medidasAproximadas"))) labels.push("Medidas pendientes");
        if (!hasAttachments(request)) labels.push("Foto pendiente");
        return labels;
      },
      getTags(request) {
        const tags = [];
        if (/lo antes posible|hoy|urgente/i.test(getAnswerValue(request, "urgencia")) || request.urgency === "Hoy") tags.push("Rotura prioritaria");
        if (!this.getPendingLabels(request).length) tags.push("Datos listos para valorar");
        return tags;
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Puedes facilitarnos medidas aproximadas del cristal, ventana o mampara?",
          "¿Puedes enviar una foto del hueco o de la pieza actual?",
          "¿Hay rotura o riesgo en la zona ahora mismo?",
          "¿Qué disponibilidad tienes para una visita si hace falta tomar medidas?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por contactar. Hemos recibido tu solicitud de cristalería. Revisaremos las medidas, las fotos y la urgencia para confirmar si podemos preparar un presupuesto o necesitamos una visita.`;
      },
      getNextAction(request) {
        if (/lo antes posible|hoy|urgente/i.test(getAnswerValue(request, "urgencia")) || request.urgency === "Hoy") return "Confirmar si la rotura está asegurada y pedir medidas o foto para priorizar la solución.";
        return "Revisar medidas aproximadas y confirmar si hace falta visita para valorar el trabajo.";
      },
      getContactedAction() {
        return "Confirmar medidas, fotos y disponibilidad para una posible visita.";
      },
      getCreatedActivity() {
        return "Solicitud de cristalería creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const work = getAnswerValue(request, "tipoTrabajo") || "Trabajo por concretar";
        const measures = getAnswerValue(request, "medidasAproximadas") || "Medidas por confirmar";
        return {
          businessSubject: `Nueva solicitud de cristalería: ${request.reference}`,
          businessIntro: "Nueva solicitud de cristalería recibida. Revisa el trabajo, la urgencia, la zona, las medidas y las fotos antes de preparar un presupuesto o una visita.",
          businessDetails: [["Trabajo", work], ["Medidas", measures], ["Zona", getAnswerValue(request, "zona") || "Por confirmar"], ["Urgencia", getAnswerValue(request, "urgencia") || "Por confirmar"]],
          clientSubject: "Hemos recibido tu solicitud de cristalería",
          clientBody: "Hemos recibido tu solicitud de cristalería. Revisaremos medidas, fotos y urgencia antes de confirmar el siguiente paso o una visita.",
        };
      },
    },
    academias: {
      detailTitle: "Datos de las clases",
      detailFields: [
        { label: "Materia", keys: "materia" },
        { label: "Nivel", keys: "nivel" },
        { label: "Objetivo", keys: "objetivo" },
        { label: "Modalidad", keys: "modalidad" },
        { label: "Disponibilidad", keys: "disponibilidad" },
      ],
      getSummary(request) {
        const subject = getAnswerValue(request, "materia") || "materia por confirmar";
        const level = getAnswerValue(request, "nivel") || "nivel por confirmar";
        const goal = getAnswerValue(request, "objetivo") || "objetivo por confirmar";
        const modality = getAnswerValue(request, "modalidad") || "modalidad por confirmar";
        return `Solicitud de ${subject} para ${level}. Objetivo: ${goal}. Modalidad: ${modality}. Confirmar horarios para proponer la clase que mejor encaje.`;
      },
      getPendingLabels(request) {
        const labels = [];
        if (isPendingValue(getAnswerValue(request, "disponibilidad"))) labels.push("Horario pendiente");
        if (isPendingValue(getAnswerValue(request, "modalidad"))) labels.push("Modalidad pendiente");
        if (request.status === "En preparación" && !labels.includes("Horario pendiente")) labels.push("Encaje de clase pendiente");
        return labels;
      },
      getTags(request) {
        const tags = [];
        if (!isPendingValue(getAnswerValue(request, "nivel"))) tags.push("Nivel confirmado");
        if (!isPendingValue(getAnswerValue(request, "objetivo"))) tags.push("Objetivo definido");
        if (!this.getPendingLabels(request).length) tags.push("Respuesta lista");
        return tags;
      },
      getQuestions() {
        return withMaximumQuestions([
          "¿Qué disponibilidad horaria tenéis durante la semana?",
          "¿Preferís clases presenciales, online o indistintas?",
          "¿El objetivo es refuerzo, recuperación, examen o apoyo continuo?",
          "¿Cuándo os gustaría empezar?",
        ]);
      },
      getResponse(request) {
        return `Hola ${request.name}, gracias por contactar. Hemos recibido la solicitud de clases. Revisaremos materia, nivel, objetivo y disponibilidad para proponeros la opción que mejor encaje.`;
      },
      getNextAction() {
        return "Confirmar disponibilidad, modalidad y el encaje de clase antes de proponer una opción.";
      },
      getContactedAction() {
        return "Revisar si el horario y la modalidad siguen encajando para proponer una clase.";
      },
      getCreatedActivity() {
        return "Solicitud de clases creada desde el formulario sectorial de la demo.";
      },
      getEmailCopy(request) {
        const subject = getAnswerValue(request, "materia") || "Materia por confirmar";
        const level = getAnswerValue(request, "nivel") || "Nivel por confirmar";
        const goal = getAnswerValue(request, "objetivo") || "Objetivo por confirmar";
        const modality = getAnswerValue(request, "modalidad") || "Modalidad por confirmar";
        const availability = getAnswerValue(request, "disponibilidad") || "Horario pendiente";
        return {
          businessSubject: `Nueva solicitud de clases: ${request.reference}`,
          businessIntro: "Nueva solicitud de clases recibida. Revisa materia, nivel, objetivo, modalidad y disponibilidad antes de proponer el mejor encaje de clase.",
          businessDetails: [
            ["Materia", subject],
            ["Nivel", level],
            ["Objetivo", goal],
            ["Modalidad", modality],
            ["Disponibilidad", availability],
          ],
          clientSubject: "Hemos recibido tu solicitud de clases",
          clientBody: "Hemos recibido tu solicitud de clases. Revisaremos materia, nivel, objetivo y disponibilidad para proponerte la opción que mejor encaje. No necesitamos información personal sensible para revisar esta solicitud.",
        };
      },
    },
  });

  function getSectorExperience(sectorId, request) {
    const config = SECTOR_INTERNAL_CONFIGS[sectorId];

    if (!config) {
      return null;
    }

    return {
      detailTitle: config.detailTitle,
      detailFields: config.detailFields
        .map((field) => ({
          label: field.label,
          value: getAnswerValue(request, field.keys),
        }))
        .filter((field) => field.value),
      internalSummary: config.getSummary(request),
      dataPendingLabels: config.getPendingLabels(request),
      sectorTags: config.getTags(request),
      suggestedQuestions: config.getQuestions(request),
      suggestedResponse: config.getResponse(request),
      emailCopy: config.getEmailCopy(request),
      nextAction: config.getNextAction(request),
      contactedAction: config.getContactedAction(request),
      createdActivity: config.getCreatedActivity(request),
    };
  }

  const SECTOR_FORM_CONFIGS = Object.freeze({
    reformas: {
      title: "Cuéntanos tu reforma",
      description: "No necesitas conocer medidas exactas. Cuéntanos qué quieres cambiar y añade fotos si las tienes.",
      submitLabel: "Enviar solicitud de reforma",
      confirmationText: "Hemos recibido tu solicitud de reforma. Revisaremos la información y te contactaremos para concretar el siguiente paso.",
      service: "Reformas",
      budget: "No lo sabe todavía",
      referencePrefix: "REF",
      urgencyMap: { "Lo antes posible": "Hoy", "En las próximas semanas": "Esta semana", "En 1-3 meses": "Este mes", "Más adelante": "Sin prisa", "Solo quiero orientación": "Sin prisa" },
      fields: [
        { name: "tipoReforma", label: "Tipo de reforma", type: "select", required: true, options: ["Baño", "Cocina", "Reforma integral", "Reforma parcial", "Local comercial", "Suelo o pintura", "Otro"] },
        { name: "zona", label: "Zona o municipio", type: "text", required: true, placeholder: "Ej. Valencia centro" },
        { name: "description", label: "Descripción breve", type: "textarea", required: true, minLength: 20, fullWidth: true, placeholder: "Cuéntanos qué quieres cambiar y cualquier detalle útil.", help: "Mínimo 20 caracteres para preparar una primera orientación." },
        { name: "plazoDeseado", label: "Plazo deseado", type: "select", required: true, options: ["Lo antes posible", "En las próximas semanas", "En 1-3 meses", "Más adelante", "Solo quiero orientación"] },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
        { name: "phone", label: "Teléfono recomendable", type: "tel", placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
      ],
    },
    electricidad: {
      title: "Cuéntanos qué ocurre",
      description: "Describe qué ocurre y dónde. Si hay humo, chispas, olor a quemado o cables expuestos, no dependas del formulario para una emergencia.",
      submitLabel: "Enviar solicitud eléctrica",
      confirmationText: "Hemos recibido tu solicitud eléctrica. Revisaremos la prioridad y te contactaremos lo antes posible.",
      service: "Electricidad",
      budget: "No lo sabe todavía",
      referencePrefix: "ELE",
      urgencyMap: { "Riesgo inmediato": "Hoy", Hoy: "Hoy", "24-48 horas": "Esta semana", "Esta semana": "Esta semana", "Sin prisa": "Sin prisa" },
      fields: [
        { name: "tipoTrabajo", label: "Tipo de trabajo", type: "select", required: true, options: ["Avería eléctrica", "Instalación de enchufes", "Iluminación", "Cuadro eléctrico", "Revisión", "Boletín o certificado", "Otro"] },
        { name: "riesgoUrgencia", label: "Urgencia o riesgo", type: "select", required: true, options: ["Riesgo inmediato", "Hoy", "24-48 horas", "Esta semana", "Sin prisa"] },
        { name: "zona", label: "Zona o municipio", type: "text", required: true, placeholder: "Ej. Valencia centro" },
        { name: "description", label: "Descripción breve", type: "textarea", required: true, minLength: 20, fullWidth: true, placeholder: "Describe el problema sin manipular la instalación.", help: "Mínimo 20 caracteres para entender la incidencia." },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "phone", label: "Teléfono", type: "tel", required: true, placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
      ],
    },
    fontaneria: {
      title: "Cuéntanos la incidencia",
      description: "Indica qué ocurre y si el agua sigue saliendo. Una foto ayuda, pero no retrases la solicitud para subirla.",
      submitLabel: "Enviar solicitud de fontanería",
      confirmationText: "Hemos recibido tu solicitud de fontanería. Revisaremos la urgencia y te contactaremos para confirmar el siguiente paso.",
      service: "Fontanería",
      budget: "No lo sabe todavía",
      referencePrefix: "FON",
      urgencyMap: { "Agua activa": "Hoy", Hoy: "Hoy", "24-48 horas": "Esta semana", "Esta semana": "Esta semana", "Sin prisa": "Sin prisa" },
      fields: [
        { name: "tipoIncidencia", label: "Tipo de incidencia", type: "select", required: true, options: ["Fuga", "Desagüe atascado", "Grifo o cisterna", "Tubería", "Calentador", "Otro"] },
        { name: "aguaActivaUrgencia", label: "Urgencia o agua activa", type: "select", required: true, options: ["Agua activa", "Hoy", "24-48 horas", "Esta semana", "Sin prisa"] },
        { name: "zona", label: "Zona o municipio", type: "text", required: true, placeholder: "Ej. Valencia centro" },
        { name: "description", label: "Descripción breve", type: "textarea", required: true, minLength: 20, fullWidth: true, placeholder: "Describe qué ocurre y la zona afectada.", help: "Mínimo 20 caracteres para preparar la visita." },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "phone", label: "Teléfono", type: "tel", required: true, placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
      ],
    },
    climatizacion: {
      title: "Cuéntanos qué necesitas",
      description: "Indica si necesitas instalación, reparación o mantenimiento y cuéntanos qué equipo tienes. Las fotos son simuladas y no se suben.",
      submitLabel: "Enviar solicitud de climatización",
      confirmationText: "Hemos recibido tu solicitud de climatización. Revisaremos la información y te contactaremos para concretar el siguiente paso.",
      service: "Climatización",
      budget: "No lo sabe todavía",
      referencePrefix: "CLI",
      urgencyMap: { "Lo antes posible": "Hoy", Hoy: "Hoy", "Esta semana": "Esta semana", "Sin prisa": "Sin prisa" },
      fields: [
        { name: "tipoTrabajo", label: "¿Qué necesitas?", type: "select", required: true, options: ["Instalación de aire acondicionado", "Reparación / avería", "Mantenimiento", "Equipo no enfría", "Ruido o fuga", "Presupuesto para varios splits", "Otro"] },
        { name: "urgencia", label: "¿Es urgente?", type: "select", required: true, options: ["Lo antes posible", "Hoy", "Esta semana", "Sin prisa"] },
        { name: "zona", label: "Zona o municipio", type: "text", required: true, placeholder: "Ej. Valencia centro" },
        { name: "tipoEquipo", label: "Tipo de equipo", type: "select", required: true, options: ["Split pared", "Conductos", "Cassette", "Varios splits", "No lo sé", "Otro"] },
        { name: "description", label: "Describe el problema o instalación", type: "textarea", required: true, minLength: 20, fullWidth: true, placeholder: "Ej. El equipo no enfría o quiero instalar aire en dos habitaciones." },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
        { name: "phone", label: "Teléfono", type: "tel", required: true, placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
      ],
    },
    cristaleria: {
      title: "Cuéntanos qué necesitas",
      description: "Indica el trabajo, las medidas aproximadas y si hay urgencia. Las fotos son simuladas y no se suben.",
      submitLabel: "Enviar solicitud de cristalería",
      confirmationText: "Hemos recibido tu solicitud de cristalería. Revisaremos medidas, fotos y urgencia para confirmar el siguiente paso.",
      service: "Cristalerías",
      budget: "No lo sabe todavía",
      referencePrefix: "CRI",
      urgencyMap: { "Lo antes posible": "Hoy", Hoy: "Hoy", "Esta semana": "Esta semana", "Sin prisa": "Sin prisa" },
      fields: [
        { name: "tipoTrabajo", label: "¿Qué necesitas?", type: "select", required: true, options: ["Cristal roto", "Cambio de cristal / ventana", "Mampara", "Espejo", "Cerramiento", "Presupuesto con medidas", "Otro"] },
        { name: "urgencia", label: "¿Es urgente?", type: "select", required: true, options: ["Lo antes posible", "Hoy", "Esta semana", "Sin prisa"] },
        { name: "zona", label: "Zona o municipio", type: "text", required: true, placeholder: "Ej. Valencia centro" },
        { name: "medidasAproximadas", label: "Medidas aproximadas", type: "text", required: true, placeholder: "Ej. 120 x 90 cm" },
        { name: "description", label: "Describe el trabajo", type: "textarea", required: true, minLength: 20, fullWidth: true, placeholder: "Cuéntanos qué pieza hay que cambiar o qué cerramiento quieres valorar." },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
        { name: "phone", label: "Teléfono", type: "tel", required: true, placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
      ],
    },
    academias: {
      title: "Encuentra la clase que necesitas",
      description: "Indica la materia, el nivel y los horarios que mejor encajan. No compartas información médica o personal sensible.",
      submitLabel: "Enviar solicitud de clases",
      confirmationText: "Hemos recibido tu solicitud. Revisaremos la disponibilidad y te contactaremos para confirmar las opciones de clase.",
      service: "Academia",
      budget: "No lo sabe todavía",
      referencePrefix: "ACA",
      defaultUrgency: "Sin prisa",
      descriptionTemplate: "Solicitud de {{materia}} para {{nivel}}. Objetivo: {{objetivo}}. Modalidad: {{modalidad}}. Disponibilidad: {{disponibilidad}}.",
      fields: [
        { name: "materia", label: "Materia", type: "select", required: true, options: ["Matemáticas", "Inglés", "Lengua", "Física y química", "Valenciano", "Preparación PAU/EBAU", "Informática", "Otro"] },
        { name: "nivel", label: "Nivel", type: "select", required: true, options: ["Primaria", "ESO", "Bachillerato", "FP", "Universidad", "Adultos", "Examen oficial", "Otro"] },
        { name: "objetivo", label: "Objetivo", type: "select", required: true, options: ["Refuerzo", "Recuperación", "Preparar examen", "Mejorar conversación", "Apoyo continuo", "Otro"] },
        { name: "modalidad", label: "Modalidad", type: "select", required: true, options: ["Presencial", "Online", "Indistinta"] },
        { name: "disponibilidad", label: "Disponibilidad", type: "text", required: true, placeholder: "Ej. Martes y jueves por la tarde" },
        { name: "attachments", label: "Fotos o archivos (opcional)", type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf", multiple: true, fullWidth: true, help: "Puedes añadir hasta 5 fotos o PDF de 10 MB como máximo por archivo." },
        { name: "name", label: "Nombre completo", type: "text", required: true, minLength: 2, placeholder: "Ej. Laura Sánchez" },
        { name: "email", label: "Correo electrónico obligatorio", type: "email", required: true, placeholder: "cliente@email.com" },
        { name: "phone", label: "Teléfono recomendable", type: "tel", placeholder: "+34 600 000 000", pattern: "[0-9+() .-]{7,20}" },
      ],
    },
  });

  function cloneFormField(field) {
    return { ...field, options: field.options ? [...field.options] : undefined };
  }

  function getSectorFormConfig(sectorId) {
    const form = SECTOR_FORM_CONFIGS[sectorId];
    return form
      ? {
          ...form,
          urgencyMap: form.urgencyMap ? { ...form.urgencyMap } : undefined,
          fields: form.fields.map(cloneFormField),
        }
      : null;
  }

  function getNextSectorReference(sectorId, requests) {
    const form = getSectorFormConfig(sectorId);

    if (!form) {
      return null;
    }

    const highestReference = (requests || []).reduce((highest, request) => {
      if (request?.sector !== sectorId || !String(request.reference || "").startsWith(`${form.referencePrefix}-`)) {
        return highest;
      }

      const value = Number(String(request.reference).slice(form.referencePrefix.length + 1));
      return Number.isFinite(value) ? Math.max(highest, value) : highest;
    }, 0);

    return `${form.referencePrefix}-${String(highestReference + 1).padStart(3, "0")}`;
  }

  function createSectorRequestPayload(sectorId, values, requests) {
    const form = getSectorFormConfig(sectorId);

    if (!form) {
      return null;
    }

    const customAnswers = form.fields.reduce((answers, field) => {
      if (!["name", "email", "phone", "description", "attachments"].includes(field.name)) {
        answers[field.name] = String(values[field.name] || "").trim();
      }
      return answers;
    }, {});
    const description = String(values.description || "").trim() || String(form.descriptionTemplate || "")
      .replace(/{{(.*?)}}/g, (_match, key) => customAnswers[key.trim()] || "Por confirmar")
      .trim();
    const urgencySource = values.riesgoUrgencia || values.aguaActivaUrgencia || values.urgencia || values.plazoDeseado;

    return {
      sector: sectorId,
      reference: getNextSectorReference(sectorId, requests),
      name: String(values.name || "").trim(),
      email: String(values.email || "").trim(),
      phone: String(values.phone || "").trim(),
      service: form.service,
      description,
      budget: form.budget,
      urgency: form.urgencyMap?.[urgencySource] || form.defaultUrgency || "Sin prisa",
      customAnswers,
    };
  }

  function getSectorPreset(sectorId) {
    return SECTOR_PRESETS[sectorId] || null;
  }

  function getSectorStorageKey(sectorId) {
    const preset = getSectorPreset(sectorId);
    return preset ? `solicitudpro-demo:v1.1:${preset.id}` : null;
  }

  function getSectorFromSearch(search) {
    const params = new URLSearchParams(search || "");
    const requestedSector = params.get("sector");
    const preset = getSectorPreset(requestedSector);

    if (preset) {
      return {
        activeSector: preset.id,
        selection: { isRequired: false, notice: "" },
      };
    }

    return {
      activeSector: null,
      selection: {
        isRequired: true,
        notice: requestedSector ? "Elige una demo disponible." : "",
      },
    };
  }

  return {
    SECTOR_PRESETS,
    getSectorPreset,
    getSectorExperience,
    getSectorFormConfig,
    getNextSectorReference,
    createSectorRequestPayload,
    getSectorRequestSeeds,
    getSectorStorageKey,
    getSectorFromSearch,
  };
});
