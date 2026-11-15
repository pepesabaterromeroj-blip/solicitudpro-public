# Modelo de datos futuro

Este documento define una primera forma de organizar los datos cuando la demo
local evolucione hacia backend, base de datos y automatizaciones reales.

No se debe crear todavia una base de datos real desde esta fase. El objetivo es
tener un contrato claro para decidir despues si conviene usar Supabase,
SQLite/PostgreSQL o un backend propio.

## Principios

- Mantener n8n separado del frontend.
- No guardar credenciales en JavaScript del navegador.
- Validar y sanear datos en servidor antes de guardar o llamar webhooks.
- Conservar el flujo actual de la demo: formulario, panel, estado, respuesta y seguimiento.
- Preparar entidades simples antes de pensar en multi-negocio avanzado.

## Entidades principales

### businesses

Representa el negocio que usa el sistema.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `name` | Nombre comercial del negocio. |
| `sector` | Sector principal: reformas, clinica, academia, comercio, etc. |
| `contact_email` | Email operativo para avisos. |
| `default_channel` | Canal preferido: email, WhatsApp preparado o llamada. |
| `created_at` | Fecha de alta. |

### contacts

Representa al cliente final o empresa que pide presupuesto.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `business_id` | Negocio propietario del contacto. |
| `name` | Nombre del cliente o empresa. |
| `email` | Email para responder. |
| `phone` | Telefono si existe. |
| `source` | Origen: formulario, QR, web, WhatsApp manual, etc. |
| `created_at` | Primera entrada del contacto. |

### requests

Representa una solicitud concreta de presupuesto o informacion.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `business_id` | Negocio propietario. |
| `contact_id` | Contacto asociado. |
| `service_type` | Tipo de servicio solicitado. |
| `description` | Necesidad original del cliente. |
| `budget_range` | Rango aproximado de presupuesto. |
| `urgency` | Urgencia indicada por el cliente. |
| `status` | Nuevo, Revisado, Presupuesto enviado, Pendiente, Ganado o Perdido. |
| `internal_summary` | Resumen interno generado o revisado. |
| `suggested_response` | Respuesta sugerida para revisar antes de enviar. |
| `key_questions` | Preguntas necesarias para cerrar presupuesto. |
| `created_at` | Fecha de entrada. |
| `updated_at` | Ultima modificacion. |

### request_attachments

Representa metadatos de fotos o adjuntos.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `request_id` | Solicitud asociada. |
| `file_name` | Nombre visible del archivo. |
| `mime_type` | Tipo de archivo. |
| `size_bytes` | Tamano aproximado. |
| `storage_url` | URL privada futura si se implementa almacenamiento real. |

La demo actual solo guarda metadatos en `localStorage`; no sube archivos.

### follow_ups

Representa la siguiente accion comercial.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `request_id` | Solicitud asociada. |
| `due_date` | Fecha recomendada de seguimiento. |
| `cadence_hours` | 24, 48 o 72 horas segun la regla aplicada. |
| `action` | Texto de la accion recomendada. |
| `status` | Pendiente, completado o descartado. |
| `completed_at` | Fecha si se completa. |

### messages

Representa textos preparados o enviados.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `request_id` | Solicitud asociada. |
| `channel` | general, email, WhatsApp preparado u otro canal futuro. |
| `subject` | Asunto si aplica a email. |
| `body` | Texto preparado o enviado. |
| `status` | Borrador, copiado, enviado o error. |
| `created_at` | Fecha de creacion del mensaje. |

### activity_events

Representa historial comercial visible para el negocio.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `request_id` | Solicitud asociada. |
| `type` | created, status, edit, note, message o automation. |
| `title` | Titulo corto del evento. |
| `detail` | Detalle legible. |
| `created_at` | Fecha del evento. |

### automation_events

Representa llamadas futuras a n8n, errores y reintentos.

Campos minimos:

| Campo | Uso |
| --- | --- |
| `id` | Identificador interno estable. |
| `request_id` | Solicitud relacionada si existe. |
| `workflow_name` | Nombre del flujo o integracion. |
| `status` | queued, sent, success, error o retry. |
| `payload_reference` | Referencia al payload guardado, no credenciales. |
| `error_message` | Mensaje de error si falla. |
| `created_at` | Fecha del evento. |

## Relaciones recomendadas

```text
businesses
  -> contacts
  -> requests
      -> request_attachments
      -> follow_ups
      -> messages
      -> activity_events
      -> automation_events
```

## Mapeo desde la demo actual

| Demo actual | Entidad futura |
| --- | --- |
| `name`, `email`, `phone` | `contacts` |
| `service`, `description`, `budget`, `urgency`, `status` | `requests` |
| `attachments` | `request_attachments` |
| `nextFollowUpDate`, `followUpCadence`, `nextFollowUp` | `follow_ups` |
| `suggestedResponse` y copias por canal | `messages` |
| `activityHistory` | `activity_events` |
| payload n8n documentado | `automation_events` |

## Pendientes antes de implementar

- Elegir tecnologia de backend y base de datos.
- Definir autenticacion y permisos por negocio.
- Decidir donde guardar archivos reales.
- Definir variables de entorno para n8n, Gmail, IA y base de datos.
- Crear migraciones solo cuando se apruebe pasar de demo local a backend.
