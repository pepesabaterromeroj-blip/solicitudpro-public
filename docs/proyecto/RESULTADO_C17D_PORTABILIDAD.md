# Resultado C17D — Exportación y portabilidad n8n

Fecha: 2026-09-30. Alcance: exportación de solo lectura, saneado estático y
documentación. No se modificaron workflows, credenciales, secrets, Gateway,
producción ni ejecuciones.

## Resultado

Se guardaron los cinco workflows activos en `docs/proyecto/n8n-exports/`:
C13B, C14A, C15A/C15B, Error Handler y Ops Maintenance. C13A legacy quedó
excluido. Los cinco JSON son parseables, conservan nodos, conexiones, settings,
triggers, paths, schedules y timezone aplicable, y no contienen valores de
credenciales.

Los SHA-256 finales están registrados en `n8n-exports/MANIFEST.md`. El
manifiesto también identifica responsabilidades, backend, RPC/tablas,
credenciales por nombre/tipo, secrets/config solo por nombre, efectos externos
y orden de activación.

## Portabilidad y reconfiguración

- Viajan: grafos, nodos, conexiones, lógica, paths, schedules, timezone y
  configuración del modelo C14A.
- Se reasignan: credenciales n8n, `settings.errorWorkflow`, IDs internos y la
  Data Table operativa.
- Se recrean: credenciales Header/Bearer/Custom Auth, Gmail OAuth2, secrets y
  variables runtime.
- Los paths de webhook son portables; las URLs completas dependen del host n8n
  destino. Supabase debe actualizar `N8N_EMAIL_WAKE_URL` y
  `N8N_REQUEST_ENRICHMENT_WAKE_URL`.
- Si cambia el proyecto Supabase, deben actualizarse también las URLs de Edge
  Functions contenidas en los nodos HTTP.

## Gateway C14A

El export conserva `gpt-5-mini`, razonamiento bajo, máximo 1000 tokens,
timeout de 60 segundos y 0 retries. La autorización/créditos del Gateway
administrado no viajan. En destino hay que habilitar un Gateway compatible,
disponer de plan/créditos y volver a seleccionar el modelo antes de activar.

## Dependencia n8n adicional

Error Handler y Ops Maintenance usan la Data Table
`SolicitudPro DEV - Alertas operativas`. El recurso no forma parte de los
exports; su nombre, esquema y consumidores quedaron documentados para
recrearlo y reasignarlo. Por tanto no queda como dependencia crítica conocida
solo en la instancia trial.

## Riesgos aceptados

- La restauración requiere trabajo normal de reasignación y nuevos valores
  seguros; no es una importación activa de un clic.
- Gmail exige OAuth nuevo.
- Gateway depende de disponibilidad y plan/créditos del destino.
- Los IDs del origen permanecen como referencias históricas del export, pero
  no deben reutilizarse sin reasignación.
- Los JSON reflejan workflows activos; durante la restauración se deben
  mantener inactivos hasta completar toda la configuración.

## Conclusión

No se identificaron blockers de exportación ni dependencias críticas
irreconstruibles. Existe un paquete de restauración autocontenido por
documentación, con hashes, inventario y guía operativa.

**C17D CERRADA.**

**C17 GLOBAL CERRADA.**
