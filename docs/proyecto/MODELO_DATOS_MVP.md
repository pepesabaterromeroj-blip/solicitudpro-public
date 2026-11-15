# Modelo de datos MVP para SolicitudPro

> Documento de diseño previo a Supabase. No crea tablas, no ejecuta SQL, no
> activa RLS, no conecta automatizaciones ni modifica la demo local.

## 1. Objetivo

Definir una base de datos PostgreSQL compatible con Supabase para que
SolicitudPro pueda evolucionar de demo local a producto SaaS sin perder su
flujo central:

```text
solicitud -> datos organizados -> respuesta preparada -> seguimiento
```

El modelo debe separar por completo los datos de cada negocio, admitir campos
propios por sector y mantener el producto acotado: no incluye facturación,
inventario, pagos ni un CRM avanzado.

## 2. Principios de diseño

1. **Aislamiento por negocio.** `business_id` identifica al propietario de casi
   todo dato operativo.
2. **Datos comunes en columnas, datos sectoriales en respuestas dinámicas.**
   Una solicitud conserva los campos necesarios para operar y filtrar; las
   respuestas específicas de Reformas, Electricidad, Fontanería o Academias se
   guardan fuera de `requests`.
3. **Historial antes que sobrescritura silenciosa.** Cambios de estado, emails,
   seguimientos y automatizaciones dejan actividad auditable.
4. **Formularios versionados.** Una solicitud conserva el formulario con el que
   fue creada, aunque el negocio cambie campos después.
5. **Archivos fuera de PostgreSQL.** La base guarda metadatos y una ruta privada;
   los archivos irían más adelante a Supabase Storage.
6. **Sin secretos en tablas.** Credenciales, tokens y claves viven fuera de la
   base de datos pública, en configuración segura de servidor.
7. **Preparado para RLS.** Las tablas de negocio incluyen `business_id` incluso
   cuando se puede deducir por una relación padre.

## 3. Decisiones recomendadas para el MVP

| Decisión | Recomendación | Motivo |
| --- | --- | --- |
| Identificadores | `uuid` | Seguro para URLs y adecuado para Supabase. |
| Fechas | `timestamptz` | Evita ambigüedades de zona horaria. |
| Estados | `text` con `check` controlado | Más sencillo de evolucionar que un enum y menos complejo que una tabla editable. |
| Campos sectoriales | `form_fields` + `request_custom_answers` | Evita columnas vacías o específicas de un único sector. |
| Opciones de campos | `jsonb` | Sirve para select, multiselección y reglas simples sin crear tablas por opción. |
| Respuestas dinámicas | `value_jsonb` y una copia `value_text` | Preserva el tipo y permite buscar o exportar valores simples. |
| Resumen y respuesta actual | Columnas en `requests` | Son datos operativos que el panel necesita mostrar y filtrar con rapidez. |
| Configuración variable | `business_settings.settings jsonb` | Mantiene `businesses` legible y evita una tabla de ajustes por cada opción. |

### Estados comerciales

Para el MVP, `requests.status` debería ser `text not null` con una restricción
de valores permitidos:

```text
Nuevo
En preparación
Enviado
Seguimiento pendiente
Ganado
Perdido
```

No se recomienda un enum PostgreSQL todavía: una modificación de enum implica
migraciones menos flexibles. Tampoco se recomienda una tabla editable de
estados en la primera versión, porque añadiría configuración comercial antes de
validar el flujo. Las etiquetas como `Foto pendiente` o `Horario pendiente` no
son estados: se derivan de respuestas y reglas del sector.

## 4. Diferencia entre sector y negocio

| Concepto | Ejemplo | Uso |
| --- | --- | --- |
| `sectors` | `fontaneria` | Preset reutilizable: campos base, copy y reglas recomendadas. |
| `businesses` | Fontanería Martínez | Cliente real de SolicitudPro, con usuarios y datos propios. |
| `form_configs` | Formulario de incidencias de Fontanería Martínez | Adaptación publicada de un preset al negocio concreto. |

Un sector puede tener muchos negocios. Cada negocio parte de un sector principal
pero puede personalizar formularios, textos, servicios y seguimientos sin
afectar a los demás.

## 5. Diagrama textual de relaciones

```text
sectors
  └── businesses (sector_id)
        ├── business_settings (1:1)
        ├── business_users ─── users/perfiles internos
        ├── form_configs
        │     └── form_fields
        ├── contacts
        ├── requests (contact_id, form_config_id, assigned_to)
        │     ├── request_custom_answers (form_field_id)
        │     ├── attachments
        │     ├── follow_ups
        │     ├── activities
        │     ├── email_logs
        │     └── automation_logs
        └── email_templates
```

`business_id` se replica en las tablas operativas para aplicar RLS de forma
directa. En la migración real se deben añadir claves foráneas compuestas o
validaciones de servidor que garanticen que un `request_id`, `contact_id` o
`form_config_id` pertenece al mismo negocio.

## 6. Tablas principales

### 6.1 `sectors`

Catálogo global de presets. No pertenece a un negocio.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador interno. |
| `slug` | `text` | Sí | Identificador estable: `reformas`, `electricidad`, `fontaneria`, `academias`. |
| `name` | `text` | Sí | Nombre visible. |
| `description` | `text` | No | Explicación del preset. |
| `is_active` | `boolean` | Sí | Permite retirar un preset sin borrar históricos. |
| `created_at` | `timestamptz` | Sí | Alta del preset. |
| `updated_at` | `timestamptz` | Sí | Última edición. |

Índices: único en `slug`; índice en `is_active` solo si el catálogo crece.

### 6.2 `businesses`

Representa al negocio que contrata SolicitudPro.

| Columna | PostgreSQL | Obligatoria | Descripción y ejemplo |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador del tenant. |
| `sector_id` | `uuid` FK `sectors.id` | Sí | Sector principal. Ejemplo: Fontanería. |
| `name` | `text` | Sí | Nombre comercial: `Fontanería Martínez`. |
| `slug` | `text` | Sí | Identificador futuro para URL o subdominio. |
| `contact_email` | `text` | Sí | Email operativo del negocio. |
| `contact_phone` | `text` | No | Teléfono operativo. |
| `service_area` | `text` | No | Zona general de servicio, no dirección sensible. |
| `timezone` | `text` | Sí | Inicialmente `Europe/Madrid`. |
| `status` | `text` | Sí | `active`, `trial`, `paused` o `archived`. |
| `created_at` | `timestamptz` | Sí | Alta. |
| `updated_at` | `timestamptz` | Sí | Última edición. |

Índices: único en `slug`; índice en `sector_id`; índice en `status` si hay
administración interna. `businesses` no lleva `business_id` porque es el origen
de la separación.

### 6.3 `business_settings`

Configuración 1:1 que no conviene mezclar con los datos comerciales estables del
negocio.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `business_id` | `uuid` PK/FK `businesses.id` | Sí | Propietario. |
| `settings` | `jsonb` | Sí | Preferencias no críticas: tono, canales visibles, reglas por defecto, logo futuro o textos cortos. |
| `updated_by` | `uuid` FK `users.id` | No | Último usuario interno que cambió la configuración. |
| `updated_at` | `timestamptz` | Sí | Última modificación. |

No guardar aquí secretos, credenciales de proveedores ni datos de pago. Los
textos largos del formulario van en `form_configs`; los emails, en
`email_templates`.

### 6.4 `users` y `business_users`

`users` será el perfil de aplicación asociado en el futuro a `auth.users` de
Supabase. No se duplica contraseña, sesión ni proveedor de autenticación.

**`users`**

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` PK | Sí | Futuro FK a `auth.users.id`. |
| `display_name` | `text` | No | Nombre para actividad. |
| `created_at` | `timestamptz` | Sí | Alta del perfil. |
| `updated_at` | `timestamptz` | Sí | Última edición. |

**`business_users`**

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `business_id` | `uuid` FK | Sí | Negocio al que puede acceder. |
| `user_id` | `uuid` FK | Sí | Usuario interno. |
| `role` | `text` | Sí | `owner`, `member`, `collaborator` o `viewer`. |
| `is_active` | `boolean` | Sí | Revoca acceso sin borrar historia. |
| `created_at` | `timestamptz` | Sí | Fecha de invitación/alta. |

Clave primaria recomendada: `(business_id, user_id)`. Índices adicionales:
`user_id` y `(business_id, role)`.

### 6.5 `contacts`

Contacto final de un negocio. Un mismo email o nombre puede existir en otro
negocio sin relación alguna.

| Columna | PostgreSQL | Obligatoria | Descripción y ejemplo |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento del contacto. |
| `display_name` | `text` | Sí | `María López` o `Comunidad Olmo`. |
| `email` | `text` | No | Medio de respuesta. |
| `phone` | `text` | No | Teléfono normalizado por servidor más adelante. |
| `source` | `text` | No | Primer origen: `form`, `whatsapp_manual`, `phone`, `email`. |
| `notes` | `text` | No | Nota interna breve, no historial. |
| `privacy_notice_version` | `text` | No | Versión aceptada si el flujo legal lo exige. |
| `contact_consent_at` | `timestamptz` | No | Solo para consentimiento explícito que sea necesario. |
| `created_at` | `timestamptz` | Sí | Primera aparición. |
| `updated_at` | `timestamptz` | Sí | Último cambio. |

Índices: `business_id`; `(business_id, created_at desc)`; índices parciales de
`lower(email)` y de teléfono normalizado cuando no sean nulos. No imponer un
único global por email: puede faltar, cambiar o repetirse entre negocios.

### 6.6 `form_configs`

Versión publicable de un formulario de entrada para un negocio.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Negocio propietario. |
| `sector_id` | `uuid` FK | Sí | Sector de referencia. |
| `name` | `text` | Sí | Ejemplo: `Solicitud de incidencias`. |
| `slug` | `text` | Sí | Identificador público futuro, único dentro del negocio. |
| `version` | `integer` | Sí | Versión inmutable al publicar cambios. |
| `title` | `text` | Sí | Título del formulario. |
| `description` | `text` | No | Ayuda visible al cliente. |
| `confirmation_text` | `text` | Sí | Mensaje tras enviar. |
| `status` | `text` | Sí | `draft`, `published` o `archived`. |
| `is_default` | `boolean` | Sí | Formulario principal del negocio para ese sector. |
| `created_by` | `uuid` FK `users.id` | No | Autor interno. |
| `created_at` / `updated_at` | `timestamptz` | Sí | Auditoría básica. |

Índices: `business_id`; `(business_id, slug)` único; `(business_id, status)`;
índice parcial para `is_default = true`. Al cambiar campos de un formulario
publicado se crea una versión nueva, no se reescriben las solicitudes antiguas.

### 6.7 `form_fields`

Define los campos de una versión de formulario. Sirve tanto para presets
sectoriales como para personalización por negocio.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Refuerza RLS y consistencia. |
| `form_config_id` | `uuid` FK | Sí | Formulario propietario. |
| `field_key` | `text` | Sí | Clave estable: `tipo_reforma`, `agua_activa`, `materia`. |
| `label` | `text` | Sí | Etiqueta visible. |
| `help_text` | `text` | No | Texto de ayuda. |
| `field_type` | `text` | Sí | `text`, `textarea`, `select`, `multiselect`, `boolean`, `date`, `file`. |
| `options` | `jsonb` | No | Opciones ordenadas para selects. |
| `validation` | `jsonb` | No | Reglas simples: longitud, patrón, máximo de adjuntos. |
| `is_required` | `boolean` | Sí | Obligatorio en esa versión. |
| `display_order` | `integer` | Sí | Posición en el formulario. |
| `is_active` | `boolean` | Sí | Permite ocultar dentro de un borrador. |
| `created_at` / `updated_at` | `timestamptz` | Sí | Auditoría. |

Índices y restricciones: `(form_config_id, field_key)` único;
`(form_config_id, display_order)` único; `business_id`.

### 6.8 `requests`

Núcleo operativo. Conserva los campos comunes necesarios para mostrar bandejas,
filtrar, priorizar y seguir una oportunidad.

| Columna | PostgreSQL | Obligatoria | Descripción y ejemplo | Índice |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador de solicitud. | PK |
| `business_id` | `uuid` FK | Sí | Tenant propietario. | Sí |
| `contact_id` | `uuid` FK | Sí | Contacto final. | Sí |
| `sector_id` | `uuid` FK | Sí | Snapshot del sector de entrada. | Sí |
| `form_config_id` | `uuid` FK | No | Formulario y versión usados. | Sí |
| `reference` | `text` | Sí | Ejemplo: `FON-006`; único por negocio. | Único con `business_id` |
| `title` | `text` | No | Resumen corto operable. | No |
| `service` | `text` | Sí | Servicio principal: `Fuga`, `Reformas`. | Sí con `business_id` |
| `description` | `text` | Sí | Texto original o normalizado de la necesidad. | No en MVP |
| `status` | `text` | Sí | Uno de los seis estados comerciales. | Sí con `business_id` |
| `urgency` | `text` | No | Ejemplo: `Hoy`, `Este mes`. | Opcional |
| `priority` | `smallint` | Sí | 1 alta, 2 media, 3 baja; no sustituye urgencia. | Opcional |
| `source` | `text` | Sí | `form`, `whatsapp_manual`, `phone`, `email`, `import`. | Opcional |
| `assigned_to` | `uuid` FK `users.id` | No | Responsable interno futuro. | Sí con `business_id` |
| `internal_summary` | `text` | No | Resumen revisable por el negocio. | No |
| `suggested_reply` | `text` | No | Borrador de respuesta actual. | No |
| `suggested_questions` | `jsonb` | No | Lista de preguntas pendientes. | No |
| `next_action` | `text` | No | Acción próxima recomendada. | No |
| `next_follow_up_at` | `timestamptz` | No | Momento operativo del próximo seguimiento. | Sí con `business_id` |
| `last_contacted_at` | `timestamptz` | No | Último contacto efectivo. | No |
| `won_at` / `lost_at` | `timestamptz` | No | Fechas de cierre comercial. | No |
| `archived_at` | `timestamptz` | No | Archivado reversible. | No |
| `created_at` / `updated_at` | `timestamptz` | Sí | Auditoría. | Sí con `business_id` |

Índices mínimos:

```text
(business_id, status)
(business_id, created_at desc)
(business_id, next_follow_up_at)
(business_id, contact_id)
unique (business_id, reference)
```

No se crean columnas como `tipo_reforma`, `riesgo_electrico`, `agua_activa` o
`materia`: pertenecen a respuestas dinámicas.

### 6.9 `request_custom_answers`

Respuesta específica enviada en una solicitud. Mantiene el historial incluso si
el campo se renombra o deja de usarse después.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento y RLS. |
| `request_id` | `uuid` FK | Sí | Solicitud propietaria. |
| `form_field_id` | `uuid` FK | No | Campo original; puede ser nulo si se importó. |
| `field_key` | `text` | Sí | Snapshot estable del campo. |
| `label_snapshot` | `text` | No | Etiqueta que vio el cliente. |
| `value_jsonb` | `jsonb` | Sí | Valor tipado: texto, booleano, lista u objeto. |
| `value_text` | `text` | No | Versión simple para lista, exportación y búsqueda. |
| `created_at` | `timestamptz` | Sí | Momento de recepción. |

Restricciones e índices: único `(request_id, field_key)`; `business_id`;
`request_id`; opcional `(business_id, field_key, value_text)` solo tras medir
consultas reales.

### 6.10 `follow_ups`

Seguimientos programados o completados. `requests.next_follow_up_at` es una
denormalización útil para la bandeja; `follow_ups` conserva cada acción.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Tenant propietario. |
| `request_id` | `uuid` FK | Sí | Solicitud relacionada. |
| `assigned_to` | `uuid` FK `users.id` | No | Responsable futuro. |
| `due_at` | `timestamptz` | Sí | Fecha y hora previstas. |
| `cadence_hours` | `smallint` | No | 24, 48 o 72 si procede de una regla. |
| `channel` | `text` | No | `call`, `email`, `whatsapp_prepared`, `visit`, `internal`. |
| `action_text` | `text` | Sí | Ejemplo: confirmar acceso para visita. |
| `status` | `text` | Sí | `pending`, `completed`, `skipped` o `cancelled`. |
| `completed_at` | `timestamptz` | No | Cierre de la acción. |
| `completed_by` | `uuid` FK `users.id` | No | Usuario que la completó. |
| `completion_note` | `text` | No | Resultado breve. |
| `created_at` / `updated_at` | `timestamptz` | Sí | Auditoría. |

Índices: `(business_id, status, due_at)`; `request_id`; `(business_id,
assigned_to, due_at)` cuando exista asignación.

### 6.11 `activities`

Timeline inmutable y legible para el panel. No sustituye a logs técnicos.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento. |
| `request_id` | `uuid` FK | No | Solicitud relacionada. |
| `contact_id` | `uuid` FK | No | Contacto, si aplica sin solicitud. |
| `actor_user_id` | `uuid` FK `users.id` | No | Usuario interno o nulo para sistema. |
| `type` | `text` | Sí | `request_created`, `status_changed`, `follow_up_completed`, `email_logged`, etc. |
| `title` | `text` | Sí | Etiqueta corta visible. |
| `detail` | `text` | No | Contexto útil y no sensible. |
| `metadata` | `jsonb` | No | IDs y datos mínimos para enlazar, nunca secretos. |
| `created_at` | `timestamptz` | Sí | Orden de la cronología. |

Índices: `(business_id, request_id, created_at desc)`; `(business_id,
contact_id, created_at desc)`.

### 6.12 `attachments`

Metadatos de archivos asociados a una solicitud. El binario queda fuera de la
base de datos.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento y prefijo del bucket futuro. |
| `request_id` | `uuid` FK | Sí | Solicitud asociada. |
| `contact_id` | `uuid` FK | No | Útil para archivo genérico futuro. |
| `storage_path` | `text` | Sí | Ruta privada, no URL pública. |
| `file_name` | `text` | Sí | Nombre visible saneado. |
| `mime_type` | `text` | Sí | Ejemplo: `image/jpeg`. |
| `size_bytes` | `bigint` | Sí | Tamaño validado en servidor. |
| `uploaded_by` | `uuid` FK `users.id` | No | Nulo si lo subió un formulario público. |
| `source` | `text` | Sí | `public_form`, `internal_upload`, `import`. |
| `created_at` | `timestamptz` | Sí | Alta. |
| `deleted_at` | `timestamptz` | No | Borrado lógico y retención. |

Índices: `business_id`; `request_id`; único en `storage_path`.

Ruta futura recomendada: `businesses/{business_id}/requests/{request_id}/{id}`.
No generar URLs públicas permanentes: usar acceso autenticado o URLs firmadas
de corta duración. Validar tamaño, tipo permitido, contenido real y permisos
antes de completar la subida.

### 6.13 `email_templates`

Plantillas reutilizables del negocio, incluidas confirmación al cliente y aviso
interno.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Negocio propietario. |
| `sector_id` | `uuid` FK | No | Referencia a preset, si aplica. |
| `key` | `text` | Sí | `client_confirmation`, `internal_new_request`, `follow_up`. |
| `name` | `text` | Sí | Nombre visible. |
| `channel` | `text` | Sí | Inicialmente `email`; permite crecer sin otra tabla. |
| `subject_template` | `text` | No | Asunto con variables permitidas. |
| `body_template` | `text` | Sí | Cuerpo editable y seguro. |
| `is_active` | `boolean` | Sí | Activa o retirada. |
| `created_at` / `updated_at` | `timestamptz` | Sí | Auditoría. |

Restricción: único `(business_id, key)`. Las variables permitidas deben ser una
lista cerrada validada por servidor, por ejemplo `{{contact_name}}`,
`{{request_reference}}` o `{{next_action}}`.

### 6.14 `email_logs`

Registro de borradores, simulaciones y futuros envíos reales. Conserva una copia
del contenido usado, para que una plantilla editada no altere el historial.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento. |
| `request_id` | `uuid` FK | No | Solicitud vinculada. |
| `contact_id` | `uuid` FK | No | Destinatario relacionado. |
| `template_id` | `uuid` FK | No | Plantilla de origen. |
| `direction` | `text` | Sí | `outbound` o `internal`. |
| `recipient` | `text` | Sí | Destinatario mostrado. |
| `subject` | `text` | No | Asunto resuelto. |
| `body` | `text` | Sí | Copia del contenido preparado o enviado. |
| `status` | `text` | Sí | `draft`, `simulated`, `queued`, `sent`, `failed`, `cancelled`. |
| `provider` | `text` | Sí | `local_demo` inicialmente; luego proveedor real. |
| `provider_message_id` | `text` | No | Identificador del proveedor, si existe. |
| `error_message` | `text` | No | Error saneado, sin secretos. |
| `sent_at` | `timestamptz` | No | Envío real futuro. |
| `created_at` | `timestamptz` | Sí | Alta del registro. |

Índices: `business_id`; `(business_id, request_id, created_at desc)`;
`provider_message_id` parcial si no es nulo.

### 6.15 `automation_logs`

Auditoría técnica de trabajos futuros de servidor o n8n. No es la actividad
comercial que ve normalmente el negocio.

| Columna | PostgreSQL | Obligatoria | Descripción |
| --- | --- | --- | --- |
| `id` | `uuid` | Sí | Identificador. |
| `business_id` | `uuid` FK | Sí | Aislamiento. |
| `request_id` | `uuid` FK | No | Solicitud desencadenante. |
| `event_type` | `text` | Sí | `request_created`, `follow_up_due`, `email_requested`. |
| `workflow_name` | `text` | Sí | Nombre lógico, no URL ni secreto. |
| `status` | `text` | Sí | `queued`, `running`, `succeeded`, `failed`, `retrying`. |
| `attempt` | `smallint` | Sí | Número de intento. |
| `payload_summary` | `jsonb` | No | Resumen mínimo y saneado; nunca credenciales. |
| `error_code` | `text` | No | Código interno o proveedor. |
| `error_message` | `text` | No | Error seguro para diagnóstico. |
| `started_at` / `finished_at` | `timestamptz` | No | Duración del trabajo. |
| `created_at` | `timestamptz` | Sí | Alta. |

Índices: `(business_id, status, created_at desc)`; `request_id`; índice parcial
para `status in ('failed', 'retrying')` si se necesita una bandeja de errores.

## 7. Presencia de `business_id`

Debe estar en: `business_users`, `business_settings`, `contacts`,
`form_configs`, `form_fields`, `requests`, `request_custom_answers`,
`follow_ups`, `activities`, `attachments`, `email_templates`, `email_logs` y
`automation_logs`.

No se añade a `sectors`, porque es catálogo global, ni a `users`, porque un
usuario puede participar en varios negocios. En las tablas hijas parece
redundante, pero evita un error frecuente en SaaS: consultar una fila hija por
ID sin confirmar a qué negocio pertenece.

## 8. Formularios dinámicos sin columnas sectoriales

1. Un administrador elige un `sector` al crear un `business`.
2. Se crea un `form_config` a partir del preset del sector.
3. Sus `form_fields` quedan asociados a la versión del formulario.
4. La persona completa el formulario.
5. El servidor valida campos comunes y específicos.
6. Se crea `requests` con datos comunes.
7. Cada respuesta sectorial se guarda en `request_custom_answers`.

Ejemplo de respuesta de Fontanería:

| `request_id` | `field_key` | `value_jsonb` | `value_text` |
| --- | --- | --- | --- |
| FON-006 | `tipo_incidencia` | `"Fuga"` | Fuga |
| FON-006 | `agua_activa` | `true` | Sí |
| FON-006 | `zona` | `"Valencia"` | Valencia |

El `field_key` no cambia al traducir o retocar la etiqueta. `label_snapshot`
permite saber qué se mostró al cliente en aquel momento.

## 9. Ejemplos conceptuales por sector

Los IDs son abreviados para facilitar la lectura; en el producto real serían
UUID.

### Reformas: reforma de baño en Valencia

**`contacts`**: `business_id=REF-GARCIA`, `display_name=María López`,
`email=maria@example.com`, `phone=+34 600 111 222`.

**`requests`**: `business_id=REF-GARCIA`, `contact_id=CONTACTO-1`,
`sector_id=reformas`, `reference=REF-006`, `service=Reformas`,
`description=Reforma de baño en Valencia; quiere empezar en octubre y tiene fotos`,
`status=Nuevo`, `urgency=Este mes`, `next_action=Revisar fotos y valorar visita`.

**`request_custom_answers`**: `tipo_reforma=Baño`, `zona=Valencia`,
`plazo_deseado=Octubre`, `medidas=Por confirmar`.

**`attachments`**: `storage_path=businesses/REF-GARCIA/requests/REF-006/foto-1`,
`mime_type=image/jpeg`, `source=public_form`.

**`follow_ups`**: `due_at=+24h`, `channel=call`,
`action_text=Confirmar medidas y disponibilidad para visita`, `status=pending`.

**`activities`**: `type=request_created`, `title=Solicitud de reforma recibida`.

### Electricidad: cuadro eléctrico que salta

**`contacts`**: `business_id=ELE-LOPEZ`, `display_name=Carlos Pérez`,
`email=carlos@example.com`, `phone=+34 600 222 333`.

**`requests`**: `reference=ELE-006`, `service=Avería eléctrica`, `status=Nuevo`,
`urgency=Hoy`, `priority=1`, `next_action=Llamar para confirmar seguridad y disponibilidad`.

**`request_custom_answers`**: `tipo_trabajo=Avería eléctrica`,
`riesgo_urgencia=Posible riesgo`, `zona=Valencia`, `tipo_espacio=Vivienda`.

**`attachments`**: opcional; se registra solo si la imagen se aporta de forma
segura.

**`follow_ups`**: `due_at=ahora`, `channel=call`,
`action_text=Confirmar si hay riesgo y coordinar revisión segura`.

**`activities`**: `type=request_created`, `title=Solicitud eléctrica recibida`.

### Fontanería: fuga activa en cocina

**`contacts`**: `business_id=FON-MARTINEZ`, `display_name=Ana Torres`,
`email=ana@example.com`, `phone=+34 600 333 444`.

**`requests`**: `reference=FON-006`, `service=Fuga`, `status=Nuevo`,
`urgency=Hoy`, `priority=1`, `next_action=Confirmar si el agua sigue activa y el acceso`.

**`request_custom_answers`**: `tipo_incidencia=Fuga`, `agua_activa=true`,
`zona=Cocina`, `municipio=Valencia`.

**`attachments`**: foto opcional de la zona, sin retrasar el contacto.

**`follow_ups`**: `due_at=ahora`, `channel=call`,
`action_text=Priorizar contacto y confirmar visita urgente`.

**`activities`**: `type=request_created`, `title=Incidencia de fontanería recibida`.

### Academias: inglés para adulto por las tardes

**`contacts`**: `business_id=ACA-NORTE`, `display_name=Jorge Martín`,
`email=jorge@example.com`, `phone=+34 600 444 555`.

**`requests`**: `reference=ACA-006`, `service=Clases de inglés`,
`status=Nuevo`, `urgency=Sin prisa`,
`next_action=Confirmar horario y modalidad antes de proponer grupo`.

**`request_custom_answers`**: `materia=Inglés`, `nivel=Adulto`,
`objetivo=Mejorar conversación`, `modalidad=Presencial`,
`disponibilidad=Tardes`.

**`attachments`**: no necesarios en el flujo inicial.

**`follow_ups`**: `due_at=+48h`, `channel=email`,
`action_text=Confirmar disponibilidad y fecha de inicio`.

**`activities`**: `type=request_created`, `title=Solicitud de clases recibida`.

## 10. Seguridad, privacidad y RLS futura

### Aislamiento multiempresa

- Todas las tablas con datos de negocio deben activar RLS al exponerse mediante
  la API de Supabase.
- Las políticas futuras deben verificar que el usuario autenticado tiene una
  fila activa en `business_users` para el mismo `business_id`.
- No basta con comprobar que alguien está autenticado: cada `select`, `insert`,
  `update` y `delete` debe restringirse al negocio correspondiente.
- Las rutas de Storage deben incluir `business_id` y las políticas de objetos
  deben exigir la misma pertenencia.
- El servidor nunca debe aceptar un `business_id` de cliente sin comprobar que
  el usuario o formulario público está autorizado para ese negocio.

### Datos a minimizar

- Academias: no solicitar diagnósticos, informes médicos, fecha de nacimiento
  ni otra información sensible de menores.
- Electricidad y Fontanería: no pedir instrucciones que lleven a manipular una
  instalación o retrasar una urgencia.
- Adjuntos: limitar tipos y tamaño; analizar contenido y usar URLs firmadas.
- Emails: conservar solo lo necesario para trazabilidad y definir una política
  de retención antes de activar envíos reales.
- Secretos: claves de Supabase, proveedores de email o n8n nunca se guardan en
  tablas accesibles desde el cliente ni en `metadata` o `payload_summary`.

## 11. Qué queda fuera del MVP

- Facturación, pagos, compras, inventario y materiales.
- Presupuestos completos, catálogo, firma digital y contratos.
- Calendario avanzado, rutas, asignación compleja de técnicos y agenda móvil.
- CRM avanzado, scoring comercial complejo y automatizaciones de marketing.
- Roles granulares por campo, multiidioma y analítica avanzada.
- IA real, integración n8n, Gmail, Resend, Google Sheets o API pública.

## 12. Fases posteriores a la aprobación del diseño

### Fase A. Cierre de esquema

- Revisar nombres, estados, retención y campos con una muestra de negocios.
- Validar el documento antes de escribir SQL.

### Fase B. Supabase inicial

- Crear migración de tablas base: `sectors`, `businesses`, perfiles,
  membresías, contactos, solicitudes, formularios y actividad.
- Cargar los cuatro presets de sector con datos de prueba no productivos.

### Fase C. RLS y acceso interno

- Conectar perfiles a Supabase Auth.
- Activar RLS en tablas expuestas y probar aislamiento de dos negocios.
- Añadir políticas de Storage antes de permitir adjuntos.

### Fase D. Backend mínimo de recepción

- Crear un endpoint o función de servidor para formularios públicos.
- Validar, sanear, crear contacto, solicitud, respuestas y actividad en una
  transacción.

### Fase E. Panel conectado

- Sustituir gradualmente el adaptador de `localStorage` por lectura/escritura
  segura de solicitudes, contactos y seguimientos.
- Mantener la interfaz actual mientras se valida la migración.

### Fase F. Adjuntos

- Añadir subida autenticada o firmada a Storage y persistir metadatos en
  `attachments`.

### Fase G. Automatizaciones

- Desde servidor, generar `automation_logs` y llamar a n8n sin exponer secretos.
- Registrar plantillas y resultados en `email_logs` antes de activar un
  proveedor real.

### Fase H. Pruebas completas

- Pruebas de RLS, formularios públicos, pertenencia por negocio, adjuntos,
  reintentos y migración de datos de demo.

## 13. Decisiones abiertas antes de SQL

1. ¿Un negocio podrá operar con más de un sector desde el MVP o solo tendrá un
   sector principal?
2. ¿Las solicitudes públicas requerirán captcha, límite por IP o ambos?
3. ¿Qué plazo de retención se aplicará a adjuntos, emails y solicitudes perdidas?
4. ¿Qué canales se activarán primero: email, WhatsApp preparado o llamada?
5. ¿Se permitirá que un colaborador vea todos los contactos o solo solicitudes
   asignadas?
6. ¿Qué campos de formularios deben ser buscables de verdad antes de crear
   índices sobre `request_custom_answers`?

## 14. Recomendación final

Implementar primero el núcleo multiempresa y de solicitudes: `sectors`,
`businesses`, `users`, `business_users`, `contacts`, `form_configs`,
`form_fields`, `requests`, `request_custom_answers`, `follow_ups` y
`activities`. Después validar RLS con dos negocios de prueba antes de añadir
Storage, emails o n8n.

Esta secuencia preserva el valor de SolicitudPro sin adelantar complejidad:
cada negocio ve solo sus solicitudes, las respuestas dinámicas conservan la
adaptación sectorial y el panel puede evolucionar desde la demo actual sin
convertirse en un ERP.
