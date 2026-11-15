const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_FILES,
  createAttachmentItems,
  retryFailedAttachments,
  uploadAttachmentsSequentially,
  validateAttachmentSelection,
} = require("../js/public-form-attachments.js");

const root = path.join(__dirname, "..");
const file = (name, type, size = 1024) => ({ name, type, size, lastModified: 1 });

test("C12B2 accepts the C12A formats with a maximum of five files and 10 MiB each", () => {
  assert.equal(MAX_ATTACHMENT_FILES, 5);
  assert.equal(MAX_ATTACHMENT_BYTES, 10 * 1024 * 1024);
  assert.deepEqual([...ACCEPTED_ATTACHMENT_TYPES], [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ]);

  assert.equal(validateAttachmentSelection([
    file("obra.jpg", "image/jpeg"),
    file("plano.pdf", "application/pdf"),
  ]), "");
  assert.match(validateAttachmentSelection([file("grande.pdf", "application/pdf", MAX_ATTACHMENT_BYTES + 1)]), /10 MB/);
  assert.match(validateAttachmentSelection([file("vector.svg", "image/svg+xml")]), /formato/);
  assert.match(validateAttachmentSelection(Array.from({ length: 6 }, (_, index) => file(`${index}.png`, "image/png"))), /5 archivos/);
});

test("C12B2 uploads files sequentially with the original request context", async () => {
  const calls = [];
  let inFlight = 0;
  let maximumInFlight = 0;
  const items = createAttachmentItems([
    file("foto.jpg", "image/jpeg"),
    file("documento.pdf", "application/pdf"),
  ]);

  const result = await uploadAttachmentsSequentially(items, {
    endpoint: "https://example.test/api/public/forms",
    businessSlug: "academia-demo-dev",
    formSlug: "clases",
    reference: "ACA-123",
    idempotencyKey: "original-key",
    formDataFactory: () => ({ append(name, value) { this.field = { name, value }; } }),
    fetchImpl: async (url, options) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      calls.push({ url, options });
      await Promise.resolve();
      inFlight -= 1;
      return { ok: true, status: 201, json: async () => ({ status: "stored" }) };
    },
  });

  assert.equal(maximumInFlight, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url }) => url.endsWith("/academia-demo-dev/clases/requests/ACA-123/attachments")));
  assert.ok(calls.every(({ options }) => options.headers["Idempotency-Key"] === "original-key"));
  assert.ok(calls.every(({ options }) => options.body.field.name === "file"));
  assert.ok(result.every(({ status }) => status === "success"));
});

test("C12B2 makes no attachment request when the form has no files", async () => {
  let calls = 0;
  const result = await uploadAttachmentsSequentially([], {
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => ({}) };
    },
  });

  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});

test("C12B2 partial failure keeps the request valid and retry sends only failed files", async () => {
  const items = createAttachmentItems([
    file("correcta.jpg", "image/jpeg"),
    file("fallida.pdf", "application/pdf"),
  ]);
  let firstCalls = 0;
  const context = {
    endpoint: "https://example.test/api/public/forms",
    businessSlug: "reformas-demo-dev",
    formSlug: "solicitud",
    reference: "REF-123",
    idempotencyKey: "same-original-key",
    formDataFactory: () => ({ append() {} }),
    fetchImpl: async () => {
      firstCalls += 1;
      return firstCalls === 1
        ? { ok: true, status: 201, json: async () => ({}) }
        : { ok: false, status: 503, json: async () => ({}) };
    },
  };

  await uploadAttachmentsSequentially(items, context);
  assert.deepEqual(items.map(({ status }) => status), ["success", "error"]);

  let retryCalls = 0;
  await retryFailedAttachments(items, {
    ...context,
    fetchImpl: async () => {
      retryCalls += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });

  assert.equal(retryCalls, 1);
  assert.deepEqual(items.map(({ status }) => status), ["success", "success"]);
});

test("C12B2 integrates one common uploader after request creation without direct Storage writes", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(index, /js\/public-form-attachments\.js/);
  assert.match(script, /window\.PublicFormAttachments/);
  assert.match(script, /responseBody\.reference/);
  assert.match(script, /uploadAttachmentsSequentially/);
  assert.match(script, /activeAttachmentRetryContext = null/);
  assert.ok(script.indexOf("if (!response.ok)") < script.indexOf("await uploadAttachmentsSequentially"));
  assert.doesNotMatch(script, /storage\.from|storage\.objects|localStorage\.setItem\([^\n]*(?:idempot|reference)/i);
  assert.doesNotMatch(script, /business_id|request_id/);
});
