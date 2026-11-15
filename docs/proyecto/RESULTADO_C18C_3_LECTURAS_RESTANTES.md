# C18C-3 — Lecturas reales restantes de la demo

Fecha: 7 de octubre de 2026. Rama: `c18c-3-recovery`. Alcance exclusivo de
lectura real para Inicio, Seguimientos, Contactos y comunicaciones del detalle.
Sin cambios en Supabase, migraciones, RLS, n8n, panel técnico, producción ni
landing.

## Arquitectura y capa de datos

Se conserva `UI → js/real-product.js → js/data/product-data.js → Supabase/RPC`.
`product-data.js` centraliza dos lecturas nuevas:

- `listFollowUpContext(businessId)`: obtiene `follow_ups` y las actividades C15
  24/48/72, siempre filtradas por el negocio previamente autorizado mediante
  membresía. Proyecta solo campos útiles y rechaza filas cruzadas.
- `getRequestCommunications(requestId)`: usa exclusivamente
  `POST /rest/v1/rpc/get_request_communications`; conserva únicamente
  `email_type`, `status`, `created_at` y `sent_at`.

El listado de solicitudes incorpora los campos C15 y C14 necesarios para las
vistas reales. No existe SELECT directo sobre `email_jobs`, segunda data layer,
`service_role`, secreto nuevo ni autorización basada en `localStorage`.

## Seguimientos / C15

La sección Seguimientos combina solicitudes autorizadas, tareas `follow_ups` y
actividades automáticas C15. Muestra referencia, contacto, servicio, próxima
fecha, acción/contexto, estado, origen y hito automático.

Los hitos se traducen exactamente: 0 → «Sin seguimiento automático», 24/48/72
→ horas correspondientes. Los tres `reason_code` conocidos usan allowlist y
un código desconocido produce «Seguimiento recomendado.»; nunca se imprime el
código crudo. La vista es de solo lectura y no incluye completar, crear,
contactar o editar seguimientos.

## Comunicaciones C13/C16

El detalle real incluye una sección Comunicaciones alimentada por la RPC C18B.
Traduce los dos tipos (`customer_confirmation`, `business_notification`) y los
cuatro estados reales (`pending`, `processing`, `sent`, `failed`). Solo muestra
tipo, estado y fechas. No expone contenido, destinatarios, delivery IDs,
payloads, claims, leases, retries, respuestas de proveedor ni errores crudos.
Un fallo aislado muestra un error seguro sin invalidar el resto del detalle.

## Contactos reales

Contactos se proyecta desde solicitudes y contactos ya autorizados. Agrupa de
forma conservadora por ID real de contacto; no fusiona personas solo por nombre
o email. Para cada contacto muestra nombre, medio disponible, última solicitud,
fecha y número de solicitudes. Una solicitud sin identidad suficiente conserva
una proyección independiente y honesta. No se añadió schema ni funcionalidad
CRM.

## Inicio y cambio de negocio

Inicio calcula localmente sobre el dataset ya autorizado cuatro métricas
fiables: solicitudes nuevas, activas, prioridad alta y seguimientos pendientes
para hoy o vencidos. Alertas y siguiente tarea proceden de los mismos datos.
Las tarjetas mock no se reutilizan en modo real.

Seleccionar otro `activeBusiness` autorizado vuelve a cargar conjuntamente
solicitudes y contexto de seguimientos; Inicio, Solicitudes, Seguimientos y
Contactos se renderizan desde ese nuevo dataset. La preferencia local sigue
siendo solo una preferencia revalidada contra membresías.

## Separación real / local

La ruta normal permanece cerrada sin sesión y no carga mocks. `?mode=local`
conserva la demo ficticia. Se corrigió el enlace «Cambiar demo sectorial» para
que navegue a `?mode=local` en lugar de perder el modo. No se modificaron las
semillas locales ni `js/script.js`.

## Seguridad y contratos

- Auth en memoria, membresía activa y RLS siguen siendo la autoridad.
- `follow_ups`, `activities`, `contacts` y `requests` se filtran por el negocio
  validado; cualquier fila cruzada invalida la lectura.
- La RPC de comunicaciones decide el tenant a partir de la request y
  `auth.uid()`; el frontend no envía `business_id` a esa función.
- No se modificaron grants, policies, schema, Storage ni Edge Functions.
- No se usó Supabase MCP: migraciones, tests y documentación versionada fueron
  evidencia suficiente para los contratos empleados.

## Tests y smoke

Pruebas dirigidas: **78/78 correctas**, incluyendo C15A/B, C16, C18B,
C18C-1/2/3 y regresiones locales relacionadas. C18C-3 añade 10 pruebas para
tenant, hitos, allowlist/fallback, RPC segura, comunicaciones ajenas vacías,
contactos conservadores, métricas, renders sin mocks, navegación local y
refresco completo al cambiar de negocio. `node --check` fue correcto para los
JS modificados y el test nuevo. Persisten únicamente warnings históricos de
Node sobre módulos TypeScript sin `type: module`.

Smoke HTTP local en `http://127.0.0.1:3000/`:

- modo real sin sesión: pantalla de acceso, shell oculto, cero solicitudes y
  consola sin errores/avisos;
- `?mode=local&sector=reformas`: shell ficticio, cinco solicitudes y consola
  limpia;
- «Cambiar demo sectorial»: termina en `?mode=local`, sin caída al modo real.

El smoke Auth DEV de Inicio → Solicitudes → Seguimientos → Contactos → detalle
→ comunicaciones queda **NO VERIFICADO**: no existía sesión vigente ni un
mecanismo autorizado sin contraseña en este entorno. No se buscaron
credenciales, no se crearon usuarios/fixtures y no se tocó Supabase remoto.
Esta limitación está permitida por el criterio de cierre cuando se justifica de
forma explícita; los contratos y el controlador quedan cubiertos por tests.

## Gaps, deuda y cierre

No hay gaps bloqueantes de schema, RLS o arquitectura. Gap no bloqueante: smoke
interactivo Auth DEV no verificado en esta ejecución. C19 conserva la deuda de
redistribución del detalle, huecos, layout y pulido responsive general; no se
adelantó. C18D (acciones humanas reales) tampoco se inició.

**C18C-3 queda FINALIZADA con la limitación Auth DEV explícita.** Como C18C-1 y
C18C-2 ya están cerradas, **C18C queda globalmente CERRADA** para las lecturas
previstas. Siguiente fase: **C18D — acciones humanas reales**.
