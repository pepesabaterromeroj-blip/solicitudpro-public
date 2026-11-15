# Diario de Aprendizaje de Verano

App frontend estatica para seguir un plan de aprendizaje de 1 hora al dia, de lunes a viernes, desde el 22 de junio de 2026 hasta el 31 de agosto de 2026.

## Como abrirla en local

No necesita instalacion ni backend.

1. Abre `diario-aprendizaje-verano/index.html` en el navegador.
2. O sirve esta carpeta con un servidor estatico local.

## Como desplegar en Netlify

Opcion sencilla:

1. Entra en Netlify.
2. Arrastra la carpeta `diario-aprendizaje-verano` a Deploy manually.
3. Netlify publicara el contenido estatico.

Opcion desde repositorio:

1. Crea un sitio nuevo desde Git.
2. Usa `diario-aprendizaje-verano` como base directory.
3. No hace falta build command.
4. Publish directory: `.`

## Persistencia

El progreso se guarda en `localStorage` con:

- estado del dia
- motivo de pausa
- nota de pausa
- notas de aprendizaje
- checklist
- fecha de ultima actualizacion

No hay backend, login, base de datos externa ni APIs de pago.
