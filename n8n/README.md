# Workflows n8n de SolicitudPro

## Legacy externos

Los exports originales se conservan localmente fuera de Git, en
`D:\demo Solicitudpro\flujo n8n\`, únicamente como referencia histórica. No
forman parte del repositorio ni deben importarse como arquitectura actual.

GitHub contiene únicamente los workflows preparados y saneados de
`n8n/prepared/`.

## Prepared

`prepared/` contiene los workflows portables y saneados que se usaron como base
de la validación real de C13A en n8n Cloud DEV:

1. Importar primero `SolicitudPro_DEV_Error_Handler.json`.
2. Publicar `SolicitudPro DEV - Error Handler`.
3. Importar `SolicitudPro_DEV_Email_Worker_C13A.json`.
4. Crear una credencial **Header Auth**:
   - Name: `Authorization`;
   - Value: `Bearer <secret>`.
5. Restringir la credencial al dominio Supabase correspondiente.
6. Sustituir `YOUR_DEV_PROJECT` en las tres URLs y asignar la credencial a los
   tres nodos HTTP.
7. En los Settings del Email Worker, seleccionar manualmente
   `SolicitudPro DEV - Error Handler` como Error workflow.
8. Mantener el Email Worker sin Schedule y sin activación de producción.
9. Probar únicamente con **Manual Trigger**.
10. Comprobar después en Supabase el estado, intento, retry y limpieza del claim.

El Email Worker se mantiene inactivo y sin Schedule. El Error Handler fue
publicado y asociado en la instancia DEV; su disparo automático real todavía no
se ha validado.

## Configuración necesaria al activar n8n

- Sustituir `YOUR_DEV_PROJECT` por el host real del proyecto Supabase DEV.
- Crear una credencial **Header Auth** con nombre del header `Authorization` y
  valor `Bearer <secret>`.
- Restringir la credencial al dominio Supabase configurado para esa instancia.
- Reasignar esa credencial a los tres nodos HTTP después de importar.
- Guardar el secreto únicamente en n8n Credentials; nunca en el workflow, el
  repositorio o los logs.

## Primera prueba controlada

1. Mantener el Email Worker sin Schedule ni activación de producción.
2. Configurar la URL DEV y asignar la credencial Header Auth a los tres nodos
   HTTP.
3. En `Options > Settings > Error workflow`, asociar manualmente el Error
   Handler generado por la nueva instancia.
4. Ejecutar únicamente el **Manual Trigger** y comprobar claim, contexto,
   routing por `email_type` y vuelta a `pending` mediante retry.
5. Confirmar que ningún job queda en `processing`, que el claim y el lease se
   limpian, y que ningún job se marca falsamente como `sent`.

El Error Trigger no se ejecuta durante una prueba manual de n8n; su validación
real deberá hacerse posteriormente con una ejecución automática controlada.

El worker C13A, validado con un batch real de cinco jobs y lease de 300 segundos, distingue el
campo contractual `email_type` y, como todavía no existe envío, devuelve los
dos tipos conocidos a `pending` mediante `/failed` y un `retry_at` de diez
minutos. Nunca llama a `/sent`. Un tipo desconocido se marca como fallo
terminal para no dejar un claim abandonado.

## Pendiente por fase

- **C13A:** finalizado el puente n8n DEV: importación, credencial, asociación del
  Error Handler, claim, ramas y retry validados. El disparo automático del Error
  Handler queda pendiente para C13B.
- **C13B:** incorporar el envío real, el proveedor, las plantillas y la
  idempotencia con `delivery_id`; llamar `/sent` solo tras confirmación real
  del proveedor y aplicar la política definitiva de retry.
- **C13C:** decidir si se añade enriquecimiento con IA para contenido interno.
  Deberá reutilizar el contexto normalizado y evitar dos generaciones para los
  dos `email_jobs` de una misma solicitud. No debe crear ni duplicar
  follow-ups.

Supabase continúa como fuente de verdad. Google Sheets queda únicamente como
posible integración opcional futura, no como base principal.
