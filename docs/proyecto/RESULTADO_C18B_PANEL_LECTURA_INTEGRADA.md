# C18B — Lectura integrada del panel DEV

Fecha: 30 de septiembre de 2026. Repositorio del PC del colegio, rama `main`, HEAD inicial `c47640b`. Estado inicial limpio. Sin commit ni push.

## Resultado

Se evoluciona exclusivamente `dev/panel-product-readonly.html`, su JS y su CSS. C18B añade lectura, no acciones C18C ni diseño C19. C13–C17, n8n, Gateway, proveedores, producción y landing permanecen intactos.

| Bloque | Resultado |
| --- | --- |
| C14 | Estados traducidos, resumen interno, fecha de generación y respuesta sugerida como borrador no enviado y revisable. |
| C15 | Hito 0/24/48/72, próxima fecha prevista y seguimientos existentes. |
| Actividad | Fecha, tipo legible y origen humano/automático/sistema/formulario. |
| Comunicaciones | Dos tipos y cuatro estados reales, fechas y contrato mínimo autenticado. |
| C10 y adjuntos | 28 pruebas existentes de regresión correctas; operaciones sin reimplementar. |
| DEV | Lectura real autorizada y denegaciones verificadas mediante roles SQL; pruebas revertidas. |

## Lectura del panel

El detalle incorpora `enrichment_status`, `enriched_at`, `internal_summary`, `suggested_reply` y `automatic_follow_up_milestone_hours` en la selección explícita de `requests`. No solicita claims, intentos ni fechas técnicas de reintento. Se conservan Auth en memoria, consultas por solicitud/negocio y RLS existentes.

Estados C14: `pending` → Pendiente; `processing` → Generando; `completed` → Generado; `failed` → No disponible; `legacy` → Solicitud anterior. Estado desconocido: No disponible. Textos escapados, saltos de línea conservados y nombres/textos largos ajustables. El borrador no dispone de botones de edición, aprobación o envío.

Hito C15: 0 → Sin seguimiento automático; 24/48/72 → horas correspondientes. Se evita llamar «manual» a `next_follow_up_at`: la RPC histórica de recepción también lo inicializa automáticamente a 24 horas. La etiqueta correcta es «Próxima fecha prevista»; no se inventa autoría humana.

La consulta de actividad extrae únicamente `reason_code:metadata->>reason_code`, no el objeto `metadata` completo. Los tipos de seguimiento se traducen y los motivos usan una lista explícita:

- `manual_follow_up_overdue`: Existe un seguimiento manual vencido.
- `high_priority_no_recent_activity`: Solicitud prioritaria sin actividad humana reciente.
- `no_recent_activity`: No hay actividad humana reciente.

Motivo desconocido: «Seguimiento recomendado.». No se muestra el código ni el detalle técnico de automatizaciones. Las notas internas mantienen su historial C10 separado. Orígenes derivados de `actor_type`, no inferidos por el título.

## Contrato de comunicaciones

Migration local y aplicada en DEV: `20260930113208_c18b_request_communications.sql`. El timestamp local se alineó con la versión registrada por MCP; no se modificó historia previa.

`POST /rest/v1/rpc/get_request_communications`, con JWT del usuario autenticado y clave pública existente del panel. Cuerpo:

```json
{ "p_request_id": "11111111-1111-4111-8111-111111111111" }
```

Respuesta: lista ordenada por `created_at`, después `email_type`; cada elemento contiene exclusivamente:

```json
{
  "email_type": "customer_confirmation",
  "status": "sent",
  "created_at": "2026-09-30T10:00:00Z",
  "sent_at": "2026-09-30T10:01:00Z"
}
```

`sent_at` puede ser null. No devuelve IDs, negocio, destinatario, cuerpo, HTML, errores, claims, intentos ni credenciales. Los tipos son `customer_confirmation` / `business_notification`; los estados son `pending` / `processing` / `sent` / `failed`. No se añaden enums ni acceso al contenido del email.

Función SQL `STABLE`, de solo lectura, `SECURITY DEFINER`, `search_path = ''` y relaciones cualificadas. La elevación está limitada a esta proyección: `SECURITY INVOKER` no podría leer `email_jobs` sin abrir la tabla. La función comprueba `auth.uid()` no nulo y membresía `business_users.is_active` del negocio de la solicitud, con relación request/business consistente. No confía en un business_id del cliente. Se revoca ejecución a PUBLIC/anon/authenticated y se concede únicamente a authenticated. No cambia RLS ni grants de tablas.

`email_jobs` conserva RLS y ausencia de SELECT directo para authenticated. Solicitud ajena, inexistente o null producen una lista vacía idéntica. Una membresía inactiva tampoco obtiene filas. El panel vuelve a proyectar los cuatro campos y descarta lecturas tardías tras cierre, cambio de detalle o logout.

Estados de comunicaciones: cargando, vacío y error genérico independientes de los adjuntos y del resto del detalle. No se imprimen errores internos ni se persisten respuestas fuera de la memoria de sesión.

## Pruebas y validación real

TDD inicial: seis pruebas C18B ejecutadas antes de implementar, seis fallos por campos/funciones ausentes. Tras implementación se añadió una prueba de integración del detalle completo: siete pruebas nuevas correctas.

```text
node --test tests/c18b-panel-reading.test.js tests/c10a-status-priority.test.js tests/c10b-follow-up-archive.test.js tests/c10c-internal-notes.test.js tests/c12c-panel-attachments.test.js
35 pruebas, 35 correctas, 0 fallos.
node --check dev/panel-product-readonly.js
node --check tests/c18b-panel-reading.test.js
node --check tests/c12c-panel-attachments.test.js
git diff --check
```

El test de versión C12C deja de exigir un nombre histórico fijo y comprueba que JS/CSS mantienen una versión común; ahora ambos usan `c18b` para invalidar caché antigua.

`tests/c18b-request-communications.sql` se ejecutó realmente en `rinrgjancwvcvpzjyqmu`: usuario propietario autenticado obtiene comunicaciones propias y exactamente cuatro columnas; otro tenant, request inexistente/null y membresía inactiva devuelven cero filas. SELECT directo de email_jobs y EXECUTE anon provocan `insufficient_privilege`. No se consultó `auth.users`, no se usaron contraseñas ni JWT reales.

Lectura representativa como propietario ficticio de Reformas: solicitud existente `completed`, resumen y borrador presentes, `enriched_at` informado, hito 24, fecha prevista; actividad de recepción pública, enrichment automático y seguimiento automático con `manual_follow_up_overdue`; dos comunicaciones `sent` con sus fechas. No se creó solicitud ni se envió correo.

La desactivación de membresía usada para probar autorización se hizo dentro de una transacción y se revirtió con ROLLBACK. Confirmación posterior: seis owners activos. Sin fixtures persistentes, solicitudes/jobs nuevos, objetos Storage ni residuos técnicos.

Advisor de seguridad: aviso esperado por RPC SECURITY DEFINER ejecutable por authenticated. Es deliberado, con identidad, membresía activa, proyección cerrada y permisos verificados; no es un grant directo a email_jobs. Referencia: [aviso de funciones privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). No se alteraron avisos históricos fuera del alcance.

## Límites y continuidad

- Validación DEV mediante contratos SQL con rol authenticated; render y peticiones del panel comprobados ejecutando el JS real en VM con fetch simulado. No se realizó auditoría visual en navegador ni se afirma haberla realizado.
- Las selecciones explícitas evitan solicitar campos técnicos; no constituyen permisos por columna. Los grants históricos de `requests` siguen siendo de tabla y RLS aísla por negocio. C18B no introduce ni endurece ese contrato histórico; no debe interpretarse como una denegación global de columnas técnicas mediante la API.
- Se conserva el bloque técnico DEV preexistente y las acciones C10. Las nuevas secciones no muestran claims ni payloads internos.
- Refrescar/reabrir vuelve a leer; no se añade polling ni Realtime.
- C18C queda sin iniciar: nuevas acciones humanas necesitan su propia implementación y contratos. No se implementa envío, aprobación, regeneración ni retry.

**C18B: lectura integrada implementada y validada en DEV dentro de este alcance.**
