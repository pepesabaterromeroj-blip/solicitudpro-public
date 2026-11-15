const assert = require("node:assert/strict");
const test = require("node:test");

const {
  LANGUAGE_STORAGE_KEY,
  resolveDemoLanguage,
  buildLanguageUrl,
  createTranslator,
} = require("../js/demo-i18n.js");
const { renderRequestRows } = require("../js/real-product.js");

test("resolves the initial demo language from an explicit URL before stored and browser preferences", () => {
  assert.equal(resolveDemoLanguage({ search: "?lang=en", stored: "es", languages: ["es-ES"] }), "en");
  assert.equal(resolveDemoLanguage({ search: "", stored: "es", languages: ["en-GB"] }), "es");
  assert.equal(resolveDemoLanguage({ search: "", stored: "", languages: ["es-ES", "en"] }), "es");
  assert.equal(resolveDemoLanguage({ search: "", stored: "", languages: ["fr-FR"] }), "en");
  assert.equal(LANGUAGE_STORAGE_KEY, "solicitudpro-demo-language");
});

test("builds a shareable English URL without changing the current demo mode or sector", () => {
  assert.equal(
    buildLanguageUrl("http://127.0.0.1:3000/index.html?sector=reformas&mode=local", "en"),
    "/index.html?sector=reformas&mode=local&lang=en"
  );
});

test("translates product labels and preserves unknown dynamic values", () => {
  const t = createTranslator("en");
  assert.equal(t("Solicitudes"), "Requests");
  assert.equal(t("Seguimientos"), "Follow-ups");
  assert.equal(t("Nuevo"), "New");
  assert.equal(t("Álvaro Ríos"), "Álvaro Ríos");
});

test("real product rendering remains usable in Node without a browser document", () => {
  assert.doesNotThrow(() => renderRequestRows([{
    id: "request-1",
    reference: "REQ-001",
    status: "Nuevo",
    created_at: "2026-11-13T12:00:00Z",
    priority: 1,
    contact: { display_name: "Demo contact" },
  }]));
});
