# C18C-2 — Detalle real completo y relaciones

Fecha: 5 de octubre de 2026. Alcance: lectura real del detalle de una solicitud en la demo objetivo. Sin cambios en Supabase, RLS, n8n, migraciones ni `dev/panel-product-readonly.*`.

## Arquitectura e integración

La ruta real mantiene la separación `UI → js/real-product.js → js/data/product-data.js → Supabase DEV`. La capa de datos incorpora una única operación, `getRequestDetail(businessId, requestId)`, y no se han añadido consultas Supabase dispersas en `js/script.js`.

La lectura exige sesión en memoria, negocio seleccionado previamente desde una membresía activa y UUID válido. La consulta principal filtra simultáneamente por `business_id` e `id`; una solicitud ausente o no autorizada produce el mismo estado «Solicitud no disponible» sin consultar relaciones. Todas las relaciones se vuelven a comprobar contra negocio, solicitud y formulario antes de proyectarlas a la UI.

El detalle muestra exclusivamente datos reales:

- solicitud: referencia, servicio, zona solo cuando existe en la respuesta `zona`, estado, prioridad, urgencia, fecha y necesidad;
- contacto: nombre, email y teléfono;
- formulario: nombre y respuestas ordenadas como etiqueta humana → valor, sin IDs ni claves técnicas;
- C14: estado humano, fecha, resumen interno y respuesta sugerida marcada expresamente como borrador no enviado, no aprobado y de solo lectura;
- actividad: fecha, tipo traducido y origen humano/automatización/sistema; los tipos desconocidos usan un fallback seguro y no revelan el payload original;
- notas internas: derivadas de `activities.type = internal_note`, en modo de solo lectura;
- adjuntos: nombre, tipo, tamaño, fecha y acceso temporal privado cuando la firma puede generarse.

No se consultan ni muestran claims, leases, intentos, reintentos o errores técnicos de enrichment. Tampoco se incorporan acciones de edición, aprobación, envío, notas, seguimiento o adjuntos.

## Adjuntos privados

Se reutiliza el contrato C12: bucket privado y URL firmada con la sesión autenticada. El frontend solo intenta firmar paths canónicos `{business_id}/{request_id}/{uuid}.{ext}`, con los formatos ya autorizados, y valida origen, ruta y token de la respuesta. La URL dura 120 segundos, permanece en memoria y no se persiste. Un path fuera del namespace autorizado invalida la lectura; un fallo aislado al firmar conserva la metadata segura y muestra que el acceso temporal no está disponible.

## Compatibilidad y seguridad

- `?mode=local` conserva la demo ficticia anterior; la ruta real no incorpora respuestas, resumen, actividad, notas o adjuntos mock.
- Auth, membresías, `activeBusiness` y RLS siguen siendo la autorización efectiva; la comprobación cliente es una defensa adicional, no un sustituto.
- No existe `service_role`, secreto nuevo, policy `anon`, migración ni cambio backend.
- La navegación Solicitudes → detalle → volver conserva sesión, negocio y filtros del listado.
- Los estados de carga, no disponible, error seguro y secciones vacías están implementados sin mensajes SQL ni datos internos.

## Evidencia DEV

La inspección de contratos y datos autorizados en `solicitudpro-app-dev` confirmó RLS activa para `requests`, `contacts`, `form_configs`, `form_fields`, `request_custom_answers`, `activities` y `attachments`. `REF-010` aporta enrichment C14 completado, cuatro respuestas y actividad; `REF-DEV-001` aporta enrichment legacy, dos respuestas, actividad y un adjunto privado.

## Smoke real de un adjunto

Se creó una única solicitud técnica ficticia en **Reformas Demo Dev**, `REF-011`, mediante el flujo existente C12B1/B2. Se subió exactamente un archivo generado en memoria, sin datos personales:

- nombre: `c18c2-attachment-smoke.jpg`;
- tipo: `image/jpeg`;
- tamaño: 518 bytes;
- respuesta de creación y upload: HTTP `201` en ambos pasos;
- bucket: `request-attachments`, que permaneció privado.

Tras actualizar la demo real autenticada, `REF-011` apareció en el listado. Su detalle mostró en **Adjuntos** únicamente el nombre, tipo, tamaño y fecha seguros, sin IDs ni `storage_path` en el contenido visible. «Abrir archivo» cargó el JPEG real de 1 × 1 desde una ruta `/storage/v1/object/sign/request-attachments/...` con token temporal. El JWT de firma tenía `exp - iat = 120` segundos, de acuerdo con el contrato; no se generó ni expuso una URL pública permanente.

El aislamiento no se reauditó manualmente. Los tests existentes siguieron confirmando que el tenant autorizado puede firmar su path canónico y que otro negocio o un path ajeno no puede obtener el detalle ni firmar el objeto.

El cleanup reutilizó la compensación existente de C12B1 para retirar el objeto mediante la API de Storage. Después se eliminaron exclusivamente las filas técnicas de `REF-011`: metadata, solicitud, contacto, clave de idempotencia, jobs, actividad, respuestas y follow-ups. La consulta final devolvió cero para el objeto, todas esas relaciones y la propia request; el listado autenticado volvió de 12 a 11 solicitudes. No se alteraron fixtures históricos, RLS, policies, bucket, migraciones ni backend.

## Tests

- TDD C18C-2: 9 pruebas para detalle autorizado/ajeno, respuestas y vacíos, todos los estados C14, borrador no enviado, actividades conocidas/desconocidas, notas de solo lectura, adjuntos privados, path cross-tenant, aislamiento mock/real y ausencia de credenciales privilegiadas.
- Verificación dirigida de cierre: 6/6 archivos correctos y cero fallos: `c12a-storage-attachments`, `c12b1-attachment-upload`, `c12b2-public-form-attachments`, `c12c-panel-attachments`, `c18c1-real-demo` y `c18c2-real-detail`.
- No se ejecutó la suite completa ni se modificó código funcional.

## Deuda UX para C19

Redistribuir mejor el detalle cuando una columna queda vacía / aprovechar mejor ancho disponible. No se ha implementado en C18C-2 y no se han tocado grid, columnas, responsive ni spacing.

## Estado y continuidad

La implementación, sus contratos y el smoke autenticado de un adjunto real quedan completos, sin gaps de backend o RLS y sin residuos del fixture.

**C18C-2 queda CERRADA.** No existen `PLAN_DIARIO.md` ni `LOG_DIARIO.md` en el repositorio, por lo que no se creó documentación paralela. C18C-3 y C19 no se han iniciado.
