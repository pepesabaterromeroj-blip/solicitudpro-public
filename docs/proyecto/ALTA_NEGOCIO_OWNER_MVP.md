# Alta manual de negocio y owner MVP

> Proceso de desarrollo previo a un onboarding real. No crea usuarios, negocio,
> formulario ni panel automáticamente.

## Objetivo

Dar de alta un negocio aislado con un owner y un formulario inicial, respetando
el modelo multiempresa: `business_id` es siempre el límite de datos y permisos.
Cada negocio tiene un único sector principal durante el MVP.

## Datos que decidir antes del alta

- Nombre comercial, sector, `businesses.slug` globalmente único y zona general.
- Email operativo, zona horaria y estado inicial (`trial` o `active`).
- Usuario owner y nombre visible.
- `form_configs.public_slug` único dentro del negocio, título, confirmación y
  versión inicial.
- Campos desde el preset del sector y plantillas de email que se quieran
  preparar. No se habilita envío de correo en este proceso.

## Proceso manual de desarrollo

1. **Crear el usuario Auth.** Usar el panel de Supabase o una herramienta de
   administración restringida. No crear cuentas desde el navegador público. En
   desarrollo, confirmar el email solo cuando el flujo de prueba lo requiera.
2. **Crear `profiles`.** Insertar una fila cuyo `id` sea exactamente el UUID de
   `auth.users.id`; guardar únicamente un `display_name` de aplicación.
3. **Crear `businesses`.** Resolver `sector_id` desde `sectors.slug`; guardar
   slug, contacto operativo y estado. No guardar secretos en este registro.
4. **Crear `business_users`.** Insertar la relación `(business_id, user_id)`
   con rol `owner` e `is_active = true`.
5. **Crear `business_settings` mínimo.** Solo preferencias de bajo riesgo; no
   almacenar permisos, contraseñas, tokens, ni plantillas extensas.
6. **Crear `form_configs`.** Crear la versión inicial como `draft`, añadir
   campos y publicar tras verificar el contenido. Al publicar el predeterminado,
   respetar el índice que permite un solo formulario publicado por defecto.
7. **Crear `form_fields`.** Copiar las claves estables del preset del sector,
   con opciones, validación y orden. No reutilizar `field_key` para significados
   distintos entre versiones.
8. **Crear `email_templates` si aportan valor.** Son contenido preparado; no
   conectan Gmail, Resend ni ningún proveedor.
9. **Validar RLS.** Con una sesión real del owner, confirmar que solo lee y
   edita su negocio. Añadir un segundo negocio de prueba y comprobar que no se
   puede leer ni asociar sus contactos, solicitudes o adjuntos.

## Controles obligatorios

- La creación de negocio, owner y membresía debe ejecutarse de forma
  transaccional desde una herramienta de administración segura cuando deje de
  ser manual. Si falla un paso, no puede quedar un negocio sin owner.
- Antes de publicar, verificar `businesses.slug` y
  `(business_id, form_configs.public_slug)` contra sus constraints únicas.
- El owner se crea con rol `owner`; `member` y `viewer` se añaden después por
  flujo restringido. El rol `viewer` nunca recibe permisos de escritura.
- No se crea ninguna política `anon` en este procedimiento. El formulario
  público esperará al endpoint diseñado en `API_RECEPCION_FORMULARIOS_MVP.md`.

## Qué será manual al principio

Crear Auth user, profile, business, owner, configuración de formulario, campos
de preset, plantillas y pruebas de RLS. Esta limitación es intencional mientras
no exista un backoffice seguro ni un onboarding aprobado.

## Qué se automatizará después

Un flujo interno autenticado podrá aprovisionar la secuencia completa, guardar
actividad de alta y preparar las configuraciones de sector. La automatización
debe validar permisos de operador y usar secretos solo en entorno servidor; no
se implementa en este MVP de base de datos.

## Checklist de validación

1. Owner puede leer el negocio y configuración propia.
2. Owner puede crear y actualizar solicitudes, contactos y seguimientos propios.
3. Owner no puede leer ni editar datos de otro negocio.
4. Viewer de prueba puede leer, pero no crear ni actualizar.
5. Slugs y campos del formulario respetan las restricciones del esquema.
6. No se expusieron rutas de Storage, credenciales, tokens ni proveedores de
   correo.
