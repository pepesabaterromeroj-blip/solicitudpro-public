const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const sqlPath = path.join(
  root,
  "docs",
  "proyecto",
  "sql",
  "009_c8a_dev_new_priority_sectors.sql"
);

test("defines an idempotent fictional C8A seed without Auth administration or RLS changes", () => {
  assert.equal(fs.existsSync(sqlPath), true, "C8A requires its development seed");

  const sql = fs.readFileSync(sqlPath, "utf8");

  [
    "climatizacion",
    "cristaleria",
    "climatizacion-demo-dev",
    "cristaleria-demo-dev",
    "CLI-001",
    "CRI-001",
    "fca0e098-36df-47ff-9de0-cd54a34d9fee",
    "a8942ced-aeea-4882-adec-776b9ad9cbbc",
  ].forEach((value) => assert.match(sql, new RegExp(value, "i")));

  assert.match(sql, /on conflict/i);
  assert.match(sql, /insert into public\.profiles/i);
  assert.match(sql, /insert into public\.business_users/i);
  assert.match(sql, /insert into public\.request_custom_answers/i);
  assert.match(sql, /insert into public\.follow_ups/i);
  assert.match(sql, /insert into public\.activities/i);
  assert.doesNotMatch(sql, /auth\.users/i);
  assert.doesNotMatch(sql, /password|service_role|secret/i);
  assert.doesNotMatch(sql, /alter table.*enable row level security|create policy|drop table|delete from/i);
});
