const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BUSINESS_SLUG,
  DEV_ENDPOINT,
  FORM_SLUG,
  buildPayload,
  formatResult,
  generateIdempotencyKey,
  generateRunId,
  runDevRequest,
} = require("../scripts/dev-test-request.js");

const TEST_EMAIL = "cliente.e2e@example.test";
const FIXED_DATE = new Date("2026-09-23T09:15:00.000Z");
const UUIDS = [
  "a1b2c3d4-1111-4111-8111-111111111111",
  "e5f6a7b8-2222-4222-8222-222222222222",
];

function createOptions(overrides = {}) {
  let uuidIndex = 0;
  return {
    argv: [],
    env: { SOLICITUDPRO_DEV_TEST_CUSTOMER_EMAIL: TEST_EMAIL },
    fetchImpl: async () => {
      throw new Error("fetch no debía ejecutarse");
    },
    now: () => FIXED_DATE,
    randomUUID: () => UUIDS[uuidIndex++] || UUIDS.at(-1),
    ...overrides,
  };
}

test("dry-run is the default and never calls fetch", async () => {
  let fetchCalls = 0;
  const execution = await runDevRequest(createOptions({
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  }));

  assert.equal(execution.exitCode, 0);
  assert.equal(execution.result.mode, "dev-dry-run");
  assert.equal(execution.result.success, true);
  assert.equal(fetchCalls, 0);
  assert.match(formatResult(execution.result), /DEV DRY RUN/);
});

test("--send without a configured email aborts before fetch", async () => {
  let fetchCalls = 0;
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    env: {},
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  }));

  assert.equal(execution.exitCode, 2);
  assert.equal(execution.result.success, false);
  assert.equal(execution.result.error_code, "MISSING_DEV_TEST_EMAIL");
  assert.equal(fetchCalls, 0);
});

test("a non-DEV endpoint is rejected before any network traffic", async () => {
  let fetchCalls = 0;
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    endpoint: "https://example.invalid/functions/v1/receive-public-form/api/public/forms/reformas-demo-dev/solicitud/requests",
    fetchImpl: async () => {
      fetchCalls += 1;
    },
  }));

  assert.equal(execution.exitCode, 2);
  assert.equal(execution.result.error_code, "NON_DEV_ENDPOINT");
  assert.match(formatResult(execution.result), /ABORTED: NON-DEV ENDPOINT/);
  assert.equal(fetchCalls, 0);
});

test("payload follows the published Reformas contract", () => {
  const runId = generateRunId(FIXED_DATE, () => UUIDS[0]);
  const payload = buildPayload({ email: TEST_EMAIL, runId });

  assert.equal(BUSINESS_SLUG, "reformas-demo-dev");
  assert.equal(FORM_SLUG, "solicitud");
  assert.deepEqual(Object.keys(payload).sort(), [
    "answers",
    "contact",
    "metadata",
    "privacy_notice_version",
  ]);
  assert.deepEqual(Object.keys(payload.answers).sort(), [
    "descripcion",
    "plazo",
    "tipo_reforma",
    "zona",
  ]);
  assert.equal(payload.answers.tipo_reforma, "Baño");
  assert.equal(payload.answers.zona, "Valencia");
  assert.equal(payload.answers.plazo, "En las próximas semanas");
  assert.match(payload.answers.descripcion, new RegExp(runId));
  assert.equal(payload.contact.email, TEST_EMAIL);
  assert.equal("business_id" in payload, false);
});

test("run_id and Idempotency-Key are valid and unique inputs", () => {
  const runId = generateRunId(FIXED_DATE, () => UUIDS[0]);
  const key = generateIdempotencyKey(() => UUIDS[1]);

  assert.match(runId, /^SP-E2E-\d{8}-\d{6}-[A-F0-9]{4}$/);
  assert.match(key, /^[A-Za-z0-9._:-]{16,128}$/);
  assert.notEqual(runId, key);
});

test("a successful real execution sends exactly one POST and processes reference", async () => {
  const calls = [];
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ reference: "REF-321", message: "Recibida" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, DEV_ENDPOINT);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.match(calls[0].options.headers["Idempotency-Key"], /^[A-Za-z0-9._:-]{16,128}$/);
  assert.equal(JSON.parse(calls[0].options.body).contact.email, TEST_EMAIL);
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.result.success, true);
  assert.equal(execution.result.http_status, 201);
  assert.equal(execution.result.reference, "REF-321");
  assert.equal("request_id" in execution.result, false);
  assert.match(formatResult(execution.result), /DEV REAL E2E TEST[\s\S]*SUCCESS/);
});

test("request_id is included only when the server actually returns it", async () => {
  const requestId = "123e4567-e89b-42d3-a456-426614174000";
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    fetchImpl: async () => new Response(JSON.stringify({
      reference: "REF-322",
      request_id: requestId,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  }));

  assert.equal(execution.result.request_id, requestId);
});

test("HTTP errors return FAILED and a nonzero exit code", async () => {
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    fetchImpl: async () => new Response(JSON.stringify({ error: "SP_RATE_LIMITED" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }),
  }));

  assert.equal(execution.exitCode, 3);
  assert.equal(execution.result.success, false);
  assert.equal(execution.result.http_status, 429);
  assert.match(formatResult(execution.result), /FAILED/);
});

test("--email overrides local configuration for one execution", async () => {
  let sentPayload;
  const overrideEmail = "otra-prueba@example.test";
  await runDevRequest(createOptions({
    argv: ["--send", "--email", overrideEmail],
    fetchImpl: async (_url, options) => {
      sentPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({ reference: "REF-323" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    },
  }));

  assert.equal(sentPayload.contact.email, overrideEmail);
});

test("--json produces one valid JSON document without personal email", async () => {
  const execution = await runDevRequest(createOptions({ argv: ["--json"] }));
  const output = formatResult(execution.result, { json: true });
  const parsed = JSON.parse(output);

  assert.equal(parsed.mode, "dev-dry-run");
  assert.equal(parsed.payload.contact.email, "[configurado]");
  assert.doesNotMatch(output, new RegExp(TEST_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(output.trim().startsWith("{"), true);
  assert.equal(output.trim().endsWith("}"), true);
});

test("network failures are sanitized and never reveal email values", async () => {
  const execution = await runDevRequest(createOptions({
    argv: ["--send"],
    fetchImpl: async () => {
      throw new Error(`fallo con ${TEST_EMAIL} y token privado`);
    },
  }));
  const output = formatResult(execution.result);

  assert.equal(execution.exitCode, 4);
  assert.equal(execution.result.error_code, "NETWORK_ERROR");
  assert.doesNotMatch(output, /cliente\.e2e@example\.test/);
  assert.doesNotMatch(output, /token privado/);
});
