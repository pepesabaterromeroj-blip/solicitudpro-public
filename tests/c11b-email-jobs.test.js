const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
const c11bMigration = fs.readdirSync(migrationsDirectory)
  .find((file) => /_c11b_email_jobs_from_public_form\.sql$/.test(file));

test("C11B creates exactly the two email jobs within the idempotent public submission RPC", () => {
  assert.ok(c11bMigration, "C11B migration is missing");

  const sql = fs.readFileSync(path.join(migrationsDirectory, c11bMigration), "utf8");
  assert.match(sql, /create or replace function public\.submit_public_form_submission/i);
  assert.match(sql, /insert into public\.email_jobs/i);
  assert.match(sql, /customer_confirmation/);
  assert.match(sql, /business_notification/);
  assert.match(sql, /on conflict \(request_id, email_type\) do nothing/i);
  assert.match(sql, /SP_EMAIL_JOBS_NOT_READY/);
});

test("C11B does not add recipients, sending, n8n, or frontend access to email jobs", () => {
  assert.ok(c11bMigration, "C11B migration is missing");

  const sql = fs.readFileSync(path.join(migrationsDirectory, c11bMigration), "utf8");
  const executableSql = sql.replace(/^--.*$/gm, "");
  assert.doesNotMatch(sql, /^\s*(recipient|to_email|from_email|html_body|body_html)\s+/im);
  assert.doesNotMatch(executableSql, /create trigger|pg_net|net\.http|n8n|smtp|resend/i);
  assert.doesNotMatch(sql, /grant .*email_jobs.*(?:anon|authenticated)/i);
});
