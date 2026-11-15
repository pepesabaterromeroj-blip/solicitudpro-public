const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const seedPath = path.join(root, "docs", "proyecto", "sql", "008_c7_dev_multisector_panel.sql");

test("keeps the C7 multisector development seed idempotent and free of Auth credentials", () => {
  assert.equal(fs.existsSync(seedPath), true, "C7 must provide the local dev seed");

  const sql = fs.readFileSync(seedPath, "utf8");

  assert.match(sql, /electricidad-demo-dev/);
  assert.match(sql, /fontaneria-demo-dev/);
  assert.match(sql, /Owner Electricidad Dev/);
  assert.match(sql, /Owner Fontanería Dev/);
  assert.match(sql, /FON-001/);
  assert.match(sql, /on conflict/i);
  assert.doesNotMatch(sql, /auth\.users/i);
  assert.doesNotMatch(sql, /password|service_role|secret|create policy|alter table.*row level security/i);
  assert.doesNotMatch(sql, /drop\s+table|delete\s+from/i);
});
