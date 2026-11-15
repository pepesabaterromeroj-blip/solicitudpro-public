# PRE-C13A1 — Auditoría Auth y baseline de migraciones DEV

Fecha: 15 de septiembre de 2026.

Ámbito: repositorio `pepesabaterromeroj-blip/solicitudpro`, rama `main`,
`HEAD fd68499`, y únicamente Supabase DEV `solicitudpro-app-dev`
(`rinrgjancwvcvpzjyqmu`). La auditoría fue de solo lectura: no se modificaron
Auth, contraseñas, usuarios, esquema, historial remoto de migraciones, RLS,
Storage, Edge Functions ni datos. No se hizo commit ni push.

## Resumen para Joanet

1. **Contraseñas:** DEV conserva la configuración mínima de Supabase: mínimo
   efectivo de 6 caracteres y sin requisitos de tipos de caracteres. Funciona,
   pero es más débil de lo recomendable incluso para un entorno de desarrollo.
2. **Owners actuales:** endurecer la política no cambia sus contraseñas ni los
   bloquea automáticamente. Supabase permite que sigan iniciando sesión; puede
   devolver una advertencia de contraseña débil. Las nuevas altas y los cambios
   o restablecimientos sí tendrán que cumplir la nueva política.
3. **Recomendación:** en PRE-C13A2 subir DEV a un mínimo de 8 caracteres y
   exigir al menos minúsculas, mayúsculas y números. No hace falta cambiar ni
   conocer las contraseñas actuales.
4. **Contraseñas filtradas:** la protección está desactivada y el Advisor la
   marca como advertencia. No puede activarse en la organización actual porque
   está en plan Free; Supabase la ofrece en Pro o superior. Debe activarse antes
   de producción cuando el proyecto esté en un plan compatible.
5. **Baseline:** el Supabase DEV actual está sano. El problema es que el
   directorio formal `supabase/migrations/` empieza en C11 y no contiene todo lo
   necesario para reconstruir desde cero el esquema histórico.
6. **Producto actual y n8n:** esta deuda no altera el DEV activo ni bloquea el
   puente seguro de worker o C13. Sí bloquearía levantar con confianza un
   proyecto limpio o promocionar el esquema a otro entorno.
7. **PRE-C13A2:** debe recuperar las cinco migraciones históricas ya registradas,
   formalizar el pequeño gap C2, separar datos de referencia de fixtures DEV y
   demostrar un `db reset` completo en una base local/desechable.

## Evidencia y límites de la auditoría

- La raíz Git es
  `C:/Users/ciclo1/Downloads/demo solicitudpro/solicitudpro`.
- Rama: `main`.
- HEAD: `fd68499 C12C: visualización y validación de adjuntos`.
- Se preservaron sin alterar el cambio documental C12C y el informe global
  pre-C13 que ya estaban pendientes en Git.
- La configuración Auth se leyó en el Dashboard del proyecto sin pulsar
  `Save` y se contrastó con el Advisor, el plan real de la organización y la
  documentación oficial de Supabase.
- No se inspeccionaron hashes de usuarios ni se consultó directamente
  `auth.users`.

## Auth

### Configuración real observada

| Ajuste | Estado DEV observado | Interpretación |
| --- | --- | --- |
| Plan de la organización | Free | No incluye leaked password protection. |
| Proveedor email | Activado | El panel real usa email + contraseña. |
| Longitud mínima | Sin valor personalizado; mínimo efectivo 6 | La propia interfaz indica 6 como mínimo y recomienda 8 o más. |
| Requisitos de caracteres | Ninguno seleccionado | No se exige actualmente minúscula, mayúscula, número ni símbolo. |
| Prevent use of leaked passwords | Desactivado | El Advisor confirma `auth_leaked_password_protection`. |
| Secure password change | Desactivado | El cambio no exige una sesión creada en las últimas 24 horas. |
| Require current password when updating | Desactivado | No se exige la contraseña actual en esa operación. |

No se auditaron OAuth ni proveedores sociales porque quedan fuera del objetivo.

### Qué hace leaked password protection

Supabase consulta la API Pwned Passwords de HaveIBeenPwned y rechaza una
contraseña conocida como filtrada o fácil de adivinar. La pantalla del proyecto
indica expresamente que actúa en el registro y al cambiar contraseña. Una
recuperación termina estableciendo una contraseña nueva, por lo que la nueva
contraseña también queda sujeta a la política al guardarse.

La documentación actual indica además que los usuarios existentes pueden
seguir iniciando sesión con su contraseña actual aunque no cumpla una política
endurecida; el resultado de `signInWithPassword` puede incluir una señal
`WeakPasswordError` explicativa. No hay rehash, cambio automático ni obligación
de conocer la contraseña previa. Por tanto, activar requisitos más fuertes no
debería dejar fuera a los owners DEV existentes, aunque conviene comprobar el
login ficticio tras el cambio porque el cliente debe tolerar esa advertencia.

Disponibilidad confirmada: **Pro o superior**. DEV pertenece a una organización
**Free**, así que la opción no está disponible en este momento. Referencia:
[Password security de Supabase](https://supabase.com/docs/guides/auth/password-security).

### Recomendación por entorno

#### DEV ahora

| Medida | Clasificación | Recomendación mínima |
| --- | --- | --- |
| Longitud mínima | CORREGIR AHORA | Subir de 6 a 8 caracteres. |
| Tipos de caracteres | CORREGIR AHORA | Exigir minúscula, mayúscula y número; no forzar símbolo en DEV. |
| Leaked password protection | ANTES DE PRODUCCIÓN | No disponible en Free; activar al pasar a Pro o superior. |
| Sesión reciente para cambiar contraseña | OPCIONAL | Valorar antes de producción junto con la UX de recuperación. |
| Contraseña actual al actualizar | OPCIONAL | Útil para cambios iniciados desde una sesión, no requisito de C13. |
| MFA | OPCIONAL | Recomendable más adelante para owners, no requisito PRE-C13. |

El mínimo de 8 es el cambio menos disruptivo que corrige la advertencia de la
documentación. No se propone rotación masiva ni tocar owners existentes.

#### Futura producción

- Mínimo recomendado: 12 caracteres.
- Exigir minúscula, mayúscula y número; añadir símbolo si la UX final lo
  comunica y valida correctamente.
- Activar leaked password protection en un plan compatible.
- Valorar sesión reciente, contraseña actual y MFA para operaciones sensibles.
- Probar registro, login existente, cambio y recuperación en staging antes de
  aplicar la configuración productiva.

## Baseline de migraciones

### Estado real de Supabase DEV

Inventario de objetos de aplicación en `public`:

- 17 tablas: `activities`, `attachments`, `business_settings`,
  `business_users`, `businesses`, `contacts`, `email_jobs`, `email_templates`,
  `follow_ups`, `form_configs`, `form_fields`, `profiles`,
  `public_form_idempotency_keys`, `public_form_rate_limit_windows`,
  `request_custom_answers`, `requests` y `sectors`.
- 17 claves primarias, 31 FKs, 17 restricciones únicas y 63 checks.
- 68 índices.
- 0 triggers de aplicación.
- 4 funciones/RPC: dos firmas de `submit_public_form_submission`,
  `get_email_job_context` y `authorize_public_attachment_upload`.
- Las cuatro funciones son `SECURITY INVOKER`; ninguna es ejecutable por
  `PUBLIC`, `anon` o `authenticated`, y sí por `service_role`.
- RLS está activa en las 17 tablas.
- 34 policies en `public`, todas para `authenticated`; no hay policy `anon`.
- `email_jobs`, `public_form_idempotency_keys` y
  `public_form_rate_limit_windows` no tienen policies y permanecen inaccesibles
  por RLS para frontend. `email_jobs` además tiene revocados los privilegios de
  `anon` y `authenticated`.

Storage forma parte del inventario por separado:

- bucket `request-attachments` privado;
- límite 10 MiB;
- JPEG, PNG, WebP, HEIC, HEIF y PDF;
- una única policy `SELECT` para `authenticated`, ligada a metadata,
  membresía activa, negocio y path canónico;
- la creación del bucket y su policy sí están versionadas en C12A.

Los cuatro checks C12A `NOT VALID` de `attachments` son intencionales para
conservar dos filas legacy. Se exigen en escrituras nuevas y no constituyen un
gap del baseline.

Auth es configuración administrada fuera del esquema SQL. Las Edge Functions
viven correctamente en `supabase/functions/` y tampoco son migrations.

### Historial remoto aplicado

DEV registra 12 migraciones, en este orden:

1. `20260831113530_solicitudpro_initial_schema`
2. `20260831113551_solicitudpro_seed_sectors`
3. `20260831114541_solicitudpro_rls_policies_draft`
4. `20260831181435_add_reviewed_indexes`
5. `20260903124438_c8b_reference_prefixes`
6. `20260910082352_c11a_email_jobs`
7. `20260910082542_c11a_email_jobs_fk_index`
8. `20260910092630_c11b_email_jobs_from_public_form`
9. `20260910111207_c11c_email_job_context`
10. `20260911080621_c12a_request_attachments_storage`
11. `20260911081108_c12a_attachment_uploader_fk_index`
12. `20260911082835_c12b1_authorize_attachment_upload`

### Inventario local formal

`supabase/migrations/` contiene solo las siete entradas C11/C12, desde
`20260910082352` hasta `20260911082835`.

- No hay archivos vacíos.
- No hay timestamps ni nombres duplicados.
- Las dos migrations cortas de índices son correcciones deliberadas, no
  duplicados.
- Las siete definiciones coinciden semánticamente con las siete entradas
  remotas: se comparó el hash MD5 tras normalizar espacios y saltos de línea.

Las cinco entradas remotas anteriores a C11 no están en el directorio formal,
pero su SQL de aplicación está conservado en `docs/proyecto/sql/`:

| Historial remoto | SQL local equivalente | Comprobación |
| --- | --- | --- |
| `20260831113530` | `001_initial_schema.sql` | Código SQL equivalente; solo difieren comentarios/formato. |
| `20260831113551` | `003_seed_sectors.sql` | Código SQL equivalente. |
| `20260831114541` | `002_rls_policies_draft.sql` | Código SQL equivalente. |
| `20260831181435` | `004_indexes_review.sql` | Código SQL equivalente; solo difieren comentarios/formato. |
| `20260903124438` | `010_c8b_reference_prefixes.sql` | Código SQL equivalente. |

Esta equivalencia se comprobó comparando el SQL remoto registrado con los
archivos locales tras retirar comentarios y normalizar whitespace. No hace
falta reconstruir estas cinco piezas a mano.

### Gap analysis

| Gap | Clasificación | Origen con evidencia | Impacto en una base limpia |
| --- | --- | --- | --- |
| Las cinco migrations remotas históricas no existen bajo `supabase/migrations/` | CRÍTICO para bootstrap | B3, C1 y C8B | La primera migration local, C11A, referencia `businesses` y `requests` inexistentes y falla. |
| Tablas `public_form_rate_limit_windows` y `public_form_idempotency_keys`, con constraints y RLS, no tienen entrada formal | CRÍTICO para bootstrap | C2 (`006_public_form_rate_limit_idempotency.sql`) | C12B1 no puede crear su función SQL porque referencia una tabla ausente. |
| RPC de tres argumentos | CUBIERTO | C1, sustituida por C8B | Su definición final ya está en la migration remota C8B que debe recuperarse. |
| RPC de ocho argumentos | CUBIERTO | C2, sustituida por C11B | Su definición final está en la migration formal C11B. No debe restaurarse la versión antigua sobre DEV. |
| Sectores Climatización y Cristalería y configuración de los seis sectores | NECESARIO como datos de referencia | C6/C7/C8A | El esquema arranca, pero no queda un entorno funcional multisector sin seed/provisioning. |
| Negocios, owners, contactos, solicitudes y respuestas ficticias | FIXTURE DEV, no baseline | C6/C7/C8A | No deben convertirse en migration de producto ni copiarse a producción. |
| `supabase/config.toml` ausente | NECESARIO para stack local | No hay archivo actual | Auth y otros ajustes locales no quedan declarados para `supabase start`. |
| README SQL mantiene un flujo manual anterior | SECUNDARIO | Documentación histórica | Puede confundir, pero no cambia DEV. |
| Cuatro checks C12A `NOT VALID` | LEGACY documentado | C12A | No impiden bootstrap ni escrituras nuevas; conservar hasta migración explícita de legacy. |

No se han detectado migrations aplicadas de C11/C12 que falten en el repo,
migrations vacías, duplicaciones reales ni cambios DEV posteriores a C12 sin
versionar. El gap es anterior a C11 y está delimitado.

## Estrategia segura recomendada para PRE-C13A2

No se recomienda una migration gigante ni un `db reset --linked`. Tampoco se
debe renombrar, borrar, combinar o reescribir ninguna entrada aplicada.

Plan mínimo:

1. Inicializar el soporte local de Supabase y revisar un `supabase/config.toml`
   sin secretos. Los secretos, si fueran necesarios, deberán referenciarse por
   entorno.
2. Copiar a `supabase/migrations/` las cinco piezas históricas con **sus mismos
   timestamps y nombres remotos**, usando el SQL registrado/conservado y
   comprobando nuevamente hashes normalizados. Esto alinea el repo con cinco
   entradas ya aplicadas y no ejecuta nada en DEV.
3. Crear una migration histórica pequeña, colocada antes de C12B1, que contenga
   únicamente las dos tablas C2, constraints, RLS y permisos necesarios. No
   incluir la antigua RPC C2, porque C11B ya contiene su definición final.
4. Validar toda la secuencia en un Supabase local o base desechable con
   `supabase db reset`. Confirmar que las 17 tablas, 4 funciones, constraints,
   índices, RLS, policies y bucket esperado se reconstruyen.
5. Tras demostrar igualdad de catálogo, registrar la migration C2 como aplicada
   en DEV mediante el mecanismo soportado `supabase migration repair --status
   applied`; esta acción solo deberá hacerse en PRE-C13A2 con revisión previa y
   sin ejecutar DDL destructivo.
6. Crear un `supabase/seed.sql` saneado para los seis sectores y los datos de
   referencia realmente necesarios. No copiar usuarios Auth, UUID de owners ni
   solicitudes DEV; el alta de owners/negocios debe seguir un provisioning
   separado.
7. Ejecutar `supabase migration list`, una comparación final de catálogo y
   `db push --dry-run`. El resultado esperado es cero DDL pendiente en DEV.

Supabase documenta `db pull` como mecanismo para adoptar un proyecto existente,
`db reset` local como prueba de reproducibilidad y `migration repair` para
reconciliar historial. En este caso, recuperar primero los cinco archivos
exactos y aislar el gap C2 es más controlable que aceptar sin revisión un dump
monolítico. Referencias:

- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Repair migration history](https://supabase.com/docs/reference/cli/supabase-migration-repair)

### Riesgos y controles

- Una migration C2 colocada al final no sirve: C12B1 depende de su tabla al
  crear una función `language sql`. Debe aparecer cronológicamente antes.
- Aplicar el archivo `006` completo ahora sería incorrecto porque restauraría
  una versión antigua de la RPC de ocho argumentos. Hay que extraer solo el
  schema C2 aún vigente.
- Los SQL 007-009 contienen fixtures ligados a owners DEV. No deben convertirse
  íntegramente en migrations de producción.
- Toda prueba destructiva debe apuntar exclusivamente al stack local o a una
  base desechable. Nunca ejecutar `db reset --linked` contra DEV.
- Antes de registrar una migration como aplicada, el catálogo remoto debe
  demostrar que sus objetos ya existen con definición equivalente.

## ¿Bloquea PRE-C13B/C13?

**NO BLOQUEA.** El Supabase DEV actual es coherente; C11 y C12 están aplicados y
coinciden con sus migrations. El puente seguro de worker puede desarrollarse y
probarse sobre DEV sin depender del baseline histórico.

No obstante, conviene ejecutar PRE-C13A2 antes de crear otro entorno o preparar
producción. También es preferible terminar A2 antes de seguir acumulando nuevas
migrations, porque cada nueva dependencia hace más costosa la reconstrucción.
Después de A2 se puede continuar con PRE-C13B con una base formal ya ordenada.

## Decisión final

| Tema | Estado | Acción | Prioridad | Bloquea C13 |
| --- | --- | --- | --- | --- |
| Auth password policy | Mínimo efectivo 6, sin requisitos de caracteres | Subir DEV a 8 y exigir minúscula, mayúscula y número; validar login ficticio existente | CORREGIR AHORA | NO |
| Leaked password protection | Desactivada y no disponible en plan Free | Activar al pasar a Pro o superior, antes de producción | ANTES DE PRODUCCIÓN | NO |
| Baseline migrations | DEV sano; historial formal local incompleto antes de C11 | Recuperar 5 migrations, formalizar schema C2, seed saneado y validar `db reset` local | CORREGIR AHORA | NO |

## Resultado

Existe una estrategia concreta, pequeña y sin cambios destructivos para
PRE-C13A2. Ninguno de los dos asuntos impide técnicamente PRE-C13B/C13 en el DEV
actual, pero el baseline debe quedar resuelto antes de levantar otro entorno y
la política de contraseña debe endurecerse antes de producción.

PRE-C13A1 FINALIZADA — PLAN DE CORRECCIÓN DEFINIDO
