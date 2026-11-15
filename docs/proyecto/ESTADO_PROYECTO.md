# Estado del proyecto

## SolicitudPro Demo v1.1 sectorial

Estado: lista para revisión manual final como demo local sectorial.

## Funciona en local

- Navegación por Inicio, Solicitudes, Seguimientos, Contactos, acceso del
  cliente y vistas secundarias.
- Selector de demo y URLs locales para Reformas, Electricidad, Fontanería y
  Academias.
- Cinco solicitudes ficticias por sector, con estados comerciales, etiquetas de
  datos por confirmar, actividad y seguimiento.
- Formulario validado por sector, detalle por pasos, respuestas preparadas y
  copia local.
- Tabla interna con filtros, edición local y exportación CSV del sector activo.
- Emails automáticos simulados y adaptados al sector: aviso interno y
  confirmación al cliente.
- Persistencia selectiva por sector en `localStorage` y reinicio seguro de la
  demo activa.

## Límites actuales

- No hay backend, autenticación ni base de datos compartida.
- No se conecta ni envía información a n8n, Gmail, Resend, Supabase, Google
  Sheets ni otros servicios externos.
- Las respuestas, emails, QR y adjuntos son simulaciones locales. Todo queda
  guardado únicamente en este navegador.

## Criterio de cierre

La demo debe explicar sin apoyo técnico: solicitud → datos organizados →
respuesta sugerida → seguimiento. Tras la revisión manual final, esta versión
podrá congelarse como SolicitudPro Demo v1.1 sectorial.
