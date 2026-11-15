const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const testerPath = path.join(__dirname, "..", "dev", "public-form-tester.html");

test("keeps the public form tester isolated, safe, and limited to Supabase development", () => {
  const tester = fs.readFileSync(testerPath, "utf8");

  assert.match(tester, /Formulario aislado de desarrollo\. No usar con datos reales\./);
  assert.match(tester, /rinrgjancwvcvpzjyqmu\.supabase\.co/);
  assert.match(tester, /reformas-demo-dev/);
  assert.match(tester, /academia-demo-dev/);
  assert.match(tester, /solicitud/);
  assert.match(tester, /clases/);
  assert.match(tester, /Idempotency-Key/);
  assert.match(tester, /crypto\.randomUUID/);
  assert.match(tester, /tipo_reforma/);
  assert.match(tester, /disponibilidad/);
  assert.doesNotMatch(tester, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(tester, /service_role/);
  assert.doesNotMatch(tester, /business_id/);
  assert.doesNotMatch(tester, /assigned_to/);
  assert.doesNotMatch(tester, /localStorage/);
});
