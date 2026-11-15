const assert = require("node:assert/strict");
const fs = require("node:fs");
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
const migrationsDirectory = path.join(__dirname, "..", "supabase", "migrations");

const hostile = `<script>alert(1)</script> & "presupuesto"`;

function context(overrides = {}) {
  return {
    recipient_email: "destino@example.test",
    business: {
      name: "Reformas Ejemplo & Hijos",
      sector: "Reformas",
      contact_email: "negocio@example.test",
    },
    customer: {
      name: `Ana <Cliente>`,
      email: "ana@example.test",
      phone: "+34 600 000 000",
    },
    request: {
      reference: "REF-C16-001",
      service: `Cocina & baño`,
      description: hostile,
      urgency: "Esta semana",
      priority: 1,
      internal_summary: "Reforma de cocina pendiente de revisión profesional.",
    },
    answers: [{ label: "Zona <centro>", value: `Madrid & ${hostile}` }],
    ...overrides,
  };
}

test("C16 customer confirmation is professional and excludes internal context", async () => {
  const { renderEmailJob } = await import(pathToFileURL(workerPath).href);
  const rendered = renderEmailJob("customer_confirmation", context());

  assert.equal(rendered.subject, "Solicitud recibida · REF-C16-001");
  assert.match(rendered.text, /hemos recibido tu solicitud/i);
  assert.match(rendered.text, /revisará/i);
  assert.match(rendered.text, /no necesitas hacer nada más/i);
  assert.match(rendered.html, /<html lang="es" dir="ltr">/i);
  assert.match(rendered.html, /<title>Solicitud recibida · REF-C16-001<\/title>/i);
  assert.doesNotMatch(`${rendered.subject}\n${rendered.text}\n${rendered.html}`, /internal_summary|prioridad|600 000 000|ana@example/i);
  assert.doesNotMatch(`${rendered.text}\n${rendered.html}`, /presupuesto confirmado|visita confirmada|disponibilidad garantizada/i);
});

test("C16 business notification uses enrichment when already available", async () => {
  const { renderEmailJob } = await import(pathToFileURL(workerPath).href);
  const rendered = renderEmailJob("business_notification", context());

  assert.equal(rendered.subject, "Nueva solicitud · REF-C16-001");
  assert.match(rendered.text, /Reforma de cocina pendiente de revisión profesional/);
  assert.match(rendered.text, /Cocina & baño/);
  assert.match(rendered.text, /Esta semana/);
  assert.match(rendered.text, /Revisa la solicitud en SolicitudPro/);
  assert.doesNotMatch(`${rendered.text}\n${rendered.html}`, /business_id|request_id|service_role|suggested_reply/i);
});

test("C16 business notification falls back without waiting for C14A", async () => {
  const { renderEmailJob } = await import(pathToFileURL(workerPath).href);
  const pending = context({
    request: {
      ...context().request,
      internal_summary: null,
      enrichment_status: "pending",
    },
  });
  const failed = context({
    request: {
      ...context().request,
      internal_summary: null,
      enrichment_status: "failed",
    },
  });

  for (const candidate of [pending, failed]) {
    const rendered = renderEmailJob("business_notification", candidate);
    assert.match(rendered.text, /<script>alert\(1\)<\/script>/);
    assert.match(rendered.text, /Referencia: REF-C16-001/);
    assert.ok(rendered.html.length > 200);
  }
});

test("C16 escapes every untrusted value in HTML while keeping readable text", async () => {
  const { renderEmailJob } = await import(pathToFileURL(workerPath).href);
  const rendered = renderEmailJob("business_notification", context());

  assert.doesNotMatch(rendered.html, /<script>|<Cliente>|<centro>/i);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/i);
  assert.match(rendered.html, /Ana &lt;Cliente&gt;/);
  assert.match(rendered.html, /Zona &lt;centro&gt;/);
  assert.match(rendered.html, /Madrid &amp;/);
  assert.match(rendered.text, /<script>alert\(1\)<\/script>/);
});

test("C16 claim returns rendered payload without changing delivery idempotency", async () => {
  const { handleWorkerRequest } = await import(pathToFileURL(workerPath).href);
  const jobId = "11111111-1111-4111-8111-111111111111";
  const claimToken = "22222222-2222-4222-8222-222222222222";
  const request = new Request("https://example.test/functions/v1/email-job-worker/claim", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-worker-secret",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const response = await handleWorkerRequest(request, {
    workerSecret: "test-worker-secret",
    now: () => new Date("2026-09-29T12:00:00.000Z"),
    log: () => {},
    rpc: async () => ({
      error: null,
      data: [{
        job_id: jobId,
        email_type: "customer_confirmation",
        attempt_count: 1,
        lease_expires_at: "2026-09-29T12:05:00.000Z",
        claim_token: claimToken,
        delivery_id: jobId,
        context: context(),
      }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.jobs[0].delivery_id, jobId);
  assert.equal(body.jobs[0].rendered.subject, "Solicitud recibida · REF-C16-001");
  assert.match(body.jobs[0].rendered.html, /<!doctype html>/i);
  assert.match(body.jobs[0].rendered.text, /REF-C16-001/);
});

test("C16 context exposes optional enrichment without coupling queue creation to C14A", () => {
  const migrationName = fs.readdirSync(migrationsDirectory)
    .find((file) => /_c16_professional_email_context\.sql$/.test(file));

  assert.ok(migrationName, "C16 context migration is missing");
  const sql = fs.readFileSync(path.join(migrationsDirectory, migrationName), "utf8");
  assert.match(sql, /create or replace function public\.get_email_job_context/i);
  assert.match(sql, /'internal_summary',\s*r\.internal_summary/i);
  assert.match(sql, /'enrichment_status',\s*r\.enrichment_status/i);
  assert.doesNotMatch(sql, /where[\s\S]*enrichment_status\s*=\s*'completed'/i);
  assert.doesNotMatch(sql, /pg_sleep|poll|request_enrichment_worker|suggested_reply/i);
  assert.match(sql, /grant execute on function public\.get_email_job_context\(uuid\)\s+to service_role/i);
});
