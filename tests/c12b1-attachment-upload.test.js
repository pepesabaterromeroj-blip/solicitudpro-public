const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const helperPath = path.join(
  root,
  "supabase",
  "functions",
  "receive-public-form",
  "attachment-upload.ts",
);

async function loadHelper() {
  return import(pathToFileURL(helperPath).href);
}

function fakeContext() {
  return {
    businessId: "11111111-1111-4111-8111-111111111111",
    requestId: "22222222-2222-4222-8222-222222222222",
  };
}

test("C12B1 exposes a separate multipart attachment route without changing JSON submission", () => {
  const handler = fs.readFileSync(
    path.join(root, "supabase", "functions", "receive-public-form", "index.ts"),
    "utf8",
  );

  assert.match(handler, /kind: "attachment"/);
  assert.match(handler, /\/attachments/);
  assert.match(handler, /multipart\/form-data/i);
  assert.match(handler, /authorize_public_attachment_upload/);
  assert.match(handler, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(handler, /Idempotency-Key/);
  assert.match(handler, /persistAttachment/);
  assert.match(handler, /application\/json/);
  assert.doesNotMatch(handler, /business_id\s*=\s*formData|request_id\s*=\s*formData/i);
});

test("C12B1 authorization RPC is backend-only, read-only and tenant-bound", () => {
  const migration = fs.readdirSync(migrationsDirectory)
    .find((file) => /_c12b1_authorize_attachment_upload\.sql$/.test(file));
  assert.ok(migration, "C12B1 authorization migration is missing");

  const sql = fs.readFileSync(path.join(migrationsDirectory, migration), "utf8");
  assert.match(sql, /create or replace function public\.authorize_public_attachment_upload/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /p_idempotency_key_hash/i);
  assert.match(sql, /submission_key\.request_id\s*=\s*request\.id/i);
  assert.match(sql, /request\.business_id\s*=\s*business\.id/i);
  assert.match(sql, /request\.form_config_id\s*=\s*form\.id/i);
  assert.match(sql, /key\.expires_at\s*>\s*now\(\)/i);
  assert.match(sql, /revoke all on function[\s\S]*from public/i);
  assert.match(sql, /revoke all on function[\s\S]*from anon/i);
  assert.match(sql, /revoke all on function[\s\S]*from authenticated/i);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/i);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\b(insert|update|delete)\s+(?:into\s+|from\s+)?public\./i);
});

test("C12B1 validates signatures, extension, size and canonical deterministic paths", async () => {
  const { prepareAttachment } = await loadHelper();
  const context = fakeContext();
  const jpeg = new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 1])], " foto baño.JPG ", {
    type: "image/jpeg",
  });
  const prepared = await prepareAttachment(jpeg, context);

  assert.equal(prepared.mimeType, "image/jpeg");
  assert.equal(prepared.fileName, "foto baño.JPG");
  assert.match(
    prepared.storagePath,
    new RegExp(`^${context.businessId}/${context.requestId}/[0-9a-f-]{36}\\.jpg$`),
  );

  const replay = await prepareAttachment(jpeg, context);
  assert.equal(replay.id, prepared.id);
  assert.equal(replay.storagePath, prepared.storagePath);

  const pdf = await prepareAttachment(
    new File(["%PDF-1.7\n"], "presupuesto.pdf", { type: "application/pdf" }),
    context,
  );
  assert.equal(pdf.mimeType, "application/pdf");
  assert.match(pdf.storagePath, /\.pdf$/);

  await assert.rejects(
    () => prepareAttachment(new File(["bad"], "virus.svg", { type: "image/svg+xml" }), context),
    /Tipo de archivo no permitido/,
  );
  await assert.rejects(
    () => prepareAttachment(new File(["%PDF-1.7"], "engaño.jpg", { type: "image/jpeg" }), context),
    /contenido del archivo no coincide/i,
  );
  await assert.rejects(
    () => prepareAttachment(
      new File([new Uint8Array((10 * 1024 * 1024) + 1)], "grande.pdf", { type: "application/pdf" }),
      context,
    ),
    /supera el límite de 10 MB/i,
  );
});

test("C12B1 stores metadata only after upload and compensates metadata failures", async () => {
  const { persistAttachment } = await loadHelper();
  const prepared = {
    id: "33333333-3333-4333-8333-333333333333",
    ...fakeContext(),
    storagePath: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.pdf",
    fileName: "documento.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
    bytes: new Uint8Array(Buffer.from("%PDF-1.7")),
  };
  const events = [];
  const dependencies = {
    findMetadata: async () => null,
    upload: async () => { events.push("upload"); return { error: null }; },
    objectExists: async () => true,
    insertMetadata: async () => { events.push("metadata"); return { error: new Error("forced") }; },
    remove: async () => { events.push("remove"); return { error: null }; },
    log: () => {},
  };

  await assert.rejects(() => persistAttachment(prepared, dependencies), /metadatos/i);
  assert.deepEqual(events, ["upload", "metadata", "remove"]);
});

test("C12B1 leaves no metadata on upload failure and returns an idempotent replay", async () => {
  const { persistAttachment } = await loadHelper();
  const prepared = {
    id: "33333333-3333-4333-8333-333333333333",
    ...fakeContext(),
    storagePath: "safe/path.pdf",
    fileName: "documento.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
    bytes: new Uint8Array(Buffer.from("%PDF-1.7")),
  };
  let inserted = false;
  const failed = {
    findMetadata: async () => null,
    upload: async () => ({ error: new Error("storage unavailable") }),
    objectExists: async () => false,
    insertMetadata: async () => { inserted = true; return { error: null }; },
    remove: async () => ({ error: null }),
    log: () => {},
  };
  await assert.rejects(() => persistAttachment(prepared, failed), /almacenar el archivo/i);
  assert.equal(inserted, false);

  const existing = {
    id: prepared.id,
    business_id: prepared.businessId,
    request_id: prepared.requestId,
    storage_path: prepared.storagePath,
    file_name: prepared.fileName,
    mime_type: prepared.mimeType,
    size_bytes: prepared.sizeBytes,
  };
  const replay = await persistAttachment(prepared, {
    ...failed,
    findMetadata: async () => existing,
    upload: async () => { throw new Error("upload must not run on replay"); },
  });
  assert.equal(replay.wasReplayed, true);
  assert.equal(inserted, false);
});
