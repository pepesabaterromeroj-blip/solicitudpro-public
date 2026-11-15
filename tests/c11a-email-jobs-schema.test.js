const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260910082352_c11a_email_jobs.sql",
);
const indexFixPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260910082542_c11a_email_jobs_fk_index.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const indexFix = fs.readFileSync(indexFixPath, "utf8");

test("C11A defines a minimal email job lifecycle and the two C11B job types", () => {
  assert.match(migration, /create table public\.email_jobs/i);
  assert.match(migration, /customer_confirmation/);
  assert.match(migration, /business_notification/);
  assert.match(migration, /pending.*processing.*sent.*failed/s);
  assert.match(migration, /attempt_count smallint not null default 0/i);
  assert.match(migration, /available_at timestamptz not null default now\(\)/i);
  assert.match(migration, /processing_started_at timestamptz/i);
  assert.match(migration, /sent_at timestamptz/i);
  assert.match(migration, /last_error text/i);
});

test("C11A enforces tenant-safe request linkage and per-request type idempotency", () => {
  assert.match(migration, /foreign key \(request_id, business_id\)[\s\S]*references public\.requests \(id, business_id\)/i);
  assert.match(migration, /unique \(request_id, email_type\)/i);
  assert.match(indexFix, /drop index public\.email_jobs_business_request_idx/i);
  assert.match(indexFix, /email_jobs_request_business_fk_idx[\s\S]*\(request_id, business_id\)/i);
  assert.match(migration, /email_jobs_pending_idx[\s\S]*where status = 'pending'/i);
});

test("C11A keeps the queue backend-only while enabling RLS", () => {
  assert.match(migration, /alter table public\.email_jobs enable row level security/i);
  assert.match(migration, /revoke all on table public\.email_jobs from anon, authenticated/i);
  assert.match(migration, /grant select, insert, update, delete on table public\.email_jobs to service_role/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /service_role\s*[:=]/i);
});

test("C11A does not add email payloads, credentials, providers, or automatic creation", () => {
  assert.doesNotMatch(
    migration,
    /^\s*(html_body|body_html|credential|password|api_key|provider_token)\s+/im,
  );
  assert.doesNotMatch(migration, /create trigger|create function|net\.http|pg_net/i);
});
