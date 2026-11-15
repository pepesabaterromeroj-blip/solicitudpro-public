(function (root, factory) {
  const data = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = data;
  }

  root.SummerLearningPlan = data;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const categories = {
    security: "Redes, Linux y seguridad",
    databases: "Bases de datos",
    logic: "Programacion y logica",
    ai: "IA y prompts",
    project: "Proyecto real",
  };

  const platforms = {
    TryHackMe: {
      url: "https://tryhackme.com/path/outline/presecurity",
      category: categories.security,
      summary:
        "Aprende redes, Linux, seguridad, IP, DNS, terminal, web y servidores con rooms guiadas.",
    },
    SQLBolt: {
      url: "https://sqlbolt.com/",
      category: categories.databases,
      summary: "Practica SQL y bases de datos con ejercicios interactivos.",
    },
    CodeCombat: {
      url: "https://codecombat.com/play",
      category: categories.logic,
      summary: "Practica logica programando en formato juego. Recomendado: JavaScript.",
    },
    "Learn Prompting": {
      url: "https://learnprompting.org/",
      category: categories.ai,
      summary: "Mejora prompts, roles, contexto, RAG, agentes y evaluacion de respuestas.",
    },
    n8n: {
      url: "https://docs.n8n.io/hosting/",
      category: categories.project,
      summary: "Automatiza flujos entre formularios, hojas, emails y sistemas internos.",
    },
    Supabase: {
      url: "https://supabase.com/pricing",
      category: categories.project,
      summary: "Base de datos y backend en plan gratuito para prototipos.",
    },
    "Google Sheets": {
      url: "https://workspace.google.com/products/sheets/",
      category: categories.project,
      summary: "Hojas de calculo para registrar solicitudes y validar procesos simples.",
    },
    Netlify: {
      url: "https://www.netlify.com/pricing/",
      category: categories.project,
      summary: "Hosting gratuito para publicar la web sin dominio propio.",
    },
    "Proyecto web": {
      url: "",
      category: categories.project,
      summary: "Trabajo directo sobre piezas reales del diario y de SolicitudPro.",
    },
    "Proyecto automatizacion": {
      url: "",
      category: categories.project,
      summary: "Pruebas de flujos utiles para SolicitudPro sin depender de pagos.",
    },
    "Proyecto final": {
      url: "",
      category: categories.project,
      summary: "Cierre del verano y publicacion del diario.",
    },
    "Revision final": {
      url: "",
      category: categories.project,
      summary: "Resumen de aprendizaje, dificultades y siguientes pasos.",
    },
  };

  const STATUS_OPTIONS = [
    { id: "pending", label: "Pendiente" },
    { id: "in-progress", label: "En progreso" },
    { id: "completed", label: "Completado" },
    { id: "paused", label: "Pausado" },
  ];

  const PAUSE_REASONS = [
    "Vacaciones",
    "Viaje",
    "Descanso",
    "No he tenido tiempo",
    "Otro motivo",
  ];

  const motivationalQuotes = [
    "Una hora al dia parece poco, pero en 10 semanas cambia mucho.",
    "No necesito aprenderlo todo hoy, solo avanzar.",
    "Cada dia completado es una prueba de disciplina.",
    "Estoy aprendiendo habilidades reales, no solo viendo videos.",
    "Lo que practico hoy me acerca a construir mejor SolicitudPro.",
    "La constancia gana a la motivacion cuando la motivacion falla.",
    "Cada consulta SQL, cada prompt y cada linea de codigo cuentan.",
    "Hoy no busco perfeccion, busco progreso.",
    "Descansar tambien forma parte del proceso. Lo importante es volver.",
    "Este diario no va de hacerlo perfecto. Va de avanzar cuando puedas.",
  ];

  const defaultWhy = {
    [categories.security]:
      "Entender redes, servidores, Linux y seguridad te da una base solida para crear productos web con mas criterio.",
    [categories.databases]:
      "SQL te ayuda a filtrar solicitudes, preparar datos y entender mejor Supabase o PostgreSQL.",
    [categories.logic]:
      "La logica mejora tu forma de resolver problemas en JavaScript, React, backend y automatizaciones.",
    [categories.ai]:
      "Aprender prompting mejora como trabajas con Codex, ChatGPT, asistentes y agentes IA.",
    [categories.project]:
      "Los viernes convierten lo aprendido en piezas reales para SolicitudPro.",
  };

  function day(date, platform, category, task, result, objective, extras) {
    return {
      id: date,
      date,
      platform,
      category,
      task,
      result,
      objective,
      why: defaultWhy[category],
      durationMinutes: 60,
      tools: extras && extras.tools ? extras.tools : [],
      quote: extras && extras.quote ? extras.quote : "",
    };
  }

  const learningPlan = [
    day("2026-06-22", "TryHackMe", categories.security, "Crear cuenta, entrar en Pre Security y hacer la primera introduccion disponible.", "Apuntar que es ciberseguridad y 3 conceptos nuevos.", "Entrar en la ruta Pre Security y entender el punto de partida."),
    day("2026-06-23", "SQLBolt", categories.databases, "Hacer SQL Lesson 1: SELECT queries 101.", "Guardar una consulta SELECT basica.", "Aprender a pedir columnas concretas de una tabla."),
    day("2026-06-24", "CodeCombat", categories.logic, "Crear cuenta, elegir JavaScript y completar los primeros 2-3 niveles gratuitos.", "Apuntar que es una instruccion y que hace una funcion basica.", "Empezar a practicar logica con instrucciones simples."),
    day("2026-06-25", "Learn Prompting", categories.ai, "Leer introduccion a prompt engineering y probar un prompt simple en ChatGPT.", "Guardar tu primer prompt util.", "Entender que un buen prompt guia mejor a la IA."),
    day("2026-06-26", "Proyecto web", categories.project, "Crear archivos iniciales del diario.", "Primera version del diario con lunes-viernes.", "Convertir el plan en una herramienta propia.", { tools: ["Netlify"] }),

    day("2026-06-29", "TryHackMe", categories.security, "Avanzar en Network Fundamentals.", "Apuntar que es IP, red y router.", "Comprender conceptos basicos de redes."),
    day("2026-06-30", "SQLBolt", categories.databases, "Hacer SQL Lesson 2: Queries with constraints Pt.1.", "Guardar una consulta con WHERE.", "Filtrar informacion con condiciones."),
    day("2026-07-01", "CodeCombat", categories.logic, "Completar 3 niveles mas usando JavaScript.", "Apuntar que comandos repetiste y por que.", "Detectar patrones repetidos en instrucciones."),
    day("2026-07-02", "Learn Prompting", categories.ai, "Leer sobre instrucciones claras y contexto.", "Crear un prompt para que una IA explique un error de codigo.", "Aprender a dar contexto para recibir respuestas mas utiles."),
    day("2026-07-03", "Proyecto web", categories.project, "Mejorar diseno del diario: tarjetas, colores y responsive movil.", "Captura de la primera version bonita.", "Hacer que el diario apetezca usarse desde el movil.", { tools: ["Netlify"] }),

    day("2026-07-06", "TryHackMe", categories.security, "Seguir con redes: IP, DNS o puertos segun la room disponible.", "Apuntar diferencia entre IP, DNS y puerto.", "Separar conceptos que aparecen en cualquier app web."),
    day("2026-07-07", "SQLBolt", categories.databases, "Hacer SQL Lesson 3: Queries with constraints Pt.2.", "Guardar consulta con filtros de texto.", "Filtrar por texto y condiciones mas concretas."),
    day("2026-07-08", "CodeCombat", categories.logic, "Completar niveles centrados en condiciones if.", "Apuntar un ejemplo de if.", "Tomar decisiones en codigo."),
    day("2026-07-09", "Learn Prompting", categories.ai, "Leer sobre role prompting.", "Crear un prompt tipo 'actua como profesor de SMR'.", "Usar roles para orientar mejor la respuesta."),
    day("2026-07-10", "Proyecto web", categories.project, "Anadir checkboxes funcionales al diario.", "Marcar dias completados desde la web.", "Registrar avances reales de forma visible."),

    day("2026-07-13", "TryHackMe", categories.security, "Hacer una parte de How The Web Works.", "Apuntar que es HTTP y una peticion web.", "Entender como habla un navegador con un servidor."),
    day("2026-07-14", "SQLBolt", categories.databases, "Hacer SQL Lesson 4: Filtering and sorting.", "Guardar consulta con ORDER BY.", "Ordenar informacion de forma util."),
    day("2026-07-15", "CodeCombat", categories.logic, "Completar niveles con bucles.", "Apuntar diferencia entre repetir manualmente y usar bucles.", "Evitar trabajo repetitivo con codigo."),
    day("2026-07-16", "Learn Prompting", categories.ai, "Leer sobre ejemplos dentro del prompt.", "Crear un prompt con 2 ejemplos antes de pedir respuesta.", "Mejorar instrucciones con ejemplos concretos."),
    day("2026-07-17", "Proyecto web", categories.project, "Guardar progreso con localStorage.", "Que los checks no se borren al recargar.", "Aprender persistencia local basica."),

    day("2026-07-20", "TryHackMe", categories.security, "Seguir con How The Web Works.", "Apuntar cliente, servidor, navegador y respuesta.", "Ver las piezas basicas de una web."),
    day("2026-07-21", "SQLBolt", categories.databases, "Hacer review de SELECT, WHERE y ORDER BY.", "Crear 3 consultas propias sobre solicitudes.", "Llevar SQL al contexto de SolicitudPro."),
    day("2026-07-22", "CodeCombat", categories.logic, "Completar niveles con funciones.", "Apuntar que es una funcion y para que sirve.", "Organizar instrucciones reutilizables."),
    day("2026-07-23", "Learn Prompting", categories.ai, "Leer sobre prompts para programacion.", "Crear prompt para pedir revision de codigo a Codex.", "Pedir ayuda tecnica con mas precision."),
    day("2026-07-24", "Proyecto web", categories.project, "Crear formulario tipo SolicitudPro.", "Formulario con nombre, email, telefono, servicio y mensaje.", "Conectar aprendizaje con un flujo real de negocio.", { tools: ["Google Sheets", "Supabase"] }),

    day("2026-07-27", "TryHackMe", categories.security, "Empezar o continuar Linux Fundamentals.", "Apuntar 5 comandos Linux.", "Ganar soltura con terminal."),
    day("2026-07-28", "SQLBolt", categories.databases, "Hacer SQL Lesson 6: Multi-table queries with JOINs.", "Guardar una consulta con JOIN.", "Relacionar datos entre tablas."),
    day("2026-07-29", "CodeCombat", categories.logic, "Completar niveles con arrays/listas si aparecen.", "Apuntar que es una lista de datos.", "Entender colecciones de informacion."),
    day("2026-07-30", "Learn Prompting", categories.ai, "Leer sobre errores/alucinaciones de IA.", "Crear checklist para comprobar respuestas de IA.", "No aceptar respuestas de IA sin revisar."),
    day("2026-07-31", "Proyecto web", categories.project, "Crear hoja en Google Sheets para solicitudes.", "Tabla con columnas fecha, nombre, email, telefono, estado y resumen.", "Preparar un registro simple para solicitudes.", { tools: ["Google Sheets"] }),

    day("2026-08-03", "TryHackMe", categories.security, "Continuar Linux Fundamentals.", "Apuntar comandos ls, cd, mkdir, rm y cat.", "Practicar comandos esenciales."),
    day("2026-08-04", "SQLBolt", categories.databases, "Hacer SQL Lesson 7: OUTER JOINs.", "Apuntar diferencia entre JOIN y LEFT JOIN.", "Entender datos relacionados aunque falte informacion."),
    day("2026-08-05", "CodeCombat", categories.logic, "Completar 2-3 niveles mas y repasar errores.", "Apuntar el error mas repetido.", "Aprender de bloqueos habituales."),
    day("2026-08-06", "Learn Prompting", categories.ai, "Leer sobre RAG basico o busqueda con documentos.", "Crear prompt para responder solo con una base de conocimiento.", "Evitar respuestas inventadas usando contexto."),
    day("2026-08-07", "n8n", categories.project, "Preparar n8n local o revisar como se va a usar.", "Apuntar flujo solicitud -> Sheets -> email.", "Disenar el flujo base de SolicitudPro.", { tools: ["n8n", "Google Sheets"] }),

    day("2026-08-10", "TryHackMe", categories.security, "Seguir con Linux o Windows Fundamentals.", "Apuntar diferencias entre Windows y Linux.", "Comparar sistemas que pueden alojar o usar herramientas."),
    day("2026-08-11", "SQLBolt", categories.databases, "Hacer SQL Lesson 8: NULLs.", "Guardar ejemplo con valor vacio.", "Entender datos incompletos sin romper consultas."),
    day("2026-08-12", "CodeCombat", categories.logic, "Completar niveles con objetos o propiedades.", "Apuntar que es un objeto en JS.", "Representar datos como entidades."),
    day("2026-08-13", "Learn Prompting", categories.ai, "Leer sobre agentes IA.", "Crear prompt para un asistente de solicitudes.", "Imaginar asistentes utiles para clientes y negocios."),
    day("2026-08-14", "Proyecto automatizacion", categories.project, "Crear flujo de prueba en n8n: dato manual -> Google Sheets.", "Primera automatizacion funcionando.", "Probar una automatizacion gratuita y concreta.", { tools: ["n8n", "Google Sheets"] }),

    day("2026-08-17", "TryHackMe", categories.security, "Repasar una room de redes ya hecha y repetir preguntas falladas.", "Lista de conceptos que ya entiende.", "Consolidar antes de avanzar."),
    day("2026-08-18", "SQLBolt", categories.databases, "Hacer SQL Lesson 9: Queries with expressions.", "Consulta con calculo o columna calculada.", "Crear informacion derivada desde los datos."),
    day("2026-08-19", "CodeCombat", categories.logic, "Completar niveles sin pedir ayuda durante 20 min.", "Apuntar como resolvio el bloqueo.", "Practicar autonomia tecnica."),
    day("2026-08-20", "Learn Prompting", categories.ai, "Crear 3 prompts para Codex: diseno, bug y explicacion.", "Guardar los 3 prompts en el diario.", "Construir una pequena biblioteca de prompts utiles."),
    day("2026-08-21", "Proyecto automatizacion", categories.project, "Anadir email automatico al flujo, aunque sea de prueba.", "Flujo solicitud -> Sheets -> email interno.", "Acercar SolicitudPro a un proceso real.", { tools: ["n8n", "Google Sheets"] }),

    day("2026-08-24", "TryHackMe", categories.security, "Test personal: repasar redes, web y Linux.", "Escribir 10 preguntas y responderlas.", "Medir lo aprendido sin presion."),
    day("2026-08-25", "SQLBolt", categories.databases, "Hacer SQL Lesson 10: Aggregates Pt.1.", "Consulta con COUNT, SUM o AVG.", "Crear metricas utiles desde una tabla."),
    day("2026-08-26", "CodeCombat", categories.logic, "Repetir niveles dificiles y hacerlos mas limpio.", "Apuntar mejora concreta en logica.", "Mejorar calidad, no solo terminar."),
    day("2026-08-27", "Learn Prompting", categories.ai, "Crear prompt maestro para SolicitudPro.", "Guardar version final del prompt.", "Tener una instruccion base para seguir construyendo."),
    day("2026-08-28", "Proyecto final", categories.project, "Publicar o actualizar diario en Netlify.", "Enlace final del diario web.", "Cerrar el verano con una web publicable.", { tools: ["Netlify"] }),

    day("2026-08-31", "Revision final", categories.project, "Crear resumen final del verano: total de dias, horas, aprendizajes, dificultades, septiembre y SolicitudPro.", "Resumen final guardado en el diario.", "Cerrar el ciclo y decidir el siguiente paso.", { tools: ["Netlify", "Supabase", "Google Sheets"] }),
  ];

  return {
    categories,
    platforms,
    STATUS_OPTIONS,
    PAUSE_REASONS,
    motivationalQuotes,
    learningPlan,
  };
});
