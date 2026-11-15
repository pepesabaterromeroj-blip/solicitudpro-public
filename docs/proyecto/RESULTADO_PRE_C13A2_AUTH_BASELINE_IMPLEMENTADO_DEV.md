# PRE-C13A2 — Auth DEV endurecido y baseline reproducible

Fecha de cierre: 15 de septiembre de 2026.

Proyecto autorizado: `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`).
No se ha accedido ni aplicado ningún cambio a producción o al proyecto de la
landing.

## Estado recuperado desde el checkpoint

Se continuó desde `14c3c5d WIP: preparar PRE-C13A2 Auth y baseline`, sin rehacer
el trabajo ya versionado. La clasificación al retomarlo fue:

- **YA HECHA:** recuperación de las cinco migraciones históricas, migration
  bootstrap de C2, configuración local, seed ficticio y comprobador de
  reconstrucción.
- **PARCIAL:** el baseline estaba preparado, pero todavía no había evidencia de
  una ejecución completa desde cero en este equipo.
- **PENDIENTE:** guardar la política Auth DEV, ejecutar la reconstrucción,
  comparar con DEV, pasar la suite y cerrar esta documentación.
- **BLOQUEADA:** ninguna tarea.

Todos los puntos pendientes se completaron durante esta ejecución.

## Auth DEV

### Configuración anterior

- Longitud mínima efectiva: 6 caracteres.
- Requisitos de caracteres: ninguno.
- Protección de contraseñas filtradas: desactivada.

### Configuración nueva aplicada

En `Authentication > Sign In / Providers > Email` se guardó exclusivamente:

- longitud mínima: 8 caracteres;
- al menos una letra minúscula;
- al menos una letra mayúscula;
- al menos un número.

La consola mostró `Successfully updated settings`. Después de guardar se
releyeron los controles: longitud `8`, requisito `Lowercase, uppercase letters
and digits`, y los botones `Save`/`Cancel` quedaron desactivados al no existir
cambios pendientes.

No se abrió, creó, eliminó ni modificó ningún usuario Auth. No se cambiaron ni
restablecieron contraseñas y los owners ficticios existentes permanecieron
intactos. Según la documentación vigente de Supabase, el endurecimiento se
aplica a nuevas contraseñas y cambios posteriores; no sustituye las contraseñas
existentes.

`Prevent use of leaked passwords` continúa desactivado porque el proyecto usa
el plan Free. Queda expresamente como **PENDIENTE SUPABASE PRO / ANTES DE
PRODUCCIÓN**.

## Cinco migraciones históricas recuperadas

El inventario remoto confirma las cinco entradas históricas y sus timestamps.
PRE-C13A1 había contrastado el SQL remoto con los archivos conservados en
`docs/proyecto/sql/` después de retirar comentarios y normalizar espacios. En
esta ejecución se volvió a comparar cada archivo recuperado con esa fuente
local: la única diferencia es un salto de línea final.

| Migration recuperada | Objetivo y objetos principales | Fuente de recuperación | Estado en DEV |
| --- | --- | --- | --- |
| `20260831113530_solicitudpro_initial_schema.sql` | Esquema inicial: 14 tablas de producto, relaciones, constraints e índices base. | `docs/proyecto/sql/001_initial_schema.sql`, previamente contrastado con el SQL remoto. | Aplicada históricamente; solo restaurada al repositorio. |
| `20260831113551_solicitudpro_seed_sectors.sql` | Catálogo inicial de sectores Reformas y Electricidad. | `docs/proyecto/sql/003_seed_sectors.sql`, previamente contrastado con el SQL remoto. | Aplicada históricamente; solo restaurada al repositorio. |
| `20260831114541_solicitudpro_rls_policies_draft.sql` | Activa RLS y crea las 36 policies multi-tenant originales; C12A sustituye posteriormente tres policies de adjuntos por una lectura canónica, dejando 34 en el estado final. | `docs/proyecto/sql/002_rls_policies_draft.sql`, previamente contrastado con el SQL remoto. | Aplicada históricamente; solo restaurada al repositorio. |
| `20260831181435_add_reviewed_indexes.sql` | Añade índices revisados para FKs y consultas operativas. | `docs/proyecto/sql/004_indexes_review.sql`, previamente contrastado con el SQL remoto. | Aplicada históricamente; solo restaurada al repositorio. |
| `20260903124438_c8b_reference_prefixes.sql` | Conserva las RPC de formulario público y amplía los prefijos sectoriales C8B. | `docs/proyecto/sql/010_c8b_reference_prefixes.sql`, previamente contrastado con el SQL remoto. | Aplicada históricamente; solo restaurada al repositorio. |

No se reejecutó ninguna de estas migraciones sobre DEV y no se reescribió su
historial remoto.

## Formalización de C2

La migration
`20260831120000_c2_public_form_guards_bootstrap_recovered.sql` formaliza solo las
dos tablas de C2 que faltaban en el historial local reproducible. Su fuente es
`docs/proyecto/sql/006_public_form_rate_limit_idempotency.sql`; se excluyó de
forma deliberada la RPC C2 antigua porque C11B contiene su definición vigente.

### `public_form_rate_limit_windows`

- Columnas: `business_id uuid`, `form_config_id uuid`, `requester_hash text`,
  `window_started_at timestamptz`, `request_count integer default 0`,
  `last_attempt_at timestamptz default now()` y `created_at timestamptz default
  now()`.
- PK compuesta por negocio, formulario, hash y comienzo de ventana.
- FK simple al negocio y FK compuesta al formulario del mismo negocio, ambas
  con `ON DELETE CASCADE`.
- Checks de hash SHA-256 hexadecimal y contador positivo.
- El índice de PK cubre la clave operativa.
- RLS activada y sin policies: el acceso directo de frontend queda denegado.

### `public_form_idempotency_keys`

- Columnas: `id uuid default gen_random_uuid()`, negocio, formulario, hashes de
  idempotencia y payload, solicitud/referencia/confirmación opcionales,
  expiración, creación y finalización.
- PK en `id`; unique por negocio, formulario y hash de idempotencia.
- FKs al negocio, al formulario del mismo negocio y a la solicitud del mismo
  negocio; borrado `CASCADE` o `RESTRICT` según la dependencia.
- Checks de hashes, expiración posterior a creación y consistencia del estado
  completado.
- Los índices de PK y unique cubren sus claves principales.
- RLS activada y sin policies: `anon` y usuarios autenticados no pueden obtener
  filas aunque el esquema administrado conserve grants de tabla; el backend
  opera mediante `service_role` y las RPC no se exponen al frontend.

El catálogo real de DEV coincide en columnas, tipos, nulabilidad, defaults,
PK/FK, unique/checks, índices, RLS y ausencia de policies. El archivo usa
`IF NOT EXISTS` para la reconstrucción local, pero no se ejecutó ni se marcó
como nueva migración remota: DEV conserva sus 12 entradas históricas originales
y el repositorio añade esta pieza local para poder arrancar desde cero.

## Seed y configuración local

`supabase/config.toml` declara, sin credenciales:

- seed local habilitado;
- Auth local con los mismos requisitos de 8 caracteres, minúscula, mayúscula y
  número;
- Storage habilitado;
- bucket privado `request-attachments`, 10 MiB y los seis MIME de C12;
- configuración local existente de `receive-public-form` con verificación JWT
  desactivada, coherente con su autorización propia para formularios públicos.

`supabase/seed.sql` es determinista e idempotente. Contiene seis sectores, seis
negocios `*-baseline-dev`, un formulario ficticio mínimo por negocio y dos
campos ficticios por formulario. No contiene usuarios Auth, passwords, tokens,
JWT, `service_role`, claves privadas, UUID de owners, solicitudes de DEV ni
datos personales reales. Si una prueba local necesita owners Auth, deben
crearse manualmente con credenciales temporales que no se versionen.

## Reconstrucción limpia y aislada

Este PC no dispone de Docker ni Supabase CLI. Se utilizó la alternativa
equivalente ya preparada en el checkpoint:
`supabase/tests/verify_clean_rebuild.mjs`, con PGlite `0.5.8`, extensión
`pgcrypto` y stubs mínimos desechables para los esquemas administrados `auth` y
`storage`. El paquete y la base se crearon fuera del repositorio, en el
directorio temporal del sistema.

Se ejecutaron, en orden, las 13 migrations del repositorio y después el seed.
Resultado:

- 17 tablas públicas y 17 con RLS;
- 128 constraints;
- 68 índices;
- 34 policies públicas;
- 0 triggers de aplicación;
- cuatro firmas RPC: dos de `submit_public_form_submission`,
  `get_email_job_context(uuid)` y `authorize_public_attachment_upload`;
- ninguna RPC de aplicación `SECURITY DEFINER`;
- RPC backend-only sin `EXECUTE` para `PUBLIC`, `anon` o `authenticated`;
- bucket `request-attachments` privado, 10 MiB, seis MIME;
- una policy Storage de lectura autenticada;
- cuatro checks C12A `NOT VALID` preservados;
- seed: 6 sectores, 6 negocios, 6 formularios y 12 campos.

La base temporal reconstruida coincide con el inventario funcional de DEV en
tablas, constraints, índices, policies, RLS, RPC, funciones helper y objetos de
Storage relevantes para C10, C11 y C12. No se exige igualdad de internals
administrados por Supabase. Los negocios/formularios del seed local son
fixtures reproducibles y no pretenden igualar los datos vivos de DEV.

## Comprobación de DEV después de PRE-C13A2

Las consultas posteriores, exclusivamente de lectura, confirman:

- 6 negocios, 31 solicitudes, 31 seguimientos, 8 `email_jobs` y 6 adjuntos,
  iguales al inventario anterior al cambio Auth;
- RLS activa en las 17 tablas públicas;
- columnas C10 `status`, `priority`, `next_follow_up_at` y `archived_at`;
- seguimiento con `due_at`, `status`, `completed_at` y `completed_by`;
- `get_email_job_context(uuid)` existente y `SECURITY INVOKER`;
- `attachments` existente y protegida por RLS;
- bucket `request-attachments` existente, privado y limitado a 10 MiB;
- policy canónica de lectura de objetos presente;
- `receive-public-form` activo, versión 5, sin cambio de versión ni hash;
- las 12 entradas del historial remoto permanecen sin cambios.

El Advisor conserva los avisos esperados: tres tablas backend-only con RLS y
sin policies, y la protección de contraseñas filtradas desactivada. No se han
relajado RLS, grants, policies ni Storage.

## Tests y verificaciones

- `node --test tests/*.js`: **113/113 OK**, 0 fallos, 0 omitidos.
- Reconstrucción aislada: **OK**, 13 migrations y seed completo.
- `node --check supabase/tests/verify_clean_rebuild.mjs`: **OK**.
- Comparación de las cinco migrations recuperadas: **OK**, solo salto de línea
  final frente a sus fuentes conservadas.
- `git diff --check` y revisión adicional del documento no rastreado: **OK**.
- Revisión de secretos: **OK**, sin nombres sensibles ni coincidencias de alta
  confianza; tampoco hay temporales versionados.
- Estado Git: `main` sincronizada con `origin/main`; solo queda sin rastrear
  este documento final, sin commit ni push por indicación expresa.

## Deuda pendiente real

- **PENDIENTE SUPABASE PRO / ANTES DE PRODUCCIÓN:** activar leaked password
  protection cuando el plan lo permita.

La diferencia de 12 entradas remotas frente a 13 archivos locales es
intencional: la pieza C2 restaura el gap de reproducibilidad local sin ejecutar
DDL ni reescribir el historial ya aplicado de DEV.

No se ha iniciado PRE-C13B ni ninguna fase posterior.

## Checklist final

```text
Auth mínimo 8: OK
Minúscula: OK
Mayúscula: OK
Número: OK
Owners actuales modificados: NO
Leaked password protection: PENDIENTE SUPABASE PRO
5 migrations recuperadas: OK
C2 formalizado: OK
Seed saneado: OK
Reconstrucción limpia: OK
DEV intacto: OK
Tests: OK
Secretos: OK
```
