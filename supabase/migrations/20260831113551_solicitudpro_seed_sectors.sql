-- SolicitudPro: datos de referencia para sectores iniciales.
-- Archivo local para revisión. No se ha ejecutado en Supabase.

insert into public.sectors (slug, name, description)
values
  (
    'reformas',
    'Reformas',
    'Solicitudes con fotos, medidas, visitas y presupuestos orientativos.'
  ),
  (
    'electricidad',
    'Electricidad',
    'Averías, instalaciones, urgencias y revisiones con criterios de seguridad.'
  ),
  (
    'fontaneria',
    'Fontanería',
    'Fugas, atascos, termos e incidencias con prioridad según agua o daño activo.'
  ),
  (
    'academias',
    'Academias',
    'Solicitudes de clases según materia, nivel, objetivo, modalidad y disponibilidad.'
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

