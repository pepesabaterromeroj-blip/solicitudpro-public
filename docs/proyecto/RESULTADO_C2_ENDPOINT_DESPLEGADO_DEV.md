# Resultado C2: endpoint desplegado en desarrollo

**Fecha:** 2026-08-31  
**Proyecto:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo, con datos ficticios; no es el proyecto de la landing.

## Alcance realizado

- Se aplicó únicamente en desarrollo `sql/006_public_form_rate_limit_idempotency.sql`.
- Se desplegó la Edge Function `receive-public-form`, versión 1, sin conectar
  formularios visuales, panel, Storage ni servicios externos.
- Ruta de desarrollo:
  `POST /functions/v1/receive-public-form/api/public/forms/:businessSlug/:formSlug/requests`.
- La función usa la RPC transaccional ya preparada y no permite escritura
  directa de `anon` ni `authenticated` en la RPC ni en las tablas operativas.

## Secretos de desarrollo configurados

Solo se registran nombres, nunca valores:

- `PUBLIC_FORM_IP_HASH_SECRET` (rotado durante C2).
- `PUBLIC_FORM_ALLOWED_ORIGINS`.
- `PUBLIC_FORM_RATE_LIMIT_MAX`.
- `PUBLIC_FORM_RATE_LIMIT_WINDOW_SECONDS`.

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` permanecen como secretos de
servidor de Edge Functions. Ninguno se ha escrito en el repositorio, la
documentación ni los logs de aplicación.

## Protecciones aplicadas

### Rate limiting

La tabla `public_form_rate_limit_windows` registra solo un hash HMAC del origen,
junto a negocio, formulario y ventana. No guarda IP en claro. En desarrollo se
validó el límite configurado: tres envíos distintos aceptados dentro de la
ventana y el cuarto rechazado con HTTP `429`.

### Idempotencia

La tabla `public_form_idempotency_keys` guarda hashes de la clave de envío y del
payload durante 24 horas. Un reintento idéntico devuelve HTTP `200` y la misma
referencia, sin crear otra solicitud. La misma clave con payload distinto se
rechaza con HTTP `422`.

### CORS

La función admite solo la lista de orígenes de desarrollo configurada. Se
comprobó un preflight permitido con HTTP `204` y un origen ajeno rechazado con
HTTP `403`. No se utiliza `*`.

## Pruebas HTTP reales

Todas las pruebas se ejecutaron contra el proyecto de desarrollo con contactos
ficticios `@solicitudpro.test`:

| Grupo | Resultado |
| --- | --- |
| Negocio o formulario inexistente | HTTP `404` seguro |
| Formulario temporalmente no publicado | HTTP `404` seguro; restaurado a publicado |
| Contacto sin email ni teléfono | HTTP `422` |
| Campo obligatorio ausente | HTTP `422` |
| Campo desconocido | HTTP `422` |
| Opción de select no permitida | HTTP `422`; configuración restaurada |
| `business_id`, `status`, `priority` o `assigned_to` enviados por cliente | HTTP `422` |
| Envío válido de Reformas | HTTP `201`, referencia `REF-001` |
| Envío válido de Academias | HTTP `201`, referencia `ACA-001` |
| Reintento idéntico | HTTP `200`, sin duplicado |
| Misma clave y payload distinto | HTTP `422` |
| Límite de envíos | tres `201` y cuarto `429` |
| CORS permitido / no permitido | `204` / `403` |

La validación posterior confirmó cinco solicitudes C2 completas, cinco
contactos, diez respuestas dinámicas, cinco seguimientos y cinco actividades.
No se detectaron asociaciones entre negocios distintos.

## Seguridad de base de datos

- Las 16 tablas actuales tienen RLS activada, incluidos los dos registros de
  protección añadidos en C2.
- No existen políticas `anon` en tablas operativas.
- La RPC de ocho parámetros es ejecutable por `service_role`, no por `anon` ni
  por `authenticated`.
- Los avisos de "RLS sin política" de las dos tablas de protección son
  intencionados: solo las utiliza el servidor con rol de servicio.

## Incidencias y correcciones

La comprobación inicial de resultados filtró por el valor antiguo de `source`
`public_form`; la RPC almacena `form`. Se corrigió la consulta de validación,
sin modificar datos ni lógica. También se detectó que el esquema aplicado usa
`form_fields.display_order`, no `position`; fue una diferencia de consulta de
auditoría, no del endpoint.

## Riesgos pendientes

1. Activar la protección contra contraseñas filtradas de Supabase Auth sigue
   pendiente de ajuste en consola.
2. Antes de tráfico real: añadir honeypot y evaluar CAPTCHA, fijar orígenes
   finales, aplicar retención de hashes y revisar la carga bajo concurrencia.
3. Los avisos de claves foráneas sin índice del asesor de rendimiento se dejan
   para una revisión posterior: no afectan a este endpoint MVP ni justifican
   añadir índices no medidos durante C2.

## Ajuste posterior de C3

C3 detectó que el preflight CORS de la versión inicial no incluía el encabezado
obligatorio `Idempotency-Key`. Se actualizó exclusivamente la Edge Function de
desarrollo a la versión 2 para permitir `content-type, idempotency-key`. El
preflight desde `http://localhost:3000` respondió después con HTTP `204` y el
formulario aislado pudo enviar solicitudes válidas. No se modificaron RLS,
esquema, datos de la demo ni ningún proyecto de landing.

## Siguiente paso recomendado

Crear un formulario aislado de desarrollo que consuma esta ruta sin alterar la
demo visual, o conectar una lectura interna mínima del panel a Supabase. En
ambos casos, mantener este endpoint como única vía pública de escritura.
