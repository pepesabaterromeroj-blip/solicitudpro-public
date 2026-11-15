import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const packageRoot = process.argv[2];

if (!packageRoot) {
  throw new Error("Uso: node supabase/tests/verify_clean_rebuild.mjs <directorio-paquete-pglite>");
}

const { PGlite } = await import(
  pathToFileURL(path.join(path.resolve(packageRoot), "dist", "index.js")).href
);
const { pgcrypto } = await import(
  pathToFileURL(path.join(path.resolve(packageRoot), "dist", "contrib", "pgcrypto.js")).href
);

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const migrationsDir = path.join(projectRoot, "supabase", "migrations");
const seedPath = path.join(projectRoot, "supabase", "seed.sql");
const db = new PGlite({ extensions: { pgcrypto } });

const managedSchemasPrelude = [
  "create role anon nologin;",
  "create role authenticated nologin;",
  "create role service_role nologin;",
  "create schema auth;",
  "create table auth.users (id uuid primary key);",
  "create function auth.uid() returns uuid language sql stable as 'select null::uuid';",
  "create schema storage;",
  "create table storage.buckets (id text primary key, name text not null unique, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);",
  "create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null references storage.buckets(id), name text not null);",
  "create function storage.foldername(name text) returns text[] language sql immutable as 'select string_to_array(name, ''/'')';",
  "alter table storage.objects enable row level security;",
].join("\n");

const expectedTables = [
  "activities",
  "attachments",
  "business_settings",
  "business_users",
  "businesses",
  "contacts",
  "email_jobs",
  "email_templates",
  "follow_ups",
  "form_configs",
  "form_fields",
  "profiles",
  "public_form_idempotency_keys",
  "public_form_rate_limit_windows",
  "request_custom_answers",
  "requests",
  "sectors",
];

const expectedFunctions = [
  "authorize_public_attachment_upload",
  "claim_email_jobs",
  "get_email_job_context",
  "resolve_email_job_failed",
  "resolve_email_job_sent",
  "submit_public_form_submission",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await db.exec(managedSchemasPrelude);

const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const migrationFile of migrationFiles) {
  try {
    await db.exec(await readFile(path.join(migrationsDir, migrationFile), "utf8"));
  } catch (error) {
    throw new Error("Fallo en " + migrationFile + ": " + error.message, { cause: error });
  }
}

await db.exec(await readFile(seedPath, "utf8"));

const tables = await db.query([
  "select c.relname as name, c.relrowsecurity as rls",
  "from pg_class c",
  "join pg_namespace n on n.oid = c.relnamespace",
  "where n.nspname = 'public' and c.relkind = 'r'",
  "order by c.relname",
].join("\n"));

assert(
  JSON.stringify(tables.rows.map((row) => row.name)) === JSON.stringify(expectedTables),
  "Tablas inesperadas: " + JSON.stringify(tables.rows),
);
assert(tables.rows.every((row) => row.rls), "Todas las tablas públicas deben tener RLS");

const functions = await db.query([
  "select p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments",
  "from pg_proc p",
  "join pg_namespace n on n.oid = p.pronamespace",
  "where n.nspname = 'public'",
  "and p.proname in ('submit_public_form_submission', 'get_email_job_context', 'authorize_public_attachment_upload', 'claim_email_jobs', 'resolve_email_job_sent', 'resolve_email_job_failed')",
  "order by p.proname, arguments",
].join("\n"));
assert(
  expectedFunctions.every((name) => functions.rows.some((row) => row.name === name)),
  "Faltan funciones: " + JSON.stringify(functions.rows),
);
assert(functions.rows.length === 7, "Deben existir siete firmas de funciones de aplicación");

const securityDefiners = await db.query([
  "select p.proname as name",
  "from pg_proc p",
  "join pg_namespace n on n.oid = p.pronamespace",
  "where n.nspname = 'public' and p.prosecdef",
].join("\n"));
assert(securityDefiners.rows.length === 0, "Las RPC de aplicación deben ser SECURITY INVOKER");

const executeGrants = await db.query([
  "select routine_name, grantee",
  "from information_schema.routine_privileges",
  "where specific_schema = 'public'",
  "and routine_name in ('get_email_job_context', 'authorize_public_attachment_upload', 'claim_email_jobs', 'resolve_email_job_sent', 'resolve_email_job_failed')",
  "and grantee in ('PUBLIC', 'anon', 'authenticated')",
].join("\n"));
assert(executeGrants.rows.length === 0, "Las RPC backend-only no deben tener EXECUTE frontend");

const storagePolicy = await db.query([
  "select policyname, roles, cmd",
  "from pg_policies",
  "where schemaname = 'storage' and tablename = 'objects'",
].join("\n"));
assert(
  storagePolicy.rows.length === 1 && storagePolicy.rows[0].cmd === "SELECT",
  "Policy Storage inesperada: " + JSON.stringify(storagePolicy.rows),
);

const bucket = await db.query([
  "select public, file_size_limit, allowed_mime_types",
  "from storage.buckets",
  "where id = 'request-attachments'",
].join("\n"));
assert(bucket.rows.length === 1, "Falta el bucket request-attachments");
assert(bucket.rows[0].public === false, "El bucket debe ser privado");
assert(Number(bucket.rows[0].file_size_limit) === 10_485_760, "Límite de bucket incorrecto");
assert(bucket.rows[0].allowed_mime_types.length === 6, "Lista MIME de bucket incorrecta");

const notValidChecks = await db.query([
  "select conname",
  "from pg_constraint",
  "where conrelid = 'public.attachments'::regclass",
  "and contype = 'c'",
  "and not convalidated",
  "order by conname",
].join("\n"));
assert(notValidChecks.rows.length === 4, "Deben conservarse cuatro checks NOT VALID legacy");

const catalogCounts = await db.query([
  "select",
  "(select count(distinct c.oid)::int from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace where n.nspname = 'public' and c.contype in ('p', 'f', 'u', 'c')) as constraints,",
  "(select count(*)::int from pg_indexes where schemaname = 'public') as indexes,",
  "(select count(*)::int from pg_policies where schemaname = 'public') as policies",
].join("\n"));
assert(
  catalogCounts.rows[0].constraints === 129 &&
    catalogCounts.rows[0].indexes === 69 &&
    catalogCounts.rows[0].policies === 34,
  "Inventario SQL distinto de DEV: " + JSON.stringify(catalogCounts.rows[0]),
);

const workerColumns = await db.query([
  "select column_name",
  "from information_schema.columns",
  "where table_schema = 'public'",
  "and table_name = 'email_jobs'",
  "and column_name in ('claim_token', 'lease_expires_at')",
  "order by column_name",
].join("\n"));
assert(workerColumns.rows.length === 2, "Faltan columnas de claim/lease PRE-C13B");

const seedCounts = await db.query([
  "select",
  "(select count(*)::int from public.sectors where slug in ('reformas','electricidad','fontaneria','climatizacion','cristaleria','academias')) as sectors,",
  "(select count(*)::int from public.businesses where slug like '%-baseline-dev') as businesses,",
  "(select count(*)::int from public.form_configs f join public.businesses b on b.id = f.business_id where b.slug like '%-baseline-dev' and f.public_slug = 'solicitud') as forms,",
  "(select count(*)::int from public.form_fields ff join public.businesses b on b.id = ff.business_id where b.slug like '%-baseline-dev') as fields",
].join("\n"));
assert(
  seedCounts.rows[0].sectors === 6 &&
    seedCounts.rows[0].businesses === 6 &&
    seedCounts.rows[0].forms === 6 &&
    seedCounts.rows[0].fields === 12,
  "Seed incompleto: " + JSON.stringify(seedCounts.rows[0]),
);

await db.exec([
  "insert into public.contacts (id, business_id, display_name, email)",
  "select fixture.contact_id, b.id, fixture.display_name, fixture.email",
  "from public.businesses b",
  "cross join (values",
  "('70000000-0000-4000-8000-000000000001'::uuid, 'Cliente Worker Uno', 'cliente.worker.uno@example.test'),",
  "('70000000-0000-4000-8000-000000000002'::uuid, 'Cliente Worker Dos', 'cliente.worker.dos@example.test')",
  ") fixture(contact_id, display_name, email)",
  "where b.slug = 'reformas-baseline-dev';",
  "",
  "insert into public.requests (id, business_id, contact_id, sector_id, form_config_id, reference, service, description, status, created_at)",
  "select fixture.request_id, b.id, fixture.contact_id, b.sector_id, f.id, fixture.reference, 'Servicio ficticio', 'Solicitud ficticia PRE-C13B', 'Nuevo', fixture.created_at",
  "from public.businesses b",
  "join public.form_configs f on f.business_id = b.id and f.public_slug = 'solicitud'",
  "cross join (values",
  "('71000000-0000-4000-8000-000000000001'::uuid, '70000000-0000-4000-8000-000000000001'::uuid, 'REF-WORKER-001', clock_timestamp() - interval '2 minutes'),",
  "('71000000-0000-4000-8000-000000000002'::uuid, '70000000-0000-4000-8000-000000000002'::uuid, 'REF-WORKER-002', clock_timestamp() - interval '1 minute')",
  ") fixture(request_id, contact_id, reference, created_at)",
  "where b.slug = 'reformas-baseline-dev';",
  "",
  "insert into public.email_jobs (id, business_id, request_id, email_type, created_at)",
  "select fixture.job_id, r.business_id, r.id, fixture.email_type, fixture.created_at",
  "from public.requests r",
  "join (values",
  "('72000000-0000-4000-8000-000000000001'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 'customer_confirmation', clock_timestamp() - interval '4 minutes'),",
  "('72000000-0000-4000-8000-000000000002'::uuid, '71000000-0000-4000-8000-000000000001'::uuid, 'business_notification', clock_timestamp() - interval '3 minutes'),",
  "('72000000-0000-4000-8000-000000000003'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 'customer_confirmation', clock_timestamp() - interval '2 minutes'),",
  "('72000000-0000-4000-8000-000000000004'::uuid, '71000000-0000-4000-8000-000000000002'::uuid, 'business_notification', clock_timestamp() - interval '1 minute')",
  ") fixture(job_id, request_id, email_type, created_at) on fixture.request_id = r.id;",
].join("\n"));

const firstClaims = await db.query("select * from public.claim_email_jobs(2, 300)");
assert(firstClaims.rows.length === 2, "El claim debe respetar p_limit y devolver dos jobs");
assert(
  firstClaims.rows.every((row) =>
    row.claim_token &&
    row.delivery_id === row.job_id &&
    row.context?.recipient_email
  ),
  "Cada claim debe incluir token, delivery_id y contexto C11C",
);

const sent = await db.query(
  "select * from public.resolve_email_job_sent($1::uuid, $2::uuid)",
  [firstClaims.rows[0].job_id, firstClaims.rows[0].claim_token],
);
assert(sent.rows.length === 1 && sent.rows[0].status === "sent", "El claim actual debe poder marcar sent");

const retry = await db.query(
  "select * from public.resolve_email_job_failed($1::uuid, $2::uuid, $3, clock_timestamp() + interval '10 minutes')",
  [firstClaims.rows[1].job_id, firstClaims.rows[1].claim_token, "Timeout saneado"],
);
assert(retry.rows.length === 1 && retry.rows[0].status === "pending", "retry_at debe devolver el job a pending");

const thirdClaim = await db.query("select * from public.claim_email_jobs(1, 30)");
assert(thirdClaim.rows.length === 1, "Debe reclamar el siguiente job disponible");
await db.query([
  "update public.email_jobs",
  "set processing_started_at = clock_timestamp() - interval '10 minutes',",
  "lease_expires_at = clock_timestamp() - interval '5 minutes'",
  "where id = $1::uuid",
].join("\n"), [thirdClaim.rows[0].job_id]);

const recovered = await db.query("select * from public.claim_email_jobs(1, 300)");
assert(recovered.rows.length === 1, "Un lease expirado debe ser recuperable");
assert(recovered.rows[0].job_id === thirdClaim.rows[0].job_id, "Debe recuperarse el mismo job expirado");
assert(recovered.rows[0].claim_token !== thirdClaim.rows[0].claim_token, "La recuperación debe emitir un token nuevo");

const staleSent = await db.query(
  "select * from public.resolve_email_job_sent($1::uuid, $2::uuid)",
  [thirdClaim.rows[0].job_id, thirdClaim.rows[0].claim_token],
);
const staleFailed = await db.query(
  "select * from public.resolve_email_job_failed($1::uuid, $2::uuid, $3, null)",
  [thirdClaim.rows[0].job_id, thirdClaim.rows[0].claim_token, "Worker antiguo"],
);
assert(staleSent.rows.length === 0 && staleFailed.rows.length === 0, "Un token antiguo no puede resolver el job");

const terminalFailed = await db.query(
  "select * from public.resolve_email_job_failed($1::uuid, $2::uuid, $3, null)",
  [recovered.rows[0].job_id, recovered.rows[0].claim_token, "Fallo permanente saneado"],
);
assert(
  terminalFailed.rows.length === 1 && terminalFailed.rows[0].status === "failed",
  "El token vigente debe poder registrar un fallo terminal",
);

const fourthClaim = await db.query("select * from public.claim_email_jobs(1, 300)");
assert(fourthClaim.rows.length === 1, "Debe quedar un cuarto job pendiente");
await db.query(
  "select * from public.resolve_email_job_failed($1::uuid, $2::uuid, $3, null)",
  [fourthClaim.rows[0].job_id, fourthClaim.rows[0].claim_token, "Fallo terminal saneado"],
);

await db.query(
  "update public.email_jobs set available_at = clock_timestamp() - interval '1 second' where id = $1::uuid",
  [firstClaims.rows[1].job_id],
);
const retryClaim = await db.query("select * from public.claim_email_jobs(1, 300)");
assert(retryClaim.rows.length === 1 && retryClaim.rows[0].attempt_count === 2, "El retry debe incrementar attempt_count");
const staleRetryToken = await db.query(
  "select * from public.resolve_email_job_sent($1::uuid, $2::uuid)",
  [firstClaims.rows[1].job_id, firstClaims.rows[1].claim_token],
);
assert(staleRetryToken.rows.length === 0, "El token anterior al retry debe quedar inutilizado");
await db.query(
  "select * from public.resolve_email_job_sent($1::uuid, $2::uuid)",
  [retryClaim.rows[0].job_id, retryClaim.rows[0].claim_token],
);

const noClaims = await db.query("select * from public.claim_email_jobs(10, 300)");
assert(noClaims.rows.length === 0, "Los jobs sent/failed no deben volver a reclamarse");

const workerState = await db.query([
  "select status, count(*)::int as total",
  "from public.email_jobs",
  "where id::text like '72000000-%'",
  "group by status",
  "order by status",
].join("\n"));
assert(
  JSON.stringify(workerState.rows) === JSON.stringify([
    { status: "failed", total: 2 },
    { status: "sent", total: 2 },
  ]),
  "Estado final inesperado: " + JSON.stringify(workerState.rows),
);

console.log(JSON.stringify({
  migrations: migrationFiles.length,
  tables: tables.rows.length,
  rlsTables: tables.rows.filter((row) => row.rls).length,
  functions: functions.rows.map((row) => row.name),
  catalog: catalogCounts.rows[0],
  storagePolicies: storagePolicy.rows.length,
  bucket: "private/10MiB/6 MIME",
  legacyNotValidChecks: notValidChecks.rows.length,
  seed: seedCounts.rows[0],
  workerLifecycle: workerState.rows,
}, null, 2));

await db.close();
