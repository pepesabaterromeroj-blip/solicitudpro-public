# C13A — n8n conectado al worker de email en DEV

## Arquitectura validada

```text
Formulario / Supabase
  → public.email_jobs
  → Edge Function email-job-worker
  → n8n Cloud DEV
```

Supabase continúa como fuente de verdad. n8n consume únicamente el contrato
acotado del worker y no accede directamente a tablas ni recibe `service_role`.

## Autenticación

Los nodos HTTP usan una credencial n8n **Header Auth** con el contrato
`Authorization: Bearer <EMAIL_WORKER_SECRET>`. El secreto compartido existe
únicamente en los secretos de Supabase y en n8n Credentials. La credencial de
la instancia real se restringió al dominio del proyecto Supabase DEV.

El repositorio no contiene el valor del secreto, IDs reales de credentials,
IDs de cuenta o instancia, tokens ni credenciales privilegiadas. El workflow
portable conserva placeholders explícitos para URL y credential.

## Workflows

- `SolicitudPro DEV - Email Worker C13A`: importado y probado manualmente.
- `SolicitudPro DEV - Error Handler`: importado, publicado y asociado al Email
  Worker desde Workflow Settings.
- Estado del Error Handler: **PUBLICADO Y ASOCIADO — DISPARO AUTOMÁTICO
  PENDIENTE DE VALIDACIÓN C13B**. Una ejecución manual correcta no demuestra el
  disparo del Error Trigger.

No se versiona el workflow ID de la instancia usado por la asociación. Tras una
nueva importación, la selección del Error Handler se realiza manualmente.

## Comparación del export real y el portable

La comparación completa, semántica y nodo por nodo confirmó los mismos once
nodos, conexiones, `typeVersion`, expresiones, routing y payloads. La
importación/configuración real introdujo únicamente datos no portables o de
presentación: IDs regenerados de nodos y workflow, posiciones, ID y nombre de
credential, URL DEV real, `instanceId`, `versionId`, `binaryMode` y dimensiones
de una nota.

n8n eliminó además `contentType: "json"` de los dos nodos `/failed`; era
redundante porque ambos mantienen `Content-Type: application/json` y
`specifyBody: "json"`. El portable se sincronizó con esa representación
validada. Se conservaron sus IDs estructurales internos, los placeholders de
URL/credential y se descartó toda metadata de instancia.

## Prueba real en n8n Cloud DEV

Se realizó una ejecución manual con `limit = 5` y `lease_seconds = 300`:

- `/claim` devolvió cinco jobs independientes.
- Dos jobs fueron `customer_confirmation`.
- Tres jobs fueron `business_notification`.
- Ningún job cayó en el fallback de tipo desconocido.
- `pairedItem` preservó la relación de cada item y ambas ramas confluyeron en
  el retry controlado.
- `/failed` con `retry_at` futuro funcionó; C13A programó el retry a diez
  minutos porque todavía no existe envío real.
- La ejecución terminó sin nodos rojos y no llamó a `/sent`.

Después de ejecutar, los cinco jobs quedaron `pending`, con
`attempt_count = 1`, `available_at` aproximadamente diez minutos posterior,
`claim_token = NULL`, `lease_expires_at = NULL` y `sent_at = NULL`. El error
controlado fue `C13A: envío real todavía no configurado.`. Los jobs fuera del
batch conservaron `attempt_count = 0`; no quedó ningún job en `processing` y no
se envió ningún email real.

## Contrato confirmado

El workflow coincide con la Edge Function, `worker-contract.ts`, la migración
PRE-C13B, sus tests y el resultado documentado:

- `POST /claim`: `limit`, `lease_seconds`.
- Respuesta por job: `job_id`, `email_type`, `claim_token` y contexto.
- Tipos soportados: `customer_confirmation` y `business_notification`.
- `POST /failed`: `job_id`, `claim_token`, error saneado y `retry_at` opcional.
- Tipo desconocido: `/failed` sin `retry_at`, fallo terminal.
- C13A no usa `POST /sent`.

## Seguridad y alcance

El export real permanece fuera del repositorio como evidencia y no se copia.
El template versionado no contiene la URL DEV real ni referencias reales de la
credential. El Error Handler reduce su salida a fecha, workflow, nodo, ID de
ejecución, mensaje saneado y estado; elimina emails, Authorization, Bearer,
keys, tokens, passwords, secrets y credentials, limita el mensaje a 500
caracteres y no conserva payloads, headers ni stacks completos. Su salida
actual es un fallback `NoOp` seguro.

C13A no envía emails, no usa `/sent`, no integra OpenAI, no crea seguimientos
24/48/72 y no activa Schedule ni producción. No modifica backend, migrations,
Supabase remoto, Edge Functions, RLS, Auth, panel, formularios ni landing.

## Siguiente objetivo: C13B

C13B incorporará un proveedor real para `customer_confirmation` y
`business_notification`; llamará a `/sent` únicamente tras confirmación del
proveedor, usará `/failed + retry_at` ante fallos transitorios y fallo terminal
cuando corresponda, definirá idempotencia/delivery y realizará una prueba desde
una solicitud real DEV. También deberá validar el disparo automático del Error
Handler con una ejecución fallida controlada.
