# C18C-1 — Base real de la demo objetivo

Fecha: 30 de septiembre de 2026. Alcance: sesión, negocio activo y listado de Solicitudes. Sin cambios en Supabase, RLS, n8n ni `dev/panel-product-readonly.*`.

## Implementación

- `index.html` y `css/style.css`: acceso mínimo por email/contraseña, selector de negocio si hay varios, actualizar/salir y estados de lectura. Sidebar, tarjetas y estilo existente conservados.
- `js/data/product-data.js`: transporte único del producto a Supabase DEV con URL/clave **publicable** existentes, JWT en memoria, comprobación `GET /auth/v1/user`, membresías activas, negocios visibles por RLS, requests y contactos del negocio. No usa service role ni credenciales nuevas. La capa valida IDs seleccionados contra negocios devueltos por membresía, comprueba pertenencia de las filas y descarta respuestas de sesiones cambiadas.
- `js/real-product.js`: orquestador de la ruta real, preferencia local solo para `activeBusinessId` (revalidada al entrar), filtros de estado/servicio/búsqueda, tarjetas y detalle básico construido exclusivamente con campos ya leídos. Peticiones tardías no repueblan otro negocio o sesión.
- `js/script.js`: la ruta normal (`index.html`, con o sin `?sector=`) empieza sin `requests` locales y delega navegación/listado/detalle al controlador real. La demo ficticia anterior queda aislada tras `?mode=local&sector=...`; `?submit=supabase-dev` conserva el probador público DEV previo como ruta explícita. Sus escrituras y acciones simuladas no se ejecutan en la ruta real de producto.

La sesión no se persiste en navegador: al recargar se pide acceso de nuevo. Una sesión ausente o expirada no lee solicitudes ni muestra semillas. Con 0 negocios se muestra estado vacío; con 1 se selecciona automáticamente; con varios aparece selector. El ID local no actúa como permiso. Solicitudes se ordena por `created_at.desc` desde PostgREST y filtra solo filas reales. Se leen `id,business_id,contact_id,reference,title,service,status,priority,urgency,created_at,archived_at`; los contactos aportan nombre/email/teléfono. Zona no se inventa porque no existe equivalente confirmado en el contrato de listado. No se consultan claims, leases, reintentos, payloads técnicos ni `email_jobs`.

Inicio, Seguimientos, Contactos, tabla, acceso cliente y demás secciones aún no migradas muestran un estado pendiente al navegar en modo real. El detalle abre solo contacto, servicio, estado, prioridad y fecha ya presentes en el listado. Cambiar estado, editar, marcar contactado, copiar respuestas ficticias y reset local no están disponibles en modo real; C18D queda separado. El flujo local antiguo permanece únicamente en el modo explícito de desarrollo.

## Validación

- `node --test tests/c18c1-real-demo.test.js`: 10/10. Cubre Auth simulado a nivel HTTP, ausencia/expiración de sesión, 0/1/varios negocios y preferencia validada, rechazo de negocio ajeno, filtro por `business_id` + JWT, respuesta cruzada, error sin fallback, render del controlador y detalle sin acciones simuladas.
- `node --test tests/product-demo-shell.test.js tests/demo-supabase-dev-submit.test.js tests/request-detail.test.js`: 27/27; flujo local explícito y envío público previo conservados.
- `node --check` de los tres JS modificados: correcto.
- **DEV real, sin escritura ni fixtures:** proyecto `rinrgjancwvcvpzjyqmu`; bajo rol `authenticated` y `auth.uid()` simulado para un owner ficticio existente, RLS mostró 1 membresía/1 negocio, 11 requests propios y 0 de otro negocio. Una fila real (`REF-010`) con contacto real se pasó al render del listado y produjo la tarjeta esperada. Se usó transacción con `ROLLBACK`.

## Límite de verificación y continuidad

No hay credenciales de prueba Auth disponibles en el repo ni se hizo login HTTP real en esta sesión. El contrato Auth se validó con pruebas de transporte y la base DEV con rol autenticado/RLS, pero **el recorrido interactivo completo login → selección → listado no está verificado contra Auth DEV**. Por ello C18C-1 queda **implementada, con cierre pendiente de esa única comprobación**. No se atribuye esta prueba al panel técnico ni se presenta como auditoría visual.

Siguiente acción dentro de C18C-1: efectuar un único login DEV con un usuario ficticio autorizado y comprobar en la demo que aparece su negocio y el listado real, que el ID de otro negocio no concede acceso y que el detalle básico no ofrece escrituras simuladas. Después, iniciar C18C-2 según el mapa vigente; no adelantarla ahora.

## VALIDACIÓN WINDOWS CASA

Validación realizada el 4 de octubre de 2026 en `D:\demo Solicitudpro\solicitudpro`, sirviendo la raíz por HTTP local en `http://127.0.0.1:3000/`, sin usar `file://`, instalar herramientas ni modificar Supabase.

- Portabilidad: imports y recursos de C18C-1 respondieron por HTTP con estado 200. No se encontraron rutas absolutas de macOS ni dependencias del entorno Mac en los archivos revisados.
- Tests dirigidos: 38/38 correctos tras añadir una prueba de regresión; `node --check` correcto para `js/data/product-data.js`, `js/real-product.js` y `js/script.js`.
- Modo real sin sesión: mostró únicamente el acceso a Supabase DEV, con el shell oculto, cero tarjetas de solicitud y sin errores o avisos en consola. Después de usar la demo local, volver a la ruta real siguió mostrando cero datos ficticios.
- Modo local: `?mode=local` mostró el selector ficticio y `?mode=local&sector=reformas` cargó cinco solicitudes de ejemplo, sin errores o avisos en consola.
- Bug encontrado y corregido: los seis enlaces `Probar demo` del selector omitían `mode=local` y devolvían al modo real. Ahora conservan explícitamente el modo local; la prueba nueva reproduce y protege este caso.
- Seguridad: los tests confirman sesión en memoria, validación de membresías, rechazo de negocios ajenos, consultas con JWT y `business_id`, ausencia de fallback mock y ausencia de `service_role` en frontend. El detalle real básico no incorpora acciones simuladas.
- Auth DEV: no había una sesión DEV válida en el navegador y el proyecto no documenta credenciales utilizables sin conocer o exponer una contraseña. No se intentó login, no se buscaron credenciales y no se creó ni modificó ningún usuario.

Resultado: **implementación validada en Windows; cierre pendiente únicamente del smoke interactivo Auth DEV**: login autorizado → negocio → listado real → detalle básico real.

## Cierre C18C-1 — smoke manual Auth DEV (5 de octubre de 2026)

La validación interactiva pendiente se completó hoy por HTTP en `http://127.0.0.1:3000/`, con un usuario owner ficticio autorizado de Supabase DEV:

- Login DEV correcto y negocio detectado: **Reformas Demo Dev**.
- Listado cargado desde DEV con **11 solicitudes autorizadas**; entre los ejemplos, `REF-010` (Validación C14A DEV) y `REF-DEV-001` (Marta Prueba Reformas).
- Se abrieron solicitudes reales y el detalle básico mostró datos coherentes.
- Navegación listado → detalle → volver y búsqueda validadas manualmente.
- No se mezclaron solicitudes ficticias/mock con los datos reales.
- Los filtros de estado/servicio no pudieron comprobarse manualmente con variedad: los registros visibles son principalmente «Nuevo» y «Baño». No bloquea el cierre porque esa lógica ya cuenta con cobertura de tests; no se crearon registros artificiales.

**C18C-1 queda oficialmente CERRADA.** La limitación interactiva descrita en las secciones históricas anteriores queda resuelta por este smoke manual. Siguiente fase: **C18C-2**; no iniciada en esta tarea.
