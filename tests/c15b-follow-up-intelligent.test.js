const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const migrationName = fs.existsSync(migrationsDir)
  ? fs.readdirSync(migrationsDir).find((name) => name.endsWith('_c15b_contextual_follow_up.sql'))
  : null;
const migrationPath = migrationName ? path.join(migrationsDir, migrationName) : '';
const workerPath = path.join(
  root,
  'supabase',
  'functions',
  'follow-up-basic-worker',
  'worker-contract.ts',
);

function readOrEmpty(filePath) {
  return filePath && fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

test('C15B postpones future manual plans and only relevant human activity', () => {
  const sql = readOrEmpty(migrationPath);
  assert.ok(sql, 'C15B migration must exist');
  assert.match(sql, /next_follow_up_at/i);
  assert.match(
    sql,
    /coalesce\s*\(\s*r\.next_follow_up_at\s*>\s*statement_timestamp\(\)\s*,\s*false\s*\)/i,
    'A request without next_follow_up_at must remain eligible',
  );
  assert.match(sql, /status\s*=\s*'pending'[\s\S]*due_at/i);
  assert.match(sql, /actor_type\s*=\s*'user'/i);
  assert.match(sql, /type\s*<>\s*'request_created'/i);
  assert.match(sql, /last_contacted_at/i);
  assert.match(
    sql,
    /last_relevant_human_action_at\s+is\s+null[\s\S]*last_relevant_human_action_at\s*<=/i,
    'A request without previous human activity must remain eligible',
  );
  assert.match(sql, /status\s*=\s*'completed'/i);
  assert.match(sql, /completed_at/i);
  assert.match(sql, /interval '24 hours'/i);
  assert.doesNotMatch(sql, /actor_type\s*=\s*'automation'[\s\S]*recent_human/i);
});

test('C15B decision precedence is overdue manual, high priority, then inactivity', () => {
  const sql = readOrEmpty(migrationPath);
  const overdue = sql.indexOf('manual_follow_up_overdue');
  const priority = sql.indexOf('high_priority_no_recent_activity');
  const inactivity = sql.indexOf('no_recent_activity');
  assert.ok(overdue >= 0, 'overdue manual reason must exist');
  assert.ok(priority > overdue, 'high priority must follow overdue manual');
  assert.ok(inactivity > priority, 'generic inactivity must be the fallback');
  assert.match(sql, /priority\s*=\s*1/i);
});

test('C15B preserves C15A catch-up, terminal exclusion and DB idempotency', () => {
  const sql = readOrEmpty(migrationPath);
  assert.match(sql, /status\s+in\s*\(\s*'Nuevo',[\s\S]*'Seguimiento pendiente'\s*\)/i);
  assert.match(sql, /archived_at\s+is\s+null/i);
  assert.match(sql, /then 72[\s\S]*then 48[\s\S]*then 24/i);
  assert.match(sql, /for update[\s\S]*skip locked/i);
  assert.match(sql, /on conflict[\s\S]*do nothing/i);
  assert.match(sql, /r\.business_id\s*=\s*c\.business_id/i);
  assert.doesNotMatch(sql, /update\s+public\.follow_ups|next_follow_up_at\s*=/i);
});

test('C15B stores short deterministic reasons without sector or AI rules', () => {
  const sql = readOrEmpty(migrationPath);
  assert.match(sql, /jsonb_build_object\([\s\S]*'reason_code'/i);
  assert.match(sql, /Seguimiento recomendado:/i);
  assert.doesNotMatch(sql, /sector_id\s*=|openai|gateway|prompt|model/i);
});

test('C15B reuses the existing worker and RPC without a new external side effect', () => {
  const worker = readOrEmpty(workerPath);
  assert.match(worker, /process_basic_follow_up_milestones/);
  assert.doesNotMatch(worker, /email|gmail|resend|suggested_reply|openai|gateway/i);
});
