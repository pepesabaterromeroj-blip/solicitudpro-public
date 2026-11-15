const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");
const migrationNames = fs.readdirSync(migrationsDirectory)
  .filter((file) => /_c12a_.*\.sql$/.test(file))
  .sort();

function readMigration() {
  assert.ok(migrationNames.length > 0, "C12A migration is missing");
  return migrationNames
    .map((file) => fs.readFileSync(path.join(migrationsDirectory, file), "utf8"))
    .join("\n");
}

test("C12A creates a private bucket with conservative upload limits", () => {
  const sql = readMigration();

  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /'request-attachments'/);
  assert.match(sql, /false,\s*10485760/i);
  for (const mime of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ]) {
    assert.match(sql, new RegExp(mime.replace("/", "\\/")));
  }
  assert.doesNotMatch(sql, /image\/svg\+xml|application\/x-|text\/html/i);
});

test("C12A reuses attachments and enforces tenant-bound canonical metadata", () => {
  const sql = readMigration();

  assert.match(sql, /alter table public\.attachments/i);
  assert.match(sql, /attachments_request_business_fk/i);
  assert.match(sql, /attachments_storage_path_unique/i);
  assert.match(sql, /attachments_allowed_mime_check/i);
  assert.match(sql, /attachments_storage_path_check/i);
  assert.match(sql, /business_id::text[\s\S]*request_id::text[\s\S]*jpg\|jpeg\|png\|webp\|heic\|heif\|pdf/i);
  assert.match(sql, /attachments_size_check[\s\S]*size_bytes between 1 and 10485760/i);
  assert.match(sql, /attachments_request_business_fk_idx[\s\S]*\(request_id, business_id\)/i);
  assert.match(sql, /attachments_business_uploaded_by_fk_idx[\s\S]*\(business_id, uploaded_by\)/i);
  assert.doesNotMatch(sql, /create table public\.request_attachments/i);
});

test("C12A metadata is read-only to authenticated tenants and closed to anon", () => {
  const sql = readMigration();

  assert.match(sql, /alter table public\.attachments enable row level security/i);
  assert.match(sql, /drop policy if exists "owners and members can insert attachments"/i);
  assert.match(sql, /drop policy if exists "owners and members can update attachments"/i);
  assert.match(sql, /revoke all on table public\.attachments from anon/i);
  assert.match(sql, /revoke all on table public\.attachments from authenticated/i);
  assert.match(sql, /grant select on table public\.attachments to authenticated/i);
  assert.match(sql, /membership\.business_id = attachments\.business_id[\s\S]*membership\.user_id = \(select auth\.uid\(\)\)[\s\S]*membership\.is_active/i);
  assert.doesNotMatch(sql, /create policy[^;]+to anon/is);
});

test("C12A permits only tenant-checked authenticated reads from Storage", () => {
  const sql = readMigration();
  const storagePolicies = [...sql.matchAll(/create policy[\s\S]*?on storage\.objects[\s\S]*?;/gi)]
    .map((match) => match[0]);

  assert.equal(storagePolicies.length, 1);
  assert.match(storagePolicies[0], /for select\s+to authenticated/i);
  assert.match(storagePolicies[0], /bucket_id = 'request-attachments'/i);
  assert.match(storagePolicies[0], /public\.attachments/i);
  assert.match(storagePolicies[0], /public\.business_users/i);
  assert.match(storagePolicies[0], /storage\.foldername/i);
  assert.doesNotMatch(storagePolicies[0], /for (insert|update|delete)|to anon/i);
});

test("C12A adds no upload implementation, public bucket, or external integration", () => {
  const sql = readMigration();
  const executableSql = sql.replace(/^\s*--.*$/gm, "");

  assert.doesNotMatch(executableSql, /public\s*=\s*true/i);
  assert.doesNotMatch(executableSql, /create (or replace )?function|create trigger|net\.http|pg_net|n8n|smtp|resend/i);
  assert.doesNotMatch(executableSql, /insert into storage\.objects/i);
});
