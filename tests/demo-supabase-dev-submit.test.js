const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("keeps Supabase development submission explicit and extends it minimally to Academias in C12B2", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

  assert.match(script, /get\("submit"\) === "supabase-dev"/);
  assert.match(script, /reformas-demo-dev/);
  assert.match(script, /electricidad-demo-dev/);
  assert.match(script, /fontaneria-demo-dev/);
  assert.match(script, /climatizacion-demo-dev/);
  assert.match(script, /cristaleria-demo-dev/);
  assert.match(script, /academia-demo-dev/);
  assert.match(script, /formSlug: "clases"/);
  assert.match(script, /materia: "materia"[\s\S]*?disponibilidad: "disponibilidad"/);
  [
    "reformas",
    "electricidad",
    "fontaneria",
    "climatizacion",
    "cristaleria",
    "academias",
  ].forEach((sector) => assert.match(script, new RegExp(`\\b${sector}: \\{`)));
  assert.match(script, /Idempotency-Key/);
  assert.match(script, /Modo desarrollo · Envío a Supabase dev · Datos ficticios/);
  assert.match(index, /id="supabase-dev-form-notice"/);
});

test("maps only published answers for Fontanería, Climatización and Cristalerías", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(script, /fontaneria:[\s\S]*?businessSlug: "fontaneria-demo-dev"[\s\S]*?tipoIncidencia: "tipo_incidencia"[\s\S]*?aguaActivaUrgencia: "agua_activa_urgencia"[\s\S]*?description: "descripcion"/);
  assert.match(script, /climatizacion:[\s\S]*?businessSlug: "climatizacion-demo-dev"[\s\S]*?tipoTrabajo: "tipo_trabajo"[\s\S]*?tipoEquipo: "tipo_equipo"[\s\S]*?description: "descripcion"/);
  assert.match(script, /cristaleria:[\s\S]*?businessSlug: "cristaleria-demo-dev"[\s\S]*?tipoTrabajo: "tipo_trabajo"[\s\S]*?medidasAproximadas: "medidas_aproximadas"[\s\S]*?description: "descripcion"/);
  assert.doesNotMatch(script, /attachments:\s*"/);
  assert.doesNotMatch(script, /business_id/);
  assert.doesNotMatch(script, /status:\s*formValues/);
  assert.doesNotMatch(script, /priority:\s*formValues/);
});

test("submits only the public endpoint contract from the sector demo", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(script, /receive-public-form\/api\/public\/forms/);
  assert.match(script, /privacy_notice_version/);
  assert.match(script, /answers,\s+metadata:/);
  assert.match(script, /contact:/);
  assert.match(script, /No se pudo conectar con Supabase dev/);
  assert.match(script, /Hay demasiados intentos de prueba/);
  assert.match(script, /No se pudo guardar la solicitud de prueba/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(script, /service_role/);
  assert.doesNotMatch(script, /assigned_to/);
  assert.doesNotMatch(script, /internal_summary/);
  assert.doesNotMatch(script, /suggested_reply/);
});

test("reuses an idempotency key only for an identical payload in the same sector", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(script, /activeSupabaseDevSubmission/);
  assert.match(script, /payloadFingerprint/);
  assert.match(script, /activeSupabaseDevSubmission\?\.sector === activeSector/);
  assert.match(script, /activeSupabaseDevSubmission\?\.payloadFingerprint === payloadFingerprint/);
  assert.match(script, /activeSupabaseDevSubmission\.key/);
});
