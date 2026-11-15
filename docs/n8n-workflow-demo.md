# Flujo n8n: solicitudes, presupuestos y seguimiento

Este documento describe el flujo n8n existente y como encaja con la demo web local.

La web de este repositorio no modifica n8n, no crea automatizaciones externas y no expone credenciales. Su objetivo es servir como interfaz de producto y demo comercial.

## Flujo real actual

```text
Formulario publicado
  -> preparacion de campos CRM
  -> validacion
  -> OpenAI
  -> extraccion de respuesta IA
  -> Google Sheets
  -> Gmail cliente
  -> Gmail negocio
  -> workflow de errores
```

## Objetivo del flujo

Automatizar el primer proceso comercial de un pequeno negocio:

1. Recibir una solicitud.
2. Preparar campos utiles para gestion interna.
3. Validar que la informacion minima existe.
4. Generar resumen, respuesta sugerida y seguimiento con IA.
5. Registrar la oportunidad.
6. Responder al cliente.
7. Avisar al negocio.
8. Registrar fallos si algo no funciona.

## 1. Formulario publicado

Campos recomendados:

- Nombre completo.
- Correo electronico.
- Telefono.
- Tipo de servicio.
- Descripcion del problema o necesidad.
- Presupuesto aproximado.
- Urgencia.
- Adjuntos o fotos descriptivas.
- Fuente de entrada.
- Fecha de solicitud.

La demo local reproduce estos campos en `index.html`, pero no envia datos reales a n8n. En el caso de adjuntos, guarda solo metadatos locales para explicar el caso de uso sin subir archivos.

La seccion de enlace/QR de la web es una preparacion visual para explicar como
el cliente podria llegar a este formulario desde un cartel, tarjeta, web o email.
No genera un QR real, no publica una URL y no conecta todavia con n8n.

La bandeja de seguimientos de la demo usa `proximo_seguimiento` y `estado` para
ordenar oportunidades activas. No crea tareas reales ni envia avisos; sirve para
mostrar como el negocio priorizaria a quien volver a contactar.

La vista de detalle reune todos los campos de una oportunidad y las acciones de
copia por canal. Sigue siendo una representacion local: no consulta n8n, Google
Sheets ni una base de datos.

La edicion desde ese detalle actualiza solo `localStorage`. En una integracion
real, el mismo cambio deberia validarse en backend y sincronizarse con n8n o la
base de datos mediante un identificador estable, sin exponer credenciales.

El historial de actividad de la demo registra eventos locales como creacion,
cambio de estado y edicion comercial. En una version real, este historial
deberia guardarse como eventos de auditoria en backend o base de datos antes de
sincronizarse con n8n, Google Sheets o cualquier CRM.

La cadencia local se simula con reglas de 24/48/72 horas: las solicitudes nuevas
o urgentes se revisan antes, los leads revisados y presupuestos enviados se
retoman en 48 horas, y las oportunidades pendientes sin urgencia en 72 horas.
Estas reglas son orientativas y no programan tareas externas.

## 2. Preparacion de campos CRM

El flujo debe normalizar datos para que despues puedan guardarse, enviarse o migrarse a base de datos:

- `cliente_nombre`
- `cliente_email`
- `cliente_telefono`
- `servicio_tipo`
- `descripcion_original`
- `presupuesto_rango`
- `urgencia`
- `estado`
- `fecha_entrada`
- `proximo_seguimiento`
- `cadencia_seguimiento_horas`
- `adjuntos`
- `resumen_interno`
- `respuesta_sugerida`
- `historial_actividad`

Estado inicial recomendado: `Nuevo`.

## Payload futuro para webhook n8n

La demo incluye una seccion visual con el payload JSON que podria enviarse en
una fase posterior a un backend o webhook seguro de n8n. Es una referencia de
contrato de datos, no una conexion activa.

No se debe llamar este webhook desde el frontend. La version real deberia:

- Enviar la solicitud primero a un backend seguro.
- Validar y sanear los campos en servidor.
- Guardar el registro en base de datos o cola si hace falta.
- Llamar a n8n desde servidor usando variables de entorno.
- Registrar errores y reintentos sin exponer credenciales.

Ejemplo de payload recomendado:

```json
{
  "origen": "formulario_demo",
  "cliente_nombre": "Marta Lopez",
  "cliente_email": "marta.lopez@example.com",
  "cliente_telefono": "+34 612 345 678",
  "servicio_tipo": "Reformas",
  "descripcion_original": "Quiere reformar un bano pequeno y revisar humedades.",
  "presupuesto_rango": "1.000 - 3.000 EUR",
  "urgencia": "Este mes",
  "estado": "Nuevo",
  "fecha_entrada": "2026-06-18",
  "proximo_seguimiento": "2026-06-19",
  "cadencia_seguimiento_horas": 24,
  "adjuntos": [
    {
      "nombre": "bano-humedad-demo.jpg",
      "tipo": "image/jpeg",
      "tamano_bytes": 184000
    }
  ],
  "resumen_interno": "Revisar detalles y confirmar alcance.",
  "respuesta_sugerida": "Hola Marta, gracias por contactar...",
  "preguntas_clave": ["medidas aproximadas", "fotos del estado actual"],
  "historial_actividad": [
    {
      "fecha": "2026-06-18",
      "tipo": "created",
      "titulo": "Solicitud creada"
    }
  ]
}
```

Campos minimos para una primera integracion:

- `cliente_nombre`
- `cliente_email`
- `servicio_tipo`
- `descripcion_original`
- `presupuesto_rango`
- `urgencia`
- `estado`
- `fecha_entrada`
- `proximo_seguimiento`
- `respuesta_sugerida`
- `historial_actividad`

## 3. Validacion

La validacion evita que entren oportunidades incompletas:

- Email obligatorio y con formato correcto.
- Nombre o negocio obligatorio.
- Descripcion suficiente para entender la necesidad.
- Servicio seleccionado.
- Urgencia seleccionada.
- Adjuntos opcionales limitados por numero, tipo y tamano antes de aceptar una subida real.

La demo web ya valida estos campos en frontend. En una version real tambien debe validarse en backend o en n8n.

## 4. OpenAI y extraccion de respuesta IA

La IA puede devolver:

- Resumen interno para el negocio.
- Respuesta sugerida para el cliente.
- Preguntas necesarias para completar presupuesto.
- Plantilla o tono recomendado segun el tipo de servicio.
- Prioridad aproximada.
- Siguiente accion comercial.

Ejemplo de salida esperada:

```json
{
  "resumen_interno": "Cliente solicita reforma de bano con humedad. Presupuesto estimado 1.000 - 3.000 EUR. Urgencia este mes.",
  "respuesta_sugerida": "Hola Marta, gracias por contactar. Hemos recibido tu solicitud para reformar el bano...",
  "preguntas_clave": ["medidas aproximadas", "fotos del estado actual", "fecha ideal para visita"],
  "prioridad": "media",
  "proximo_seguimiento": "Revisar en 48 horas si no responde"
}
```

## 5. Google Sheets

Google Sheets funciona como primer registro operativo.

Columnas recomendadas:

- Fecha.
- Nombre.
- Email.
- Telefono.
- Servicio.
- Descripcion.
- Presupuesto.
- Urgencia.
- Estado.
- Resumen interno.
- Respuesta sugerida.
- Proximo seguimiento.
- Responsable.
- Notas.
- Error si aplica.

## 6. Gmail cliente

El email al cliente deberia:

- Confirmar recepcion.
- Repetir brevemente lo entendido.
- Pedir datos faltantes si hacen falta.
- Explicar el siguiente paso.
- Marcar expectativas de tiempo de respuesta.

La demo local permite copiar un borrador de email con asunto y cuerpo, pero no lo envia. En una version real, el envio debe hacerse desde n8n o backend seguro con credenciales fuera del frontend.

## 6.1. WhatsApp preparado

La demo tambien permite copiar una version breve para WhatsApp a partir de la respuesta sugerida. Esto sirve para ensenar el flujo comercial sin usar WhatsApp API ni abrir conexiones externas.

En una fase real, WhatsApp deberia conectarse solo mediante proveedor aprobado, backend seguro y consentimiento del negocio.

## 7. Gmail negocio

El aviso al negocio deberia incluir:

- Nombre del cliente.
- Servicio solicitado.
- Urgencia.
- Presupuesto aproximado.
- Resumen interno.
- Respuesta sugerida.
- Enlace a Google Sheets o futuro CRM.

## 8. Workflow de errores

El flujo de errores debe registrar:

- Fecha y hora del fallo.
- Nodo o paso donde fallo.
- Payload minimo para poder reproducir.
- Mensaje de error.
- Accion recomendada.

Este punto es importante antes de convertir el proyecto en SaaS real porque permite revisar fallos sin perder solicitudes.

## Relacion con la demo web

La demo web muestra de forma visual:

- Como entra una solicitud.
- Como el cliente podria acceder al formulario mediante enlace o QR en una fase real.
- Como se ordena en un panel.
- Que resumen y respuesta podria obtener el negocio.
- Que preguntas conviene confirmar antes de cerrar presupuesto.
- Como preparar una respuesta para WhatsApp o email sin enviarla desde la demo.
- Como se controla el estado.
- Como se planifica y prioriza el seguimiento pendiente por fecha.
- Que payload JSON se podria enviar a n8n en una fase posterior.

La integracion real debera hacerse mas adelante con backend o webhook seguro. No se deben exponer claves ni llamar APIs externas desde el frontend.

## Relacion con el modelo de datos futuro

El documento `docs/data-model.md` define las entidades que deberian existir
antes de convertir esta demo en una aplicacion con base de datos:

- `businesses` para la configuracion del negocio.
- `contacts` para clientes o empresas que piden presupuesto.
- `requests` para solicitudes y oportunidades comerciales.
- `follow_ups` para proxima accion y cadencia.
- `messages` para respuestas preparadas o enviadas.
- `activity_events` para historial comercial.
- `automation_events` para envios, errores y reintentos de n8n.

Esta documentacion no activa una base de datos ni modifica el flujo n8n. Sirve
para que el futuro webhook y la futura persistencia usen nombres y relaciones
previsibles.
