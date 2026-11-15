# Recepción segura de formularios MVP

> C2 ha desplegado y validado este endpoint exclusivamente en
> `solicitudpro-app-dev`. Sigue sin estar conectado a un formulario visual, a
> la demo local o a producción, y no se ha concedido acceso `anon` a Supabase.

## Objetivo

Recibir una solicitud pública desde el formulario de un negocio sin exponer
tablas operativas ni confiar en identificadores enviados por el navegador. El
resultado debe crear, en una única transacción, el contacto, la solicitud, las
respuestas dinámicas, una primera actividad y, si la configuración lo indica,
un seguimiento inicial.

## Contrato propuesto

- **Ruta prevista:** `POST /api/public/forms/:businessSlug/:formSlug/requests`
- **Autenticación del cliente:** ninguna. La seguridad no depende de que el
  cliente oculte la URL.
- **Identificación segura:** el servidor busca `businesses.slug` y un
  `form_configs.public_slug` publicado dentro de ese negocio.
- **Respuesta correcta:** `201 Created` con una referencia pública y un mensaje
  de confirmación. No devolver datos internos ni el identificador de negocio.

El endpoint podrá vivir más adelante en una función de servidor o Edge Function
revisada. No debe ser una inserción directa desde el navegador a PostgREST.

## Entrada permitida

```json
{
  "contact": {
    "display_name": "María López",
    "email": "maria@example.test",
    "phone": "+34 600 000 000"
  },
  "answers": {
    "tipo_reforma": "baño",
    "zona": "Valencia",
    "descripcion": "Quiero renovar un baño pequeño"
  },
  "privacy_notice_version": "2026-08"
}
```

El contrato no admite `business_id`, `sector_id`, `form_config_id`, `status`,
`reference`, `assigned_to`, fechas, actividad, plantillas, rutas de adjuntos ni
identificadores de respuestas. Todos esos valores se resuelven o calculan en el
servidor.

## Validación y proceso interno

1. Normalizar los slugs de la ruta y buscar el negocio activo.
2. Buscar exclusivamente una configuración de formulario `published` con el
   `public_slug` indicado, perteneciente a ese negocio.
3. Leer sus `form_fields` activos y validar tipos, opciones, requeridos,
   longitudes y campos desconocidos. Guardar la etiqueta vigente como snapshot.
4. Validar `display_name` y al menos uno entre email o teléfono. Normalizar
   espacios, email y teléfono antes de buscar un contacto existente.
5. Reutilizar un contacto solo con coincidencia inequívoca dentro del mismo
   negocio; si hay ambigüedad, crear uno nuevo y dejar revisión interna. Nunca
   buscar ni fusionar contactos de otro negocio.
6. Crear la solicitud con el `business_id`, `sector_id` y `form_config_id`
   derivados. El estado inicial es `Nuevo`; prioridad, resumen, respuesta y
   asignación no vienen del cliente.
7. Generar la referencia en servidor. La operación C1 bloquea la fila del
   negocio durante la secuencia y respeta la restricción única
   `(business_id, reference)`, por lo que serializa la generación por negocio
   en este MVP. Si el volumen crece, se sustituirá por un contador dedicado.
8. Insertar `request_custom_answers`, la actividad `public_form` y, solo si la
   regla de negocio publicada lo define, un `follow_up` inicial.
9. Confirmar toda la transacción o revertirla por completo. Actualizar
   `requests.next_action` y `next_follow_up_at` dentro de la misma operación si
   se creó un seguimiento.

## Errores públicos

| Caso | HTTP | Respuesta segura |
| --- | --- | --- |
| JSON o datos comunes inválidos | 400 | `No hemos podido validar la solicitud.` |
| Negocio o formulario no publicado | 404 | `Este formulario no está disponible.` |
| Campo requerido, tipo u opción inválida | 422 | Errores solo por `field_key`, sin datos internos. |
| Límite de envíos alcanzado | 429 | `Inténtalo de nuevo más tarde.` |
| Error inesperado | 500 | `No se pudo enviar la solicitud. Inténtalo de nuevo.` |

No exponer errores SQL, IDs, reglas internas, miembros, ni si un contacto ya
existe en el negocio.

## Protección frente a abuso

- Límite inicial recomendado: por IP y formulario, con ventana corta y límite
  bajo; la cifra exacta se decidirá con el proveedor que implemente el endpoint.
- Limitar tamaño del cuerpo, número de respuestas, longitud de texto y número
  de intentos fallidos antes de procesar la transacción.
- Preparar honeypot y tiempo mínimo de cumplimentación. Evaluar CAPTCHA o
  Turnstile antes de abrir formularios al tráfico real.
- Aplicar CORS por lista explícita de orígenes del formulario. No usar `*` con
  credenciales ni aceptar `Origin` sin validarlo. El preflight debe permitir
  tanto `Content-Type` como `Idempotency-Key`, porque la idempotencia forma
  parte obligatoria del contrato.
- La clave de servicio, si llegase a necesitarse, vive solo en el entorno de
  servidor. Nunca en el HTML, JavaScript público, localStorage o logs.

## RLS y ejecución privilegiada

Las políticas actuales no conceden inserción `anon` y deben mantenerse así. El
endpoint futuro se ejecutará con un contexto de servidor cuidadosamente
restringido, validará todos los slugs y realizará la transacción. No debe
aceptar un `business_id` proporcionado por el cliente ni reutilizar ciegamente
una credencial con privilegios de servicio para consultas arbitrarias.

## Registro seguro

Registrar solo: hora, formulario resuelto, resultado, código de error,
duración, contador de rate limit y una referencia de solicitud después de crearla.
No registrar cuerpo completo, email, teléfono, textos de la solicitud, adjuntos,
tokens, cabeceras de autorización, IP completa ni secretos. Cuando exista una
solución de observabilidad, aplicar retención corta y acceso restringido.

## Datos que no se piden ni guardan

No aceptar contraseñas, tokens, claves, datos bancarios, diagnósticos, informes
médicos ni datos sensibles de menores. Los adjuntos no se incluyen hasta que
Storage privado y sus políticas se diseñen en una fase separada.

## Pruebas necesarias antes de activar el endpoint

1. Slug de negocio y formulario válidos, inválidos, archivados y de otro tenant.
2. Campos requeridos, opciones inválidas, claves desconocidas y normalización.
3. Dos envíos simultáneos: no repetir `reference` ni dejar datos a medias.
4. Aislamiento completo: no crear ni consultar datos de otro `business_id`.
5. Reutilización de contacto segura y caso ambiguo sin fusión automática.
6. Rollback si falla una respuesta, actividad o seguimiento.
7. Rate limit, honeypot, CORS y respuesta sin filtración de información.
8. Verificación de que `anon` sigue sin insertar directamente en tablas.
9. Auditoría de logs: ningún dato sensible ni secreto.

## Estado C2 y riesgos abiertos

La operación SQL `submit_public_form_submission` está aplicada solo en
`solicitudpro-app-dev` y el manejador de servidor está preparado localmente en
`supabase/functions/receive-public-form/index.ts`. La Edge Function
`receive-public-form` está desplegada solo en ese proyecto de desarrollo y
acepta la ruta prevista bajo `/functions/v1/receive-public-form`.

C2 añade tres defensas de servidor que no abren acceso directo a PostgREST:

- límite persistente por negocio, formulario, origen hasheado y ventana;
- idempotencia de 24 horas con `Idempotency-Key`, que devuelve el mismo
  resultado ante un reintento y rechaza una reutilización con otro payload;
- CORS con lista explícita de orígenes de desarrollo.

Los secretos de estas defensas existen solo en la configuración del proyecto
de desarrollo y nunca se guardan en este repositorio. Las tablas de apoyo usan
RLS sin políticas públicas y la RPC continúa siendo ejecutable solo por
`service_role` desde la función.

Siguen pendientes antes de tráfico real: un mecanismo anti-spam adicional
(honeypot y evaluación de CAPTCHA), configuración de orígenes finales, una
política de retención para los registros de límite/idempotencia y observabilidad
con acceso restringido. Ninguna de estas medidas está conectada a la demo
actual.
