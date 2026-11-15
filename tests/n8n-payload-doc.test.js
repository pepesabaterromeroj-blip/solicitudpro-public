const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("documents the future n8n webhook payload without enabling a real integration", () => {
  const html = readProjectFile("index.html");
  const docs = readProjectFile("docs/n8n-workflow-demo.md");

  assert.match(html, /id="payload-n8n"/);
  assert.match(html, /Payload futuro para n8n/);
  assert.match(html, /No envía datos todavía/);
  assert.match(html, /cliente_nombre/);
  assert.match(html, /respuesta_sugerida/);
  assert.match(html, /historial_actividad/);

  assert.match(docs, /## Payload futuro para webhook n8n/);
  assert.match(docs, /cliente_nombre/);
  assert.match(docs, /respuesta_sugerida/);
  assert.match(docs, /historial_actividad/);
  assert.match(docs, /No se debe llamar este webhook desde el frontend/);
});
