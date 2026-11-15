const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const workerPath = path.join(
  __dirname,
  "..",
  "supabase",
  "functions",
  "email-job-worker",
  "worker-contract.ts",
);

const SECRET = "test-worker-secret-with-enough-entropy";
const NOW = new Date("2026-09-15T12:00:00.000Z");
const JOB_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_TOKEN = "22222222-2222-4222-8222-222222222222";

async function loadWorker() {
  return import(pathToFileURL(workerPath).href);
}

function request(operation, body, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const method = options.method ?? "POST";
  if (options.authorized !== false) headers.set("Authorization", `Bearer ${SECRET}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request(`https://example.test/functions/v1/email-job-worker/${operation}`, {
    method,
    headers,
    body: body === undefined || method === "GET" || method === "HEAD"
      ? undefined
      : JSON.stringify(body),
  });
}

function dependencies(rpc) {
  return {
    workerSecret: SECRET,
    now: () => NOW,
    rpc,
    log: () => {},
  };
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test("PRE-C13B denies missing and incorrect worker credentials before any RPC", async () => {
  const { handleWorkerRequest } = await loadWorker();
  let calls = 0;
  const rpc = async () => { calls += 1; return { data: [], error: null }; };

  const missing = await json(await handleWorkerRequest(
    request("claim", {}, { authorized: false }),
    dependencies(rpc),
  ));
  const incorrect = await json(await handleWorkerRequest(
    request("claim", {}, { headers: { Authorization: "Bearer incorrect" }, authorized: false }),
    dependencies(rpc),
  ));

  assert.equal(missing.status, 401);
  assert.equal(incorrect.status, 401);
  assert.deepEqual(missing.body, { error: "Acceso no autorizado." });
  assert.equal(calls, 0);
});

test("PRE-C13B claims jobs with bounded defaults and returns normalized context", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const calls = [];
  const claimed = {
    job_id: JOB_ID,
    email_type: "customer_confirmation",
    attempt_count: 1,
    lease_expires_at: "2026-09-15T12:05:00.000Z",
    claim_token: CLAIM_TOKEN,
    delivery_id: JOB_ID,
    context: { recipient_email: "cliente@example.test", answers: [] },
  };
  const rpc = async (name, params) => {
    calls.push({ name, params });
    return { data: [claimed], error: null };
  };

  const result = await json(await handleWorkerRequest(
    request("claim", {}),
    dependencies(rpc),
  ));

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [{
    name: "claim_email_jobs",
    params: { p_limit: 1, p_lease_seconds: 300 },
  }]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(result.body.jobs[0]).filter(([key]) => key !== "rendered")),
    claimed,
  );
  assert.equal(result.body.jobs[0].rendered.subject, "Solicitud recibida · Sin referencia");
  assert.match(result.body.jobs[0].rendered.text, /Hemos recibido tu solicitud/i);
  assert.match(result.body.jobs[0].rendered.html, /<!doctype html>/i);
});

test("PRE-C13B rejects excessive claim limits and invalid leases without calling SQL", async () => {
  const { handleWorkerRequest } = await loadWorker();
  let calls = 0;
  const rpc = async () => { calls += 1; return { data: [], error: null }; };

  const excessive = await json(await handleWorkerRequest(
    request("claim", { limit: 11 }),
    dependencies(rpc),
  ));
  const shortLease = await json(await handleWorkerRequest(
    request("claim", { lease_seconds: 29 }),
    dependencies(rpc),
  ));

  assert.equal(excessive.status, 400);
  assert.equal(shortLease.status, 400);
  assert.equal(calls, 0);
});

test("PRE-C13B marks sent only through the current job and claim token", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const calls = [];
  const resolved = { job_id: JOB_ID, status: "sent", sent_at: "2026-09-15T12:01:00.000Z" };
  const rpc = async (name, params) => {
    calls.push({ name, params });
    return { data: [resolved], error: null };
  };

  const result = await json(await handleWorkerRequest(
    request("sent", { job_id: JOB_ID, claim_token: CLAIM_TOKEN }),
    dependencies(rpc),
  ));

  assert.equal(result.status, 200);
  assert.deepEqual(calls, [{
    name: "resolve_email_job_sent",
    params: { p_job_id: JOB_ID, p_claim_token: CLAIM_TOKEN },
  }]);
  assert.deepEqual(result.body, { job: resolved });
});

test("PRE-C13B rejects stale or invalid claim tokens without reporting success", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const rpc = async () => ({ data: [], error: null });

  const stale = await json(await handleWorkerRequest(
    request("sent", { job_id: JOB_ID, claim_token: CLAIM_TOKEN }),
    dependencies(rpc),
  ));
  const malformed = await json(await handleWorkerRequest(
    request("sent", { job_id: JOB_ID, claim_token: "not-a-uuid" }),
    dependencies(rpc),
  ));

  assert.equal(stale.status, 409);
  assert.deepEqual(stale.body, { error: "El claim ya no es válido." });
  assert.equal(malformed.status, 400);
});

test("PRE-C13B records a sanitized terminal failure and clears retry scheduling", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const calls = [];
  const resolved = {
    job_id: JOB_ID,
    status: "failed",
    available_at: "2026-09-15T12:00:00.000Z",
    last_error: "Proveedor rechazó [email] Authorization=[redacted]",
  };
  const rpc = async (name, params) => {
    calls.push({ name, params });
    return { data: [resolved], error: null };
  };

  const result = await json(await handleWorkerRequest(
    request("failed", {
      job_id: JOB_ID,
      claim_token: CLAIM_TOKEN,
      error: "Proveedor rechazó cliente@example.test Authorization=Bearer top-secret-value",
    }),
    dependencies(rpc),
  ));

  assert.equal(result.status, 200);
  assert.equal(calls[0].name, "resolve_email_job_failed");
  assert.equal(calls[0].params.p_retry_at, null);
  assert.doesNotMatch(calls[0].params.p_error, /example\.test|top-secret-value|Bearer/i);
  assert.ok(calls[0].params.p_error.length <= 500);
  assert.deepEqual(result.body, { job: resolved });
});

test("PRE-C13B schedules only a valid future retry using existing available_at", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const calls = [];
  const retryAt = "2026-09-15T12:10:00.000Z";
  const rpc = async (name, params) => {
    calls.push({ name, params });
    return {
      data: [{ job_id: JOB_ID, status: "pending", available_at: retryAt, last_error: "Timeout" }],
      error: null,
    };
  };

  const scheduled = await json(await handleWorkerRequest(
    request("failed", {
      job_id: JOB_ID,
      claim_token: CLAIM_TOKEN,
      error: "Timeout",
      retry_at: retryAt,
    }),
    dependencies(rpc),
  ));
  const past = await json(await handleWorkerRequest(
    request("failed", {
      job_id: JOB_ID,
      claim_token: CLAIM_TOKEN,
      error: "Timeout",
      retry_at: "2026-09-15T11:59:59.000Z",
    }),
    dependencies(rpc),
  ));

  assert.equal(scheduled.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.p_retry_at, retryAt);
  assert.equal(past.status, 400);
});

test("PRE-C13B rejects unknown operations, methods, fields and malformed JSON", async () => {
  const { handleWorkerRequest } = await loadWorker();
  let calls = 0;
  const rpc = async () => { calls += 1; return { data: [], error: null }; };
  const deps = dependencies(rpc);

  const unknown = await json(await handleWorkerRequest(request("delete", {}), deps));
  const method = await json(await handleWorkerRequest(request("claim", {}, { method: "GET" }), deps));
  const field = await json(await handleWorkerRequest(request("claim", { business_id: JOB_ID }), deps));
  const malformedRequest = new Request(
    "https://example.test/functions/v1/email-job-worker/claim",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
      body: "{",
    },
  );
  const malformed = await json(await handleWorkerRequest(malformedRequest, deps));

  assert.equal(unknown.status, 404);
  assert.equal(method.status, 405);
  assert.equal(field.status, 400);
  assert.equal(malformed.status, 400);
  assert.equal(calls, 0);
});

test("PRE-C13B never leaks database error details to the worker client", async () => {
  const { handleWorkerRequest } = await loadWorker();
  const rpc = async () => ({
    data: null,
    error: { message: "connection failed with service_role=very-secret" },
  });

  const result = await json(await handleWorkerRequest(
    request("claim", {}),
    dependencies(rpc),
  ));

  assert.equal(result.status, 500);
  assert.deepEqual(result.body, { error: "No se pudo completar la operación." });
  assert.doesNotMatch(JSON.stringify(result.body), /service_role|very-secret/i);
});
