# Resultado C1: endpoint de formularios en desarrollo

**Fecha:** 31 de agosto de 2026  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo con datos ficticios. No es el proyecto de la landing
`pepesabaterromeroj-blip's Project` y no contiene datos reales de clientes.

## Arquitectura aplicada

Se preparó una función de servidor local en
`supabase/functions/receive-public-form/index.ts` para la ruta prevista:

`POST /api/public/forms/:businessSlug/:formSlug/requests`

La función nunca recibe ni confía en `business_id`, estado, prioridad o
asignación. Resuelve el negocio por `businesses.slug`, el formulario publicado
por `form_configs.public_slug` y llama con credenciales de servidor a la
operación transaccional de PostgreSQL
`public.submit_public_form_submission(text, text, jsonb)`.

La función de servidor **no se ha desplegado** y la ruta no está pública. Antes
de exponerla habrá que decidir cómo mapear esa ruta a la función de borde o al
backend elegido. Las tablas siguen sin políticas `anon`.

## Datos aceptados y validaciones

El cuerpo admite únicamente `contact`, `answers`, `metadata` y
`privacy_notice_version`. Se exige nombre y al menos email o teléfono. La
operación SQL valida negocio activo, formulario publicado, campos activos,
requeridos, tipo, longitud y opciones de selección. Los campos desconocidos se
rechazan para evitar que el navegador inserte valores internos.

En una sola transacción crea o reutiliza de forma no ambigua el contacto y
crea:

1. `requests` con estado `Nuevo` y referencia por sector.
2. `request_custom_answers` con el snapshot de cada campo.
3. Un `follow_ups` pendiente a 24 horas.
4. Una `activities` de recepción desde formulario público.

La referencia usa el prefijo del sector y una secuencia serializada por la fila
del negocio. La restricción única por negocio sigue siendo la garantía final.

## Índices y SQL aplicados

- Los nueve índices de `sql/004_indexes_review.sql` se aplicaron únicamente en
  `solicitudpro-app-dev`.
- La operación de `sql/005_public_form_submission_rpc.sql` se aplicó únicamente
  en `solicitudpro-app-dev`.
- El aplicador de migraciones del conector separó los cuerpos PL/pgSQL antes de
  enviarlos a PostgreSQL. Tras verificar que no había función parcial, `005` se
  ejecutó mediante el ejecutor SQL directo del mismo proyecto. El archivo local
  continúa siendo la fuente de verdad y el resultado queda documentado aquí.
- La creación inicial heredó permisos de ejecución de Supabase para `anon` y
  `authenticated`. Se detectó en la revisión posterior, se revocó
  explícitamente y se comprobó que solo `service_role` puede ejecutar la
  operación.

No se añadieron tablas, políticas `anon`, Storage, logs de email ni
automatizaciones.

## Pruebas realizadas

Todas se ejecutaron dentro de una transacción finalizada con `ROLLBACK`, por lo
que no dejaron solicitudes nuevas de prueba.

- Una solicitud válida creó contacto, solicitud, dos respuestas dinámicas,
  seguimiento pendiente y actividad inicial.
- Un segundo envío con el mismo email reutilizó el contacto dentro del mismo
  negocio.
- Se rechazaron negocio inexistente, formulario inexistente y formulario no
  publicado.
- Se rechazaron contacto sin email ni teléfono, campo obligatorio ausente,
  campo desconocido, opción de selección no permitida y claves superiores
  manipulables como `business_id`, `status` o `assigned_to`.
- Se rechazó usar el formulario de academias desde el negocio de reformas.
- La prueba local del contrato del manejador y la función SQL pasó.

## Seguridad y límites

- La clave `SUPABASE_SERVICE_ROLE_KEY` solo se lee desde el entorno de la
  función de servidor. No está en la demo ni en el frontend.
- CORS se limita a orígenes de desarrollo explícitos o a
  `PUBLIC_FORM_ALLOWED_ORIGINS` cuando se configure en el entorno de servidor.
- El cuerpo se limita a 32 KiB y no se registran nombres, email, teléfono ni
  respuestas completas.
- No hay rate limiting persistente, honeypot, CAPTCHA ni clave de idempotencia
  todavía. Son obligatorios antes de exponer el endpoint a tráfico público.
- No se conectaron formularios reales, panel, Storage, n8n, Gmail, Resend,
  Google Sheets ni ninguna otra integración externa.

## Próximo paso recomendado

Hacer C2: elegir y desplegar en un entorno de desarrollo el runtime del
endpoint, añadir rate limiting e idempotencia, configurar una lista estricta de
orígenes y ejecutar pruebas HTTP reales. Solo después conviene conectar un
formulario de prueba aislado; el panel interno sigue fuera de alcance.
