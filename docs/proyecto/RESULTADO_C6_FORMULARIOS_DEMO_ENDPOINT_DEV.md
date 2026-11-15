# Resultado C6: formularios de demo conectados a Supabase dev

**Fecha:** 2026-09-02  
**Proyecto:** `solicitudpro-app-dev` (`rinrgjancwvcvpzjyqmu`)  
**Entorno:** desarrollo con datos ficticios. No es la landing ni producción.

## Objetivo y decisión técnica

C6 conecta el formulario visual sectorial de la demo con el endpoint C2 ya validado.

`formulario bonito -> receive-public-form -> Supabase dev`

La conexión solo se activa con `submit=supabase-dev`. Sin ese parámetro, la demo mantiene intacta su creación local y el almacenamiento por sector. En el modo activo se muestra el aviso **Modo desarrollo · Envío a Supabase dev · Datos ficticios**. El frontend no escribe tablas: llama al endpoint de servidor que resuelve slugs, valida y realiza las escrituras de Supabase.

Solo se conectaron **Reformas** y **Electricidad**. Academias y Fontanería conservan su experiencia local y muestran **Este sector aún no está conectado en C6.** si se fuerza el modo dev.

## Archivos creados o modificados

- Modificado: `index.html`, aviso de entorno junto al formulario existente.
- Modificado: `css/style.css`, estilo acotado para ese aviso.
- Modificado: `js/script.js`, modo explícito, mapeo de campos, envío seguro, clave de idempotencia, estados y recibo de desarrollo.
- Modificado: `tests/sector-presets.test.js`, revisión de seguridad compatible con el endpoint C6 permitido.
- Modificado: `tests/product-demo-shell.test.js`, para verificar que el envío
  remoto queda detrás del modo dev explícito, en vez de exigir que el archivo
  nunca use `fetch`.
- Modificado: `tests/supabase-readonly-panel.test.js`, para conservar la
  comprobación de aislamiento del panel C4 sin confundir su URL con el
  endpoint de envío C6.
- Creado: `tests/demo-supabase-dev-submit.test.js`.
- Creado y ejecutado solo en el proyecto dev: `docs/proyecto/sql/007_c6_dev_form_configs.sql`.
- Creado: este documento.

No se modificaron la landing, Netlify, el proyecto Supabase de la landing, RLS, Auth, el endpoint C2, Storage, n8n, Gmail, Resend ni Google Sheets.

## Activación, endpoint y slugs

- Reformas: `http://localhost:3000/index.html?sector=reformas&submit=supabase-dev`
- Electricidad: `http://localhost:3000/index.html?sector=electricidad&submit=supabase-dev`

Endpoint de desarrollo:

`POST https://rinrgjancwvcvpzjyqmu.supabase.co/functions/v1/receive-public-form/api/public/forms/:businessSlug/:formSlug/requests`

| Sector | Business slug | Form slug |
| --- | --- | --- |
| Reformas | `reformas-demo-dev` | `solicitud` |
| Electricidad | `electricidad-demo-dev` | `solicitud` |

El SQL idempotente `007` publicó los campos que acepta el endpoint. Para Electricidad se creó solo la configuración mínima de negocio y formulario: no hubo usuarios Auth, contraseñas, membresías ni datos reales.

## Campos enviados y exclusiones

| Sector | Campos de `answers` |
| --- | --- |
| Reformas | `tipo_reforma`, `zona`, `descripcion`, `plazo` |
| Electricidad | `tipo_trabajo`, `riesgo_urgencia`, `zona`, `descripcion` |

El contrato contiene únicamente `contact`, `answers`, `metadata` segura (`source` y sector) y `privacy_notice_version`. Las fotos simuladas se excluyen porque C6 no activa Storage, subida de archivos ni adjuntos. Tampoco se envían `business_id`, estado, prioridad, asignación, resumen, respuesta sugerida, seguimiento ni campos internos.

## Pruebas manuales de envío real

Las pruebas se hicieron desde `http://localhost:3000`, nunca desde `file:///`, y solo con datos ficticios `@solicitudpro.test`.

| Sector | Resultado HTTP visible | Referencia | Registros verificados |
| --- | --- | --- | --- |
| Reformas | Éxito y recibo seguro | `REF-003` | contacto, request, 4 respuestas, 1 seguimiento y 1 actividad |
| Reformas, doble clic | Un solo recibo | `REF-004` | 1 request, 4 respuestas, 1 seguimiento y 1 actividad |
| Electricidad | Éxito y recibo seguro | `ELE-001` | contacto, request, 4 respuestas, 1 seguimiento y 1 actividad |

Los recibos devolvieron referencia, sector y formulario, junto al aviso de que no se enviaron emails ni se activaron automatizaciones.

## Errores, idempotencia y rate limiting

- Los obligatorios se validan antes de red. La interfaz muestra **Revisa los campos marcados antes de continuar** y no prepara campos internos.
- Academias se abrió en modo dev y quedó bloqueada con el mensaje explícito de C6. Fontanería está protegida por la misma configuración cerrada.
- Un doble clic en Reformas creó solo `REF-004`: el botón se bloquea de inmediato y cada intento incorpora un encabezado `Idempotency-Key`.
- El endpoint mantiene la comprobación de misma clave con payload distinto, validada por HTTP real durante C2/C3; C6 no expone un control para manipular esa clave ni payloads internos.
- No se forzó un 429 nuevo para no ensuciar la ventana dev. El límite persistente fue validado en C2/C3 y C6 conserva un mensaje seguro para 429.
- Un fallo de red o servidor muestra un mensaje genérico, sin detalles de Supabase.

## Verificación en Supabase dev

La revisión se hizo solo en `solicitudpro-app-dev`:

- Tres contactos ficticios C6, tres solicitudes, doce respuestas dinámicas, tres seguimientos y tres actividades.
- `REF-003` y `REF-004` pertenecen a `reformas-demo-dev` / `reformas`.
- `ELE-001` pertenece a `electricidad-demo-dev` / `electricidad`.
- Las comprobaciones devolvieron `0` enlaces cruzados entre request y contacto, respuestas, seguimientos o actividades, y `0` referencias duplicadas por negocio.
- RLS sigue activa en las tablas operativas revisadas y hay `0` políticas `anon` sobre ellas.

## Seguridad

- El frontend solo usa la URL pública de la Edge Function, sin `service_role`, contraseñas, tokens privados ni secretos.
- La escritura pasa exclusivamente por el endpoint C2; el formulario no usa Supabase directo ni desactiva RLS.
- No se guardan claves en HTML, JavaScript, pruebas, documentación, `localStorage` ni `sessionStorage`.
- No se usaron datos reales ni se conectaron emails, n8n, Storage, Google Sheets ni OpenAI.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| Formularios visuales de Reformas y Electricidad | Correctos, con recibos y referencias indicadas |
| Demo local normal de Reformas | Botón local habilitado y aviso dev ausente |
| Sector no conectado en modo dev | Academias bloqueada con mensaje explícito |
| Integridad de datos C6 en Supabase | Sin cruces de `business_id` ni duplicados |
| RLS y políticas `anon` | RLS activa; 0 políticas `anon` |
| Pruebas de C6 y presets | Correctas |

## Comandos ejecutados

```sh
node --test tests/*.js
node --check js/script.js
node --check js/request-detail.js
node --check js/follow-up-rules.js
node --check js/sector-presets.js
```

Resultado: **49 pruebas correctas, 0 fallos** y todas las comprobaciones de
sintaxis indicadas superadas. La revisión estática de `index.html` y
`js/script.js` no encontró claves, `service_role`, contraseñas ni tokens
literalmente incluidos en el frontend C6.

## Pendientes y recomendación

- Fontanería y Academias siguen sin conexión desde la demo bonita.
- Electricidad no tiene owner de panel dev porque C6 no amplía Auth ni membresías; se verificó mediante datos de base de datos.
- La prueba de misma clave y la de 429 siguen cubiertas por C2/C3, no por una interfaz expuesta en la demo bonita.
- C7 puede decidir si amplía sectores conectados o plantea acciones internas básicas en un alcance separado y protegido.
