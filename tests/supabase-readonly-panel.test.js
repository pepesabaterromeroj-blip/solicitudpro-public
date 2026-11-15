const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const testerPath = path.join(root, "dev", "panel-supabase-readonly.html");

test("keeps the Supabase development panel isolated and explicitly read-only", () => {
  assert.equal(fs.existsSync(testerPath), true, "the isolated panel must exist");

  const html = fs.readFileSync(testerPath, "utf8");

  assert.match(html, /Modo desarrollo · Supabase dev · Solo lectura/);
  assert.match(html, /rinrgjancwvcvpzjyqmu/);
  assert.match(html, /auth\/v1\/token\?grant_type=password/);
  assert.match(html, /getRows\("requests"/);
  assert.match(html, /rest\/v1\/\$\{table\}\?\$\{query\}/);
  assert.match(html, /credentials:\s*["']omit["']/);
  assert.match(html, /No se guarda la sesi[oó]n/);
  assert.doesNotMatch(html, /service_role/i);
  assert.doesNotMatch(html, /localStorage|sessionStorage/);
  assert.doesNotMatch(html, /rest\/v1\/[\s\S]{0,200}method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
  const methods = [...html.matchAll(/method:\s*["']([A-Z]+)["']/g)].map((match) => match[1]);
  assert.deepEqual(methods.sort(), ["GET", "POST"]);
  assert.match(html, /auth\/v1\/token\?grant_type=password/);
  assert.doesNotMatch(html, /password\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(html, /(?:access_token|refresh_token)\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(html, /<form[^>]+action=/i);
});

test("offers the approved fictional development owners without credentials", () => {
  const html = fs.readFileSync(testerPath, "utf8");

  assert.match(html, /owner\.reformas\.dev@solicitudpro\.test/);
  assert.match(html, /owner\.electricidad\.dev@solicitudpro\.test/);
  assert.match(html, /owner\.fontaneria\.dev@solicitudpro\.test/);
  assert.match(html, /owner\.academia\.dev@solicitudpro\.test/);
  assert.match(html, /owner\.climatizacion\.dev@solicitudpro\.test/);
  assert.match(html, /owner\.cristaleria\.dev@solicitudpro\.test/);
  assert.doesNotMatch(html, /password\s*[:=]\s*["'][^"']+["']/i);
});

test("leaves the main local demo outside the Supabase read-only mode", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.doesNotMatch(index, /panel-supabase-readonly/);
  assert.doesNotMatch(script, /panel-supabase-readonly/);
  assert.match(script, /get\("submit"\) === "supabase-dev"/);
});

test("provides an isolated, read-only request detail with a safe denied state", () => {
  const html = fs.readFileSync(testerPath, "utf8");

  assert.match(html, /Ver detalle/);
  assert.match(html, /Detalle de solicitud · Solo lectura/);
  assert.match(html, /Solicitud no disponible o no permitida/);
  assert.match(html, /getRows\("form_fields"/);
  assert.match(html, /getRows\("attachments"/);
  assert.match(html, /async function loadRequestDetail/);
  assert.match(html, /method:\s*["']GET["']/);
  assert.doesNotMatch(html, /(?:Guardar|Eliminar|Enviar email|Cambiar estado)/i);
});
