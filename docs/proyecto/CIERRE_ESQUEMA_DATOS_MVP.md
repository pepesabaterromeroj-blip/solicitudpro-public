# Cierre del esquema de datos MVP

> Molde final previo a SQL para Supabase. Este documento no crea tablas, no
> ejecuta migraciones, no configura RLS ni modifica la demo funcional.

## 1. Veredicto general

El modelo de `MODELO_DATOS_MVP.md` tiene la dirección correcta: separa
negocios con `business_id`, mantiene los datos comunes de solicitud en
`requests` y deja los datos de sector en respuestas dinámicas.

Antes de preparar los SQL locales se acordaron cinco ajustes de cierre, ya
reflejados en los archivos de revisión:

1. Renombrar la tabla de aplicación `users` a **`profiles`**, reservando
   `auth.users` para Supabase Auth futuro.
2. Mantener un único campo `requests.source`; no añadir un segundo `origin`
   porque duplicaría significado.
3. Derivar etiquetas y datos pendientes desde reglas y respuestas dinámicas;
   no crear una tabla de etiquetas en la primera migración.
4. Crear `attachments` desde el inicio solo como metadatos, aunque Storage se
   active más tarde.
5. Posponer `email_logs` y `automation_logs` hasta que exista un backend que
   haga envíos o ejecute automatizaciones reales.

Con estas decisiones, el núcleo de primera migración queda acotado y soporta
la Demo v1.1: solicitud, datos específicos, resumen, respuesta, seguimiento,
actividad y aislamiento por negocio.

Los archivos SQL locales de revisión están en `docs/proyecto/sql/`. No se han
ejecutado ni están conectados a Supabase.

## 2. Reglas transversales obligatorias

### 2.1 Aislamiento por `business_id`

Todas las tablas con datos de un negocio incluyen `business_id`:

```text
business_settings, business_users, contacts, form_configs, form_fields,
requests, request_custom_answers, follow_ups, activities, attachments,
email_templates, email_logs y automation_logs.
```

No se incluye en `sectors`, catálogo global, ni en `profiles`, porque una
persona puede pertenecer a varios negocios.

En la migración se recomienda reforzar los enlaces internos con claves
foráneas compuestas. Ejemplo conceptual: una solicitud debe referenciar un
contacto mediante `(contact_id, business_id)`, no solo `contact_id`. Para ello
el padre expone una clave única `(id, business_id)`. Así se evita que un error
de servidor asocie una solicitud de un negocio con un contacto de otro.

Los campos de asignación y auditoría (`assigned_to`, `completed_by`,
`actor_user_id`, `uploaded_by`, `created_by` y `updated_by`) se relacionan con
`business_users` mediante `(business_id, user_id)`, no solo con `profiles`.
Así también se evita asignar una solicitud a una persona ajena al negocio.

### 2.2 Convenciones técnicas

| Regla | Decisión final |
| --- | --- |
| Identificadores | `uuid` generado por base de datos. |
| Fechas | `timestamptz` en UTC; presentar en la zona horaria del negocio. |
| Borrado | No borrar solicitudes, actividad ni emails históricos; usar `archived_at` o estados. |
| Estados | `text` + `check`, no enum y no tabla editable en MVP. |
| Datos flexibles | `jsonb` solo para opciones/validación y valores dinámicos, no como sustituto de columnas operativas. |
| Auditoría | `created_at`, `updated_at` en tablas editables; `activities` para la historia comercial. |
| Secretos | Nunca en tablas públicas, `metadata`, logs ni frontend. |

### 2.3 Estados comerciales

`requests.status` debe permitir exclusivamente:

```text
Nuevo | En preparación | Enviado | Seguimiento pendiente | Ganado | Perdido
```

`Ganado` y `Perdido` cierran el trabajo comercial activo. El cálculo de la
bandeja de seguimientos debe excluirlos, igual que la demo actual.

### 2.4 Decisiones cerradas en Fase B1

1. Cada negocio tiene un único `sector_id` principal en el MVP; no existe aún
   `business_sectors`.
2. La ruta pública futura combina `businesses.slug` y
   `form_configs.public_slug`, único dentro del negocio.
3. `contacts` exige `display_name` y al menos uno entre `email` o `phone`.
4. `business_users.role` permite únicamente `owner`, `member` y `viewer`.
5. No hay borrado automático: se conservarán `archived_at`, `deleted_at`,
   `won_at` y `lost_at` según corresponda.
6. Los filtros MVP usan columnas comunes de `requests`; las respuestas
   dinámicas mantienen `field_key`, `value_text` y `value_jsonb` sin índices
   JSONB avanzados.

## 3. Relaciones finales

```text
sectors
  └── businesses
        ├── business_settings (1:1)
        ├── business_users ─── profiles
        ├── form_configs
        │     └── form_fields
        ├── contacts
        ├── email_templates
        └── requests
              ├── request_custom_answers
              ├── follow_ups
              ├── activities
              └── attachments

Segunda migración:
requests ─── email_logs
requests ─── automation_logs
```

## 4. Fichas de tablas

Leyenda de veredicto:

- **M1**: primera migración.
- **M2**: segunda migración, tras validar el núcleo y antes de integrar un
  proveedor real si corresponde.
- **Posponer**: no necesaria para el MVP inicial.

### 4.1 `sectors`

**Veredicto: M1, mantener.** Catálogo global, extensible más allá de los cuatro
presets actuales.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | FK estable. | MVP |
| `slug` | `text` | Sí | — | `fontaneria` | Identificador técnico estable. | MVP |
| `name` | `text` | Sí | — | Fontanería | Texto visible. | MVP |
| `description` | `text` | No | `null` | Fugas y atascos | Copy del preset. | MVP |
| `is_active` | `boolean` | Sí | `true` | `true` | Retirar sin borrar histórico. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraints: `unique(slug)`, `name <> ''`. Índices: el único de `slug` basta.
Riesgo: no convertirla en configuración por negocio; para eso están
`businesses` y `form_configs`.

### 4.2 `businesses`

**Veredicto: M1, mantener con campos estables.** Es el tenant de SolicitudPro.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad del negocio. | MVP |
| `sector_id` | `uuid` FK | Sí | — | Fontanería | Sector principal inicial. | MVP |
| `name` | `text` | Sí | — | Fontanería Martínez | Nombre comercial. | MVP |
| `slug` | `text` | Sí | — | `fontaneria-martinez` | URL o identificador futuro. | MVP |
| `contact_email` | `text` | Sí | — | hola@negocio.es | Contacto operativo. | MVP |
| `contact_phone` | `text` | No | `null` | +34... | Canal operativo. | MVP |
| `service_area` | `text` | No | `null` | Valencia y alrededores | Zona general, no dirección privada. | MVP |
| `timezone` | `text` | Sí | `Europe/Madrid` | Europe/Madrid | Fechas y seguimiento. | MVP |
| `status` | `text` | Sí | `trial` | `active` | `trial`, `active`, `paused`, `archived`. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraints: `unique(slug)`; check de estado; `name <> ''`. Índices:
`sector_id`, `status`. No añadir aquí servicios, horarios, tono ni textos de
formulario: cambian con más frecuencia.

### 4.3 `business_settings`

**Veredicto: M1, mantener minimalista.** Configuración 1:1 que no pertenece al
registro comercial estable.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `business_id` | `uuid` PK/FK | Sí | — | UUID | Propietario. | MVP |
| `settings` | `jsonb` | Sí | `'{}'` | `{"tone":"cercano"}` | Preferencias de bajo riesgo. | MVP |
| `updated_by` | `uuid` FK `profiles.id` | No | `null` | UUID | Trazabilidad. | Futuro cercano |
| `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Puede contener tono de mensaje, canales visibles, servicios ofrecidos y horario
general mientras se validan necesidades. No guardar plantillas largas,
contraseñas, claves, reglas de permisos ni opciones de campos aquí.

### 4.4 `profiles` y `business_users`

**Veredicto: M1, modificar.** Sustituir `users` por `profiles`, con `id` igual
al futuro `auth.users.id`; no almacenar autenticación propia.

**`profiles`**

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` PK/FK Auth | Sí | — | UUID | Identidad de aplicación. | MVP |
| `display_name` | `text` | No | `null` | Ana Martínez | Mostrar actor en actividad. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

**`business_users`**

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant accesible. | MVP |
| `user_id` | `uuid` FK | Sí | — | UUID | Miembro interno. | MVP |
| `role` | `text` | Sí | `member` | `owner` | `owner`, `member`, `viewer`. | MVP |
| `is_active` | `boolean` | Sí | `true` | `true` | Revocar acceso sin borrar. | MVP |
| `created_at` | `timestamptz` | Sí | `now()` | — | Alta. | MVP |

Constraints: PK `(business_id, user_id)`; check de rol. Índices: `user_id` y
`(business_id, is_active)`. No hace falta otra tabla de permisos hasta que un
rol necesite capacidades distintas.

### 4.5 `contacts`

**Veredicto: M1, mantener con regla de contacto mínimo.** Historial básico, no
CRM avanzado.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Separación de tenants. | MVP |
| `display_name` | `text` | Sí | — | María López | Nombre visible. | MVP |
| `email` | `text` | No | `null` | maria@ejemplo.es | Contacto por email. | MVP |
| `phone` | `text` | No | `null` | +34... | Contacto por llamada/mensajería. | MVP |
| `source` | `text` | No | `null` | `form` | Primer origen conocido. | MVP |
| `notes` | `text` | No | `null` | Prefiere tardes | Nota breve interna. | MVP |
| `privacy_notice_version` | `text` | No | `null` | `2026-01` | Solo si se necesita evidencia. | Futuro cercano |
| `contact_consent_at` | `timestamptz` | No | `null` | — | No confundir con consentimiento comercial. | Futuro cercano |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraint recomendado: `display_name <> ''` y al menos un medio de contacto
en entradas públicas: `email is not null or phone is not null`. La aplicación
puede exigir email según el formulario, como hace la demo, sin impedir altas
manuales de WhatsApp o teléfono en el futuro.

Índices: `business_id`, `(business_id, created_at desc)`, `(business_id,
lower(email)) where email is not null`. No imponer unicidad por email o teléfono
en M1: primero buscar coincidencias dentro del negocio y ofrecer fusión manual.

### 4.6 `form_configs`

**Veredicto: M1, mantener y completar publicación/versionado.** Un formulario
es una versión concreta; cambiar un publicado crea otro registro.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Propietario. | MVP |
| `sector_id` | `uuid` FK | Sí | — | Reformas | Preset de partida. | MVP |
| `name` | `text` | Sí | — | Solicitud de reforma | Gestión interna. | MVP |
| `public_slug` | `text` | Sí | generado | `r8Kp...` | Ruta pública difícil de adivinar. | MVP |
| `version` | `integer` | Sí | `1` | 2 | Conserva histórico. | MVP |
| `title` | `text` | Sí | — | Cuéntanos tu reforma | Encabezado cliente. | MVP |
| `description` | `text` | No | `null` | No necesitas medidas exactas | Ayuda. | MVP |
| `confirmation_text` | `text` | Sí | — | Hemos recibido... | Cierre del formulario. | MVP |
| `status` | `text` | Sí | `draft` | `published` | `draft`, `published`, `archived`. | MVP |
| `is_default` | `boolean` | Sí | `false` | `true` | Predeterminado del negocio. | MVP |
| `published_at` | `timestamptz` | No | `null` | — | Auditoría de publicación. | MVP |
| `created_by` | `uuid` FK | No | `null` | UUID | Autor interno. | Futuro cercano |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraints: `version > 0`, check de estado, único `(business_id,
public_slug)`, único `(business_id, name, version)`. Índices: `business_id`,
`(business_id, status)`, `public_slug` único. `is_public` sobra: `status =
'published'` ya expresa la disponibilidad pública.

### 4.7 `form_fields`

**Veredicto: M1, mantener con configuración mínima.** Soporta los cuatro
sectores sin repetir HTML ni añadir columnas por caso.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | RLS y consistencia. | MVP |
| `form_config_id` | `uuid` FK | Sí | — | UUID | Versión de formulario. | MVP |
| `field_key` | `text` | Sí | — | `agua_activa` | Clave estable. | MVP |
| `label` | `text` | Sí | — | ¿Sigue saliendo agua? | Texto mostrado. | MVP |
| `help_text` | `text` | No | `null` | No retrases el contacto | Ayuda sectorial. | MVP |
| `placeholder` | `text` | No | `null` | Ej. Valencia centro | UX de formulario. | MVP |
| `field_type` | `text` | Sí | — | `select` | Tipo controlado. | MVP |
| `options` | `jsonb` | No | `'[]'` | ["Fuga","Atasco"] | Selects. | MVP |
| `validation` | `jsonb` | No | `'{}'` | `{ "min_length": 20 }` | Reglas simples. | MVP |
| `default_value` | `jsonb` | No | `null` | `false` | Solo cuando ayude. | MVP |
| `is_required` | `boolean` | Sí | `false` | `true` | Validación. | MVP |
| `display_order` | `integer` | Sí | — | 3 | Orden estable. | MVP |
| `is_active` | `boolean` | Sí | `true` | `true` | Campo disponible. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Checks: `field_type in ('text','textarea','select','multiselect','boolean',
'date','file')`, `display_order > 0`. Unique: `(form_config_id, field_key)` y
`(form_config_id, display_order)`. Posponer `conditional_rules`, layout ancho,
secciones y grupos hasta que una necesidad real los justifique.

### 4.8 `requests`

**Veredicto: M1, mantener como núcleo y retirar duplicados.** Debe ser rápida
para bandeja, detalle y seguimiento; no debe contener campos propios de sector.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant. | MVP |
| `contact_id` | `uuid` FK | Sí | — | UUID | Cliente final. | MVP |
| `sector_id` | `uuid` FK | Sí | — | Fontanería | Snapshot de entrada. | MVP |
| `form_config_id` | `uuid` FK | No | `null` | UUID | Formulario usado; nulo para alta manual/importación. | MVP |
| `reference` | `text` | Sí | — | FON-006 | Referencia comercial única por negocio. | MVP |
| `title` | `text` | No | `null` | Fuga en cocina | Encabezado operativo; se puede generar. | MVP |
| `service` | `text` | Sí | — | Fuga | Filtro y bandeja. | MVP |
| `description` | `text` | Sí | — | Agua sale bajo fregadero | Necesidad original. | MVP |
| `status` | `text` | Sí | `Nuevo` | Enviado | Estado comercial. | MVP |
| `urgency` | `text` | No | `null` | Hoy | Lo indica cliente o formulario. | MVP |
| `priority` | `smallint` | No | `null` | 1 | Priorización interna; 1 alta, 2 media, 3 baja. | MVP |
| `source` | `text` | Sí | `form` | `form`, `phone`, `email` | Único origen de entrada. | MVP |
| `assigned_to` | `uuid` FK | No | `null` | UUID | Responsable futuro. | MVP |
| `internal_summary` | `text` | No | `null` | Fuga activa, revisar acceso | Resumen revisable. | MVP |
| `suggested_reply` | `text` | No | `null` | Hola, gracias... | Borrador actual. | MVP |
| `suggested_questions` | `jsonb` | No | `'[]'` | ["¿Sigue activa?"] | Preguntas actuales. | MVP |
| `next_action` | `text` | No | `null` | Llamar para confirmar acceso | Acción visible. | MVP |
| `next_follow_up_at` | `timestamptz` | No | `null` | 2026-09-01T09:00Z | Cache de próxima tarea pendiente. | MVP |
| `last_contacted_at` | `timestamptz` | No | `null` | — | Métrica y contexto. | MVP |
| `won_at` / `lost_at` | `timestamptz` | No | `null` | — | Cierre comercial. | MVP |
| `archived_at` | `timestamptz` | No | `null` | — | Archivado reversible. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraints imprescindibles:

- `unique(business_id, reference)`.
- Check de `status`, `source` y `priority between 1 and 3` cuando no sea nula.
- Check de coherencia de cierre: `Ganado` exige `won_at`, `Perdido` exige
  `lost_at` y ningún estado puede conservar ambas fechas.
- Referencias compuestas a contacto y formulario del mismo negocio.

Índices imprescindibles:

```text
(business_id, status)
(business_id, created_at desc)
(business_id, next_follow_up_at) where archived_at is null
(business_id, contact_id)
unique (business_id, reference)
```

No crear búsqueda de texto completo, índices JSONB ni índices por `urgency` en
M1: medir primero la necesidad. No añadir `origin`, `budget_range`,
`last_activity` ni campos sectoriales duplicados. `budget_range` puede entrar
como respuesta dinámica hasta que el producto requiera filtros comerciales
reales por presupuesto.

### 4.9 `request_custom_answers`

**Veredicto: M1, mantener.** Es la pieza que permite formularios por sector y
por negocio sin ensuciar `requests`.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant. | MVP |
| `request_id` | `uuid` FK | Sí | — | UUID | Solicitud. | MVP |
| `form_field_id` | `uuid` FK | No | `null` | UUID | Campo original; nulo para importación. | MVP |
| `field_key` | `text` | Sí | — | `materia` | Snapshot estable. | MVP |
| `label_snapshot` | `text` | No | `null` | Materia | Mantiene significado histórico. | MVP |
| `value_jsonb` | `jsonb` | Sí | — | `"Inglés"` | Valor tipado. | MVP |
| `value_text` | `text` | No | `null` | Inglés | Exportación y lectura simple. | MVP |
| `created_at` | `timestamptz` | Sí | `now()` | — | Recepción. | MVP |

Constraints: `unique(request_id, field_key)` y referencias compuestas al mismo
negocio. Índices: `request_id`, `business_id`. Posponer índices por valores
dinámicos hasta conocer filtros que los necesiten.

### 4.10 `follow_ups`

**Veredicto: M1, mantener.** Registra cada tarea; `requests.next_follow_up_at`
solo acelera la bandeja.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant. | MVP |
| `request_id` | `uuid` FK | Sí | — | UUID | Solicitud. | MVP |
| `assigned_to` | `uuid` FK | No | `null` | UUID | Responsable. | MVP |
| `due_at` | `timestamptz` | Sí | — | +24 h | Fecha prevista. | MVP |
| `cadence_hours` | `smallint` | No | `null` | 24 | Regla 24/48/72. | MVP |
| `channel` | `text` | No | `null` | `call` | Llamada, email, visita, WhatsApp preparado. | MVP |
| `action_text` | `text` | Sí | — | Confirmar visita | Acción visible. | MVP |
| `status` | `text` | Sí | `pending` | `completed` | Pendiente, completado, omitido o cancelado. | MVP |
| `completed_at` | `timestamptz` | No | `null` | — | Cierre. | MVP |
| `completed_by` | `uuid` FK | No | `null` | UUID | Actor. | MVP |
| `completion_note` | `text` | No | `null` | Cliente confirma tarde | Resultado. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Checks: `cadence_hours in (24,48,72)` cuando exista; estado controlado;
`completed_at` obligatorio si `status = completed`. Índices: `(business_id,
status, due_at)`, `request_id`. La regla de negocio debe actualizar en la misma
transacción `requests.next_follow_up_at` y `requests.next_action` con la tarea
pendiente más próxima. Al completar, crear actividad; un email futuro crea su
propio log y puede generar una actividad enlazada.

### 4.11 `activities`

**Veredicto: M1, mantener con actor explícito.** Timeline comercial visible,
no log técnico.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant. | MVP |
| `request_id` | `uuid` FK | No | `null` | UUID | Solicitud asociada. | MVP |
| `contact_id` | `uuid` FK | No | `null` | UUID | Evento sin solicitud, si existe. | MVP |
| `actor_type` | `text` | Sí | `system` | `user` | `user`, `system`, `public_form`, `automation`. | MVP |
| `actor_user_id` | `uuid` FK | No | `null` | UUID | Usuario interno si aplica. | MVP |
| `type` | `text` | Sí | — | `status_changed` | Tipo estable de evento. | MVP |
| `title` | `text` | Sí | — | Estado actualizado | Texto corto. | MVP |
| `detail` | `text` | No | `null` | Nuevo estado: Enviado | Contexto legible. | MVP |
| `metadata` | `jsonb` | No | `'{}'` | `{ "from":"Nuevo" }` | Datos mínimos enlazables. | MVP |
| `created_at` | `timestamptz` | Sí | `now()` | — | Orden cronológico. | MVP |

`is_system_generated` sobra porque se deriva de `actor_type`; `visible_to_business`
sobra en MVP porque toda actividad de esta tabla es interna. Índices:
`(business_id, request_id, created_at desc)`, `(business_id, contact_id,
created_at desc)`. No guardar respuestas completas, adjuntos privados ni
payloads en `metadata`.

### 4.12 `attachments`

**Veredicto: M1, mantener solo metadatos.** Aunque no haya subida real aún,
evita una migración urgente cuando Reformas, Electricidad o Fontanería activen
fotos.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Tenant y ruta Storage. | MVP |
| `request_id` | `uuid` FK | Sí | — | UUID | Solicitud; no añadir `contact_id` aún. | MVP |
| `storage_path` | `text` | Sí | — | `businesses/.../foto.jpg` | Ruta privada, no URL pública. | MVP |
| `file_name` | `text` | Sí | — | fuga-cocina.jpg | Nombre saneado. | MVP |
| `mime_type` | `text` | Sí | — | image/jpeg | Validación. | MVP |
| `size_bytes` | `bigint` | Sí | — | 132000 | Límites de tamaño. | MVP |
| `source` | `text` | Sí | `public_form` | `internal_upload` | Procedencia. | MVP |
| `uploaded_by` | `uuid` FK | No | `null` | UUID | Usuario interno si existe. | MVP |
| `created_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |
| `deleted_at` | `timestamptz` | No | `null` | — | Retención y borrado lógico. | Futuro cercano |

Índices: `request_id`, `business_id`, único `storage_path`. Prohibido base64 en
PostgreSQL. La subida futura debe validar tipo, tamaño y autorización, y guardar
objetos bajo `businesses/{business_id}/requests/{request_id}/...` con acceso
privado o URLs firmadas de corta duración.

### 4.13 `email_templates`

**Veredicto: M1, mantener.** Es útil aunque inicialmente el panel solo prepare
emails o muestre simulaciones.

| Columna | Tipo | Oblig. | Default | Ejemplo | Motivo | Alcance |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | Sí | generado | UUID | Identidad. | MVP |
| `business_id` | `uuid` FK | Sí | — | UUID | Propietario. | MVP |
| `sector_id` | `uuid` FK | No | `null` | Reformas | Punto de partida sectorial. | MVP |
| `key` | `text` | Sí | — | `client_confirmation` | Tipo estable. | MVP |
| `name` | `text` | Sí | — | Confirmación cliente | Gestión interna. | MVP |
| `channel` | `text` | Sí | `email` | email | Permite futuro canal preparado. | MVP |
| `subject_template` | `text` | No | `null` | Hemos recibido... | Asunto. | MVP |
| `body_template` | `text` | Sí | — | Hola {{contact_name}} | Cuerpo. | MVP |
| `is_active` | `boolean` | Sí | `true` | `true` | Retirar sin borrar. | MVP |
| `created_at` / `updated_at` | `timestamptz` | Sí | `now()` | — | Auditoría. | MVP |

Constraint: `unique(business_id, key)`. Las variables permitidas deben
validarse en backend con lista cerrada; nunca interpolar expresiones libres.

### 4.14 `email_logs`

**Veredicto: M2, posponer.** No hay email real en MVP inicial y una simulación
no necesita persistencia. Se activa antes del primer envío real.

Columnas finales previstas: `id`, `business_id`, `request_id`, `contact_id`,
`template_id`, `direction`, `recipient`, `subject`, `body`, `status`,
`provider`, `provider_message_id`, `error_message`, `sent_at`, `created_at`.

Estados: `draft`, `simulated`, `queued`, `sent`, `failed`, `cancelled`.
Índices futuros: `(business_id, request_id, created_at desc)` y
`provider_message_id` parcial. No guardar tokens, cabeceras sensibles ni
credenciales del proveedor.

### 4.15 `automation_logs`

**Veredicto: M2, posponer.** Solo aporta valor cuando backend o n8n existen.

Columnas finales previstas: `id`, `business_id`, `request_id`, `event_type`,
`workflow_name`, `status`, `attempt`, `payload_summary`, `error_code`,
`error_message`, `started_at`, `finished_at`, `created_at`.

Estados: `queued`, `running`, `succeeded`, `failed`, `retrying`. Mantener un
resumen saneado, no payloads completos con datos innecesarios ni secretos.

## 5. Decisiones de producto y datos

### 5.1 Respuestas sugeridas

Para MVP bastan estas columnas de `requests`:

```text
internal_summary
suggested_reply
suggested_questions
next_action
```

`activities` registra cuándo se preparó o editó una respuesta. `email_templates`
aporta el texto de base por negocio. No crear `suggested_reply_versions`,
`response_drafts` ni `request_recommendations` aún: serían útiles solo cuando
existan varias versiones, generación real, aprobación por usuario o métricas de
calidad. El email enviado conservará su propia copia más adelante en
`email_logs`.

### 5.2 Datos pendientes y etiquetas

**Decisión MVP: derivar, no persistir.** Las reglas del backend/panel evalúan
`request_custom_answers`, adjuntos, estado y datos comunes para mostrar:

```text
Foto pendiente | Medidas pendientes | Visita pendiente
Riesgo por confirmar | Agua activa | Horario pendiente
```

- Etiquetas de información incompleta: visuales y derivadas.
- Etiquetas de riesgo o urgencia: se reflejan además en `urgency` y `priority`
  cuando necesitan ordenar trabajo.
- Etiquetas manuales: posponer hasta que un negocio pida clasificarlas o
  filtrarlas de forma persistente.

No usar `requests.tags jsonb` ni `request_tags` en M1. Una tabla
`request_flags` solo se justificaría después si hay flags manuales, responsables
o fecha de resolución.

### 5.3 Seguimientos 24/48/72 h

`follow_ups` conserva la tarea real. `requests.next_follow_up_at` y
`requests.next_action` son una copia operativa de la tarea pendiente más
próxima, actualizada de forma transaccional al crear, completar, omitir o
cancelar un seguimiento.

- Regla de cadencia: crea `follow_ups.cadence_hours` de 24, 48 o 72.
- Bandeja: consulta `follow_ups` pendientes por `due_at` y usa la copia de
  `requests` para tarjetas y contadores rápidos.
- Actividad: registrar creación y cierre de cada seguimiento.
- Automatización futura: `automation_logs` registra el trabajo técnico; no
  sustituye al seguimiento comercial.

## 6. Matriz MVP vs futuro

| Tabla | Primera migración | Segunda migración | Motivo | Riesgo de posponer | Prioridad |
| --- | --- | --- | --- | --- | --- |
| `sectors` | Sí | No | Presets globales | No hay sector estructurado | Alta |
| `businesses` | Sí | No | Tenant principal | No hay aislamiento | Alta |
| `business_settings` | Sí | No | Preferencias por negocio | Configuración dispersa | Media |
| `profiles` | Sí | No | Preparar Auth/RLS | Rehacer acceso después | Alta |
| `business_users` | Sí | No | Membresía y roles | RLS incompleta | Alta |
| `contacts` | Sí | No | Historial básico | Solicitudes aisladas | Alta |
| `form_configs` | Sí | No | Formularios por negocio | No hay versión ni URL pública | Alta |
| `form_fields` | Sí | No | Campos sectoriales dinámicos | Columnas específicas | Alta |
| `requests` | Sí | No | Núcleo operativo | Producto no funcional | Alta |
| `request_custom_answers` | Sí | No | Datos de sector | Formularios rígidos | Alta |
| `follow_ups` | Sí | No | Oportunidades pendientes | No hay seguimiento real | Alta |
| `activities` | Sí | No | Timeline comercial | Sin trazabilidad | Alta |
| `attachments` | Sí, metadatos | Storage después | Preparar fotos | Migración apresurada al activar imágenes | Media |
| `email_templates` | Sí | No | Copy configurable | Templates en código | Media |
| `email_logs` | No | Sí | Auditoría de envío | No hay registro al activar email | Media |
| `automation_logs` | No | Sí | Diagnóstico técnico | No hay n8n/backend aún | Media |

## 7. Matriz de campos críticos

| Campo/concepto | Dónde vive | Obligatorio | Origen | Calculado | MVP | Motivo |
| --- | --- | --- | --- | --- | --- | --- |
| `business_id` | Todas las tablas operativas | Sí | Sistema | No | Sí | Aislamiento SaaS. |
| `sector_id` | `businesses`, `form_configs`, `requests` | Sí | Sistema/negocio | No | Sí | Preset y snapshot. |
| `contact_id` | `requests`, hijos opcionales | Sí en solicitud | Sistema | No | Sí | Historial por persona/empresa. |
| `form_config_id` | `requests` | No | Sistema | No | Sí | Versión usada; nulo para alta manual. |
| `reference` | `requests` | Sí | Sistema | Sí, al crear | Sí | Referencia comercial. |
| `status` | `requests`, `follow_ups` | Sí | Negocio/sistema | No | Sí | Operación y cierre. |
| `internal_summary` | `requests` | No | Sistema/negocio | No | Sí | Lectura interna rápida. |
| `suggested_reply` | `requests` | No | Sistema/negocio | No | Sí | Borrador actual. |
| `suggested_questions` | `requests` | No | Sistema/negocio | No | Sí | Dudas actuales. |
| `next_action` | `requests` | No | Sistema/negocio | Sí desde seguimiento | Sí | Acción visible. |
| `next_follow_up_at` | `requests` | No | Sistema | Sí desde seguimiento | Sí | Bandeja rápida. |
| Respuestas dinámicas | `request_custom_answers` | Sí por campo enviado | Cliente/negocio | No | Sí | Datos por sector. |
| Actividad | `activities` | Sí por evento | Sistema/negocio | No | Sí | Historia comercial. |
| Seguimiento | `follow_ups` | Sí al programar | Sistema/negocio | No | Sí | Tareas 24/48/72. |

## 8. RLS futura y seguridad

### Tablas con RLS

Al exponerlas mediante Supabase Data API, deben tener RLS: `businesses`,
`business_settings`, `profiles`, `business_users`, `contacts`, `form_configs`,
`form_fields`, `requests`, `request_custom_answers`, `follow_ups`,
`activities`, `attachments`, `email_templates`, `email_logs` y
`automation_logs`.

`sectors` puede ser de solo lectura para usuarios autenticados, o mantenerse en
un esquema privado y entregarse por servidor. En ambos casos no debe permitir
escritura desde el cliente.

### Políticas conceptuales

- Un usuario interno puede leer o modificar una fila solo si tiene una
  membresía activa en `business_users` para el mismo `business_id`.
- Un `viewer` solo puede leer; `owner` y `member` pueden operar sobre datos
  comerciales. La administración de miembros se mantiene en un flujo de
  provisión controlado durante el MVP.
- Storage usa la misma comprobación a partir del prefijo `business_id` de la
  ruta.
- Los formularios públicos no insertan directamente en tablas expuestas. Un
  backend verifica el identificador público del formulario, ignora cualquier
  `business_id` enviado por el navegador, valida datos y crea todo en una
  transacción.

### Prueba mínima de aislamiento

1. Crear dos negocios de prueba y un usuario por negocio.
2. Insertar contacto, solicitud, respuestas y adjunto para cada uno.
3. Verificar que cada usuario solo puede leer y editar sus filas.
4. Intentar consultar o insertar un `request_id` con `business_id` ajeno.
5. Verificar que Storage y tablas hijas rechazan la mezcla.

## 9. Puntos de revisión antes de ejecutar SQL

Las decisiones de modelo quedan cerradas para la primera migración. Antes de
aplicarla en Supabase solo queda definir el proceso operativo: quién crea el
primer negocio y su `owner`, qué formato final tendrán los slugs públicos, y
qué retención concreta se aplicará al activar Storage o correo real. No se
deben añadir índices JSONB hasta observar filtros frecuentes con datos reales.

## 10. Orden recomendado antes de SQL

1. Aprobar las seis decisiones abiertas anteriores.
2. Crear primera migración con las tablas M1 y sus constraints/índices mínimos.
3. Cargar los cuatro sectores como datos de referencia.
4. Conectar Supabase Auth a `profiles` y `business_users`.
5. Activar y probar RLS con dos negocios antes de construir cualquier endpoint.
6. Crear el backend de formulario público y migrar la lectura del panel.
7. Añadir Storage, `email_logs` y `automation_logs` como segunda migración solo
   cuando haya un flujo real que los use.

## 11. Recomendación final

El esquema está listo para traducirse a una migración inicial **cuando se
cierren las decisiones abiertas**. La primera migración debe ser deliberadamente
operativa y pequeña: multiempresa, formularios, solicitudes, respuestas,
seguimientos, actividad, adjuntos como metadatos y plantillas. La segunda debe
esperar a que exista backend: logs de correo y automatizaciones.

Esto permite pasar de la Demo v1.1 sectorial a un producto real sin improvisar
columnas por sector ni convertir SolicitudPro en un ERP.
