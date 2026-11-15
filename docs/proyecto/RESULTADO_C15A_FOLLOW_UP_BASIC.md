# Resultado C15A — Follow-up Basic

Fecha: 2026-09-29. Entorno: Supabase/n8n DEV.

## Estado

**C15A cerrada en DEV.**

- Workflow independiente activo: \`SolicitudPro DEV - Follow-up Basic C15A\`
  (\`PUBLIC_SOLICITUDPRO_DEV_FOLLOW_UP_BASIC_C15A_WORKFLOW_ID\`), 2 nodos, horario cada hora en el minuto 37 y zona
  \`Europe/Madrid\`.
- Export sanitizado y portable en
  \`n8n/prepared/SolicitudPro_DEV_Follow-up_Basic_C15A.json\`; requiere asignar
  la credencial dedicada al importar y no contiene valores secretos.
- Flujo: Schedule Trigger → Edge Function dedicada → RPC transaccional
  \`process_basic_follow_up_milestones\`.
- Estado monotónico por request: \`0 → 24 → 48 → 72\`.
- El RPC selecciona el hito vencido más alto, bloquea con
  \`FOR UPDATE SKIP LOCKED\`, actualiza la request y crea la activity en la
  misma transacción.
- Índice único parcial por \`request_id + type\` evita duplicados en
  \`request_follow_up_24h\`, \`request_follow_up_48h\` y
  \`request_follow_up_72h\`.
- Estados activos reales: \`Nuevo\`, \`En preparación\`, \`Enviado\` y
  \`Seguimiento pendiente\`. Se excluyen archivadas y terminales.
- Backend-only: ejecución RPC solo para \`service_role\`; anon/authenticated
  revocados. El worker y n8n usan credenciales dedicadas almacenadas en sus
  gestores seguros.
- Sin emails, IA, Gateway ni envío de \`suggested_reply\`. No se modifican
  \`follow_ups\` ni \`next_follow_up_at\`.

## Validación

- Fixtures DEV ficticias: 25 h → 24; 49 h → 48; 75/76 h desde 0 → solo 72;
  terminal \`Ganado\` → sin seguimiento.
- Dos tenants procesados en la tanda dirigida; \`business_id\` coincidió en
  todas las activities.
- Carrera concurrente sobre la misma request: resultados 1 y 0; quedó una
  sola activity.
- Replay dirigido: 0 procesadas.
- E2E n8n → Edge Function → RPC: ejecución \`208\` \`success\`, 33 requests
  DEV vencidas avanzaron directamente a 72; ejecución \`209\` inmediata:
  0 procesadas.
- El Schedule real disparó automáticamente la ejecución \`210\` en modo
  \`trigger\` a las \`:37\`; terminó \`success\` con 0 pendientes.
- Evidencia de catch-up: \`ACA-DEV-001\` quedó en 72 con una sola activity
  \`request_follow_up_72h\` y texto correcto.
- Comprobación final: 0 duplicados, 0 terminales procesadas, 0 vencidas
  pendientes, 0 fixtures restantes y 6 negocios alcanzados en la ejecución
  DEV.
- Tests locales C15A: 7/7 correctos.

## Nota de implementación

DEV reveló mojibake en dos literales acentuados durante el transporte de la
migración. La migración correctiva usa escapes Unicode ASCII-estables y dejó
índice, filtro de estado y texto visible correctos.

No se realizaron cambios en C13B, C14A, producción ni landing.
