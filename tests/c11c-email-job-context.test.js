const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
const c11cMigration = fs.readdirSync(migrationsDirectory)
  .find((file) => /_c11c_email_job_context\.sql$/.test(file));

function readMigration() {
  assert.ok(c11cMigration, "C11C migration is missing");
  return fs.readFileSync(path.join(migrationsDirectory, c11cMigration), "utf8");
}

test("C11C exposes one stable read-only JSON context for an email job", () => {
  const sql = readMigration();

  assert.match(sql, /create function public\.get_email_job_context\(p_email_job_id uuid\)/i);
  assert.match(sql, /returns jsonb/i);
  assert.match(sql, /language sql/i);
  assert.match(sql, /stable/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /jsonb_build_object\([\s\S]*'job'[\s\S]*'recipient_email'[\s\S]*'business'[\s\S]*'customer'[\s\S]*'request'[\s\S]*'answers'/i);
});

test("C11C derives recipients and preserves multi-tenant joins", () => {
  const sql = readMigration();

  assert.match(sql, /when ej\.email_type = 'customer_confirmation' then c\.email/i);
  assert.match(sql, /when ej\.email_type = 'business_notification' then b\.contact_email/i);
  assert.match(sql, /r\.id = ej\.request_id[\s\S]*r\.business_id = ej\.business_id/i);
  assert.match(sql, /c\.id = r\.contact_id[\s\S]*c\.business_id = r\.business_id/i);
  assert.match(sql, /a\.request_id = r\.id[\s\S]*a\.business_id = r\.business_id/i);
});

test("C11C returns ordered human answers without technical metadata", () => {
  const sql = readMigration();
  const resultObject = sql.match(/jsonb_build_object\(\s*'label',[\s\S]*?'value',[\s\S]*?\)/i);

  assert.ok(resultObject, "Human answer object is missing");
  assert.match(sql, /coalesce\(nullif\(btrim\(a\.label_snapshot\), ''\), ff\.label\)/i);
  assert.match(sql, /order by ff\.display_order/i);
  assert.doesNotMatch(resultObject[0], /field_key|field_type|display_order|slug/i);
  assert.match(sql, /when jsonb_typeof\(a\.value_jsonb\) = 'boolean'[\s\S]*'Sí'[\s\S]*'No'/i);
  assert.match(sql, /jsonb_array_elements_text/i);
});

test("C11C remains backend-only and has no write or delivery side effects", () => {
  const sql = readMigration();
  const executableSql = sql.replace(/^\s*--.*$/gm, "");

  assert.match(sql, /revoke execute on function public\.get_email_job_context\(uuid\) from public/i);
  assert.match(sql, /revoke execute on function public\.get_email_job_context\(uuid\) from anon/i);
  assert.match(sql, /revoke execute on function public\.get_email_job_context\(uuid\) from authenticated/i);
  assert.match(sql, /grant execute on function public\.get_email_job_context\(uuid\) to service_role/i);
  assert.doesNotMatch(executableSql, /\b(insert|update|delete|merge|truncate)\b/i);
  assert.doesNotMatch(executableSql, /pg_net|net\.http|smtp|n8n|resend|create trigger/i);
});
