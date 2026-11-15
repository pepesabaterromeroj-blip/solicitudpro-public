# SolicitudPro

SolicitudPro Demo v1.0

SolicitudPro es una plataforma SaaS para pequeños negocios de servicios que
convierte solicitudes de clientes en trabajo organizado: datos estructurados,
resumen operativo, respuesta sugerida y seguimiento.

Este snapshot está preparado para portfolio. Incluye código y documentación
saneados; los ejemplos usan datos ficticios y no contienen credenciales.

## Qué demuestra

- Captación de solicitudes y formularios sectoriales.
- Panel con métricas, prioridades, estados y búsqueda.
- Detalle de solicitud con contacto, respuestas personalizadas, enrichment,
  notas, actividad, adjuntos privados y comunicaciones.
- Seguimientos manuales y automatizaciones de hitos.
- Auth, membresías y aislamiento multi-tenant mediante `business_id` y RLS.
- Integración preparada para Supabase, funciones seguras y workflows n8n.
- Demo local aislada (`?mode=local`) para explorar la interfaz sin servicios
  externos.

## Arquitectura resumida

```text
Frontend web (HTML, CSS, JavaScript)
        ↓
Data layer y contratos seguros
        ↓
Supabase Auth / Postgres / RLS / Storage / Edge Functions
        ↓
Automatizaciones y workflows controlados
```

La autorización real pertenece a Auth, membresías y RLS; el estado del cliente
no se considera permiso. Las claves privadas y configuraciones de entorno no
forman parte de este snapshot.

## Ejecutar la demo local

Requisitos: Node.js y un navegador moderno.

```powershell
python -m http.server 3000
```

Abre `http://127.0.0.1:3000/?mode=local&sector=reformas`.
La demo local utiliza únicamente datos ficticios almacenados en el navegador.
Para una integración DEV real se necesita configurar un entorno propio con
credenciales fuera de Git; no se incluyen valores privados aquí.
Modelo de datos futuro documentado como referencia; no crea una base
de datos por sí mismo.

## Tests y validación

```powershell
npm test
npm run build
```

El build ejecuta comprobaciones de sintaxis JavaScript. Los tests cubren los
contratos y comportamientos principales del proyecto saneado.

## Estructura

```text
index.html          entrada de la demo
css/                estilos y responsive
js/                 UI, datos y contratos de frontend
supabase/           migraciones, funciones y pruebas versionadas
n8n/                workflows preparados y documentación asociada
tests/              pruebas automatizadas
docs/proyecto/      resultados técnicos y decisiones del producto
```

## Estado

SolicitudPro es un producto en evolución con una base técnica avanzada y
validada en entorno DEV. Este repositorio público sirve para mostrar la
arquitectura y el trabajo de ingeniería; no constituye una promesa de servicio
de producción ni incluye datos de clientes reales.

## Licencia

No se incluye licencia todavía. Al tratarse de un SaaS comercial, la opción
recomendada para esta fase es mantener el código visible sin conceder derechos
de reutilización hasta definir la estrategia comercial y legal.
