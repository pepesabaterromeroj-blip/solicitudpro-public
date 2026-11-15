# SolicitudPro — Auditoría global y plan hasta una demo comercial

Versión: **v1**. Fecha de referencia y consulta: **18/10/2026**, Europe/Madrid.
Horizonte prioritario: **19–31/10/2026**. Documento de investigación; no autoriza implementación, sincronización, despliegue ni nuevas fases.

Modelo solicitado: **GPT-6 Astra / High**; alternativas solicitadas: GPT-6.1 Sol / High y GPT-5.6 Sol / High. Modelo de runtime exacto y esfuerzo efectivo: **NO VERIFICADO**. No se cambió el modelo ni su configuración; no se puede afirmar que se ejecutó Astra ni que hubo una sustitución concreta.

## A. Resumen ejecutivo

SolicitudPro ya tiene un recorrido real DEV considerable: captación multisector, persistencia, Auth y membresías, lecturas y acciones humanas, archivos privados, generación de resumen/borrador, correo transaccional y recomendaciones automáticas. La carencia principal para una presentación guiada no es reconstruir el backend: es terminar la integración visual, corregir inconsistencias concretas, comprobar el entorno actual y ensayar una demostración repetible.

**C19 sigue abierta.** C19A+B está implementada y publicada con validación histórica; C19C+D tiene copia de respuesta, ajustes de navegación y estilos publicados, pero carece de resultado final y evaluación POST. La revisión fresca encuentra seis tests C19 correctos y dos errores documentales del validador. También identifica tres problemas acotados: fallback de copia con posible falso éxito, prioridad numérica en el listado y archivadas sin diferenciación en ese listado.

El panel real aún no integra las entradas «Compartir formulario» y «Probar como cliente»: navegan a una sección pendiente. El formulario público DEV existe por una ruta explícita separada. Esto permite una demo guiada en dos pestañas sin construir onboarding, pero debe explicarse y ensayarse. No se debe presentar ese acceso como un portal de cliente terminado.

Estimación para el **Objetivo A**, con servicios DEV disponibles y sin añadir funcionalidades de negocio: **12 horas optimistas, 22 probables y 35 conservadoras**, incluida una reserva explícita. Son horas humanas asistidas por Codex, con pruebas y revisión. No son una medida exacta del progreso ni una promesa contractual.

Hay **10 días de lunes a viernes** del 19 al 31 de octubre. Con 30–45 minutos diarios no cabe el trabajo. Con 1–1,5 horas cabe solo un desenlace favorable y de alcance muy contenido. Con 2–3 horas, el 31 de octubre es un objetivo razonable si se reservan al menos unas 22 horas, no aparece una restauración de servicios y la revisión humana llega a tiempo. **No existe fecha confirmada.**

| Objetivo | Qué significa | Situación y criterio |
|---|---|---|
| A — Demo comercial presentable | Presentación guiada, datos ficticios/DEV controlados, recorrido principal coherente y límites explícitos | Prioridad inmediata. Puede usar servidor local, owner preparado y dos pestañas. No exige alta autoservicio, facturación ni despliegue productivo. |
| B — Piloto real limitado | Un negocio autorizado utiliza el sistema con datos y operación reales bajo condiciones acordadas | Requiere activación, accesos, formulario compartible, continuidad operativa, privacidad y soporte. No demostrado por el cierre DEV histórico. |
| C — SaaS de producción | Operación sostenida para clientes, despliegue, mantenimiento, seguridad y soporte | No verificado ni listo. Necesita evaluación y trabajo separados; no es requisito íntegro de A. |

La reacción comercial de una empresa depende de su problema y de su evaluación; no se garantiza aceptación.

## B. Checkpoint Git

**VERIFICADO LOCAL** al iniciar:

```text
Equipo: Windows CASA / HP
Raíz: D:/demo Solicitudpro/solicitudpro
Rama: c19ab-detail-responsive
HEAD: ba488eedfbcb99424f1d3a6bc648b3708f6e7ff7
Asunto: wip(c19): continue global UX polish
Padre: e225b3bf8695b22ccd2a01a87c979adaeceb1b96
Estado: ## c19ab-detail-responsive...origin/c19ab-detail-responsive
Staged: ninguno
Unstaged: ninguno
Untracked: ninguno
Repositorio shallow: false
```

**PUBLICADO**, contrastado con `git ls-remote --heads origin` sin fetch:

| Referencia | SHA |
|---|---|
| Rama C19 en GitHub | `ba488eedfbcb99424f1d3a6bc648b3708f6e7ff7` |
| `main` en GitHub | `331690f7a8dd991b6692b32398842678b7046a75` |
| `main` y `origin/main` locales | `331690f7a8dd991b6692b32398842678b7046a75` |

Remoto: `https://github.com/pepesabaterromeroj-blip/solicitudpro.git`. La rama C19 está 4 commits por delante y 0 por detrás de `main`: C18C-3, C18D-1, C18D-2 y el WIP C19. Un pull de main por sí solo no incorpora esas fases.

El commit C19 contiene 14 archivos: cuatro de código (`css/style.css`, `js/real-product.js`, `js/request-detail.js`, `js/script.js`), dos tests C19, el resultado C19AB, README de evaluaciones y seis registros de casos/prompts/evaluaciones C19AB/CD. No cambia `js/data/product-data.js`, `index.html`, SQL, Edge Functions ni workflows respecto de su padre.

No existe trabajo C19 exclusivo de casa sin publicar al inicio de esta auditoría. La única diferencia local que debe quedar al terminar es **este documento nuevo sin seguimiento**, no publicado. Ninguna operación Git mutante está autorizada ni se ha realizado.

## C. Evolución histórica

La historia accesible arranca en `5bfb6cb` (07/09), un snapshot C9A que ya contiene trabajo anterior. No hay commits separados de todos los primeros desarrollos; fechas y cierres anteriores se atribuyen a sus documentos, no se reconstruyen como commits inexistentes. Los hashes siguientes pertenecen a la ascendencia del HEAD publicado.

| Bloque | Resultado y arquitectura reutilizada | Evidencia principal | Prueba conocida y límite actual |
|---|---|---|---|
| Demo local inicial | Formularios sectoriales, solicitudes ficticias, detalle por pasos, copia, contactos, simulaciones de correo y persistencia local | Snapshot `5bfb6cb`; [estado histórico](ESTADO_PROYECTO.md); `js/script.js`, `js/sector-presets.js` | La documentación general sigue describiendo esta etapa. Hoy solo representa `?mode=local`, no todo el producto. |
| Base B y C1–C2 | Tablas, relaciones, RLS y entrada pública mediante Edge Function/RPC; rate limit persistente, CORS e idempotencia | [C2](RESULTADO_C2_ENDPOINT_DESPLEGADO_DEV.md), 31/08; [B4](sql/RESULTADO_B4_HARDENING_DEV.md) | DOCUMENTADO: respuestas 201/200, rechazo de tenant/valores no permitidos, 429 y ausencia de asociaciones cruzadas. Limitaciones de C1 superadas por C2; no tratarlas como defectos abiertos. |
| C3–C9A | Formulario aislado, lecturas autenticadas, detalle, seis sectores y panel técnico de diagnóstico | [C6](RESULTADO_C6_FORMULARIOS_DEMO_ENDPOINT_DEV.md), [C7](RESULTADO_C7_ENTORNO_DEV_MULTISECTOR.md), [C8B](RESULTADO_C8B_FORMULARIOS_PRIORITARIOS_ENDPOINT_DEV.md), [C9A](RESULTADO_C9A_PANEL_REAL_BONITO_READONLY.md) | DOCUMENTADO: seis owners aislados en C9A, 4 tests de panel. Panel `dev/panel-product-readonly.*` no es el frontend de producto actual. |
| C10 | Estado/prioridad, archivo, completar tareas y notas internas persistentes | `ac2f703`, `d744f23`; resultados C10A/B/C en esta carpeta | Contratos posteriormente reutilizados por C18D; no duplicar notas ni backend. C10 vive originalmente en el panel técnico. |
| C11 | `email_jobs` backend-only, dos tipos por solicitud y contexto normalizado | `29d78d9`; [C11B](RESULTADO_C11B_GENERACION_EMAIL_JOBS_DEV.md), [C11C](RESULTADO_C11C_CONTEXTO_EMAILS_N8N_READY_DEV.md) | Base transaccional e idempotente. Crear jobs no equivale a enviar correo. |
| C12 | Storage privado, subida autorizada por referencia y clave original, módulo común seis sectores, lectura autenticada con firma temporal | `d883c8c`, `e8ea469`, `fd68499`; [C12B2](RESULTADO_C12B2_FORMULARIOS_ADJUNTOS_DEV.md), [C12C](RESULTADO_C12C_VISUALIZACION_ADJUNTOS_PANEL_DEV.md) | DOCUMENTADO: Academias sin/con JPEG, multiarchivo Reformas, PDF idempotente y SVG rechazado. Retry pierde contexto al cerrar la página. |
| PRE-C13 | Auth endurecido, baseline histórico recuperado, worker con claim atómico, lease y token; retry controlado | `14c3c5d`, `dce035e`; [baseline](RESULTADO_PRE_C13A2_AUTH_BASELINE_IMPLEMENTADO_DEV.md), [worker](RESULTADO_PRE_C13B_WORKER_EMAIL_JOBS_DEV.md) | Históricamente 113 tests con 13 migrations y después 122/14. Reconstrucción con PGlite y stubs, no un despliegue Supabase completo. Hoy hay 21 archivos de migrations; no se ha reconstruido esta revisión durante la auditoría. |
| C13A/B | n8n consume contrato acotado; C13B incorpora transporte Resend, wake/fallback, retry, Error Handler, Gmail operativo y retención | `a4c4595`, `3b5e8d2`, `11e9779`, `c7f3f6e`; [C13B](RESULTADO_C13B_VALIDACION_Y_HARDENING.md) | El documento es cronológico: el bloqueo del 23/09 no es su último estado. Adendas 24–25/09 y C17 acreditan avances. Anti-spam documentado con dos errores y una alerta; limpieza selectiva probada manualmente. Primer disparo automático de retención no acreditado en esa evidencia. |
| C14A | Enriquecimiento separado del correo: resumen y borrador validados, una inferencia, claim/lease/retry | `958360e`, `29f37d6`; [C14A](RESULTADO_C14A_REQUEST_ENRICHMENT.md) | DOCUMENTADO: wake → complete de REF-010, replay sin inferencia y una activity. Gateway/modelo requieren disponibilidad y créditos; el borrador nunca se envía automáticamente. |
| C15A/B | Recomendaciones internas monotónicas 0/24/48/72 y reglas contextuales; mismo worker/RPC | `0806ea4`, `497cfa8`; [C15A](RESULTADO_C15A_FOLLOW_UP_BASIC.md), [C15B](RESULTADO_C15B_FOLLOW_UP_INTELLIGENT.md) | DOCUMENTADO: C15A 7/7, C15B 5/5, replay/concurrencia/tenant. No son emails ni tareas manuales para completar. |
| C16 | HTML/texto profesional para confirmación al cliente y aviso al negocio; fallback determinista sin esperar IA | `6406a0e`; [C16](RESULTADO_C16_COMUNICACIONES_PROFESIONALES.md) | DOCUMENTADO: 19/19, dos jobs enviados, replay vacío. No introduce envío de respuesta sugerida. |
| C17 | Inventario/freeze, E2E integrado, limpieza y portabilidad | `642e0ca`, `b0482f3`, `0924dfc`, `c47640b`; [C17B](RESULTADO_C17B_E2E_INTEGRADO.md), [C17C](RESULTADO_C17C_HARDENING_LIMPIEZA.md), [C17D](RESULTADO_C17D_PORTABILIDAD.md) | DOCUMENTADO: solicitud → dos correos + enrichment + C15 sin duplicados y cleanup. Corrigió codificación Windows. Cinco exports portables; restaurar exige reasignar credenciales, Data Table, endpoints y Gateway. |
| C18A/B | Contratos y lectura integrada en el panel técnico | `a01fbd1`; [C18B](RESULTADO_C18B_PANEL_LECTURA_INTEGRADA.md) | Oráculo de contratos, no segundo producto. RPC de comunicaciones expone campos seguros, no la cola completa. |
| C18C | Demo bonita conectada a Auth, negocio, solicitudes, detalle completo, contactos, métricas, C15 y comunicaciones | `fb017bd`, `d01c2da`, `a6826ba`, `e55d430`, `c1bfc9a`, `a7a7003`; [C18C-1](RESULTADO_C18C_1_BASE_REAL_DEMO.md), [C18C-2](RESULTADO_C18C_2_DETALLE_REAL.md), [C18C-3](RESULTADO_C18C_3_LECTURAS_RESTANTES.md) | Login y adjuntos con smoke histórico; C18C-3 78/78 y cierre con limitación explícita de smoke Auth. No se transforma esa limitación en una prueba completa de todas las pantallas. |
| C18D | Acciones reales base y ciclo manual crear → pendiente → completar → Activity | `ccded32`, `e225b3b`; [C18D-1](RESULTADO_C18D_1_ACCIONES_HUMANAS_BASE.md), [C18D-2](RESULTADO_C18D_2_SEGUIMIENTOS_MANUALES.md) | DOCUMENTADO: 53/53; 96/96 previos y 26/26 afectados tras corregir varias tareas por solicitud. Smoke owner DEV; Activity es segunda escritura con aviso de éxito parcial. |
| C19AB/CD | Detalle compacto, responsive y pasos estables; copia real y polish parcial | `ba488ee`; [C19AB](RESULTADO_C19AB_DETALLE_RESPONSIVE.md), [caso CD](../../evals/codex-prompts/casos/c19cd-ux-global-polish.md) | AB: 72/72 históricos y cinco viewports documentados. CD: tres tests propios y POST pendiente. Hoy seis tests AB/CD pasan; eso no prueba el cierre visual. |

## D. Inventario funcional

«Completa en alcance verificado» significa implementación local y evidencia de la fase indicada; no garantiza disponibilidad remota hoy. El estado operativo actual de Supabase/n8n/proveedor es **NO VERIFICADO** por restricción del encargo. Producción no se inspeccionó y ninguna capacidad se acredita como productiva.

| Capacidad | Frontend local | Producto real DEV / backend / n8n | Clasificación y brecha |
|---|---|---|---|
| Formularios públicos | Seis presets simulados | Ruta explícita `?submit=supabase-dev&sector=...` a `receive-public-form`; slugs fijos DEV | Completa para seis negocios DEV configurados; parcial para compartir desde panel/onboarding arbitrario. |
| Captación/almacenamiento | Navegador | RPC con requests, contacto, respuestas, actividad y jobs; idempotencia/rate limit | Completa en alcance C2/C11; nueva ejecución remota no verificada. |
| Login/membresías | No aplica | Auth, JWT en memoria, consulta de user y membresías activas | Completa DEV básica; recarga/expiración requieren login. Recuperación/alta comercial pendientes. |
| Selección de negocio | Selector sectorial ficticio | Membresía autoriza; preferencia guardada no concede permisos | Completa C18C; no es una consola de alta de negocios. |
| Inicio/métricas | Métricas ficticias | Nuevas, activas, prioridad alta, vencidas/hoy; alertas y próxima tarea | Completa para dataset pequeño cargado; ya existe base de bandeja accionable. |
| Listado/búsqueda | Demo | Búsqueda por referencia/servicio/contacto, filtros estado/servicio | Parcial en UX: prioridad numérica y archivo sin distinción; no paginación explícita en la consulta. |
| Detalle | Cinco pasos | Datos reales, formulario, C14, actividad, notas, tareas, archivos y comunicaciones | Completa C18C-2; presentación C19 real autenticada aún necesita revisión global. |
| Estado/prioridad/archivo/restauración | Simulación | Writes autenticados y confirmados; archivo reversible sin DELETE | Completa C18D para persistencia. UX del listado tras archivo y auditoría específica por cambio pendientes. |
| Resumen/enrichment | Texto simulado | C14, Gateway, resultado validado y almacenado | Completa histórica DEV; servicio/modelo/créditos actuales no verificados. |
| Respuesta sugerida | Texto simulado | Borrador C14, no aprobado ni enviado | Completa en lectura. Editar/aprobar/enviar no implementado ni necesario para A. |
| Copiar respuesta | Acción histórica | C19CD añade copia exacta y botón condicional | Parcial: happy path testado; fallback de error defectuoso y prueba visual pendiente. |
| Notas internas | Simulación | Activities tipo `internal_note`, texto acotado/escapado | Completa C18D. No edición/borrado; no necesitan un segundo sistema de notas. |
| Actividades | Ficticias | Historial real traducido, creación/completado de tareas y automatizaciones | Completa en eventos existentes; no activity específica de estado/prioridad/archivo. |
| Seguimientos manuales | Simulación local | `follow_ups`, tarea/fecha/autor, pending/completed, finalización real | Completa C18D-2 con smoke documentado. Creación y Activity no son una transacción única. |
| Automáticos 24/48/72 | Ejemplos | C15 backend/n8n, hitos monotónicos y contexto | Completa histórica; no editar/completar esos hitos ni presentarlos como emails. |
| Contactos | Vista ficticia | Proyección de requests + contacts autorizados; agrupa por ID | Completa en alcance de proyección; no CRUD CRM. |
| Adjuntos | Simulados | Máximo 5 × 10 MiB, seis MIME, subida secuencial privada y firma temporal 120 s | Completa C12/C18C-2; retry solo en memoria y firma caduca. No subir de nuevo antes de crear solicitud. |
| Comunicaciones | Simuladas y etiquetadas | C13/C16 envían dos tipos; UI lee RPC `get_request_communications` | Completa histórica; `sent` acredita estado del envío/proveedor, no lectura ni llegada al inbox. |
| Sectores | Seis demos | Reformas, Electricidad, Fontanería, Climatización, Cristalerías, Academias | Completa configuración DEV. Academias publica solo materia/disponibilidad del mapeo aprobado. |
| Acceso cliente/enlace | Pantalla/enlace demo | Formulario técnico accesible, pero navegación real formulario/acceso pendiente | Parcial. No hay portal de seguimiento de cliente acreditado. |
| Onboarding negocio | Personalización demostrativa | Modelo/config existen; no alta guiada desde producto | Pendiente para B; provisión asistida puede bastar para primer piloto, con revisión específica. |
| Seguridad/mantenimiento | Separación explícita | Auth/RLS, tenants, Storage privado, workers acotados, alertas/retención, migrations/exports | Completa en alcance histórico DEV; readiness operacional/producción no verificada. |
| Demo comercial | Recorrido posible | Muchas piezas reales disponibles | Parcial: faltan cierre C19, recorrido actual ensayado y presentación honesta/repetible. |

## E. Arquitectura consolidada

Se preservan tres recorridos distintos:

1. Producto: `UI → js/real-product.js → js/data/product-data.js → REST/RPC con Auth y RLS`.
2. Captación: formulario explícito DEV → `receive-public-form` → persistencia/idempotencia → adjuntos y wakes. El backend resuelve el negocio/formulario; el navegador no elige libremente IDs privilegiados.
3. Automatización: n8n → worker acotado → RPC/cola. C13B transporta correo; C14 genera borrador; C15 registra recomendaciones. No se traslada lógica de autorización al frontend.

Contratos y límites a conservar:

- Auth, membresías activas, `business_id` y RLS; preferencia `activeBusiness` revalidada.
- Modo real sin fallback ficticio; `?mode=local` explícito. El formulario DEV es una tercera ruta explícita, no una autorización para mezclar datasets.
- `email_jobs` backend-only; comunicaciones frontend por RPC segura. Claim atómico, token renovado, lease y resolución protegida. Claim no garantiza exactly-once con proveedor externo; conservar idempotencia de entrega y sus límites.
- Storage privado, autorización backend de upload y URLs firmadas temporales. Sin secretos ni credenciales privilegiadas en frontend.
- Suggested reply es borrador: copiar no envía ni aprueba. C16 no incorpora ese borrador a los correos transaccionales.
- `follow_ups` manual y actividades C15 son conceptos distintos. No crear tablas, workflows o historiales paralelos.
- C15B consulta `last_contacted_at`, finalizaciones de tareas y actividades `actor_type='user'` distintas de `request_created`. Por tanto una nota puede contar como actividad humana reciente en el contrato actual; **no demuestra contacto con el cliente ni cambia semánticamente a contacto realizado**. Una fase futura deberá revisar esta distinción sin modificar C15 silenciosamente.
- Los exports C17D son recuperables, pero requieren configuración segura en destino; no contienen un entorno activo de un clic.

Las siete directrices de producto se mantienen: arquitectura existente; notas reutilizadas; C15 preservado; UX simple; escritorio/portátil prioritario con móvil/tablet; comparación selectiva sin CRM empresarial; reutilización de tests y herramientas actuales.

## F. Deuda y problemas reales

Prioridad P0: impide acreditar el cierre/demo; P1: riesgo relevante del recorrido; P2: deuda aceptable si se declara. No se ha encontrado una exposición multi-tenant nueva mediante esta inspección acotada; tampoco se ha reauditado seguridad remota.

| ID | Impacto/estado | Evidencia | Tratamiento recomendado |
|---|---|---|---|
| F1 | P0 cierre C19, VERIFICADO LOCAL | Falta `RESULTADO_C19CD_UX_GLOBAL_POLISH.md`; POST vacío; validador falla con 2 errores | Completar evidencia/documentación después de validar, no rellenar un cierre ficticio. |
| F2 | P0 presentación, NO VERIFICADO | Sin recorrido visual global final ni revisión humana; C19AB solo documenta detalle local y real sin sesión | Recorrido completo con viewports y sesión autorizada si está disponible. |
| F3 | P1 microacción, VERIFICADO LOCAL | Fallback `writeClipboard` ignora retorno de `execCommand('copy')`; prueba aislada en memoria devolvió false y la promesa resolvió sin error | Corrección y test dirigido en futura continuación C19; mismo patrón existe en copia local. No se cambió ahora. |
| F4 | P1 comprensión, VERIFICADO LOCAL | `renderRequestRows` pinta prioridad 1/2/3; prueba sintética confirmó `<strong>1</strong>` | Reutilizar traducción humana ya presente en el detalle; no cambiar enum. |
| F5 | P1 archivo, VERIFICADO LOCAL | `renderList` no filtra `archived_at`; `renderRequestRows` no la representa. Render sintético archivado carece de etiqueta | Hacer visible la condición en C19; decidir filtro posteriormente si necesario. La escritura archivo/restauración sí existe. No copiar automáticamente todos los controles del panel técnico. |
| F6 | P1 recorrido autónomo, VERIFICADO LOCAL | Navegación real `formulario`/`acceso-cliente` deriva a `real-pending` | A guiada: pestaña pública explícita y límites claros. B: activación/enlace real. No presentar un portal terminado. |
| F7 | P1 continuidad de demo, NO VERIFICADO actual | C17D depende de hosting n8n, Gateway/créditos, correo y reasignación de credenciales | Antes de E2E futuro, verificar disponibilidad con autorización. No repetir toda C13–C17; si falta servicio, reestimar. |
| F8 | P2 sesión, VERIFICADO LOCAL | Token en memoria, sin refresh/persistencia; reload pide login | Explicarlo en guion y ensayar reentrada. Evaluar política de sesión para B, sin guardar credenciales por comodidad. |
| F9 | P2 trazabilidad, DOCUMENTADO/LOCAL | Estado/prioridad/archivo sin activity propia; follow-up y Activity en dos escrituras | A admite límites explícitos. B requiere decisión de auditoría y tolerancia a fallo parcial; no nueva infraestructura automática. |
| F10 | P2 escala, VERIFICADO LOCAL | `listRequests` sin paginación explícita y métricas sobre filas cargadas | Adecuado solo con dataset pequeño comprobado. Antes de crecimiento, verificar completitud/límites; no prometer métricas de todo el negocio sin ello. |
| F11 | P2 fuentes obsoletas, VERIFICADO LOCAL | ESTADO_PROYECTO/ROADMAP aún dicen sin backend; C19AB dice sin commit pese a ba488ee | Usar este informe y resultados específicos. Actualizar documentos generales en encargo separado autorizado. |
| F12 | P2 validación histórica, DOCUMENTADO | C18C-3 cerrado con smoke Auth global no realizado; C19AB real autenticado no visto | Resolver en un único recorrido actual del producto; no reauditar RLS como sustituto de UX. |
| F13 | Piloto/producción, DOCUMENTADO/NO VERIFICADO actual | Deuda de protección de contraseñas filtradas y requisitos operativos; baseline reciente no reconstruido aquí | Revisión específica antes de B/C. No asumir que el conteo histórico 13/14 representa las 21 migrations actuales. |

No se ha demostrado que todo defecto de producto esté listado. El alcance fue histórico/funcional dirigido, no pentest ni inspección línea por línea. No se deben convertir los huecos de evidencia en fallos remotos confirmados.

## G. Comparación con herramientas similares

Comparación acotada a **dos productos**; suficiente para contrastar entrada de solicitudes y organización del trabajo sin ampliar investigación. Fuentes oficiales consultadas el 18/10/2026. No se abrieron cuentas ni se probaron sus apps autenticadas; no se certifican pantallas, rendimiento o planes no accesibles.

### Fuentes

- L1: Less Annoying CRM, [Customizing the Workspace](https://lessannoyingcrm.com/help/edit-your-workspace).
- L2: Less Annoying CRM, [Creating tasks](https://lessannoyingcrm.com/help/how-do-tasks-work).
- J1: Jobber, [Request Basics](https://help.getjobber.com/en/articles/request-basics/).
- J2: Jobber, [Client hub](https://www.getjobber.com/features/client-hub/).

| Patrón y fuente | Problema que resuelve | SolicitudPro actual | Beneficio probable, complejidad y decisión |
|---|---|---|---|
| L1: workspace reúne tareas vencidas, pipeline y actividad; permite filtrar horizontes | Saber qué merece atención hoy | Inicio ya tiene métricas, alertas y siguiente tarea; Seguimientos lista tareas reales | Mejor orden/foco podría reducir clics. Baja/media si reutiliza lecturas. Posponer una nueva bandeja hasta observar insuficiencia; no reconstruir Inicio. |
| L2: tarea con fecha vinculada al registro, visible allí y en el workspace | No perder la acción al cambiar de pantalla | C18D-2 ya crea tarea y la refleja en listado/detalle/contadores | La capacidad esencial ya existe. Validar descubrimiento y claridad en C19, no crear calendario/segundo sistema. |
| J1: formulario de solicitud configurable alimenta una lista e historial | Capturar datos útiles y pasar a revisión | Formularios de seis presets y detalle existen; compartir desde panel real está pendiente | Enlace fiable del negocio es una brecha concreta. Media para activación asistida. Priorizar para B; para A usar ruta preparada y explicada. |
| J2: portal con solicitud, presupuestos, citas y pagos | Autoservicio durante el trabajo completo | Solo captación real y acceso cliente visual no integrado | Complejidad alta y cambio de alcance. Posponer portal; descartar pagos/presupuestos/calendario como requisitos de esta demo. |

Conclusión inferida de fuentes y código: el mayor valor inmediato está en conectar con claridad la captación y la revisión y hacer visibles las tareas existentes. La comparación no justifica añadir CRM, más notas, otra automatización o envío automático del borrador. Notas/comunicaciones y menús no inspeccionados en aplicaciones privadas se consideran NO VERIFICADOS, no carencias del competidor.

## H. Criterios de demo comercial

La demo presentable será **guiada y controlada**, orientada primero a un sector de servicios (Reformas es la propuesta por evidencia previa), con alcance multisector explicado sin prometer personalización autoservicio. Datos ficticios y owner DEV autorizado. Posible presentación por pantalla compartida o portátil; no se exige alojar producción.

### Gates bloqueantes para A

1. C19C+D validada: ninguna acción esencial rota, copia exacta/error honesto, navegación y archivo comprensibles; POST y resultado completos; revisión humana.
2. Formulario → solicitud: ruta y negocio correctos, envío confirmado, registro visible en panel sin duplicados. Una prueba actual controlada, autorizada en otro encargo, usando las herramientas existentes. Identificar previamente sus efectos de correo/enrichment; no enviar silenciosamente.
3. Detalle: contacto/datos, resumen/borrador, adjunto privado y comunicaciones coherentes. Si enrichment/correo no está disponible, mostrar evidencia histórica como tal y no simular estado real.
4. Acciones humanas: demostrar estado/prioridad, nota, tarea pendiente/completada y Activity en fixture controlada, con confirmación real. Archivo/restauración correctamente identificados. Persistencia comprobable con reentrada cuando corresponda.
5. Automáticos: explicar hitos C15 con historial auténtico; no esperar 72 horas ni alterar fechas del negocio para una presentación.
6. UX: recorrido Inicio → Solicitudes → detalle → Seguimientos → Contactos; 1366/1920/390 y comprobación dirigida 768/1536 al 100 %. Sin overflow global, trampas de foco ni controles esenciales inaccesibles. Vacíos y errores entendibles.
7. Seguridad visible: real/local inequívocos, sin secretos ni datos personales reales; borrador no enviado; `sent` no presentado como email leído.
8. Repetibilidad: guion de 10–15 minutos, estado inicial conocido, dos ensayos completos, procedimiento de recuperación y conexión revisados. No crear residuos o envíos acumulados por ensayar sin control.

Si falta el gate de backend actual, se puede ofrecer antes una **presentación exploratoria del concepto con datos locales**, etiquetada como tal; no acredita el objetivo A completo de este plan ni una demo integrada validada.

### Opcionales para A

Onboarding autoservicio, CRM de contactos, registrar contacto humano estructurado, bandeja adicional, cambiar política de sesión, pagos, presupuestos, calendario externo, marca por negocio, editar/aprobar/enviar borradores y nuevas automatizaciones. No condicionan la demo guiada salvo requisito concreto del negocio destinatario.

## I. Roadmap futuro propuesto

Nombres funcionales provisionales; ninguno inicia C20 ni implica aprobación. Las fases D1–D4 constituyen la ruta crítica a A. Las siguientes requieren una decisión posterior.

| Fase | Objetivo / alcance mínimo y problema | Reutilización y dependencia | Riesgo, prueba futura y validación humana | Terminado / destino / complejidad |
|---|---|---|---|---|
| D1 — Cerrar C19 existente | Resolver F1–F5, copy/error y coherencia; recorrido responsive; documentación/POST | Código C19 y tests C18/C19. Precondición: checkpoint preservado | Riesgo de regresión visual; tests de causa, navegación y controles más revisión cinco viewports. Usuario aprueba visualmente | Gates C19 satisfechos, sin backend nuevo. Necesaria A. Media. |
| D2 — Preparar recorrido y material de demo | Fijar sector, dos pestañas si hace falta, datos autorizados y guion; documentar sesión y límites de acceso | Formulario DEV existente, panel real y resultados C17/C18. Tras D1 estable | Riesgo de promesa ambigua o fixture con emails reales. Ensayo seco y revisión humana del recorrido/datos | Guion reproducible, enlaces correctos, ninguna capacidad pendiente presentada como terminada. Necesaria A. Baja. |
| D3 — Comprobar recorrido integrado actual | Comprobar servicios autorizados y una captación controlada con persistencia/adjunto/resultado; disponer fallback honesto | Herramienta E2E y procedimientos C12/C17/C18; tras D2 y permiso explícito para efectos DEV | Red/plan/créditos/correo; no reauditar todo. Verificar frontend/backend y efectos previstos; cleanup coordinado cuando corresponda | Evidencia reciente de recorrido, efectos controlados, límites registrados. Necesaria A. Media con incertidumbre remota. |
| D4 — Ensayo comercial y congelación | Dos recorridos, revisión de comprensión y errores, selección exacta de versión candidata | D1–D3; tests afectados ya presentes | Cambio de última hora; ensayo dueño + observador si disponible, regresión proporcional | Usuario puede presentar sin explicar errores técnicos; publicación solo con permiso. Necesaria A. Baja/media. |
| P1 — Activación asistida y formulario compartible | Un negocio autorizado, acceso y enlace correcto, sector/formulario configurados; no wizard genérico | businesses/memberships/form_configs y endpoint; tras A y aprobación de piloto | Permisos, URLs/hosting y recuperación Auth. Pruebas tenant/enlace/sesión y onboarding con propietario | Negocio piloto entra y recibe solicitudes por su enlace con límites claros. Necesaria B. Media. |
| P2 — Preparación operativa del piloto | Entorno adecuado para datos reales, accesos, planes/créditos, remitentes, alertas, privacidad, backup/recuperación y responsabilidad | RLS, workers, Error Handler y exports. Antes de datos reales; puede avanzar junto a P1 tras decisiones | Cambios de proveedor/seguridad requieren revisión propia. Verificar restauración y operaciones permitidas, revisión responsable | Lista de condiciones de piloto aceptada y probada, sin depender del trial sin plan. Necesaria B. Alta/variable. |
| P3 — Piloto acotado y evaluación | Un negocio, periodo y soporte definidos; medir utilidad y registrar incidencias | P1/P2; ningún CRM nuevo | Uso real distinto de fixtures; escenarios del negocio, feedback y aceptación de límites | Evidencia de uso/recuperación, incidencias prioritarias resueltas. Necesaria B. Media; tiempo calendario adicional. |
| O1 — Contacto humano explícito | Registrar que hubo contacto cuando notas/tareas no basten; revisar semántica C15 antes | `last_contacted_at` y Activities, sin duplicar nota. Requiere validar contrato/permisos y necesidad | Podría afectar recomendaciones; tests de tenant/actividad/C15 y validación del significado con usuario | Evento inequívoco sin alterar automatización silenciosamente. Opcional B, no A. Media. |
| O2 — Foco diario mejorado | Mejorar selección/orden de tareas actuales si Inicio no basta | Métricas, alertas y Seguimientos ya existentes; datos de uso tras A | Duplicación visual; tests del dataset, fecha/negocio y evaluación de menos clics | Beneficio observado, sin segunda lista de verdad. Opcional B, no A. Baja/media. |
| S1 — Despliegue y configuración de servicio | Entornos, configuración portable, dominio/HTTPS, versionado y rollback | Baseline/exports y experiencia piloto | Permisos y dependencias externas; smoke de despliegue y rollback autorizado | Servicio separado DEV/prod y recuperable. Necesaria C. Alta. |
| S2 — Seguridad/privacidad de operación | Revisar accesos, ciclo de usuarios, permisos, abuso público, datos/retención y obligaciones aplicables | Auth/RLS/guards existentes; no asumir ausencia ni volver a diseñarlos | Revisión especializada y decisiones externas; tests adversariales dirigidos y revisión humana competente | Riesgos priorizados resueltos/aceptados con responsabilidad. Necesaria C. Alta/variable. |
| S3 — Continuidad, observabilidad y soporte | Restauración integral, alertas verificadas, costes/límites, incidencias y soporte | Error Handler, mantenimiento, exports y baseline | Proveedor caído o restore incompleto; simulación controlada, runbook y ensayo humano | Recuperación demostrada y responsable operativo. Necesaria C. Alta. |
| S4 — Preparación comercial/servicio | Alcance contratado, soporte, alta repetible, documentación cliente y criterio de aceptación | Piloto y P1; evitar construir billing si venta asistida basta | Expectativas/disponibilidad/coste; validación con primer cliente | Oferta comprensible y sostenible, sin prometer capacidades inexistentes. Necesaria C en alcance acordado. Media/alta. |

Tres prioridades posteriores recomendadas tras A: **(1) activación asistida + enlace fiable**, **(2) evaluar registro explícito de contacto humano**, **(3) evaluar foco diario reutilizando Inicio**. La primera tiene una brecha confirmada; las otras son candidatas y se posponen si notas/tareas/Inicio ya resuelven el problema. P2 es condición operacional del piloto, no una feature comercial opcional.

## J. Estimaciones

Horas de trabajo humano asistido por Codex, incluyendo inspección necesaria, pruebas, correcciones normales y revisión. No se infieren de fechas de commits. Optimista: reutilización directa y sin interrupciones; probable: una iteración de corrección; conservador: varias iteraciones acotadas. No incluyen esperas de terceros ni disponibilidad del usuario.

| Fase | Optimista | Probable | Conservadora |
|---|---:|---:|---:|
| D1 — cierre C19 | 5 h | 8 h | 13 h |
| D2 — recorrido/material | 2 h | 4 h | 6 h |
| D3 — validación integrada actual | 2 h | 4 h | 7 h |
| D4 — ensayos/congelación | 1 h | 2 h | 3 h |
| **Subtotal A** | **10 h** | **18 h** | **29 h** |
| Reserva única de imprevistos (~20 %, redondeada) | 2 h | 4 h | 6 h |
| **Total A** | **12 h** | **22 h** | **35 h** |
| P1 — activación asistida | 6 h | 12 h | 24 h |
| P2 — condiciones operativas piloto | 12 h | 24 h | 45 h |
| P3 — ejecutar/evaluar piloto | 5 h | 10 h | 18 h |
| **Subtotal adicional B después de A** | **23 h** | **46 h** | **87 h** |
| Reserva única adicional B | 5 h | 9 h | 17 h |
| **Total adicional B** | **28 h** | **55 h** | **104 h** |
| O1 — contacto humano, si aprobado | 4 h | 8 h | 16 h |
| O2 — foco diario, si aprobado | 3 h | 6 h | 10 h |
| S1 — despliegue/configuración | 8 h | 18 h | 36 h |
| S2 — seguridad/privacidad operativa | 16 h | 32 h | 64 h |
| S3 — continuidad/soporte técnico | 16 h | 30 h | 60 h |
| S4 — preparación comercial | 12 h | 24 h | 48 h |
| **Subtotal adicional C después de B** | **52 h** | **104 h** | **208 h** |
| Reserva única adicional C | 10 h | 21 h | 42 h |
| **Total adicional C** | **62 h** | **125 h** | **250 h** |

O1/O2 quedan fuera de los totales. No sumar de nuevo porcentajes a totales con reserva. P1/P2 se ejecutan una vez; S1–S4 estiman únicamente maduración incremental, no repetir el piloto. Para B/C son bandas de orden de magnitud con baja confianza, no compromiso de entrega; definir datos, alojamiento, disponibilidad, soporte y exigencias del primer negocio reduce la incertidumbre. El periodo de observación del piloto podría añadir 1–2 semanas de calendario sin trabajo continuo.

Hipótesis decisiva de A: DEV y los servicios históricos están utilizables. Si n8n/Gateway/proveedor requieren restauración, el rango de A deja de ser suficiente: la portabilidad existe pero puede añadir aproximadamente **6–16 horas** y espera externa, pendiente de diagnóstico autorizado. Este trabajo extraordinario no se esconde en la reserva ni se ejecuta aquí. También cambia el plan si se exige demo autónoma alojada en lugar de presentación guiada.

## K. Calendario de octubre

### Capacidad disponible bajo hipótesis

Del lunes 19 al sábado 31 hay 13 días naturales: **10 lunes–viernes** y **3 días opcionales de fin de semana** (24, 25 y 31). No se conocen festivos personales, horario de clase ni disponibilidad real; se calculan días semanales, no jornadas confirmadas.

| Escenario | Capacidad base en 10 días | Fin de semana opcional, misma dedicación diaria | Qué cabe y viabilidad |
|---|---|---|---|
| Reducida: 30–45 min/día | 5–7,5 h | +1,5–2,25 h | Parte o cierre favorable de C19. Ni siquiera el total optimista A de 12 h cabe. Cumplir A antes de noviembre es poco viable. |
| Habitual: 1–1,5 h/día | 10–15 h | +3–4,5 h | C19 y preparación; A solo si se aproxima al optimista, sin fallos/remoto pendiente. Las 22 h probables no caben ni con todos esos fines de semana. Cumplimiento frágil. |
| Intensiva: 2–3 h/día | 20–30 h | +6–9 h | A probable cabe si media efectiva ≥2,2 h/día o se aporta reserva opcional. 35 h conservadoras no caben sin extra. Cumplimiento razonable, condicionado. |

### Plan por fechas para la ruta probable de 22 horas

Distribución de 18 h de trabajo previsto y 4 h de reserva. La reserva no es funcionalidad adicional: solo se consume ante incidencias. Casa se recomienda para edición/validación por contexto y sesión; clase puede usarse con checkout aislado autorizado. No son capacidades presupuestas.

| Fecha | Trabajo y objetivo observable | Dependencia | Horas | Equipo / personas | Continuar o detener |
|---|---|---|---:|---|---|
| Lun 19 | Revisar informe, fijar demo guiada/sector y abrir checklist C19; reproducir fallos acotados | Checkpoint | 1,5 | Clase lectura; casa validación. Ambos | Si rama/diff inesperado, preservar y aclarar antes de editar. |
| Mar 20 | Corregir copia/fallback y textos de prioridad/archivo dentro de alcance aprobado | Evidencia lunes | 2 | Casa, Codex + revisión | Si requiere contrato backend, separar y pedir decisión. |
| Mié 21 | Recorrido global 1366/1920, vacío/error y navegación; primer salto de pasos | Cambios dirigidos verdes | 2 | Casa, ambos | Regresión funcional impide avanzar a cierre. |
| Jue 22 | 390/768/1536, modo real disponible, completar regresiones y POST/resultado | Recorrido desktop | 2,5 | Casa, ambos | C19 solo cierra con evidencia y aprobación visual. |
| Vie 23 | Guion, sector, enlaces explícitos, datos/efectos controlados y estado inicial | D1 aceptada | 2 | Clase puede preparar; casa ensayar. Ambos | No provocar envíos sin autorización de destinatarios/efectos. |
| Sáb 24 | Descanso; opcional recuperar una validación fallida | Voluntario | 0 base | Casa | No asumir horas extra. |
| Dom 25 | Descanso; opcional revisión de comprensión del guion | Voluntario | 0 base | Cualquier equipo | No sustituir validación técnica por impresión visual. |
| Lun 26 | Completar guion y confirmar disponibilidad autorizada de servicios | D2 y acceso seguro | 2 | Casa, ambos | Si trial/credenciales/Gateway no disponibles, reestimar antes del E2E. |
| Mar 27 | Un recorrido integrado controlado y persistencia; registro de efectos | Gate operativo | 2 | Casa, ambos | Fallo real detiene cierre; no disparar reintentos indiscriminados. |
| Mié 28 | Completar D3, limpieza/estado final y margen de corrección | Resultado martes | 2 + 0,5 reserva | Casa, ambos | No declarar limpio sin evidencia; no borrar históricos. |
| Jue 29 | Ensayo completo, revisión humana y evidencia de entendimiento | D1–D3 | 1 + 1 reserva | Casa o sitio presentación, ambos | Si falta gate, usar reserva y mover la fecha. |
| Vie 30 | Segundo ensayo y decisión go/no-go sobre versión exacta | Primer ensayo aceptable | 1 + 2,5 reserva | Equipo de presentación, ambos | Candidato presentable solo si pasa gates; publicación separada autorizada. |
| Sáb 31 | Fecha objetivo límite; presentación solo si ya está validada | Go viernes | 0 base | Humano | No usar fecha como razón para cerrar trabajo pendiente. |

Los bloques de edición solo se ejecutarían con el siguiente encargo autorizado; el presente informe no los ejecuta. La sesión de clase puede adelantar guion/criterios sin repetir esta investigación. Cualquier fallo desplaza el resto del calendario.

## L. Viabilidad del objetivo

**Fecha objetivo:** antes del 01/11, idealmente candidato validado el viernes 30/10. **Fecha confirmada:** ninguna.

Ventanas calculadas para unas 22 h efectivas, trabajando solo lunes–viernes desde 19/10 y sin festivos/interrupciones:

- Reducida: 30–44 jornadas → aproximadamente **27/11–17/12**. Antes de noviembre no es viable con ese esfuerzo probable. Una revisión conceptual anticipada puede servir para recoger interés, pero no acredita A.
- Habitual: 15–22 jornadas → aproximadamente **06/11–17/11**. Llegar al 30/10 requeriría que todo se acerque a 12 h, disponibilidad en el extremo alto y casi ninguna incidencia. No es la previsión central.
- Intensiva: 8–11 jornadas → aproximadamente **28/10–02/11**. El plan de 22 h hasta el 30/10 exige una media de 2,2 h. Es razonable reservar presentación para 30–31/10, con posibilidad de moverla a **02–06/11** si consume margen o alguna sesión falla.

Para el conservador de 35 h, con 2–3 h/día se necesitan unas 12–18 jornadas; no debe comprometerse octubre sin extra. Una indisponibilidad externa puede romper todas estas ventanas.

Posponer para proteger la fecha: onboarding autoservicio, O1/O2 salvo necesidad demostrada, portal cliente, persistencia Auth nueva, envío/edición de borradores, CRM, cambios de automatización y branding avanzado. Conservar antes de presentar: seguridad, feedback honesto, persistencia y coherencia del recorrido. No sacrificar esos gates.

## M. Continuidad entre equipos

Casa: `D:\demo Solicitudpro\solicitudpro`, rama `c19ab-detail-responsive`, HEAD `ba488ee`.
Clase: `C:\Users\ciclo1\Downloads\demo solicitudpro\solicitudpro`; según contexto usa `main` y tiene cambios documentales locales que deben preservarse. **Estado de ese PC NO VERIFICADO.**

- El código de C19 actual ya está en GitHub; no hace falta reconstruir trabajo local perdido.
- Este informe nuevo solo estará en casa hasta que se autorice trasladarlo/publicarlo. Puede copiarse su contenido como contexto de chat sin sincronizar repositorios.
- Desde clase se puede revisar GitHub, preparar guion/criterios, cotejar capacidades con necesidades de una empresa y registrar decisiones conceptuales. No repetir la comparación externa ya realizada ni iniciar funciones candidatas.
- Para trabajar sobre C19 en clase, inspeccionar primero estado y luego, con autorización, usar una copia o worktree aislado de la rama publicada; no cambiar a ciegas el `main` con documentos locales ni hacer merge automático.
- Reservar inicialmente la validación autenticada y los cambios C19 para casa por sesión/contexto conocidos. No es una prohibición permanente de desarrollar en clase: con entorno aislado y acceso autorizado puede trasladarse.
- Integración a main y publicación serán decisiones explícitas, posteriores a revisión. La rama publicada no debe confundirse con main desplegada ni con producción.

## N. Decisiones humanas necesarias

1. Confirmar disponibilidad real y formato A: presentación guiada en portátil/pantalla compartida o demo autónoma alojada. Las estimaciones asumen guiada.
2. Elegir sector/empresa objetivo y tres problemas que deberá resolver; Reformas es propuesta por evidencia, no decisión tomada.
3. Aprobar continuación C19 acotada, incluida corrección de los defectos identificados, sin funciones de negocio nuevas.
4. Para D3, autorizar el recorrido DEV y sus efectos de email/enrichment, destinatarios controlados, fixture y estado final. No buscar contraseñas ni ampliar privilegios.
5. Decidir financiación/continuidad de n8n/Gateway/proveedor solo si la disponibilidad lo exige; actualmente no inspeccionada.
6. Aceptar visualmente el candidato y después decidir integración/publicación; ninguna de ambas está autorizada por esta auditoría.
7. Tras la demo, decidir piloto, uso de datos reales y necesidades O1/O2 a partir de feedback. No asumir su aprobación previa.

## O. Limitaciones y metodología

### Etiquetas de evidencia

- **VERIFICADO LOCAL:** observado hoy en Git/código/tests o comprobación aislada reproducible.
- **PUBLICADO:** objeto/HEAD contrastado con la rama remota; no implica ejecución correcta.
- **DOCUMENTADO:** resultado escrito en archivos de fase, con pruebas conocidas pero no repetidas hoy.
- **HISTÓRICO:** pertenece a un corte anterior; puede haber sido superado.
- **HIPÓTESIS:** inferencia o supuesto explícito de planificación, no validación.
- **NO VERIFICADO:** falta evidencia actual suficiente.

### Herramientas y alcance real

Disponibles y utilizadas: PowerShell, Git, `rg`, lectura de archivos, Node.js y `node:test`, consulta GitHub mediante `git ls-remote`, búsqueda/apertura web de páginas oficiales, `apply_patch` exclusivamente para este documento. Skill reutilizada: `verification-before-completion`, para distinguir evidencia fresca de cierres documentados. README, CRITERIOS y PLANTILLA_EVALUACION del evaluador se leyeron.

GitHub connector, navegador gráfico y skills de diseño/planificación estaban disponibles en el catálogo, pero no fueron necesarios para esta investigación documental. No se utilizó auditoría visual como si se hubiera realizado: esa validación queda para C19. No se instaló ninguna herramienta. Supabase remoto, n8n, proveedores y producción no se consultaron ni modificaron. No hubo subagentes ni cambio de modelo. No faltó una herramienta imprescindible para producir este informe; sí falta autorización/evidencia de estado remoto actual y disponibilidad humana para confirmar una fecha.

### Comprobaciones realizadas el 18/10

- Checkpoint solicitado completo y comparación remota C19/main, sin fetch ni operaciones Git mutantes.
- Historial `--all`, por documentación/JS/tests y diffs selectivos. Snapshot inicial identificado; no se inspeccionaron todos los diffs.
- `node --test tests/c19ab-detail-responsive.test.js tests/c19cd-ux-polish.test.js`: **6/6, 0 fallos**. Se repitió para contrastar el estado de pruebas de C19 con sus huecos actuales; no suite global.
- `node --check` en `js/real-product.js`, `js/request-detail.js`, `js/script.js`: **correctos**.
- `node evals/codex-prompts/validar.mjs`: **fallido, 2 errores**: enlace al resultado CD inexistente y POST sin diez criterios. Se leyó antes el validador: no escribe archivos. No se arregló porque solo se autoriza este informe.
- Prueba Node aislada, sin archivos ni servicios: el render de una request sintética archivada mostró prioridad numérica y ninguna etiqueta de archivo. Otra prueba extrajo el helper de copia en memoria y simuló `execCommand` devolviendo false: la promesa resolvió sin error. Confirma la rama defectuosa, no un fallo observado en un navegador real.
- Revisión final: las secciones A–P están presentes, los 29 enlaces locales resuelven, no hay espacios al final de línea y `git diff --check` termina correctamente. El único cambio es este documento nuevo, sin seguimiento; no hay diferencias en archivos versionados ni en staging. Ninguna puntuación de prueba previa se presenta como ejecutada hoy.

No se ejecutó servidor, login, llamada de producto, envío, migración, fixture remoto, prueba de carga, auditoría legal ni reconstrucción completa. Los tests unitarios no sustituyen E2E, entregabilidad de correo, permisos reales ni validación visual.

### Diez criterios del sistema de evaluación

Registro de esta investigación: `AUDITORIA-GLOBAL-DEMO-2026-10-18-v1`; prompt de esta sesión, sin duplicarlo ni crear otros archivos. PRE y POST se distinguen en la tabla. No se impone nota máxima ni se puntúa runtime desconocido. Evaluación cualitativa, sin suma artificial; no sustituye ni modifica las evaluaciones C19 existentes.

| Criterio | PRE del encargo | POST de esta auditoría / límite |
|---|---|---|
| 1. Alcance | Define auditoría y una escritura | Informe único; implementación no iniciada. |
| 2. Arquitectura | Exige reutilizar y separar A/B/C | Contratos preservados y brechas delimitadas; no diseño backend nuevo. |
| 3. Seguridad | Prohíbe servicios/credenciales/mutaciones | Sin acceso remoto de producto ni secretos en informe; seguridad global actual NO VERIFICADA. |
| 4. Estado | Ordena checkpoint fresco | HEAD limpio y remoto contrastados; main rezagada y clase no inspeccionada. |
| 5. Entregables | Exige inventario, fases y calendario | Secciones A–P, criterios, horas y escenarios; validación comercial real pendiente. |
| 6. Tests | Condicionales y proporcionales | Seis tests, sintaxis, validador con fallos y pruebas aisladas; no se extrapola a suite global. |
| 7. Bloqueos | Exige nombrar incertidumbre | Dependencias operativas y límites de tiempo/entornos declarados; no se eluden credenciales. |
| 8. Eficiencia | Reutilizar historia | Selección de hitos y dos comparables; algunos outputs extensos exigieron lecturas focalizadas adicionales. No auditoría remota duplicada. |
| 9. Modelo/razonamiento | Astra/High o alternativas | Modelo de runtime y esfuerzo exactos NO VERIFICADOS. Sin cambio de configuración ni sustitución confirmada. |
| 10. Cierre | Documento y solo un cambio local | Auditoría entregable verificable; C19 y readiness de clientes no se declaran cerrados. |

Mejora mínima propuesta para futuros encargos: adjuntar disponibilidad semanal real, formato de presentación y confirmación autorizada del estado de servicios; reduciría la incertidumbre del calendario. **PROPUESTA**, no comparación demostrada entre prompts. La comprobación útil demostrada aquí es distinguir cierre documental de fase, código publicado y funcionamiento remoto actual.

## P. Siguiente acción exacta

**Continuar y cerrar C19C+D desde `ba488ee` en `c19ab-detail-responsive`: reproducir y corregir únicamente los problemas de copia/feedback y comprensión del listado identificados, completar el recorrido visual global real/local en los cinco viewports, ejecutar regresiones dirigidas, completar resultado y POST, y obtener la revisión visual del usuario.**

Preservar C19A+B y C18; no backend nuevo, C20, onboarding, n8n ni publicación dentro de ese paso salvo autorización adicional explícita. Si no hay sesión real, pedir login manual sin credenciales en chat y mantener la validación autenticada pendiente. No sustituir ese gate por otra auditoría.

El siguiente encargo todavía no se ha ejecutado. Este informe queda como nuevo archivo local pendiente de revisión, sin `git add`, commit ni push.
