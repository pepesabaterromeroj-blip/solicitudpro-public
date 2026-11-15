const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const panelPath = path.join(root, "dev", "panel-product-readonly.html");
const scriptPath = path.join(root, "dev", "panel-product-readonly.js");
const cssPath = path.join(root, "dev", "panel-product-readonly.css");
const technicalPanelPath = path.join(root, "dev", "panel-supabase-readonly.html");

test("keeps the responsive detail within the viewport with a sticky close header", () => {
  const css = fs.readFileSync(cssPath, "utf8");
  const narrow = css.slice(css.indexOf('@media (max-width: 1040px)'));
  assert.match(narrow, /\.detail-drawer\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*12px;/);
  assert.match(narrow, /height:\s*calc\(100dvh - 24px\)/);
  assert.match(css, /\.detail-drawer\s*\{[^}]*overflow:\s*auto;[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.detail-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/);
  assert.match(narrow, /body:has\(\.detail-drawer:not\(\[hidden\]\)\)\s*\{\s*overflow:\s*hidden/);
});

test("provides a separate visual C9A panel while retaining the technical fallback", () => {
  assert.equal(fs.existsSync(panelPath), true, "the product panel must exist");
  assert.equal(fs.existsSync(scriptPath), true, "the product panel script must exist");
  assert.equal(fs.existsSync(cssPath), true, "the product panel stylesheet must exist");
  assert.equal(fs.existsSync(technicalPanelPath), true, "the technical fallback must remain");

  const html = fs.readFileSync(panelPath, "utf8");
  const source = `${html}\n${fs.readFileSync(scriptPath, "utf8")}`;
  assert.match(html, /SolicitudPro/);
  assert.match(html, /Panel interno/);
  assert.match(html, /Supabase dev/);
  assert.match(html, /Gestión interna/);
  assert.match(html, /Limpiar filtros/);
  assert.match(html, /panel-product-readonly\.css/);
  assert.match(html, /panel-product-readonly\.js/);
  assert.match(source, /No hay resultados para los filtros actuales/);
});

test("keeps product authentication safe and the technical fallback read-only", () => {
  const source = `${fs.readFileSync(panelPath, "utf8")}\n${fs.readFileSync(scriptPath, "utf8")}`;

  assert.match(source, /rinrgjancwvcvpzjyqmu/);
  assert.match(source, /auth\/v1\/token\?grant_type=password/);
  assert.match(source, /method:\s*["']GET["']/);
  assert.match(source, /credentials:\s*["']omit["']/);
  assert.match(source, /Solicitud no disponible o no permitida/);
  assert.doesNotMatch(source, /service_role/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /(?:supabase|rest\/v1)[\s\S]{0,240}\.(?:insert|update|delete|upsert)\(/i);
  assert.doesNotMatch(source, /method:\s*["'](?:PUT|DELETE)["']/i);
  assert.doesNotMatch(fs.readFileSync(technicalPanelPath, 'utf8'), /method:\s*["'](?:PUT|PATCH|DELETE)["']/i);
  assert.doesNotMatch(source, /password\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(source, /(?:access_token|refresh_token)\s*[:=]\s*["'][^"']+["']/i);
  assert.doesNotMatch(source, /method:\s*["']DELETE["']/i);
  assert.doesNotMatch(source, /<button[^>]*>\s*(?:Borrar|Enviar email)/i);
});

test("offers every approved development owner without storing credentials", () => {
  const html = fs.readFileSync(panelPath, "utf8");

  for (const owner of [
    "owner.reformas.dev@solicitudpro.test",
    "owner.electricidad.dev@solicitudpro.test",
    "owner.fontaneria.dev@solicitudpro.test",
    "owner.climatizacion.dev@solicitudpro.test",
    "owner.cristaleria.dev@solicitudpro.test",
    "owner.academia.dev@solicitudpro.test",
  ]) {
    assert.match(html, new RegExp(owner.replace(/[.@]/g, "\\$&")));
  }
  assert.match(html, /La sesi[oó]n se conserva solo en memoria/);
});

test("keeps technical answer and activity metadata out of the customer-facing detail", () => {
  const script = fs.readFileSync(scriptPath, "utf8");
  const detailRenderer = script.slice(script.indexOf("function renderDetail"), script.indexOf("async function loadRequestDetail"));

  assert.doesNotMatch(detailRenderer, /\$\{escapeHtml\(answer\.key\)\}/);
  assert.doesNotMatch(detailRenderer, /\$\{escapeHtml\(answer\.type\)\}/);
  assert.doesNotMatch(detailRenderer, /\$\{escapeHtml\(item\.type \|\| "Sin tipo"\)\}/);
});
