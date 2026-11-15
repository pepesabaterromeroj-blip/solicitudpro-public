const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("keeps public form submission behind a server handler and a transactional RPC", () => {
  const handler = readProjectFile("supabase/functions/receive-public-form/index.ts");
  const rpc = readProjectFile("docs/proyecto/sql/005_public_form_submission_rpc.sql");
  const protections = readProjectFile("docs/proyecto/sql/006_public_form_rate_limit_idempotency.sql");

  assert.match(handler, /POST/);
  assert.match(handler, /\\\/api\\\/public\\\/forms/);
  assert.match(handler, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(handler, /Idempotency-Key/);
  assert.match(handler, /PUBLIC_FORM_IP_HASH_SECRET/);
  assert.match(handler, /PUBLIC_FORM_RATE_LIMIT_MAX/);
  assert.match(handler, /PUBLIC_FORM_RATE_LIMIT_WINDOW_SECONDS/);
  assert.match(handler, /submit_public_form_submission/);
  assert.match(handler, /Access-Control-Allow-Origin/);
  assert.match(handler, /Access-Control-Allow-Headers.*idempotency-key/i);
  assert.doesNotMatch(handler, /(?:payload|formData)[\s\S]{0,80}business_id\s*:/i);

  assert.match(rpc, /create or replace function public\.submit_public_form_submission/);
  assert.match(rpc, /security invoker/);
  assert.doesNotMatch(rpc, /security definer/);
  assert.match(rpc, /revoke all on function public\.submit_public_form_submission[\s\S]*from public/);
  assert.match(rpc, /revoke all on function public\.submit_public_form_submission[\s\S]*from anon/);
  assert.match(rpc, /revoke all on function public\.submit_public_form_submission[\s\S]*from authenticated/);
  assert.match(rpc, /grant execute on function public\.submit_public_form_submission[\s\S]*to service_role/);
  assert.match(rpc, /insert into public\.contacts/);
  assert.match(rpc, /insert into public\.requests/);
  assert.match(rpc, /insert into public\.request_custom_answers/);
  assert.match(rpc, /insert into public\.follow_ups/);
  assert.match(rpc, /insert into public\.activities/);
  assert.match(rpc, /SP_UNKNOWN_FIELD/);
  assert.match(rpc, /SP_FIELD_REQUIRED/);
  assert.match(rpc, /when 'fontaneria' then 'FON'/);
  assert.match(rpc, /when 'climatizacion' then 'CLI'/);
  assert.match(rpc, /when 'cristaleria' then 'CRI'/);
  assert.match(protections, /SP_RATE_LIMITED/);
  assert.match(protections, /SP_IDEMPOTENCY_PAYLOAD_MISMATCH/);
  assert.match(protections, /p_idempotency_key_hash/);
  assert.match(protections, /p_requester_hash/);

  assert.match(protections, /create table public\.public_form_rate_limit_windows/);
  assert.match(protections, /create table public\.public_form_idempotency_keys/);
  assert.match(protections, /enable row level security/);
  assert.doesNotMatch(protections, /create policy[^\n]*anon/i);
});
