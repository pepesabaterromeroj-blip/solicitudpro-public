import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const workerPath = path.join(root, "supabase/functions/request-enrichment-worker/worker-contract.ts");
const wakePath = path.join(root, "supabase/functions/receive-public-form/request-enrichment-wake.ts");
const migrationPath = path.join(root, "supabase/migrations/20260927190015_c14a_request_enrichment.sql");
const receivePath = path.join(root, "supabase/functions/receive-public-form/index.ts");

const SECRET = "c14a-test-secret";
const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_TOKEN = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-28T12:00:00.000Z");

function workerRequest(operation, body, authorized = true) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (authorized) headers.set("Authorization", `Bearer ${SECRET}`);
  return new Request(`https://example.test/functions/v1/request-enrichment-worker/${operation}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function dependencies(rpc) {
  return { workerSecret: SECRET, now: () => NOW, rpc, log: () => {} };
}

async function result(response) {
  return { status: response.status, body: await response.json() };
}

test("C14A denies missing worker credentials before any RPC", async () => {
  const { handleRequestEnrichmentWorkerRequest } = await import(pathToFileURL(workerPath).href);
  let calls = 0;
  const response = await handleRequestEnrichmentWorkerRequest(
    workerRequest("claim", {}, false),
    dependencies(async () => { calls += 1; return { data: [], error: null }; }),
  );
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test("C14A claim forwards only request selector and bounded lease options", async () => {
  const { handleRequestEnrichmentWorkerRequest } = await import(pathToFileURL(workerPath).href);
  const calls = [];
  const claimed = { business_id: BUSINESS_ID, request_id: REQUEST_ID, claim_token: CLAIM_TOKEN, context: {} };
  const response = await handleRequestEnrichmentWorkerRequest(
    workerRequest("claim", { request_id: REQUEST_ID, limit: 1, lease_seconds: 900 }),
    dependencies(async (name, params) => { calls.push({ name, params }); return { data: [claimed], error: null }; }),
  );
  assert.deepEqual(await result(response), { status: 200, body: { jobs: [claimed] } });
  assert.deepEqual(calls, [{
    name: "claim_request_enrichments",
    params: { p_request_id: REQUEST_ID, p_limit: 1, p_lease_seconds: 900 },
  }]);
});

test("C14A complete normalizes valid output and preserves tenant identity", async () => {
  const { handleRequestEnrichmentWorkerRequest } = await import(pathToFileURL(workerPath).href);
  const calls = [];
  const completed = { request_id: REQUEST_ID, status: "completed", enriched_at: NOW.toISOString() };
  const response = await handleRequestEnrichmentWorkerRequest(
    workerRequest("complete", {
      business_id: BUSINESS_ID,
      request_id: REQUEST_ID,
      claim_token: CLAIM_TOKEN,
      internal_summary: "  Reforma integral de cocina con plazo por concretar.  ",
      suggested_reply: "Gracias por escribirnos. Para valorar la reforma, ¿podrías confirmar medidas y el plazo aproximado?",
    }),
    dependencies(async (name, params) => { calls.push({ name, params }); return { data: [completed], error: null }; }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].name, "complete_request_enrichment");
  assert.equal(calls[0].params.p_business_id, BUSINESS_ID);
  assert.equal(calls[0].params.p_internal_summary, "Reforma integral de cocina con plazo por concretar.");
});

test("C14A rejects empty, HTML, secret-like and stale completion output", async () => {
  const { handleRequestEnrichmentWorkerRequest } = await import(pathToFileURL(workerPath).href);
  let calls = 0;
  const rpc = async () => { calls += 1; return { data: [], error: null }; };
  const base = { business_id: BUSINESS_ID, request_id: REQUEST_ID, claim_token: CLAIM_TOKEN };
  for (const payload of [
    { ...base, internal_summary: "", suggested_reply: "Respuesta suficientemente larga para pasar el mínimo." },
    { ...base, internal_summary: "<script>alert(1)</script> resumen válido", suggested_reply: "Respuesta suficientemente larga para pasar el mínimo." },
    { ...base, internal_summary: "Resumen suficientemente largo y concreto.", suggested_reply: "Authorization: Bearer secreto que nunca debe persistirse." },
  ]) {
    assert.equal((await handleRequestEnrichmentWorkerRequest(workerRequest("complete", payload), dependencies(rpc))).status, 400);
  }
  assert.equal(calls, 0);
  const stale = await handleRequestEnrichmentWorkerRequest(workerRequest("complete", {
    ...base,
    internal_summary: "Resumen suficientemente largo y concreto.",
    suggested_reply: "Gracias por escribirnos. Necesitamos algunos datos adicionales para valorar la solicitud.",
  }), dependencies(rpc));
  assert.equal(stale.status, 409);
});

test("C14A permits retry only for transient codes and a future retry time", async () => {
  const { handleRequestEnrichmentWorkerRequest } = await import(pathToFileURL(workerPath).href);
  const calls = [];
  const base = { business_id: BUSINESS_ID, request_id: REQUEST_ID, claim_token: CLAIM_TOKEN };
  const retryAt = "2026-09-28T12:10:00.000Z";
  const transient = await handleRequestEnrichmentWorkerRequest(workerRequest("failed", {
    ...base, error_code: "rate_limited", retry_at: retryAt,
  }), dependencies(async (name, params) => {
    calls.push({ name, params });
    return { data: [{ request_id: REQUEST_ID, status: "pending" }], error: null };
  }));
  assert.equal(transient.status, 200);
  assert.equal(calls[0].params.p_retry_at, retryAt);
  const permanentRetry = await handleRequestEnrichmentWorkerRequest(workerRequest("failed", {
    ...base, error_code: "invalid_output", retry_at: retryAt,
  }), dependencies(async () => ({ data: [], error: null })));
  assert.equal(permanentRetry.status, 400);
});

test("C14A wake sends only request_id, uses a dedicated secret and never blocks", async () => {
  const { scheduleRequestEnrichmentWake } = await import(pathToFileURL(wakePath).href);
  const fetchCalls = [];
  const tasks = [];
  const logs = [];
  const scheduled = scheduleRequestEnrichmentWake(REQUEST_ID, {
    getEnv: (name) => ({
      N8N_REQUEST_ENRICHMENT_WAKE_URL: "https://n8n.example/webhook/c14a",
      N8N_REQUEST_ENRICHMENT_WAKE_SECRET: "dedicated-wake-secret",
    })[name],
    fetchImpl: async (url, options) => { fetchCalls.push({ url, options }); return { ok: true, status: 202 }; },
    waitUntil: (task) => tasks.push(task),
    log: (event) => logs.push(event),
  });
  assert.equal(scheduled, true);
  assert.equal(tasks.length, 1);
  await tasks[0];
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), { request_id: REQUEST_ID });
  assert.deepEqual(Object.keys(JSON.parse(fetchCalls[0].options.body)), ["request_id"]);
  assert.equal(fetchCalls[0].options.headers["X-SolicitudPro-Enrichment-Wake-Secret"], "dedicated-wake-secret");
  assert.deepEqual(logs, [{ event: "request_enrichment_wake", outcome: "accepted", status: 202 }]);
});

test("C14A wake absorbs network failure and missing configuration", async () => {
  const { scheduleRequestEnrichmentWake } = await import(pathToFileURL(wakePath).href);
  const logs = [];
  const tasks = [];
  assert.equal(scheduleRequestEnrichmentWake(REQUEST_ID, {
    getEnv: () => undefined,
    fetchImpl: async () => { throw new Error("must not run"); },
    waitUntil: (task) => tasks.push(task),
    log: (event) => logs.push(event),
  }), false);
  assert.equal(tasks.length, 0);
  assert.deepEqual(logs, [{ event: "request_enrichment_wake", outcome: "configuration_missing" }]);
});

test("C14A migration encodes legacy, pending, locking, lease, retry and activity idempotency", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.match(sql, /enrichment_status text not null default 'legacy'/i);
  assert.match(sql, /enrichment_attempt_count smallint not null default 0/i);
  assert.match(sql, /enrichment_next_attempt_at timestamptz/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /enrichment_attempt_count < 5/i);
  assert.match(sql, /enrichment_claimed_at \+ make_interval\(secs => p_lease_seconds\)/i);
  assert.match(sql, /enrichment_claimed_at \+ interval '15 minutes' > clock_timestamp\(\)/i);
  assert.match(sql, /where r\.business_id = p_business_id[\s\S]*r\.id = p_request_id/i);
  assert.match(sql, /activities_request_enrichment_generated_unique/i);
  assert.doesNotMatch(sql, /on conflict \(request_id, type\)/i);
  assert.match(sql, /for each row execute function public\.prepare_request_enrichment\(\)/i);
  assert.match(sql, /revoke execute on function public\.claim_request_enrichments[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.claim_request_enrichments[\s\S]*to service_role/i);
});

test("C14A receive-public-form schedules enrichment only after a successful request", () => {
  const source = fs.readFileSync(receivePath, "utf8");
  const rpc = source.indexOf('supabase.rpc("submit_public_form_submission_with_enrichment_wake"');
  const error = source.indexOf("if (error)", rpc);
  const wake = source.indexOf("scheduleRequestEnrichmentWake(submission?.request_id);", error);
  assert.ok(rpc >= 0 && error > rpc && wake > error);
  assert.equal(source.match(/scheduleRequestEnrichmentWake\(submission\?\.request_id\);/g)?.length, 1);
});
