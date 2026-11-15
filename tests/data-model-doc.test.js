const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

test("documents the future data model without creating a real database", () => {
  const html = readProjectFile("index.html");
  const docs = readProjectFile("docs/data-model.md");
  const readme = readProjectFile("README.md");

  assert.match(html, /id="modelo-datos"/);
  assert.match(html, /Modelo de datos futuro/);
  assert.match(html, /No crea una base de datos real/);
  assert.match(html, /Negocio/);
  assert.match(html, /Contacto/);
  assert.match(html, /Solicitud/);
  assert.match(html, /Seguimiento/);
  assert.match(html, /Mensaje/);
  assert.match(html, /Evento de automatización/);

  assert.match(docs, /# Modelo de datos futuro/);
  assert.match(docs, /## Entidades principales/);
  assert.match(docs, /businesses/);
  assert.match(docs, /contacts/);
  assert.match(docs, /requests/);
  assert.match(docs, /follow_ups/);
  assert.match(docs, /messages/);
  assert.match(docs, /automation_events/);
  assert.match(docs, /No se debe crear todavia una base de datos real/);

  assert.match(readme, /Modelo de datos futuro documentado/);
});
