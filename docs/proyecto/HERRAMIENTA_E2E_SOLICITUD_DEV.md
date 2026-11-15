# Herramienta E2E de solicitudes DEV

## Objetivo y arquitectura

`scripts/dev-test-request.js` genera una solicitud ficticia de Reformas usando
el mismo contrato y endpoint público que el formulario real:

```text
Node.js -> receive-public-form DEV -> solicitud y email_jobs
```

La utilidad no consulta directamente la base de datos, no contiene
credenciales privilegiadas y no verifica todavía el procesamiento posterior
en n8n o el proveedor de correo.

## Configuración local

El email controlado del cliente se configura una sola vez en `.env.local`:

```dotenv
SOLICITUDPRO_DEV_TEST_CUSTOMER_EMAIL=cliente.controlado@example.test
```

`.env.local` está ignorado por Git. La herramienta lo carga con
`process.loadEnvFile()`. Para una ejecución concreta puede usarse
`--email cliente.temporal@example.test`; el valor no se imprime en la salida
normal ni JSON.

## Dry-run seguro

```powershell
npm run dev:test-request
```

Es el modo predeterminado. Muestra `DEV DRY RUN`, el destino, los slugs, el
`run_id` y el payload sanitizado. No ejecuta `fetch`, no crea solicitudes ni
provoca envíos.

## Prueba real controlada

```powershell
npm run dev:test-request -- --send
```

Solo `--send` habilita un único POST. Antes de enviarlo, la utilidad valida el
host exacto `rinrgjancwvcvpzjyqmu.supabase.co` y exige un email DEV válido. Un
destino diferente termina con `ABORTED: NON-DEV ENDPOINT` sin tráfico de red.

Cada ejecución crea un `run_id` legible, incluido en `descripcion`, y una
`Idempotency-Key` nueva compatible con `receive-public-form`. No existen
reintentos ni bucles: una ejecución puede generar como máximo una solicitud.
El rate limit actual del endpoint también se respeta evitando automatizaciones
frecuentes o ejecuciones en ráfaga.

Una respuesta aceptada muestra `SUCCESS`, el estado HTTP y `reference` cuando
existe. `request_id` solo se muestra si el servidor llega a devolverlo. Los
errores HTTP o de red muestran `FAILED` y producen un exit code distinto de
cero.

## Salida automatizable

```powershell
npm run dev:test-request -- --send --json
```

`--json` emite un único documento JSON sin texto adicional, adecuado para una
futura tarea programada de Codex. El dry-run también admite `--json`:

```powershell
npm run dev:test-request -- --json
```

## Comportamiento y códigos de salida

- `0`: dry-run correcto o solicitud aceptada.
- `2`: configuración, argumento o protección de destino inválidos.
- `3`: respuesta HTTP no exitosa.
- `4`: fallo de red o error interno controlado.

## Uso futuro y limitaciones

Una tarea programada podrá ejecutar dry-runs frecuentes o pruebas reales de
frecuencia moderada sin interacción humana. La comprobación automática de que
se crearon dos `email_jobs` y ambos llegaron a `sent` requerirá posteriormente
una interfaz de lectura limitada; no debe resolverse incorporando credenciales
privilegiadas a esta utilidad.

El endpoint actual devuelve `reference` y `message`, no `request_id`. La
herramienta conserva esa realidad y no inventa identificadores. Tampoco sube
adjuntos ni realiza reintentos automáticos.
