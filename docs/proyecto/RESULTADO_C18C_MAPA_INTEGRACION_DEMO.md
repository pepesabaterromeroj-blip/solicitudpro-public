# C18C — Mapa de integración de la demo objetivo

Fecha: 30 de septiembre de 2026. Alcance: diseño previo, sin cambios de comportamiento ni backend. Fuente: código y documentación actuales de este repositorio. **C18B confirmada**: `docs/proyecto/RESULTADO_C18B_PANEL_LECTURA_INTEGRADA.md`, `dev/panel-product-readonly.js` y `supabase/migrations/20260930113208_c18b_request_communications.sql` concuerdan en las lecturas y la RPC. No se reaudita DEV.

## Archivos exactos y arquitectura actual

- **Interfaz objetivo:** `index.html` (único entry point HTML; todas las pantallas son secciones `data-view`), `css/style.css`, `js/script.js` (estado, navegación, render, acciones y envío público), `js/sector-presets.js` (sectores, configuración, semillas y textos simulados), `js/request-detail.js` (render de detalle y edición), `js/follow-up-rules.js` (cadencia simulada), `js/public-form-attachments.js` (subida pública en modo DEV).
- Los cinco JS se cargan en ese orden desde `index.html` mediante globals `window.*`; no hay framework, imports ni capa de datos reutilizable. `showView()` alterna secciones y mantiene historial en memoria; el sector se toma de `?sector=`, el modo de envío real de `?submit=supabase-dev`. No hay router de URL para vistas de negocio.
- **Oráculo separado, no producto:** `dev/panel-product-readonly.html`, `.js`, `.css`. Sus contratos se citan abajo, sin convertirlo en segunda UI final.

## Navegación y fuentes actuales

| Sección presente | Responsable | Fuente / clase | Dependencias y acciones visibles |
| --- | --- | --- | --- |
| Selector sectorial, Inicio | `index.html`, `script.js`, `sector-presets.js` | semillas/`requests` local; **MOCK/LOCAL** | `?sector`, métricas y alertas derivadas; abrir solicitud, navegar. |
| Solicitudes, filtros, tabla interna | `script.js` | `requests` desde `localStorage` o semillas; **LOCAL** | búsqueda, estado, servicio; cambiar estado, editar celda/nota, exportar CSV y abrir detalle. |
| Detalle | `request-detail.js`, `script.js` | objeto local enriquecido; **MOCK/LOCAL** | pestañas solicitud/resumen/respuesta/seguimiento/actividad; edición, copia y marcar contactado. |
| Seguimientos | `script.js`, `follow-up-rules.js` | fecha/cadencia calculadas localmente; **MOCK/LOCAL** | abrir, copiar WhatsApp, marcar contactado. |
| Contactos | `script.js` | agrupación de `requests` por email/nombre; **LOCAL** | ficha y última solicitud; no lee `contacts`. |
| Compartir formulario / probar como cliente / recibo | `index.html`, `script.js`, `public-form-attachments.js` | enlace/QR ficticios; envío **PARCIALMENTE REAL** solo con `?submit=supabase-dev`; local por defecto | copiar enlace demo; envío público y adjuntos en modo DEV, recibo; panel no se actualiza con ese envío. |
| Recorrido, formulario público explicativo, estados comerciales, emails simulados, personalización sectorial, campos, Google Sheets futuro, panel futuro, información técnica | `index.html`, `script.js`, `sector-presets.js` | texto/presentación **MOCK** | navegación y vistas de ejemplo; no constituyen contratos de datos. |

## Mocks y persistencia

`script.js` contiene `demoRequests`, `loadRequests`/`saveRequests`/`resetDemoData`, `createInternalSummary`, `createSuggestedResponse`, `createNextFollowUp`, historial de actividad inventado y emails preparados. `sector-presets.js` contiene `SECTOR_REQUEST_SEEDS`, respuestas y experiencias por sector; `follow-up-rules.js` calcula fechas. `request-detail.js` renderiza esos campos como si fueran reales. `localStorage` usa clave por sector (`getSectorStorageKey`); no aparece `sessionStorage`. Los `setTimeout` encontrados sirven para realce/copiar/scroll, no simulan respuesta de backend. Los metadatos de adjunto local no representan un objeto Storage.

Las semillas, resumen, respuesta, cadencia, actividad, emails y agrupación local **deben dejar de alimentar vistas reales** al integrar cada bloque; pueden quedar solo detrás de un modo de desarrollo explícito y aislado mientras se migra, y eliminarse al completar su reemplazo. `localStorage` de solicitudes deja de ser persistencia del producto; no mezclar registros locales con Supabase. Textos explicativos de sectores pueden permanecer como presentación, claramente etiquetados.

## Contratos reales reutilizables y patrón seguro

Desde `dev/panel-product-readonly.js`: Auth `/auth/v1/token?grant_type=password`, token en memoria; GET PostgREST con clave **publicable** y JWT; `business_users`/`businesses` bajo RLS (políticas en `supabase/migrations/20260831114541_solicitudpro_rls_policies_draft.sql`). La demo futura debe seleccionar explícitamente negocio permitido; el panel técnico hoy muestra todos los negocios permitidos, no un selector de negocio activo.

Lecturas demostradas: `requests` listado/detalle por ID; `contacts`; `form_configs`, `form_fields`, `request_custom_answers`; `follow_ups`; `activities` (notas internas como `type=internal_note`, separadas de actividad general); `attachments` por negocio/solicitud y URL firmada de Storage `request-attachments`. Detalle C14: `enrichment_status`, `internal_summary`, `suggested_reply`, `enriched_at`. C15: `automatic_follow_up_milestone_hours`, `next_follow_up_at`, filas `follow_ups` y actividad contextual; `next_follow_up_at` significa **próxima fecha prevista**, no necesariamente manual. Comunicaciones: POST `/rest/v1/rpc/get_request_communications` con `{p_request_id: uuid}` y JWT; devuelve solo `email_type,status,created_at,sent_at`, sin acceso directo a `email_jobs`. La migración C18B limita ejecución a `authenticated` y comprueba `auth.uid()` y membresía activa.

Acciones C10 ya existentes en el panel técnico: PATCH de estado/prioridad/archivo en `requests`, completar `follow_ups`, insertar nota `internal_note` en `activities`. Son **contratos disponibles**, pero su conexión con la demo es C18D. Mantener respuestas en memoria y descartar lecturas tardías tras logout/cambio de detalle; mostrar errores genéricos sin datos internos. RLS sigue siendo la autoridad de aislamiento; filtros de UI no sustituyen membresía.

## Mapa mock/local → real

Estado: **planificado** salvo donde se indica parcial; «gap» significa contrato de producto no demostrado, no API existente.

| Interfaz | Fuente actual / clase | Fuente real y contrato | Cambio necesario | Dependencias | Estado |
| --- | --- | --- | --- | --- | --- |
| Auth/sesión | ausente / MOCK | Supabase Auth password, JWT en memoria (patrón panel) | pantalla/estado de sesión, limpieza al salir | clave publicable, usuario DEV | planificado |
| Negocio actual | sector por URL / LOCAL | `business_users` activo + `businesses` bajo RLS | resolver negocio autorizado, evitar equiparar sector con tenant | Auth | planificado; selector si hay varios: **gap UX** |
| Inicio/métricas | `requests` local / LOCAL | agregación en UI de `requests` autorizadas; `follow_ups` para pendientes | recalcular sobre lecturas reales, sin inventar métricas | negocio, listado | planificado |
| Solicitudes/filtros | semillas + `localStorage` / LOCAL | GET `requests`, contactos y datos relacionados con RLS | adaptar modelo y filtros a campos reales; no mezclar registros | negocio | planificado |
| Detalle | `enrichRequest()` / MOCK | GET `requests` por UUID y negocio + relaciones | adaptar render y estados vacío/error | listado | planificado |
| Contactos | email/nombre agrupado / LOCAL | GET `contacts` por negocio; relación `requests.contact_id` | agrupar por ID real, ficha/última solicitud | negocio, solicitudes | planificado |
| Formularios/respuestas | presets/`customAnswers` / MOCK | `form_configs`, `form_fields`, `request_custom_answers` | renderizar etiquetas/valores reales, sin JSON técnico | detalle | planificado |
| Resumen/borrador C14 | generadores JS / MOCK | campos `requests.internal_summary`, `suggested_reply`, `enrichment_status`, `enriched_at` | leer y etiquetar borrador no enviado | detalle | planificado |
| Estado/prioridad | estado local / LOCAL | campos `requests.status`, `priority`; PATCH C10 existente | lectura en C18C; escritura en C18D | detalle, Auth | lectura planificada; acción C18D |
| Seguimientos/fecha | regla y fecha local / MOCK | `follow_ups`; `requests.next_follow_up_at`, `automatic_follow_up_milestone_hours`; actividad contextual C15 | distinguir agenda real y recomendaciones; no atribuir autoría falsa | detalle, relaciones | planificado |
| Activities/notas | array local / LOCAL | `activities`, notas `type=internal_note` | separar cronología y notas | detalle | lectura planificada; escritura C18D |
| Adjuntos | solo metadatos locales / MOCK | `attachments` + URL firmada `request-attachments` | mostrar archivos reales y acceso efímero | detalle | planificado |
| Comunicaciones | previews de email / MOCK | `get_request_communications(uuid)` | mostrar tipo/estado/fechas, sin contenido email | detalle, Auth | planificado |
| Acceso cliente | enlace/QR demo; envío DEV opcional / PARCIALMENTE REAL | Edge Function `receive-public-form/.../{businessSlug}/{formSlug}/requests`, subida pública C12 | resolver URL pública real y separar vista cliente de sesión interna | negocio/formulario | parcial; enlace/QR productivo: **gap** |

## Gaps y acciones

- **Gap de contrato/UX:** selector y persistencia de «negocio actual» para usuarios con varias membresías; existen membresías y negocios, pero no un contrato de preferencia activa demostrado. Elegir en memoria es viable como decisión de UI, sin nuevo backend.
- **Gap de producto:** enlace público/QR real y ruta de acceso cliente desde la demo; existe endpoint de recepción por slugs, pero el enlace `demo.solicitudpro.local/formulario` y el QR actuales son ficticios. No afirmar URL pública estable ni auth de cliente.
- **Gap de modelo visual:** campos demo `budget`, `origin`, `nextFollowUp`, preguntas sugeridas y cadencia textual no equivalen uno a uno al detalle real. Mostrar solo dato demostrado o derivación de presentación claramente definida. Los previews de cuerpos de email no tienen contrato de lectura; `get_request_communications` devuelve solo metadatos.
- **Acciones:** navegar/filtrar/abrir detalle son UI local que se conserva; estado/prioridad/archivo, completar seguimiento y nota tienen contrato C10 pero su cableado es **C18D**. Editar borrador, aprobación, envío, regeneración, retry recuperable, seguimiento manual y activity humana requieren decisión/contrato C18D; no usar simulaciones locales como escritura real. Copiar texto es acción local, pero debe copiar el borrador real cuando exista. Exportar CSV puede ser derivación local de filas autorizadas; no tiene contrato backend propio. Reset de semillas, edición arbitraria de tabla y «marcar contactado +72 h» son **SIMULADOS** y no deben persistir en vistas reales.

## Capa fina propuesta

Ubicación: `js/data/` con `session.js` (sign-in, token en memoria, logout, generación de sesión), `supabase-api.js` (GET/RPC, headers JWT/publicable, errores técnicos uniformes y comprobación de respuesta vigente) y `product-read.js` (API interna `listBusinesses()`, `listRequests(businessId)`, `getRequestDetail(requestId)`, `listContacts(businessId)`, `listFollowUps(businessId)`, `getRequestCommunications(requestId)`). Se puede empezar con dos módulos si la división no aporta claridad. `script.js` queda como orquestador de UI; `request-detail.js` como presentación. Normalización mínima de nombres/fechas/estados de carga, sin reglas de negocio, sin duplicar RLS y sin `service_role` ni secretos. El flujo público existente puede usar la misma capa de transporte solo si no mezcla Auth del negocio con la recepción anónima; no forzar esa unión.

## Orden incremental y subfases de implementación C18C

1. **C18C-1:** Auth en memoria, negocio autorizado, capa mínima, listado de solicitudes y filtros. Cierre: refresco/logout y denegación de otro tenant verificados; `localStorage` no alimenta ese listado.
2. **C18C-2:** detalle y relaciones: contacto, formulario/respuestas, C14, activities/notas, adjuntos. Cierre: UUID propio/ajeno, estados carga/vacío/error y cambio rápido de detalle verificados.
3. **C18C-3:** seguimientos C15, comunicaciones, contactos, Inicio/métricas; resolver acceso cliente usando el endpoint existente cuando la URL de página sea concreta. Cierre: todas las vistas de lectura objetivo usan Supabase; ningún preview ficticio parece real. El enlace/QR queda explícitamente pendiente si su ruta pública no está definida.

Cada bloque debe poder probarse y cerrarse antes del siguiente. No se modifica el planning global **C18C → C18D → C19 → C20 → C21**.

## Riesgos y mitigación

- Dos fuentes de verdad por `localStorage` y envío DEV parcial: conmutar una vista completa a lectura real y aislar modo demo local explícito hasta retirarlo.
- `script.js` concentra estado, datos y UI: extraer solo transporte/lecturas; conservar render y navegación existentes hasta adaptar cada vista.
- IDs, estados, fechas y campos visuales no equivalentes: adaptar una proyección de lectura mínima con faltantes explícitos; no fabricar valores.
- Agrupar contactos por email/nombre fusiona personas: usar `contact_id` real.
- Acciones simuladas pueden aparentar persistencia: deshabilitar/rotular durante lectura C18C y conectarlas solo en C18D.
- Consulta duplicada o lectura cruzada: reutilizar capa fina, filtros por `business_id` y RLS; no solicitar columnas técnicas ni acceder a `email_jobs`.

## Archivos previstos y criterio de cierre futuro

Implementación posterior: `index.html`, `css/style.css` (solo estados/login y adaptación visual necesaria), `js/script.js`, `js/request-detail.js`, `js/sector-presets.js`/`js/follow-up-rules.js` (retirar uso de mock según bloque), `js/public-form-attachments.js` solo si se integra acceso cliente, y nuevos `js/data/*`. `dev/panel-product-readonly.*` permanece como oráculo/diagnóstico. Tests nuevos, dirigidos a límites de sesión, tenant y adaptación de datos, solo cuando se implemente.

**C18C se cerrará** cuando la demo bonita lea Auth, negocio, solicitudes, detalle, relaciones, C14/C15, contactos, adjuntos y comunicaciones de contratos reales de Supabase DEV; los mocks principales no alimenten pantallas reales; `localStorage` no sea fuente de producto; carga/vacío/error y sesión estén resueltos; RLS/aislamiento se prueben; exista una capa de lectura estable; el panel técnico no sea producto ni haya dos frontends funcionales paralelos. Acciones humanas quedan separadas para C18D. Los gaps de enlace/QR y campos sin contrato deben quedar resueltos con un contrato verificado o presentarse claramente como no disponibles, nunca como funcionalidad real.

**Estado actual:** mapa preparado; implementación C18C no iniciada. La conexión DEV se toma del contrato documentado, sin nueva ejecución contra Supabase en esta tarea.
