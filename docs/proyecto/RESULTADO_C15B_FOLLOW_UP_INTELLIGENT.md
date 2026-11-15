# Resultado C15B — Follow-up Intelligent

Fecha: 2026-09-29. Entorno: Supabase/n8n DEV.

## Estado

**C15B cerrada en DEV.** C15B evoluciona el mismo worker, RPC, secreto y
workflow de C15A; no crea una automatización paralela.

- Workflow reutilizado y publicado: `SolicitudPro DEV - Follow-up Basic C15A`
  (`PUBLIC_SOLICITUDPRO_DEV_FOLLOW_UP_BASIC_C15A_WORKFLOW_ID`). Permanece activo, con dos nodos, Schedule horario en
  el minuto `:37`, zona `Europe/Madrid`, la credencial existente y el Error
  Handler compartido configurado.
- Las migraciones `20260929093210_c15b_contextual_follow_up.sql` y
  `20260929093657_c15b_null_safe_context.sql` contextualizan la RPC existente
  `process_basic_follow_up_milestones` sin alterar su contrato de
  concurrencia.
- Se excluyen solicitudes terminales o archivadas. Un seguimiento manual
  futuro o actividad/contacto humano reciente pospone la recomendación. Un
  seguimiento manual vencido recomienda; una prioridad alta real sin actividad
  humana reciente recomienda como prioritaria; el resto recomienda por ausencia
  de avances.
- Las actividades automáticas de C13B, C14A y C15 no se consideran actividad
  humana. Tras una pausa, el catch-up avanza directamente al hito vigente
  máximo (24/48/72).
- No hay IA, Gateway, emails, reglas sectoriales ni cambios en producción,
  landing, C13B o C14A.

## Validación

- Reutilizada la evidencia contractual C15B: 5/5; la prueba DEV transaccional
  A–G e I, replay sin duplicados, retirada de fixtures y aislamiento
  multi-tenant ya se completaron antes de este cierre.
- La concurrencia no se repitió: C15B conserva los invariantes C15A ya
  validados (`FOR UPDATE SKIP LOCKED`, hito monotónico e índice único parcial).
- Verificación final de esta reanudación: el workflow publicado tiene su grafo
  íntegro (Schedule -> worker), sin nodos huérfanos ni warnings nuevos; el Error
  Handler referenciado está activo y publicado. Consulta DEV final: 0 fixtures
  C15B, 0 grupos duplicados de activities automáticas y 0 solicitudes de
  prueba artificialmente pendientes.

## Seguridad

La RPC sigue restringida a `service_role`; anon y authenticated no pueden
ejecutarla. La credencial se reutiliza desde n8n y no se documentan ni exponen
valores de secretos.
