# Resultado C18A — Panel y contratos de datos

## Decisión

El panel que se debe evolucionar es `dev/panel-product-readonly.html` con sus
archivos JavaScript y CSS asociados. Su nombre es histórico: ya es un panel
autenticado de gestión interna y realiza escrituras confirmadas de C10.
`dev/panel-supabase-readonly.html` queda como comprobador técnico de solo
lectura y `js/request-detail.js` pertenece a la demo local; ninguno debe
duplicarse ni convertirse en un segundo panel real.

## Lectura actual del panel

El listado y detalle actuales usan el token de sesión en memoria y RLS para
leer `requests`, `contacts`, `businesses`, `sectors`, formularios, respuestas,
seguimientos, actividades y adjuntos. El detalle ya muestra contacto, campos
del formulario con etiqueta humana, estado, prioridad, descripción, siguiente
acción, seguimientos, notas, actividad y adjuntos privados mediante URLs
firmadas de corta duración.

Las acciones existentes son: cambiar estado y prioridad mediante PATCH
confirmado; completar un seguimiento pendiente; archivar sin borrar; y añadir
una nota interna mediante una actividad confirmada. No existe todavía restaurar
una solicitud, crear o modificar seguimientos manuales, registrar contacto
humano, editar el borrador C14 ni enviar respuestas desde el panel.

## Contrato de `requests`

| Grupo | Campos |
| --- | --- |
| Mostrar | `reference`, sector y negocio derivados, `service`, `description`, `status`, `priority`, `urgency`, `created_at`, `updated_at`, `archived_at`, `next_action`, `next_follow_up_at`, `internal_summary`, `enrichment_status`, `enriched_at`, `automatic_follow_up_milestone_hours` y el borrador `suggested_reply` como texto editable futuro. |
| Interno no visible | `business_id`, `contact_id`, `sector_id`, `form_config_id`, `assigned_to`, `source`, `last_contacted_at`, `won_at`, `lost_at` y `suggested_questions`. Se usan para relaciones, reglas o trazabilidad; no son contenido operativo principal. |
| No exponer al frontend | `enrichment_claim_token`, `enrichment_claimed_at`, `enrichment_attempt_count`, `enrichment_next_attempt_at` y cualquier dato de claim, lease, backoff o error técnico. |

`suggested_reply` sigue siendo un borrador: no implica aprobación, envío ni
respuesta al cliente.

## Relaciones del detalle

| Recurso | Lectura necesaria | Escritura actual / futura | Contrato |
| --- | --- | --- | --- |
| `request_custom_answers` | Etiqueta humana, valor y orden de formulario. | No necesaria en C18. | RLS de tenant existente; lectura actual ya funciona. |
| `activities` | Historial visible y distinción de actor humano o automatización. | Nota interna ya existe; contacto humano necesitará acción auditada. | RLS permite lectura y alta humana de tenant; para contacto + `last_contacted_at` conviene una operación atómica. |
| `follow_ups` | Fecha, estado, texto, completado y canal. | Completar ya existe; crear, editar, cancelar o reprogramar son siguientes. | RLS de tenant existe; C18C debe usar contratos confirmados y mantener coherencia con `next_follow_up_at`. |
| `attachments` | Metadatos mínimos y URL firmada temporal. | Ninguna en C18. | RLS select aislada y firma actual ya válida. |
| `email_jobs` | Solo tipo, estado, creación y fecha de envío. | Ninguna desde panel. | Backend-only: falta una lectura mínima y proyectada para `authenticated`. |
| negocio / sector | Nombre y sector. | Ninguna. | RLS de tenant actual ya permite lectura. |

## C14A: enrichment visible

El panel debe reflejar `pending`, `processing`, `completed`, `failed` y
`legacy` con textos comprensibles. Solo cuando existe debe mostrar resumen
interno, borrador sugerido y `enriched_at`. No debe mostrar claims, intentos,
leases, próxima reintento ni errores crudos. Para `pending`, `processing`,
`failed` y `legacy` el detalle debe conservar la solicitud operativa sin
inventar resultado ni prometer una generación futura.

## C15: seguimiento visible

El detalle debe mostrar el hito actual `0/24/48/72`, la próxima fecha manual,
los seguimientos existentes y actividades relevantes. Las actividades
`request_follow_up_24h`, `request_follow_up_48h` y
`request_follow_up_72h` se representan como recomendaciones automáticas; las
actividades con `actor_type = 'user'` y los seguimientos manuales son acciones
humanas. La razón contextual ya existe en `activities.metadata.reason_code`,
pero no debe renderizarse como JSON técnico: C18B debe convertirla a texto
operativo seguro.

## C13/C16: comunicaciones

El panel no debe leer la cola completa ni recibir campos de trabajo. La
proyección necesaria por solicitud es: `email_type`, `status`, `created_at` y
`sent_at`; para un fallo, basta un estado comprensible, sin `last_error` crudo.
No deben exponerse `delivery_id`, `claim_token`, lease, `available_at`, payload,
HTML ni credenciales.

`email_jobs` tiene RLS y permisos backend-only, por lo que la lectura directa
desde el panel no es correcta. C18B necesita una RPC de lectura proyectada y
autorizada por membresía activa, o una Edge Function equivalente que valide la
sesión. La recomendación es una RPC mínima, sin escritura, sin conceder SELECT
sobre `email_jobs` a `authenticated`; si debe acceder a esa tabla backend-only,
debe encapsularse con privilegio controlado, `search_path` seguro, revocación a
`PUBLIC` y comprobación explícita de membresía.

## Acciones humanas

| Acción | Estado |
| --- | --- |
| Cambiar estado y prioridad | YA EXISTE |
| Archivar | YA EXISTE |
| Completar seguimiento pendiente | YA EXISTE |
| Añadir nota interna | YA EXISTE |
| Restaurar archivada | SIGUIENTE FASE |
| Crear, modificar, cancelar o reprogramar seguimiento manual | SIGUIENTE FASE |
| Registrar contacto o actividad humana | SIGUIENTE FASE |
| Editar `suggested_reply` como borrador con actividad auditada | SIGUIENTE FASE |
| Aprobar borrador / enviar respuesta aprobada | MÁS ADELANTE: falta contrato de aprobación y comunicación humana |
| Regenerar enrichment | MÁS ADELANTE: requiere trigger humano limitado y política de coste/reintento |
| Reintentar una comunicación fallida | MÁS ADELANTE: debe pasar por el worker, nunca por una escritura de panel |
| Editar claims, leases, retries, `email_jobs` o usar credenciales privilegiadas desde frontend | NO RECOMENDADA |

## Arquitectura recomendada

Evolucionar el panel existente con cinco áreas conceptuales: listado, detalle,
actividad/seguimiento, comunicaciones y acciones. C18B debe ampliar las
lecturas y añadir solo la proyección segura de comunicaciones; C18C debe añadir
acciones humanas auditadas y confirmadas. No se recomienda crear otro panel ni
abrir `email_jobs` al frontend.

## Siguientes fases

1. **C18B — Lectura integrada del panel.** Ampliar el detalle existente con
   C14, C15 y la proyección mínima de C13/C16; añadir pruebas de tenant,
   estados y datos no expuestos.
2. **C18C — Acciones humanas seguras.** Restauración, seguimiento manual,
   actividad de contacto y edición auditada de borrador, con contratos de
   backend que preserven RLS y consistencia.
3. **C19 — UX y pulido.** Jerarquía visual, responsive y decisiones de
   aprobación/envío solo después de validar la operación real.
