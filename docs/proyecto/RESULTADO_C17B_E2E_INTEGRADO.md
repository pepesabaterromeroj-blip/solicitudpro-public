# Resultado C17B — E2E integrado C13→C16

Fecha: 2026-09-29. Entorno: `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). Inicio de la ventana de evidencia:
`2026-09-29T11:08:36Z`.

## Resultado

**C17B cerrada en DEV.** El formulario público, C13B/C16, C14A y C15B
funcionaron conjuntamente sin duplicar efectos ni cruzar tenants. No se creó
ningún workflow, secreto, proveedor o integración, y el freeze de C17A se
mantiene.

## Fixture y flujo observado

- Fixture final: `SP-E2E-20260929-111325-B188`, referencia pública `REF-011`,
  request `df350fbe-02ca-4073-9369-49ab265dd4ab` y business
  `4d6aeb60-4a7f-40a9-996c-ffec2edc9104`.
- El endpoint público DEV respondió HTTP `201` y creó una request con dos jobs:
  `customer_confirmation` y `business_notification`.
- C13B ejecución `226`, modo `webhook`, `success`, de `11:13:27.273Z` a
  `11:13:31.149Z`. Ambos jobs terminaron `sent`, cada uno con
  `attempt_count = 1`.
- C14A ejecución `227`, modo `webhook`, `success`, de `11:13:27.309Z` a
  `11:13:34.594Z`. Hubo un claim, una inferencia y un complete; quedaron
  `internal_summary`, `suggested_reply`, `enriched_at` y una única activity
  `request_enrichment_generated`.

## C13B/C16 e independencia respecto de C14A

Los subjects finales fueron `Solicitud recibida · REF-011` y
`Nueva solicitud · REF-011`. Ambos envíos incluyeron texto y HTML válidos.
La confirmación cliente no incluyó UUIDs, resumen/prioridad interna ni
promesas. El aviso al negocio incluyó referencia, servicio, datos operativos,
zona, descripción y llamada a revisar la solicitud.

C13B reclamó ambos jobs cuando C14A seguía `pending` y `internal_summary` era
`null`; utilizó el fallback determinista basado en la descripción. C13B
terminó 3,4 segundos antes que C14A. El `suggested_reply` no formó parte del
contexto ni fue enviado.

## C15 y replay integrado

Sobre la misma request se registraron primero los valores originales:
`created_at = 2026-09-29T11:13:26.975864Z`, `next_follow_up_at` y el follow-up
pendiente `due_at = 2026-09-30T11:13:26.975864Z`. Solo en la fixture DEV se
retrocedió `created_at` 25 horas y se vencieron `next_follow_up_at`/`due_at`
una hora. La RPC existente y acotada al request devolvió:

- primera ejecución: `processed_count = 1`, milestone `24h = 1`;
- activity única: `request_follow_up_24h` con
  `reason_code = manual_follow_up_overdue`;
- replay: `processed_count = 0`, todos los contadores de milestones a cero.

Tras C15 y el replay permanecieron exactamente dos email jobs, una activity
de enrichment y una activity de follow-up. El enrichment no cambió y C15 no
generó emails.

## Aislamiento, errores y limpieza

- Los 2 jobs y las 3 activities totales de la request compartieron su mismo
  `business_id`; cruces con otro tenant: `0`.
- Jobs de tipos inesperados: `0`. Ejecuciones `error`/`crashed` desde el inicio
  en C13B, C14A, C15 y Error Handler: `0`.
- Error Handler permaneció activo/configurado; no se provocaron errores. Ops
  Maintenance no se ejecutó.
- Después de documentar la evidencia se eliminaron ambas fixtures C17B y sus
  relaciones. Resultado final: `0` requests, jobs, activities, follow-ups,
  idempotency keys y marcadores C17B residuales; jobs y activities huérfanos
  globales: `0`.

## Regresión encontrada y corrección mínima

La primera ejecución (`224`, fixture `SP-E2E-20260929-110908-5682`) reveló
mojibake en los textos enviados (`Â·`, `Ã`). El source local contenía UTF-8
correcto; la causa fue el transporte con codificación implícita de Windows en
el despliegue anterior. Se redesplegaron sin cambios funcionales los bytes
UTF-8 exactos de `email-job-worker` (versión DEV `12`) y se repitió una sola
vez el E2E. Las ejecuciones `226`/`227` demostraron subjects, tildes y cuerpos
correctos. La primera fixture y la final fueron eliminadas.

En total se realizaron cuatro envíos reales DEV: dos en la detección de la
regresión y dos en la única repetición autorizada tras corregirla. No hubo
retries del proveedor ni nuevos costes, secretos o cambios de arquitectura.

## Estado para la siguiente fase

No quedan BLOCKERS ni regresiones abiertas para C17C. La arquitectura sigue
congelada; C17C no se inicia en este cierre.
