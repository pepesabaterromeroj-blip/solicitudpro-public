# Resultado B3: Supabase de desarrollo

**Fecha:** 31 de agosto de 2026  
**Proyecto:** `solicitudpro-app-dev`  
**Referencia del proyecto:** `rinrgjancwvcvpzjyqmu`  
**Organización:** `pepesabaterromeroj-blip's Org`  
**Entorno:** desarrollo, creado para validar el modelo de datos de SolicitudPro. No es el proyecto de la landing y no contiene datos reales.

## Alcance ejecutado

Se aplicaron en este orden los archivos locales revisados:

1. `001_initial_schema.sql`
2. `003_seed_sectors.sql`
3. Datos ficticios mínimos de validación
4. `002_rls_policies_draft.sql`

No se conectaron formularios públicos, backend, Storage, n8n, Gmail, Resend ni Google Sheets. Tampoco se modificaron la demo local ni la landing.

## Esquema creado

Se crearon las 14 tablas de primera migración:

- `sectors`
- `businesses`
- `business_settings`
- `profiles`
- `business_users`
- `contacts`
- `form_configs`
- `form_fields`
- `requests`
- `request_custom_answers`
- `follow_ups`
- `activities`
- `attachments`
- `email_templates`

Se verificó que no existen `email_logs` ni `automation_logs`, que se mantienen para una segunda migración.

## Seeds y datos de prueba

El seed de sectores se ejecutó dos veces. El segundo paso confirmó que es idempotente: permanecen exactamente estos cuatro sectores activos, sin duplicados:

- `reformas`
- `electricidad`
- `fontaneria`
- `academias`

Se crearon tres usuarios ficticios de Supabase Auth con confirmación automática:

- `owner.reformas.dev@solicitudpro.test`
- `owner.academia.dev@solicitudpro.test`
- `viewer.dev@solicitudpro.test`

Se prepararon dos negocios ficticios:

| Negocio | Sector | Usuario principal |
| --- | --- | --- |
| Reformas Demo Dev | Reformas | Owner Reformas Dev |
| Academia Demo Dev | Academias | Owner Academia Dev |

El visor pertenece solo a Reformas Demo Dev. Cada negocio cuenta con un contacto, un formulario publicado, dos campos, una solicitud, dos respuestas dinámicas, un seguimiento, una actividad y un metadato de adjunto. Los adjuntos son solo rutas ficticias de metadatos: no se creó ni utilizó Storage.

## Constraints comprobadas

Las pruebas se ejecutaron dentro de transacciones revertidas cuando insertaban datos inválidos. Todas bloquearon correctamente:

- contactos sin email ni teléfono;
- rol fuera de `owner`, `member`, `viewer`;
- estado de formulario inválido;
- estado comercial de solicitud inválido;
- prioridad fuera de 1 a 3;
- referencia duplicada dentro del mismo negocio;
- `public_slug` duplicado dentro del mismo negocio;
- respuesta dinámica duplicada para la misma clave y solicitud;
- solicitud Ganada sin `won_at`;
- seguimiento pendiente con `completed_at`;
- seguimiento completado sin `completed_at`.

También se validaron las claves foráneas compuestas. No se puede:

- crear una solicitud con un contacto de otro negocio;
- añadir una respuesta dinámica a una solicitud de otro negocio;
- crear un seguimiento asociado a la solicitud de otro negocio;
- falsear una actividad usando un usuario que no pertenece al negocio.

## RLS y aislamiento multiempresa

Se habilitó RLS en las 14 tablas públicas y se crearon 36 políticas. Las políticas no incluyen acceso `anon` ni políticas abiertas de formularios públicos.

Las pruebas se hicieron con los IDs de usuarios reales de Auth y contexto PostgreSQL autenticado (`authenticated` más `auth.uid()`), sin usar credenciales ni claves en archivos.

Resultados confirmados:

- El propietario de Reformas solo ve `reformas-demo-dev`, `REF-DEV-001` y el metadato de adjunto de Reformas.
- El propietario de Academia solo ve `academia-demo-dev`, `ACA-DEV-001` y el metadato de adjunto de Academia.
- El visor de Reformas puede leer únicamente los datos de Reformas; no puede insertar contactos ni actualizar solicitudes.
- Un miembro puede insertar contactos y actualizar solicitudes. Esta prueba usó temporalmente el propietario de Academia como `member` dentro de una transacción revertida; el rol quedó restaurado como `owner`.
- Un propietario puede insertar contactos y actualizar solicitudes de su propio negocio.
- Un propietario no puede registrar una actividad atribuyéndola a un usuario de otro negocio.
- El rol `anon` no ve sectores, negocios, solicitudes, contactos ni metadatos de adjuntos.

Esta es una validación de RLS a nivel de base de datos. Queda pendiente, cuando exista una aplicación autenticada, una prueba de extremo a extremo mediante sesión real del cliente/API.

## Errores y correcciones durante B3

No se detectaron errores en el esquema ni en las políticas aplicadas.

Durante las consultas de validación se corrigieron dos incidencias del propio harness de pruebas, sin modificar el esquema:

1. Una consulta usaba un alias SQL fuera de su subconsulta.
2. Las tablas temporales de resultados necesitaban permiso explícito para el rol `authenticated` durante las pruebas.

Ambas pruebas se repitieron correctamente dentro de transacciones revertidas.

## Avisos y riesgos pendientes

Los asesores de Supabase no detectaron políticas RLS expuestas ni acceso público a las tablas operativas. Sí señalaron:

1. **Protección de contraseñas filtradas desactivada.** Es una configuración de Auth del proyecto y conviene activarla antes de crear usuarios reales.
2. **Índices para algunas claves foráneas compuestas.** Son avisos de rendimiento no bloqueantes para este entorno de desarrollo. Antes de producción conviene revisar una migración adicional para las relaciones de actividad, adjuntos, seguimientos, formularios y respuestas dinámicas que no tengan índice de cobertura suficiente.

Además, el alta de negocios, miembros y formularios públicos sigue deliberadamente fuera del cliente. El formulario público deberá pasar más adelante por un backend o endpoint seguro que derive el negocio desde una URL validada, sin permitir que el cliente envíe un `business_id` arbitrario.

## Próximo paso recomendado

Mantener este proyecto solo para desarrollo y realizar una breve Fase B4 antes de conectar el panel:

1. Decidir y aplicar los índices de rendimiento adicionales que sean necesarios.
2. Activar la protección de contraseñas filtradas antes de usuarios reales.
3. Diseñar un endpoint seguro para recepción de formulario público, sin política `anon` directa sobre tablas operativas.
4. Conectar el panel de forma progresiva, empezando por lectura autenticada de solicitudes y contactos.

