const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const helperPath = path.join(
  root,
  "supabase",
  "functions",
  "receive-public-form",
  "email-worker-wake.ts",
);

async function loadWakeHelper() {
  return import(pathToFileURL(helperPath).href);
}

function controlledRuntime(overrides = {}) {
  const tasks = [];
  const logs = [];
  const requests = [];
  const environment = {
    N8N_EMAIL_WAKE_URL: "https://n8n.example.test/webhook/wake",
    N8N_EMAIL_WAKE_SECRET: "environment-only-secret",
    ...overrides.environment,
  };

  return {
    tasks,
    logs,
    requests,
    dependencies: {
      getEnv: (name) => environment[name],
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 202 };
      },
      waitUntil: (task) => tasks.push(task),
      log: (event) => logs.push(event),
      ...overrides.dependencies,
    },
  };
}

test("C13B successful submission schedules one authenticated empty wake without waiting", async () => {
  const { scheduleEmailWorkerWake } = await loadWakeHelper();
  let resolveFetch;
  const runtime = controlledRuntime({
    dependencies: {
      fetchImpl: (url, options) => {
        runtime.requests.push({ url, options });
        return new Promise((resolve) => { resolveFetch = resolve; });
      },
    },
  });

  const scheduled = scheduleEmailWorkerWake(runtime.dependencies);

  assert.equal(scheduled, true);
  assert.equal(runtime.tasks.length, 1);
  assert.equal(runtime.requests.length, 1);
  assert.deepEqual(runtime.requests[0], {
    url: "https://n8n.example.test/webhook/wake",
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SolicitudPro-Wake-Secret": "environment-only-secret",
      },
      body: "{}",
    },
  });
  assert.deepEqual(JSON.parse(runtime.requests[0].options.body), {});
  assert.doesNotMatch(runtime.requests[0].options.body, /email|phone|reference|request_id|business_id/i);
  assert.deepEqual(runtime.logs, []);

  resolveFetch({ ok: true, status: 202 });
  await runtime.tasks[0];
  assert.deepEqual(runtime.logs, [{ event: "email_worker_wake", outcome: "accepted", status: 202 }]);
});

test("C13B wake reads both authentication settings from the environment", async () => {
  const { scheduleEmailWorkerWake } = await loadWakeHelper();
  const requestedNames = [];
  const runtime = controlledRuntime();
  runtime.dependencies.getEnv = (name) => {
    requestedNames.push(name);
    return name === "N8N_EMAIL_WAKE_URL"
      ? "https://n8n.example.test/webhook/wake"
      : "secret-from-environment";
  };

  scheduleEmailWorkerWake(runtime.dependencies);
  await runtime.tasks[0];

  assert.deepEqual(requestedNames, ["N8N_EMAIL_WAKE_URL", "N8N_EMAIL_WAKE_SECRET"]);
  assert.equal(
    runtime.requests[0].options.headers["X-SolicitudPro-Wake-Secret"],
    "secret-from-environment",
  );
});

test("C13B network and HTTP failures remain inside the background wake", async () => {
  const { scheduleEmailWorkerWake } = await loadWakeHelper();
  const network = controlledRuntime({
    dependencies: {
      fetchImpl: async () => { throw new Error("connection includes private details"); },
    },
  });
  const rejected = controlledRuntime({
    dependencies: {
      fetchImpl: async () => ({ ok: false, status: 503 }),
    },
  });

  assert.equal(scheduleEmailWorkerWake(network.dependencies), true);
  assert.equal(scheduleEmailWorkerWake(rejected.dependencies), true);
  await assert.doesNotReject(network.tasks[0]);
  await assert.doesNotReject(rejected.tasks[0]);

  assert.deepEqual(network.logs, [{ event: "email_worker_wake", outcome: "network_error" }]);
  assert.deepEqual(rejected.logs, [{ event: "email_worker_wake", outcome: "rejected", status: 503 }]);
  assert.doesNotMatch(JSON.stringify(network.logs), /private details|secret|webhook\/wake/i);
});

test("C13B missing wake configuration is safe and does not start background work", async () => {
  const { scheduleEmailWorkerWake } = await loadWakeHelper();
  for (const environment of [
    { N8N_EMAIL_WAKE_URL: undefined, N8N_EMAIL_WAKE_SECRET: "must-not-leak" },
    { N8N_EMAIL_WAKE_URL: "https://sensitive.example.test/path", N8N_EMAIL_WAKE_SECRET: undefined },
  ]) {
    const runtime = controlledRuntime({ environment });

    assert.equal(scheduleEmailWorkerWake(runtime.dependencies), false);
    assert.equal(runtime.tasks.length, 0);
    assert.equal(runtime.requests.length, 0);
    assert.deepEqual(runtime.logs, [{ event: "email_worker_wake", outcome: "configuration_missing" }]);
    assert.doesNotMatch(JSON.stringify(runtime.logs), /must-not-leak|sensitive\.example/i);
  }
});

test("C13B receive-public-form wakes only after a successful RPC result", () => {
  const handler = fs.readFileSync(
    path.join(root, "supabase", "functions", "receive-public-form", "index.ts"),
    "utf8",
  );
  const rpcCall = handler.search(
    /supabase\.rpc\("submit_public_form_submission(?:_with_enrichment_wake)?"/,
  );
  const errorBranch = handler.indexOf("if (error)", rpcCall);
  const wakeCall = handler.indexOf("scheduleEmailWorkerWake();", errorBranch);
  const successResponse = handler.indexOf("return response({", wakeCall);

  assert.ok(rpcCall >= 0, "submission RPC must exist");
  assert.ok(errorBranch > rpcCall, "RPC errors must be handled");
  assert.ok(wakeCall > errorBranch, "wake must happen only after the RPC error branch returns");
  assert.ok(successResponse > wakeCall, "wake must be scheduled without changing the form response");
  assert.equal(handler.match(/scheduleEmailWorkerWake\(\);/g)?.length, 1);
});
