# SolicitudPro — instrucciones permanentes para Codex

## Producto

SolicitudPro es un SaaS para pequeños negocios y autónomos que organiza solicitudes, contacto, adjuntos, comunicaciones y seguimientos. Evoluciona el producto existente; no lo conviertas en un CRM empresarial generalista ni crees sistemas paralelos sin una necesidad demostrada.

## Fuentes de verdad

Usa este orden: (1) Git y worktree del equipo relevante; (2) código vigente; (3) resultados específicos de fase; (4) tests y validaciones contemporáneas; (5) GitHub; (6) documentación general; (7) contexto histórico o conversacional. Distingue siempre metodología estable de estado temporal y etiqueta la evidencia como verificada, publicada, documentada, histórica, propuesta o no verificada.

El contexto profundo y el estado fechado están en `docs/contexto-chatgpt/CONTEXTO_OPERATIVO_CODEX.md`.

## Inicio de cada trabajo

1. Confirma raíz, equipo, rama, HEAD, remoto y fecha.
2. Separa staged, unstaged y untracked.
3. Comprueba referencias remotas sin destruir ni ocultar el estado local.
4. Preserva cambios ajenos y no asumas que otro ordenador está sincronizado.
5. Lee solo los resultados y contratos relevantes para la tarea.

## Git

Por defecto no ejecutes `pull`, `checkout`/`switch`, `merge`, `reset`, `rebase`, `stash`, `clean`, `commit` ni `push`. Solo se permiten con autorización explícita o cuando una automatización documentada tiene autoridad específica. Prefiere un worktree o clon aislado cuando el checkout principal tenga cambios.

## Seguridad

- Distingue DEV de producción; un cierre DEV no acredita producción.
- Auth, membresía, `business_id` y RLS son la autoridad multi-tenant.
- Mantén Storage privado y accesos temporales.
- Nunca pongas `service_role` ni secretos en frontend, Git, tests, documentación o logs.
- No debilites RLS, permisos o aislamiento para facilitar una prueba.
- No modifiques Supabase, n8n, correo o producción sin autorización expresa y alcance exacto.

## Modos de producto

- `?mode=local`: datos ficticios y comportamiento local aislado.
- Ruta normal: producto real DEV autenticado; no mezclar mocks ni usar el estado cliente como autorización.

## Flujo de trabajo

Inspección mínima → checkpoint → cambio mínimo → tests proporcionales → validación → documentación necesaria → estado Git → cierre con evidencia.

No declares una fase cerrada confundiendo estados distintos: implementada, tests automáticos aprobados, validada manualmente, documentada, publicada, integrada y cerrada globalmente.

## Modelo y herramientas

- Trabajo mecánico o documental: modelo rápido con razonamiento Low.
- Implementación habitual: GPT-5.6 Sol con Medium.
- High solo cuando la complejidad haya sido demostrada.
- Registra el modelo solicitado y el runtime real o `NO VERIFICADO`.
- Usa únicamente herramientas que aporten evidencia; evita auditorías, instalaciones y pruebas repetidas sin necesidad.

## Respuesta de cierre

Resume: resultado, archivos, tests, validación, limitaciones, estado Git y siguiente acción exacta. No expongas razonamiento interno extenso ni presentes una propuesta como ejecución terminada.
