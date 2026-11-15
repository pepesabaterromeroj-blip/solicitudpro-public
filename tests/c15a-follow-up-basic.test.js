const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).find((name) => name.endsWith('_c15a_follow_up_basic.sql'))
  : null;
const migrationPath = migrationName ? path.join(migrationsDir, migrationName) : '';
const correctionName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).find((name) => name.endsWith('_c15a_follow_up_encoding_fix.sql'))
  : null;
const correctionPath = correctionName ? path.join(migrationsDir, correctionName) : '';
const contractPath = path.join(root, 'supabase', 'functions', 'follow-up-basic-worker', 'worker-contract.ts');
const indexPath = path.join(root, 'supabase', 'functions', 'follow-up-basic-worker', 'index.ts');
const configPath = path.join(root, 'supabase', 'config.toml');

function readOrEmpty(filePath) {
  return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function request(secret, body = {}) {
  return new Request('https://example.test/functions/v1/follow-up-basic-worker/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('C15A migration uses a monotonic request milestone and explicit activity uniqueness', () => {
  const sql = readOrEmpty(migrationPath);
  assert.ok(sql, 'C15A migration must exist');
  assert.match(sql, /automatic_follow_up_milestone_hours\s+smallint\s+not null\s+default 0/i);
  assert.match(sql, /automatic_follow_up_milestone_hours\s+in\s*\(0,\s*24,\s*48,\s*72\)/i);
  assert.match(sql, /unique[\s\S]*request_id[\s\S]*type[\s\S]*request_follow_up_24h[\s\S]*request_follow_up_48h[\s\S]*request_follow_up_72h/i);
  assert.doesNotMatch(sql, /update\s+public\.follow_ups|insert\s+into\s+public\.follow_ups|next_follow_up_at\s*=/i);
});

test('C15A RPC performs highest-milestone catch-up for active unarchived requests atomically', () => {
  const sql = readOrEmpty(migrationPath);
  assert.match(sql, /create or replace function public\.process_basic_follow_up_milestones/i);
  assert.match(sql, /when[^;]*created_at\s*<=\s*[^;]*interval '72 hours'[^;]*then 72[\s\S]*interval '48 hours'[^;]*then 48[\s\S]*interval '24 hours'[^;]*then 24/i);
  assert.match(
    sql,
    /status\s+in\s*\('Nuevo',\s*(?:'En preparación'|U&'En preparaci\\00F3n'),\s*'Enviado',\s*'Seguimiento pendiente'\)/i,
  );
  assert.match(sql, /archived_at\s+is\s+null/i);
  assert.match(sql, /for update[\s\S]*skip locked/i);
  assert.match(sql, /update\s+public\.requests[\s\S]*automatic_follow_up_milestone_hours/i);
  assert.match(sql, /insert\s+into\s+public\.activities/i);
  assert.match(sql, /on conflict[\s\S]*do nothing/i);
  assert.match(sql, /actor_type[\s\S]*'automation'/i);
});

test('C15A RPC is backend-only and keeps tenant identity in every generated activity', () => {
  const sql = readOrEmpty(migrationPath);
  assert.match(sql, /business_id/i);
  assert.match(sql, /revoke execute on function public\.process_basic_follow_up_milestones\(integer, uuid\[\]\)\s+from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.process_basic_follow_up_milestones\(integer, uuid\[\]\)\s+to service_role/i);
  assert.match(sql, /set search_path\s*=\s*''/i);
});

test('C15A final corrective migration preserves accented literals without mojibake', () => {
  const sql = readOrEmpty(correctionPath);
  assert.ok(sql, 'C15A encoding correction migration must exist');
  assert.match(sql, /U&'En preparaci\\00F3n'/);
  assert.match(sql, /U&'Seguimiento autom\\00E1tico:/);
  assert.match(sql, /create or replace function public\.process_basic_follow_up_milestones/i);
  assert.match(sql, /create index requests_basic_follow_up_due_idx/i);
  assert.doesNotMatch(sql, /preparaciÃ³n|automÃ¡tico/);
});

test('C15A worker rejects missing credentials before invoking the RPC', async () => {
  assert.ok(fs.existsSync(contractPath), 'C15A worker contract must exist');
  const { handleFollowUpBasicRequest } = await import(pathToFileURL(contractPath).href);
  let calls = 0;
  const response = await handleFollowUpBasicRequest(request(null), {
    secret: 'dedicated-c15a-secret',
    invokeRpc: async () => {
      calls += 1;
      return { data: null, error: null };
    },
    log: () => {},
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

test('C15A worker invokes only the bounded RPC and returns a safe execution summary', async () => {
  assert.ok(fs.existsSync(contractPath), 'C15A worker contract must exist');
  const { handleFollowUpBasicRequest } = await import(pathToFileURL(contractPath).href);
  const calls = [];
  const logs = [];
  const response = await handleFollowUpBasicRequest(request('dedicated-c15a-secret', { limit: 25 }), {
    secret: 'dedicated-c15a-secret',
    invokeRpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: [{ processed_count: 3, milestone_24h_count: 1, milestone_48h_count: 1, milestone_72h_count: 1 }],
        error: null,
      };
    },
    log: (entry) => logs.push(entry),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ name: 'process_basic_follow_up_milestones', args: { p_limit: 25 } }]);
  assert.deepEqual(await response.json(), {
    processed_count: 3,
    milestone_24h_count: 1,
    milestone_48h_count: 1,
    milestone_72h_count: 1,
  });
  assert.deepEqual(logs, [{ event: 'follow_up_basic_worker', outcome: 'processed', processed_count: 3 }]);
});

test('C15A worker is registered without JWT because it enforces its dedicated bearer secret', () => {
  const config = readOrEmpty(configPath);
  const index = readOrEmpty(indexPath);
  assert.match(config, /\[functions\.follow-up-basic-worker\][\s\S]*verify_jwt\s*=\s*false/i);
  assert.match(index, /C15A_WORKER_SECRET/);
  assert.doesNotMatch(index + readOrEmpty(contractPath), /openai|gateway|email|suggested_reply/i);
});
