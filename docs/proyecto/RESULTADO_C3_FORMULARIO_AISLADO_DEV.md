# Resultado C3: formulario aislado de desarrollo

**Fecha:** 2026-09-01  
**Modelo:** 5.6 Terra Medio-Alto  
**Proyecto Supabase:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo, datos ficticios; no es la landing ni producción.

## Objetivo y alcance

Se validó `formulario aislado local -> receive-public-form -> Supabase dev` sin
conectar el panel ni modificar la demo visual principal.

## Archivos creados y modificados

- Creado: `dev/public-form-tester.html`.
- Creado: `tests/public-form-tester.test.js`.
- Creado: este documento.
- Modificado: `tests/public-form-endpoint.test.js`, con regresión CORS para
  `Idempotency-Key`.
- Modificado: `supabase/functions/receive-public-form/index.ts`, solo para
  permitir `content-type, idempotency-key` en CORS.
- Modificados: `API_RECEPCION_FORMULARIOS_MVP.md` y
  `RESULTADO_C2_ENDPOINT_DESPLEGADO_DEV.md` para registrar el ajuste.

## Comprobador local

- URL usada: `http://localhost:3000/public-form-tester.html`.
- Aviso visible: "Formulario aislado de desarrollo. No usar con datos reales."
- No usa localStorage, credenciales, service role, claves privadas ni datos
  reales. No contiene ni envía campos internos de negocio, estado, prioridad o
  asignación.
- Usa el endpoint público de desarrollo:
  `POST https://rinrgjancwvcvpzjyqmu.supabase.co/functions/v1/receive-public-form/api/public/forms/:businessSlug/:formSlug/requests`.

## Formularios dev y campos reales

| Negocio | Slug | Formulario | Campos activos |
| --- | --- | --- | --- |
| Reformas Demo Dev | `reformas-demo-dev` | `solicitud` | `tipo_reforma`, `zona` |
| Academia Demo Dev | `academia-demo-dev` | `clases` | `materia`, `disponibilidad` |

El comprobador enseña solo esos campos. No replica ni inventa los formularios
sectoriales completos de la demo v1.1.

Ejemplo de payload ficticio:

```json
{
  "contact": {
    "display_name": "Prueba manual dev",
    "email": "prueba.manual@solicitudpro.test",
    "phone": ""
  },
  "answers": {
    "tipo_reforma": "Baño",
    "zona": "Valencia"
  },
  "metadata": { "source": "public_form_tester_dev" },
  "privacy_notice_version": "dev-tester-2026-08"
}
```

## Pruebas HTTP

| Prueba | Resultado |
| --- | --- |
| Reformas desde navegador local | HTTP `201`, referencia `REF-002` |
| Academias desde navegador local | HTTP `201`, referencia `ACA-005` |
| Misma clave y mismo payload | HTTP `200`, misma referencia, sin duplicado |
| Misma clave y payload distinto | HTTP `422`, mensaje seguro |
| Contacto sin email ni teléfono | HTTP `422`, mensaje seguro |
| Campo obligatorio ausente | HTTP `422`, mensaje seguro |
| Límite en una ventana limpia | `201`, `201`, `201`, `429` |
| Preflight desde `localhost:3000` | HTTP `204`, permite `content-type, idempotency-key` |

Los selects actuales de dev no tienen opciones restringidas en Supabase; por
eso el caso de opción inválida no aplica al comprobador actual. C2 ya cubrió
esa validación sobre una configuración temporal controlada.

## Corrección CORS aplicada

La primera prueba desde navegador falló antes de llegar al endpoint porque el
preflight no permitía `Idempotency-Key`. Se corrigió esa lista explícita y se
desplegó únicamente la versión 2 de `receive-public-form` en
`solicitudpro-app-dev`. El endpoint no cambió de contrato, RLS ni esquema.

## Verificación en Supabase dev

Las solicitudes C3 se identificaron únicamente con direcciones ficticias
`@solicitudpro.test`:

| Dato | Resultado |
| --- | --- |
| Contactos | 9 |
| Solicitudes | 9 |
| Respuestas dinámicas | 18 |
| Seguimientos iniciales | 9 |
| Actividades iniciales | 9 |
| Idempotencias completadas | 9 |
| Cruces contacto-negocio | 0 |
| Cruces formulario-negocio | 0 |

`REF-002` quedó en Reformas/`solicitud`; `ACA-005` quedó en
Academias/`clases`, con dos respuestas dinámicas cada una. La primera prueba
secuencial de rate limit cruzó una ventana de minuto y creó cuatro registros
ficticios; la prueba paralela posterior, dentro de una sola ventana, confirmó
el `429` esperado.

## Seguridad y aislamiento

- RLS sigue activada en las 15 tablas operativas consultadas.
- No hay políticas `anon` en tablas operativas.
- La RPC no es ejecutable por `anon` ni `authenticated`; solo por el servidor.
- La consola del comprobador no reportó errores ni avisos.
- No se tocaron la demo principal, landing, Netlify, dominio ni el proyecto
  Supabase de landing.

## Comandos ejecutados

```text
python3 -m http.server 3000 --directory dev
node --test tests/*.js
node --check js/script.js
node --check js/request-detail.js
node --check js/follow-up-rules.js
node --check js/sector-presets.js
```

También se revisaron los registros de Edge Function, CORS y las cinco tablas
operativas de Supabase dev.

## Pendientes y recomendación

El comprobador es temporal y no es un formulario comercial. La siguiente fase
debe decidir entre conectar gradualmente un formulario sectorial real o añadir
una lectura interna mínima del panel, manteniendo este endpoint como única vía
pública de escritura y sin políticas `anon` directas.
