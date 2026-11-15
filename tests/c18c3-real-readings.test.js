const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const { createDataService } = require(path.join(root, 'js/data/product-data.js'));
const {
  milestoneLabel,
  followUpReasonLabel,
  projectContacts,
  calculateDashboardMetrics,
  renderFollowUpRows,
  renderContactRows,
  renderDashboard,
  renderFullDetail,
} = require(path.join(root, 'js/real-product.js'));

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const OTHER_BUSINESS = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const REQUEST_A = '44444444-4444-4444-8444-444444444444';
const REQUEST_B = '55555555-5555-4555-8555-555555555555';
const CONTACT_A = '66666666-6666-4666-8666-666666666666';
const CONTACT_B = '77777777-7777-4777-8777-777777777777';
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

const requests = [
  {
    id: REQUEST_A, business_id: BUSINESS, contact_id: CONTACT_A, reference: 'REF-001',
    title: 'Reforma', service: 'Baño', status: 'Nuevo', priority: 1,
    created_at: '2026-10-07T07:00:00Z', next_follow_up_at: '2026-10-07T09:00:00Z',
    automatic_follow_up_milestone_hours: 24, internal_summary: 'Resumen', suggested_reply: 'Borrador',
    contact: { id: CONTACT_A, business_id: BUSINESS, display_name: 'Ana', email: 'ana@example.test', phone: '600000001' },
  },
  {
    id: REQUEST_B, business_id: BUSINESS, contact_id: CONTACT_A, reference: 'REF-002',
    title: 'Cocina', service: 'Cocina', status: 'Enviado', priority: 2,
    created_at: '2026-10-06T07:00:00Z', next_follow_up_at: '2026-10-06T09:00:00Z',
    automatic_follow_up_milestone_hours: 48, internal_summary: null, suggested_reply: null,
    contact: { id: CONTACT_A, business_id: BUSINESS, display_name: 'Ana', email: 'ana@example.test', phone: '600000001' },
  },
];

test('follow-up context reads only the authorized business and rejects crossed rows', async () => {
  const { service, calls } = await authorizedService([
    [(url) => url.pathname.endsWith('/follow_ups'), { body: [{ id: CONTACT_B, business_id: BUSINESS, request_id: REQUEST_A, due_at: '2026-10-07T09:00:00Z', status: 'pending', action_text: 'Llamar', cadence_hours: 24, channel: 'call', completed_at: null, created_at: '2026-10-06T09:00:00Z' }] }],
    [(url) => url.pathname.endsWith('/activities'), { body: [{ business_id: BUSINESS, request_id: REQUEST_A, type: 'request_follow_up_24h', actor_type: 'automation', reason_code: 'manual_follow_up_overdue', created_at: '2026-10-07T08:00:00Z' }] }],
  ]);
  const result = await service.listFollowUpContext(BUSINESS);
  assert.equal(result.followUps.length, 1);
  assert.equal(result.activities[0].reason_code, 'manual_follow_up_overdue');
  for (const { target } of calls.filter(({ target }) => /\/(follow_ups|activities)$/.test(target.pathname))) {
    assert.equal(target.searchParams.get('business_id'), `eq.${BUSINESS}`);
  }

  const crossed = await authorizedService([
    [(url) => url.pathname.endsWith('/follow_ups'), { body: [{ id: CONTACT_B, business_id: OTHER_BUSINESS, request_id: REQUEST_A, status: 'pending' }] }],
    [(url) => url.pathname.endsWith('/activities'), { body: [] }],
  ]);
  await assert.rejects(crossed.service.listFollowUpContext(BUSINESS), /READ_FAILED/);
});

test('milestones and reason codes use explicit safe labels', () => {
  assert.equal(milestoneLabel(0), 'Sin seguimiento automático');
  assert.equal(milestoneLabel(24), '24 h');
  assert.equal(milestoneLabel(48), '48 h');
  assert.equal(milestoneLabel(72), '72 h');
  assert.equal(milestoneLabel(99), 'Sin seguimiento automático');
  assert.equal(followUpReasonLabel('manual_follow_up_overdue'), 'Existe un seguimiento manual vencido.');
  assert.equal(followUpReasonLabel('high_priority_no_recent_activity'), 'Solicitud prioritaria sin actividad humana reciente.');
  assert.equal(followUpReasonLabel('no_recent_activity'), 'No hay actividad humana reciente.');
  assert.equal(followUpReasonLabel('private_unknown_code'), 'Seguimiento recomendado.');
});

test('communications use the authenticated RPC and expose only its four-field projection', async () => {
  const { service, calls } = await authorizedService([
    [(url) => url.pathname.endsWith('/rpc/get_request_communications'), { body: [{ email_type: 'customer_confirmation', status: 'sent', created_at: '2026-10-07T08:00:00Z', sent_at: '2026-10-07T08:01:00Z', payload: 'PRIVATE' }] }],
  ]);
  const rows = await service.getRequestCommunications(REQUEST_A);
  assert.deepEqual(rows, [{ email_type: 'customer_confirmation', status: 'sent', created_at: '2026-10-07T08:00:00Z', sent_at: '2026-10-07T08:01:00Z' }]);
  const rpc = calls.find(({ target }) => target.pathname.endsWith('/rpc/get_request_communications'));
  assert.equal(rpc.options.method, 'POST');
  assert.deepEqual(JSON.parse(rpc.options.body), { p_request_id: REQUEST_A });
  assert.equal(calls.some(({ target }) => target.pathname.includes('email_jobs')), false);
});

test('communications return an honest empty list for a request hidden by tenant authorization', async () => {
  const { service } = await authorizedService([
    [(url) => url.pathname.endsWith('/rpc/get_request_communications'), { body: [] }],
  ]);
  assert.deepEqual(await service.getRequestCommunications(REQUEST_B), []);
});

test('contacts deduplicate only by real contact id and keep identity-less requests separate', () => {
  const projected = projectContacts([
    ...requests,
    { ...requests[0], id: '88888888-8888-4888-8888-888888888888', contact_id: CONTACT_B, contact: { ...requests[0].contact, id: CONTACT_B } },
    { ...requests[0], id: '99999999-9999-4999-8999-999999999999', contact_id: null, contact: null },
  ]);
  assert.equal(projected.length, 3);
  assert.equal(projected.find(item => item.id === CONTACT_A).request_count, 2);
  assert.equal(projected.find(item => item.id === CONTACT_B).request_count, 1);
  assert.ok(projected.some(item => item.id === 'request:99999999-9999-4999-8999-999999999999'));
});

test('dashboard metrics are derived from the authorized datasets', () => {
  const metrics = calculateDashboardMetrics(requests, {
    followUps: [
      { business_id: BUSINESS, request_id: REQUEST_A, status: 'pending', due_at: '2026-10-07T09:00:00Z' },
      { business_id: BUSINESS, request_id: REQUEST_B, status: 'completed', due_at: '2026-10-06T09:00:00Z' },
    ],
    activities: [],
  }, new Date('2026-10-07T12:00:00Z'));
  assert.deepEqual(metrics, { new_requests: 1, active_requests: 2, high_priority: 1, follow_ups_due: 1 });
});

test('real follow-up, contact and dashboard renders contain no simulated actions or raw reason codes', () => {
  const context = {
    followUps: [{ business_id: BUSINESS, request_id: REQUEST_A, status: 'pending', due_at: '2026-10-07T09:00:00Z', action_text: 'Llamar al cliente' }],
    activities: [{ business_id: BUSINESS, request_id: REQUEST_A, type: 'request_follow_up_24h', reason_code: 'manual_follow_up_overdue', created_at: '2026-10-07T08:00:00Z' }],
  };
  const followHtml = renderFollowUpRows(requests, context);
  const contactHtml = renderContactRows(projectContacts(requests));
  const dashboardHtml = renderDashboard(calculateDashboardMetrics(requests, context, new Date('2026-10-07T12:00:00Z')));
  assert.match(followHtml, /REF-001/);
  assert.match(followHtml, /Existe un seguimiento manual vencido/);
  assert.match(contactHtml, /Ana/);
  assert.match(contactHtml, /2 solicitudes/);
  assert.match(dashboardHtml, /Solicitudes nuevas/);
  assert.doesNotMatch(followHtml + contactHtml + dashboardHtml, /manual_follow_up_overdue|mark-follow-up-contacted|Copiar WhatsApp|Marta López/);
});

test('real detail displays the safe communications projection without delivery internals', () => {
  const html = renderFullDetail({
    request: requests[0], contact: requests[0].contact, form: null, answers: [], activities: [], notes: [], attachments: [], zone: null,
    communications: [{ email_type: 'business_notification', status: 'processing', created_at: '2026-10-07T08:00:00Z', sent_at: null, delivery_id: 'PRIVATE' }],
  });
  assert.match(html, /Comunicaciones/);
  assert.match(html, /Aviso al negocio/);
  assert.match(html, /Enviando/);
  assert.doesNotMatch(html, /delivery_id|PRIVATE|payload|claim|lease|retry/i);
});

test('local navigation remains explicitly local and real code contains no privileged key', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'js/data/product-data.js'), 'utf8');
  assert.match(html, /class="sector-change-link" href="\?mode=local"/);
  assert.doesNotMatch(data, /service_role|sb_secret_|email_jobs/);
});

test('changing the authorized active business refreshes requests and follow-up context together', async () => {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      value: key === '#status-filter' || key === '#service-filter' ? 'Todos' : '', hidden: false,
      innerHTML: '', textContent: '', dataset: {}, handlers: {},
      classList: { toggle() {} }, setAttribute() {}, removeAttribute() {}, replaceChildren() { this.innerHTML = ''; },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      querySelector: sub => node(`${key} ${sub}`),
    });
    return nodes.get(key);
  };
  node('#real-email').value = 'owner@example.test';
  node('#real-password').value = 'password';
  const views = ['dashboard', 'solicitudes', 'seguimientos', 'clientes', 'detalle-solicitud', 'real-pending']
    .map(name => ({ dataset: { view: name }, hidden: true, classList: { toggle() {} } }));
  const requestCalls = [];
  const followUpCalls = [];
  const service = {
    session: async () => null, signIn: async () => ({ id: USER }), signOut() {},
    listBusinesses: async () => [{ id: BUSINESS, name: 'Negocio A' }, { id: OTHER_BUSINESS, name: 'Negocio B' }],
    listRequests: async id => {
      requestCalls.push(id);
      return [{ ...requests[0], id: id === BUSINESS ? REQUEST_A : REQUEST_B, business_id: id, reference: id === BUSINESS ? 'A-001' : 'B-001' }];
    },
    listFollowUpContext: async id => {
      followUpCalls.push(id);
      return { followUps: [], activities: [] };
    },
  };
  const context = vm.createContext({
    document: {
      querySelector: node,
      querySelectorAll: selector => selector === '[data-view]' ? views : [],
    },
    location: { search: '' }, URLSearchParams, Intl,
    localStorage: { getItem: () => BUSINESS, setItem() {}, removeItem() {} },
    ProductData: { createDataService: () => service },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8'), context);
  await node('#real-sign-in').handlers.submit({ preventDefault() {} });
  node('#real-business-selector').value = OTHER_BUSINESS;
  await node('#real-business-selector').handlers.change();
  assert.deepEqual(requestCalls, [BUSINESS, OTHER_BUSINESS]);
  assert.deepEqual(followUpCalls, [BUSINESS, OTHER_BUSINESS]);
  context.RealProductDemo.navigate('dashboard');
  assert.match(node('#dashboard-metrics').innerHTML, /Solicitudes nuevas/);
  assert.doesNotMatch(node('#dashboard-metrics').innerHTML, /A-001|Marta López/);
});
