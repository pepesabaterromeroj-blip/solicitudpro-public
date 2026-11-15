# Changelog

## 0.4.1 - 2026-07-22

- Reorganizada la navegacion lateral en grupos plegables: Panel interno, Acceso
  del cliente, Gestion de solicitud, Automatizaciones simuladas, Datos,
  Configuracion demo y Documentacion tecnica.
- Anadidas vistas locales para estados comerciales, emails de ejemplo, tabla
  local, sectores y campos adaptables por tipo de negocio.
- Los accesos de Gestion de solicitud abren el detalle existente en la pestana
  correspondiente, sin duplicar su contenido.
- Las previsualizaciones de email y la tabla se generan solo con los datos
  ficticios guardados en esta demo; no conectan servicios externos.
- Mejorada la marca activa de la navegacion cuando varias entradas apuntan a la
  misma vista.
- Sin cambios en la clave de localStorage, backend, APIs ni integraciones.

## 0.4.0 - 2026-07-22

- Transformada la demo en una interfaz de app con barra lateral en escritorio y
  menu compacto en movil.
- Solicitudes es ahora la vista inicial; Acceso del cliente, Formulario,
  Seguimientos y Documentacion tecnica se muestran sin recargar la pagina.
- Simplificada la bandeja de solicitudes para mostrar solo cliente, contacto,
  servicio, urgencia, estado y proxima accion.
- Reorganizado el detalle en pestanas de Solicitud, Resumen y dudas, Respuesta,
  Seguimiento y Actividad.
- Anadido aviso permanente: "Datos ficticios · Sin emails reales · Sin APIs".
- Reducidos los mensajes visibles sobre IA: la demo habla de resumen revisable,
  respuesta sugerida y asistente interno.
- Sin cambios en localStorage, integraciones, backend ni servicios externos.

## 0.3.5 - 2026-06-23

- Convertida la primera pantalla en una cabecera compacta de SolicitudPro Demo.
- Retiradas de la vista principal las metricas simuladas que podian parecer resultados reales.
- Reordenada la experiencia principal hacia enlace/QR, formulario, panel interno y detalle.
- Anadido boton para reiniciar la demo limpiando solo la clave local de esta demo.
- Plegada la documentacion tecnica de n8n, payload futuro, modelo de datos y estado MVP en una zona secundaria.
- La demo sigue sin conectar APIs, n8n, Supabase, Resend, OpenAI ni servicios externos.

## 0.3.4 - 2026-06-19

- Anadida seccion visual de modelo de datos futuro para preparar backend/base de datos.
- Documentadas entidades `businesses`, `contacts`, `requests`, `follow_ups`, `messages`, `activity_events` y `automation_events`.
- La mejora es solo documental y visual: no crea base de datos real, backend ni integraciones externas.

## 0.3.3 - 2026-06-18

- Anadida seccion visual con payload JSON de referencia para futuro webhook n8n.
- Documentados campos como contacto, solicitud, seguimiento, adjuntos, respuesta sugerida e historial.
- La demo sigue sin enviar datos a servicios externos ni exponer credenciales en frontend.

## 0.3.2 - 2026-06-16

- Anadido historial local de actividad por solicitud.
- Las solicitudes registran creacion, cambios de estado y ediciones comerciales.
- El detalle de solicitud muestra los eventos recientes de forma escapada y legible.
- Las solicitudes antiguas se migran con un evento inicial sin conectar backend ni servicios externos.

## 0.3.1 - 2026-06-15

- Anadida edicion de solicitudes desde la vista de detalle.
- Los cambios de contacto, servicio, necesidad, presupuesto, urgencia y estado se guardan en `localStorage`.
- Al guardar se recalculan las respuestas simuladas, los contadores y el proximo seguimiento.
- Anadidas pruebas para el formulario escapado y la normalizacion de valores editados.

## 0.3.0 - 2026-06-12

- Anadida vista de detalle accesible para revisar una solicitud sin saturar las tarjetas del panel.
- El detalle reune contacto, necesidad, resumen, adjuntos, preguntas, respuesta y proximo seguimiento.
- Las acciones de copia general, WhatsApp y email tambien estan disponibles dentro del detalle.
- Anadida una prueba automatizada para el contenido y escape seguro del detalle.

## 0.2.9 - 2026-06-11

- Anadidas reglas locales de seguimiento a 24/48/72 horas segun estado y urgencia.
- La bandeja y las tarjetas muestran la cadencia recomendada junto a la fecha y accion.
- Las solicitudes guardadas anteriormente migran una vez a la nueva regla sin conectar servicios externos.

## 0.2.8 - 2026-06-10

- Anadida bandeja de seguimientos pendientes en el panel.
- La bandeja ordena oportunidades activas por fecha de proximo seguimiento y excluye estados Ganado/Perdido.
- Cada seguimiento permite saltar a la solicitud y copiar una respuesta preparada para WhatsApp sin conectar APIs externas.

## 0.2.7 - 2026-06-09

- Anadidos botones para copiar la respuesta sugerida como texto general, mensaje para WhatsApp y borrador de email.
- El borrador de email incluye asunto y datos de referencia de la solicitud.
- La accion sigue siendo local: no se envian mensajes ni se conectan APIs externas.

## 0.2.6 - 2026-06-08

- Mejoradas las respuestas sugeridas simuladas con plantillas por sector.
- Anadido bloque "Datos a confirmar" en cada solicitud para mostrar preguntas clave antes de presupuestar.
- Las respuestas tienen en cuenta el tipo de servicio y si hay adjuntos simulados.

## 0.2.5 - 2026-06-05

- Anadida seccion visual de enlace/QR demo para explicar el acceso del cliente al formulario.
- Incorporado boton para copiar un enlace local de demostracion.
- La seccion deja claro que no genera QR real, no publica datos y no conecta servicios externos.

## 0.2.4 - 2026-06-04

- Anadida simulacion de fotos o adjuntos en el formulario de solicitud.
- La demo valida hasta 3 imagenes de menos de 5 MB cada una.
- El panel muestra los adjuntos asociados a cada solicitud y los incluye en el resumen interno.
- Solo se guardan metadatos locales en `localStorage`: nombre, tipo y tamano; no se suben archivos reales.

## 0.2.3 - 2026-06-03

- Mejorada la vista movil del panel de solicitudes.
- Los indicadores de estado se muestran como una fila desplazable en pantallas pequenas.
- Las tarjetas de solicitud muestran email y telefono para poder contactar al cliente sin abrir otra vista.
- Ajustados filtros, etiquetas y respuesta sugerida para reducir cortes y desbordes en movil.

## 0.2.2 - 2026-06-02

- Anadidos indicadores por estado del pipeline en el panel.
- Cada indicador muestra cuantas solicitudes hay en Nuevo, Revisado, Presupuesto enviado, Pendiente, Ganado y Perdido.
- Los indicadores permiten aplicar o quitar rapidamente el filtro de estado.
- Actualizada documentacion del estado funcional de la demo.

## 0.2.1 - 2026-06-02

- Anadida busqueda global en el panel de solicitudes.
- La busqueda se combina con los filtros de estado y servicio.
- El panel permite localizar solicitudes por cliente, email, telefono, servicio, descripcion, presupuesto, urgencia o estado.
- Actualizada documentacion del estado funcional de la demo.

## 0.2.0 - 2026-06-01

- Reforzada la landing como demo SaaS para pequenos negocios.
- Anadidas secciones de problema, solucion, funcionamiento, sectores objetivo y estado MVP.
- Mejorada la explicacion visual del flujo n8n real con validacion, IA, Google Sheets, Gmail y workflow de errores.
- Actualizada documentacion de README, estado del proyecto, roadmap, backlog y flujo n8n.

## 0.1.4 - 2026-06-01

- Anadida validacion clara del formulario con mensajes por campo.
- El formulario evita crear solicitudes incompletas o con email/telefono mal formateados.
- Anadidos estilos de error accesibles con `aria-invalid`.
- Actualizada documentacion del estado funcional de la demo.

## 0.1.3 - 2026-05-29

- Anadidas fecha de entrada y fecha de proximo seguimiento en cada solicitud.
- Las fechas se guardan en `localStorage` junto con las solicitudes y cambios de estado.
- El panel muestra las fechas como etiquetas visibles y en el bloque de seguimiento.
- Actualizada documentacion del estado funcional de la demo.

## 0.1.2 - 2026-05-29

- Anadidos filtros por estado y tipo de servicio en el panel de solicitudes.
- Anadido estado vacio cuando ningun lead coincide con los filtros activos.
- Actualizada documentacion para reflejar el filtrado basico del panel.

## 0.1.1 - 2026-05-29

- Anadida persistencia local con `localStorage` para solicitudes nuevas.
- Anadida persistencia local para cambios de estado en el panel.
- Actualizada documentacion para reflejar que los datos ya sobreviven a recargas en el mismo navegador.

## 0.1.0 - 2026-05-29

- Creada primera version local de la demo.
- Anadida landing principal orientada a pequenos negocios.
- Anadido formulario demo de solicitud.
- Anadido panel con solicitudes simuladas.
- Anadido cambio de estado por solicitud.
- Anadida generacion simulada de resumen interno.
- Anadida generacion simulada de respuesta sugerida.
- Anadida accion para copiar la respuesta sugerida.
- Documentado roadmap, backlog y flujo de automatizacion con n8n.
