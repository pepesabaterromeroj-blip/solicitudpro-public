# Resultado B4: endurecimiento de desarrollo

**Fecha:** 31 de agosto de 2026  
**Proyecto revisado:** `solicitudpro-app-dev`  
**Referencia:** `rinrgjancwvcvpzjyqmu`  
**Entorno:** desarrollo aislado, con datos ficticios. No es el proyecto de la
landing `pepesabaterromeroj-blip's Project`.

## Estado confirmado

- El proyecto está activo y sano.
- Se mantienen 14 tablas públicas, las 14 con RLS activa y 36 políticas.
- La consulta read-only al catálogo confirmó que ninguna de las 36 políticas
  públicas está asignada al rol `anon`.
- Se mantienen cuatro sectores, tres usuarios ficticios, dos negocios de prueba
  y datos exclusivamente de desarrollo.
- No se añadieron tablas, políticas, usuarios, formularios públicos, Storage,
  funciones, endpoints ni integraciones externas.

## Índices

El asesor de rendimiento señala relaciones compuestas sin índice de cobertura.
Se creó `004_indexes_review.sql` con nueve índices B-tree modestos para las
relaciones de actividad, formularios, respuestas, asignaciones y seguimientos.

`004_indexes_review.sql` se aplicó posteriormente en
`solicitudpro-app-dev` durante C1, tras confirmar que sus nueve índices B-tree
son no destructivos y cubren relaciones de actividad, formularios, respuestas,
asignaciones y seguimientos. Los índices de bandeja del esquema inicial ya
cubren las consultas MVP por negocio, estado, fecha, seguimiento, contacto y
servicio. No se añadieron índices JSONB, de texto completo ni índices
especulativos. Los avisos de índices no usados son esperables con el volumen
mínimo de datos de desarrollo y no justifican borrar índices todavía.

La revisión de nombres, columnas y relaciones de `004` fue estática. No había
cliente `psql` local para compilarlo contra PostgreSQL, y no se ejecutó contra
Supabase porque B4 solo prepara la revisión de la migración.

## Auth y seguridad

Revisión visual read-only de Auth:

- Proveedor Email habilitado y confirmación por email habilitada.
- Inicio de sesión anónimo, vinculación manual y proveedores externos: no
  habilitados.
- Cambio de email seguro: habilitado.
- Reautenticación para cambio de contraseña y exigir contraseña actual:
  pendientes de una decisión de producto antes de habilitarlos.
- La consola y el asesor indican que la protección frente a contraseñas
  filtradas está desactivada. La documentación oficial indica que requiere plan
  Pro o superior; la organización actual es Free. No se cambió el plan ni se
  aplicó ningún coste.

La configuración de URL y rate limits no se modificó. Antes de usuarios reales
hay que establecer una Site URL y redirects explícitos, reforzar el mínimo de
contraseña a 8 o más, elegir requisitos de caracteres, decidir reautenticación
para cambio de contraseña y revisar rate limits desde Auth.

## Documentos preparados

- `../API_RECEPCION_FORMULARIOS_MVP.md`: diseño y estado C1 del endpoint; no
  está desplegado ni expuesto públicamente.
- `../ALTA_NEGOCIO_OWNER_MVP.md`: alta manual y futura automatización interna.
- `004_indexes_review.sql`: propuesta local de índices.

## Riesgos pendientes

1. Protección de contraseñas filtradas: pendiente de disponer de plan Pro o
   superior y de revisión de coste.
2. Endpoint público: pendiente de implementar con rate limit, prevención de
   spam, CORS explícito, transacción e idempotencia.
3. Auth de usuarios reales: pendientes redirects, reglas de contraseña y prueba
   completa de sesión del cliente.
4. Storage privado y adjuntos: pendientes de diseño y políticas separadas.

## Próximo paso recomendado

Implementar primero el endpoint seguro de recepción en un entorno de desarrollo
con una revisión de seguridad específica. Como alternativa conservadora, se
puede conectar antes el panel interno autenticado en modo solo lectura. Ninguno
de los dos pasos está iniciado en B4.
