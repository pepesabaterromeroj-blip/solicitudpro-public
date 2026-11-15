# Resultado C16 — Comunicaciones profesionales

Fecha: 2026-09-29. Entorno: Supabase/n8n DEV.

## Estado

**C16 cerrada en DEV.** Se profesionalizaron exclusivamente
`customer_confirmation` y `business_notification`, los dos tipos que ya tenían
un evento real de envío. No se añadieron comunicaciones C15, respuestas
sugeridas, campañas ni mensajes operativos.

## Arquitectura

La composición determinista vive en `email-job-worker`: al reclamar un job,
el worker transforma el contexto backend en `subject`, `text` y `html`. C13B
continúa siendo la infraestructura genérica de transporte y conserva cola,
claim, wake, Schedule fallback, retries, Resend, `sent`/`failed`, Error Handler
y la clave de idempotencia basada en el ID inmutable del job.

No se creó ningún workflow. El workflow existente
`SolicitudPro DEV - Email Worker C13B` (`PUBLIC_SOLICITUDPRO_DEV_EMAIL_WORKER_C13B_WORKFLOW_ID`) solo pasó a consumir
el render final y a enviar las versiones texto y HTML a Resend.

## Comunicaciones

- `customer_confirmation`: confirma recepción, muestra referencia y servicio
  cuando existen, explica que el negocio revisará la solicitud y aclara que el
  cliente no necesita hacer nada por ahora. No muestra resumen interno,
  prioridad, IDs técnicos ni promesas de precio, fecha, visita o disponibilidad.
- `business_notification`: presenta referencia, servicio, urgencia, contacto y
  respuestas útiles para escaneo rápido. Usa `internal_summary` si ya existe;
  si C14A está pendiente o falla, utiliza la descripción como fallback sin
  polling, espera ni nueva inferencia.

Ambas comunicaciones tienen asunto, texto plano equivalente y HTML en español,
responsive de una columna, sin JavaScript ni dependencias externas. El HTML
incluye `lang`, `dir`, `title`, jerarquía de encabezados, tipografía legible y
contraste conservador.

## Seguridad y privacidad

Todos los valores dinámicos se normalizan; todos los datos no confiables se
escapan al entrar en HTML, incluidos nombre, descripción, zona, respuestas y
resumen. Los asuntos eliminan controles y saltos de línea. No se incorporan
secretos, UUID internos, prompts ni `suggested_reply` al contenido visible.

`get_email_job_context` sigue siendo `security invoker`: `anon` y
`authenticated` no pueden ejecutarla; solo `service_role`. La ampliación se
limita a `internal_summary` y `enrichment_status`; no cambia RLS ni expone datos
al frontend.

## Pruebas y validación DEV

- Pruebas dirigidas: 19/19 correctas para copy, HTML/texto, uso de enrichment,
  fallback pending/failed, escaping de `<script>alert(1)</script>` y caracteres
  especiales, contexto backend y contrato de claim C13B.
- E2E mínimo: una solicitud ficticia `REF-011` creó exactamente los dos jobs.
  La ejecución webhook C13B `218` terminó `success`; ambos tipos quedaron
  `sent`, intento 1, con HTML y texto. C14A estaba `processing` y sin resumen,
  por lo que el aviso al negocio demostró el fallback determinista.
- Replay seguro: ejecución manual `220`, `success`, devolvió `jobs: []`; no hubo
  segundo envío.
- Limpieza: request, jobs e idempotency key de `REF-011` quedaron en 0.

## Extensibilidad

El renderer está separado del proveedor y recibe un contexto normalizado. Una
fase posterior podrá añadir branding o nuevos tipos reales sin duplicar
workflows por negocio. C16 no adelanta onboarding, plantillas por cliente ni
configuración de remitentes.

No se añadieron secretos, proveedores, costes ni workflows. No se modificó
producción, landing, C15A/C15B, Error Handler ni Ops Maintenance.
