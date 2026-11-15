const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { createDataService } = require(path.join(root, 'js/data/product-data.js'));
const { renderManualFollowUpComposer, renderFollowUpRows, renderFullDetail, calculateDashboardMetrics } = require(path.join(root, 'js/real-product.js'));

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const OTHER_BUSINESS = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';
const FOLLOW_UP = '55555555-5555-4555-8555-555555555555';
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const reopenMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261023100000_c19_reopen_manual_follow_up.sql'), 'utf8');
const jwt = `header.${Buffer.from(JSON.stringify({ sub: USER })).toString('base64url')}.signature`;

function fixture(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = new URL(url);
    calls.push({ target, options });
    const route = routes.find(([match]) => match(target, options));
    if (!route) throw new Error(`Unexpected request: ${target.pathname}?${target.searchParams}`);
    const value = typeof route[1] === 'function' ? route[1](target, options) : route[1];
    return { ok: value.ok !== false, status: value.status || 200, json: async () => value.body ?? value };
  };
  return { service: createDataService({ fetchImpl }), calls };
}

const authRoutes = [
  [(url) => url.pathname === '/auth/v1/token', { body: { access_token: jwt, expires_in: 3600 } }],
  [(url) => url.pathname === '/auth/v1/user', { body: { id: USER, email: 'owner@example.test' } }],
  [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: BUSINESS, user_id: USER, is_active: true, role: 'owner' }] }],
  [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: BUSINESS, name: 'Reformas Demo Dev' }] }],
];

async function authorizedService(routes) {
  const result = fixture([...authRoutes, ...routes]);
  await result.service.signIn('owner@example.test', 'test-password');
  await result.service.listBusinesses();
  return result;
}

const request = { id: REQUEST, business_id: BUSINESS, reference: 'REF-010', status: 'Nuevo', archived_at: null, contact: { display_name: 'Cliente DEV' } };
const pending = {
  id: FOLLOW_UP, business_id: BUSINESS, request_id: REQUEST, assigned_to: USER,
  due_at: '2099-10-08T10:30:00.000Z', cadence_hours: null, channel: 'internal',
  action_text: 'Llamar al cliente - prueba C18D-2', status: 'pending', completed_at: null,
};

function activity(type) {
  const titles = {
    manual_follow_up_created: 'Seguimiento manual creado',
    manual_follow_up_completed: 'Seguimiento completado',
    manual_follow_up_reopened: 'Seguimiento reabierto',
  };
  return {
    id: ACTIVITY, business_id: BUSINESS, request_id: REQUEST, actor_type: 'user', actor_user_id: USER,
    type, title: titles[type],
    detail: pending.action_text, metadata: { follow_up_id: FOLLOW_UP }, created_at: '2026-10-07T12:00:00.000Z',
  };
}

test('creates an authorized manual follow-up and records its human activity after confirmation', async () => {
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/follow_ups') && options.method === 'POST', { body: [pending] }],
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { body: [activity('manual_follow_up_created')] }],
  ]);
  const result = await service.createManualFollowUp(BUSINESS, request, { actionText: `  ${pending.action_text}  `, dueAt: '2099-10-08T10:30' });
  assert.equal(result.followUp.status, 'pending');
  assert.equal(result.activity.type, 'manual_follow_up_created');
  const writes = calls.filter(({ target, options }) => target.pathname.startsWith('/rest/v1/') && ['POST', 'PATCH'].includes(options.method));
  assert.deepEqual(writes.map(({ target }) => target.pathname.split('/').at(-1)), ['follow_ups', 'activities']);
  assert.deepEqual(JSON.parse(writes[0].options.body), {
    business_id: BUSINESS, request_id: REQUEST, assigned_to: USER, due_at: new Date('2099-10-08T10:30').toISOString(),
    cadence_hours: null, channel: 'internal', action_text: pending.action_text, status: 'pending',
  });
  assert.deepEqual(JSON.parse(writes[1].options.body).metadata, { follow_up_id: FOLLOW_UP });
});

test('rejects empty text, invalid or past date and foreign request before network write', async () => {
  const { service, calls } = await authorizedService([]);
  const before = calls.length;
  await assert.rejects(service.createManualFollowUp(BUSINESS, request, { actionText: ' ', dueAt: '2099-10-08T10:30' }), /FOLLOW_UP_INVALID/);
  await assert.rejects(service.createManualFollowUp(BUSINESS, request, { actionText: 'Llamar', dueAt: 'not-a-date' }), /FOLLOW_UP_INVALID/);
  await assert.rejects(service.createManualFollowUp(BUSINESS, request, { actionText: 'Llamar', dueAt: '2020-01-01T10:00' }), /FOLLOW_UP_INVALID/);
  await assert.rejects(service.createManualFollowUp(BUSINESS, { ...request, business_id: OTHER_BUSINESS }, { actionText: 'Llamar', dueAt: '2099-10-08T10:30' }), /FOLLOW_UP_INVALID/);
  await assert.rejects(service.createManualFollowUp(OTHER_BUSINESS, request, { actionText: 'Llamar', dueAt: '2099-10-08T10:30' }), /BUSINESS_NOT_AUTHORIZED/);
  assert.equal(calls.length, before);
});

test('completes pending manual follow-up once and records completion activity', async () => {
  const completed = { ...pending, status: 'completed', completed_at: '2026-10-07T12:00:00.000Z', completed_by: USER };
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/follow_ups') && options.method === 'PATCH', { body: [completed] }],
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { body: [activity('manual_follow_up_completed')] }],
  ]);
  const result = await service.completeManualFollowUp(BUSINESS, pending);
  assert.equal(result.followUp.status, 'completed');
  assert.equal(result.activity.type, 'manual_follow_up_completed');
  const patch = calls.find(({ options }) => options.method === 'PATCH');
  assert.equal(patch.target.searchParams.get('status'), 'eq.pending');
  assert.equal(JSON.parse(patch.options.body).completed_by, USER);
  const beforeReplay = calls.length;
  await assert.rejects(service.completeManualFollowUp(BUSINESS, completed), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.completeManualFollowUp(OTHER_BUSINESS, pending), /BUSINESS_NOT_AUTHORIZED/);
  assert.equal(calls.length, beforeReplay);
});

test('reports an honest partial result if Activity fails after the follow-up persisted', async () => {
  const completed = { ...pending, status: 'completed', completed_at: '2026-10-07T12:00:00.000Z', completed_by: USER };
  const { service } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/follow_ups') && options.method === 'PATCH', { body: [completed] }],
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { ok: false, status: 500, body: { private: 'do not expose' } }],
  ]);
  await assert.rejects(service.completeManualFollowUp(BUSINESS, pending), /FOLLOW_UP_COMPLETED_ACTIVITY_FAILED/);
});

test('reopens one completed manual follow-up, preserves its task data and records human activity', async () => {
  const completed = {
    ...pending,
    status: 'completed',
    completed_at: '2026-10-07T12:00:00.000Z',
    completed_by: USER,
    completion_note: 'Contacto realizado',
  };
  const reopened = { ...completed, status: 'pending', completed_at: null, completed_by: null, completion_note: null };
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/rpc/reopen_manual_follow_up') && options.method === 'POST', { body: [reopened] }],
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { body: [activity('manual_follow_up_reopened')] }],
  ]);

  const result = await service.reopenManualFollowUp(BUSINESS, completed, request);

  assert.equal(result.followUp.status, 'pending');
  assert.equal(result.followUp.completed_at, null);
  assert.equal(result.followUp.completed_by, null);
  assert.equal(result.followUp.action_text, completed.action_text);
  assert.equal(result.followUp.due_at, completed.due_at);
  assert.equal(result.followUp.assigned_to, completed.assigned_to);
  assert.equal(result.activity.type, 'manual_follow_up_reopened');
  assert.equal(result.followUp.completion_note, null);
  const rpc = calls.find(({ target }) => target.pathname.endsWith('/rpc/reopen_manual_follow_up'));
  assert.deepEqual(JSON.parse(rpc.options.body), { p_follow_up_id: FOLLOW_UP, p_business_id: BUSINESS });
  const activityWrite = calls.find(({ target, options }) => target.pathname.endsWith('/activities') && options.method === 'POST');
  assert.deepEqual(JSON.parse(activityWrite.options.body).metadata, { follow_up_id: FOLLOW_UP });
});

test('rejects invalid, pending, automatic, foreign, archived and closed follow-ups before reopening', async () => {
  const completed = { ...pending, status: 'completed', completed_at: '2026-10-07T12:00:00.000Z', completed_by: USER };
  const { service, calls } = await authorizedService([]);
  const before = calls.length;

  await assert.rejects(service.reopenManualFollowUp(BUSINESS, { ...completed, id: 'invalid' }, request), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, pending, request), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, { ...completed, assigned_to: null, cadence_hours: 24, channel: 'call' }, request), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.reopenManualFollowUp(OTHER_BUSINESS, completed, request), /BUSINESS_NOT_AUTHORIZED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, completed, { ...request, archived_at: '2026-10-08T10:00:00Z' }), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, completed, { ...request, status: 'Ganado' }), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, completed, { ...request, status: 'Perdido' }), /FOLLOW_UP_NOT_ALLOWED/);
  assert.equal(calls.length, before);
});

test('blocks replay and reports an honest partial result when reopen Activity fails', async () => {
  const completed = { ...pending, status: 'completed', completed_at: '2026-10-07T12:00:00.000Z', completed_by: USER };
  const reopened = { ...completed, status: 'pending', completed_at: null, completed_by: null, completion_note: null };
  const { service } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/rpc/reopen_manual_follow_up') && options.method === 'POST', { body: [reopened] }],
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { ok: false, status: 500, body: { private: 'do not expose' } }],
  ]);

  await assert.rejects(service.reopenManualFollowUp(BUSINESS, completed, request), /FOLLOW_UP_REOPENED_ACTIVITY_FAILED/);
  await assert.rejects(service.reopenManualFollowUp(BUSINESS, reopened, request), /FOLLOW_UP_NOT_ALLOWED/);
});

test('does not confirm reopen when completion data survives and preserves session failures from Activity', async () => {
  const completed = { ...pending, status: 'completed', completed_at: '2026-10-07T12:00:00.000Z', completed_by: USER, completion_note: 'Hecho' };
  const stale = { ...completed, status: 'pending', completed_at: null, completed_by: null };
  const staleFixture = await authorizedService([
    [(url) => url.pathname.endsWith('/rpc/reopen_manual_follow_up'), { body: [stale] }],
  ]);
  await assert.rejects(staleFixture.service.reopenManualFollowUp(BUSINESS, completed, request), /WRITE_NOT_CONFIRMED/);

  const reopened = { ...stale, completion_note: null };
  const expiredFixture = await authorizedService([
    [(url) => url.pathname.endsWith('/rpc/reopen_manual_follow_up'), { body: [reopened] }],
    [(url) => url.pathname.endsWith('/activities'), { ok: false, status: 401, body: {} }],
  ]);
  await assert.rejects(expiredFixture.service.reopenManualFollowUp(BUSINESS, completed, request), /SESSION_EXPIRED/);
});

test('backend reopen contract atomically restricts tenant, manual rows, completed status and active requests', () => {
  assert.match(reopenMigration, /create\s+function\s+public\.reopen_manual_follow_up\s*\(/i);
  assert.match(reopenMigration, /security\s+invoker/i);
  assert.match(reopenMigration, /set\s+search_path\s*=\s*''/i);
  assert.match(reopenMigration, /f\.id\s*=\s*p_follow_up_id/i);
  assert.match(reopenMigration, /f\.business_id\s*=\s*p_business_id/i);
  assert.match(reopenMigration, /f\.status\s*=\s*'completed'/i);
  assert.match(reopenMigration, /f\.assigned_to\s+is\s+not\s+null/i);
  assert.match(reopenMigration, /f\.cadence_hours\s+is\s+null/i);
  assert.match(reopenMigration, /f\.channel\s*=\s*'internal'/i);
  assert.match(reopenMigration, /r\.archived_at\s+is\s+null/i);
  assert.match(reopenMigration, /r\.status\s+not\s+in\s*\(\s*'Ganado'\s*,\s*'Perdido'\s*\)/i);
  assert.match(reopenMigration, /status\s*=\s*'pending'/i);
  assert.match(reopenMigration, /completed_at\s*=\s*null/i);
  assert.match(reopenMigration, /completed_by\s*=\s*null/i);
  assert.match(reopenMigration, /completion_note\s*=\s*null/i);
  assert.match(reopenMigration, /revoke\s+execute[\s\S]*from\s+public\s*,\s*anon/i);
  assert.match(reopenMigration, /grant\s+execute[\s\S]*to\s+authenticated/i);
});

test('follow-up UI keeps the composer visible at zero pending and distinguishes manual tasks', () => {
  const composer = renderManualFollowUpComposer([request]);
  assert.match(composer, /\+ Añadir seguimiento/);
  assert.match(composer, /data-real-follow-up-create/);
  assert.match(composer, /REF-010/);
  assert.match(composer, /maxlength="500"/);

  const html = renderFollowUpRows([request], {
    followUps: [pending],
    activities: [{ request_id: REQUEST, type: 'manual_follow_up_created', follow_up_id: FOLLOW_UP, actor_type: 'user' }],
  });
  assert.match(html, /Manual/);
  assert.match(html, /Llamar al cliente - prueba C18D-2/);
  assert.match(html, /Marcar como completado/);
  assert.doesNotMatch(html, /business_id|reason_code/);
});

test('follow-up UI renders every pending task when one request has multiple follow-ups', () => {
  const older = { ...pending, id: '77777777-7777-4777-8777-777777777777', assigned_to: null, action_text: 'Revisar la solicitud recibida y contactar', due_at: '2099-10-13T08:00:00.000Z' };
  const html = renderFollowUpRows([request], { followUps: [older, pending], activities: [] });
  assert.match(html, /Revisar la solicitud recibida y contactar/);
  assert.match(html, /Llamar al cliente - prueba C18D-2/);
  assert.equal((html.match(/Marcar como completado/g) || []).length, 2);
});

test('detail shows manual pending/completed tasks while C15 events remain immutable history', () => {
  const html = renderFullDetail({
    request, contact: request.contact, form: null, answers: [], notes: [], attachments: [], communications: [],
    followUps: [pending, { ...pending, id: '77777777-7777-4777-8777-777777777777', status: 'completed', completed_at: '2026-10-07T12:00:00Z' }],
    activities: [
      { actor_type: 'automation', type: 'request_follow_up_24h', created_at: '2026-10-07T10:00:00Z' },
      { actor_type: 'user', type: 'manual_follow_up_completed', title: 'PRIVATE', detail: pending.action_text, created_at: '2026-10-07T12:00:00Z' },
    ],
  });
  assert.match(html, /Seguimiento automático · 24 h/);
  assert.match(html, /Seguimiento completado/);
  assert.match(html, /data-real-complete-follow-up="55555555-5555-4555-8555-555555555555"/);
  assert.equal((html.match(/Marcar como completado/g) || []).length, 1);
  assert.doesNotMatch(html, /data-real-complete-automatic|Editar seguimiento|Eliminar seguimiento/);
});

test('pending counter and dashboard metric use only real pending rows', () => {
  const context = { followUps: [pending, { ...pending, id: '77777777-7777-4777-8777-777777777777', status: 'completed' }], activities: [] };
  assert.equal(context.followUps.filter(item => item.status === 'pending').length, 1);
  assert.equal(calculateDashboardMetrics([request], context, new Date('2099-10-08T12:00:00Z')).follow_ups_due, 1);
});

test('local mode cannot initialize real writes and frontend contains no privileged secret', () => {
  const data = fs.readFileSync(path.join(root, 'js/data/product-data.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(controller, /get\('mode'\) !== 'local'/);
  assert.match(html, /href="\?mode=local"/);
  assert.doesNotMatch(data + controller, /service_role|sb_secret_|auth\.users|email_jobs/);
});
