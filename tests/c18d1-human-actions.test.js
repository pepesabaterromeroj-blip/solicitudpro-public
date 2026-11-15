const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { createDataService } = require(path.join(root, 'js/data/product-data.js'));
const { renderFullDetail, renderFollowUpRows, confirmedWrite } = require(path.join(root, 'js/real-product.js'));

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const OTHER_BUSINESS = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';
const FOLLOW_UP = '55555555-5555-4555-8555-555555555555';
const NOTE = '66666666-6666-4666-8666-666666666666';
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
  [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: BUSINESS, name: 'Negocio DEV' }] }],
];

async function authorizedService(routes) {
  const result = fixture([...authRoutes, ...routes]);
  await result.service.signIn('owner@example.test', 'test-password');
  await result.service.listBusinesses();
  return result;
}

const request = {
  id: REQUEST, business_id: BUSINESS, reference: 'REF-C18D1', status: 'Nuevo', priority: null,
  archived_at: null, won_at: null, lost_at: null, contact: { display_name: 'Cliente DEV' },
};

test('request state and priority use allowed values, scoped PATCH and confirmed server row', async () => {
  let confirmed = { ...request, status: 'Enviado', priority: 1 };
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/requests') && options.method === 'PATCH', () => ({ body: [confirmed] })],
  ]);

  const result = await service.updateRequestState(BUSINESS, request, { status: 'Enviado', priority: 1 });
  assert.equal(result.status, 'Enviado');
  const write = calls.at(-1);
  assert.equal(write.options.method, 'PATCH');
  assert.equal(write.target.searchParams.get('id'), `eq.${REQUEST}`);
  assert.equal(write.target.searchParams.get('business_id'), `eq.${BUSINESS}`);
  assert.equal(write.options.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(write.options.body), { status: 'Enviado', priority: 1, won_at: null, lost_at: null });

  const beforeInvalid = calls.length;
  await assert.rejects(service.updateRequestState(BUSINESS, request, { status: 'Inventado', priority: 1 }), /INVALID_CHANGE/);
  await assert.rejects(service.updateRequestState(BUSINESS, request, { status: 'Nuevo', priority: 4 }), /INVALID_CHANGE/);
  await assert.rejects(service.updateRequestState(OTHER_BUSINESS, request, { status: 'Nuevo', priority: 1 }), /BUSINESS_NOT_AUTHORIZED/);
  assert.equal(calls.length, beforeInvalid);

  confirmed = { ...confirmed, business_id: OTHER_BUSINESS };
  await assert.rejects(service.updateRequestState(BUSINESS, request, { status: 'Enviado', priority: 1 }), /WRITE_NOT_CONFIRMED/);
});

test('archive and restore are symmetric confirmed PATCH operations and never DELETE', async () => {
  let archived = true;
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/requests') && options.method === 'PATCH', () => ({ body: [{ ...request, archived_at: archived ? '2026-10-07T10:00:00.000Z' : null }] })],
  ]);
  assert.ok((await service.setRequestArchived(BUSINESS, request, true)).archived_at);
  archived = false;
  assert.equal((await service.setRequestArchived(BUSINESS, { ...request, archived_at: '2026-10-07T10:00:00.000Z' }, false)).archived_at, null);
  const writes = calls.filter(({ options }) => options.method === 'PATCH');
  assert.equal(writes.length, 2);
  assert.equal(writes.some(({ options }) => options.method === 'DELETE'), false);
  assert.equal(JSON.parse(writes[1].options.body).archived_at, null);
});

test('follow-up completion is pending-only, tenant-scoped and requires server confirmation', async () => {
  const followUp = { id: FOLLOW_UP, business_id: BUSINESS, request_id: REQUEST, status: 'pending' };
  const completed = { ...followUp, status: 'completed', completed_at: '2026-10-07T10:00:00.000Z' };
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/follow_ups') && options.method === 'PATCH', { body: [completed] }],
  ]);
  assert.equal((await service.completeFollowUp(BUSINESS, followUp)).status, 'completed');
  const write = calls.at(-1);
  assert.equal(write.target.searchParams.get('status'), 'eq.pending');
  assert.equal(JSON.parse(write.options.body).status, 'completed');
  assert.match(JSON.parse(write.options.body).completed_at, /^2026-/);
  const beforeReplay = calls.length;
  await assert.rejects(service.completeFollowUp(BUSINESS, completed), /FOLLOW_UP_NOT_ALLOWED/);
  await assert.rejects(service.completeFollowUp(OTHER_BUSINESS, followUp), /BUSINESS_NOT_AUTHORIZED/);
  assert.equal(calls.length, beforeReplay);
});

test('internal note is trimmed, length-limited, user-attributed and server-confirmed', async () => {
  const confirmed = { id: NOTE, business_id: BUSINESS, request_id: REQUEST, actor_type: 'user', actor_user_id: USER, type: 'internal_note', title: 'Nota interna', detail: 'Llamar por la tarde.', created_at: '2026-10-07T10:00:00.000Z' };
  const { service, calls } = await authorizedService([
    [(url, options) => url.pathname.endsWith('/activities') && options.method === 'POST', { body: [confirmed] }],
  ]);
  const result = await service.addInternalNote(BUSINESS, REQUEST, '  Llamar por la tarde.  ');
  assert.equal(result.detail, 'Llamar por la tarde.');
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
    business_id: BUSINESS, request_id: REQUEST, actor_type: 'user', actor_user_id: USER,
    type: 'internal_note', title: 'Nota interna', detail: 'Llamar por la tarde.',
  });
  const beforeInvalid = calls.length;
  await assert.rejects(service.addInternalNote(BUSINESS, REQUEST, '   '), /NOTE_NOT_ALLOWED/);
  await assert.rejects(service.addInternalNote(BUSINESS, REQUEST, 'x'.repeat(2001)), /NOTE_NOT_ALLOWED/);
  await assert.rejects(service.addInternalNote(OTHER_BUSINESS, REQUEST, 'Nota'), /BUSINESS_NOT_AUTHORIZED/);
  assert.equal(calls.length, beforeInvalid);
});

test('real UI exposes only the approved base actions and follow-up completion', () => {
  const html = renderFullDetail({ request, contact: request.contact, form: null, answers: [], activities: [], notes: [], attachments: [], communications: [] });
  assert.match(html, /data-real-request-update/);
  assert.match(html, /Cambiar estado y prioridad/);
  assert.match(html, /data-real-archive-request/);
  assert.match(html, /Añadir nota/);
  assert.match(html, /maxlength="2000"/);
  assert.doesNotMatch(html, /Aprobar respuesta|Enviar respuesta|Regenerar|Crear seguimiento/);

  const followHtml = renderFollowUpRows([request], { followUps: [{ id: FOLLOW_UP, request_id: REQUEST, business_id: BUSINESS, status: 'pending', action_text: 'Llamar' }], activities: [] });
  assert.match(followHtml, new RegExp(`data-real-complete-follow-up="${FOLLOW_UP}"`));
});

test('confirmedWrite refreshes only after success and backend errors cannot produce false success', async () => {
  const order = [];
  const value = await confirmedWrite(async () => { order.push('write'); return { id: REQUEST }; }, async result => { order.push(`refresh:${result.id}`); });
  assert.equal(value.id, REQUEST);
  assert.deepEqual(order, ['write', `refresh:${REQUEST}`]);

  order.length = 0;
  await assert.rejects(confirmedWrite(async () => { order.push('write'); throw new Error('WRITE_FAILED'); }, async () => order.push('refresh')), /WRITE_FAILED/);
  assert.deepEqual(order, ['write']);
});

test('real writes stay out of local mode and frontend has no privileged credential', () => {
  const data = fs.readFileSync(path.join(root, 'js/data/product-data.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(controller, /get\('mode'\) !== 'local'/);
  assert.match(html, /href="\?mode=local"/);
  assert.doesNotMatch(data + controller, /service_role|sb_secret_|auth\.users|email_jobs/);
});
