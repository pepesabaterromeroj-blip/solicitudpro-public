const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const { createDataService } = require(path.join(root, 'js/data/product-data.js'));
const { chooseBusiness, renderRequestRows, renderBasicDetail } = require(path.join(root, 'js/real-product.js'));
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const USER = '44444444-4444-4444-8444-444444444444';
const REQUEST = '55555555-5555-4555-8555-555555555555';

function fixture(routes) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = new URL(url);
    calls.push({ target, options });
    const route = routes.find(([match]) => match(target, options));
    if (!route) throw new Error('Unexpected request: ' + target.pathname);
    const value = typeof route[1] === 'function' ? route[1](target, options) : route[1];
    return { ok: value.ok !== false, status: value.status || 200, json: async () => value.body ?? value };
  };
  return { service: createDataService({ fetchImpl }), calls };
}

const jwt = (sub = USER) => `header.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.signature`;
const authRoutes = [
  [(url) => url.pathname === '/auth/v1/token', { body: { access_token: jwt(), expires_in: 3600 } }],
  [(url) => url.pathname === '/auth/v1/user', { body: { id: USER, email: 'owner@example.com' } }],
];

test('real session is verified with Auth and kept in memory', async () => {
  const { service, calls } = fixture(authRoutes);
  assert.equal(await service.session(), null);
  assert.equal(calls.length, 0);
  const user = await service.signIn('owner@example.com', 'test-password');
  assert.equal(user.id, USER);
  assert.equal((await service.session()).id, USER);
  assert.ok(calls.some(({ target }) => target.pathname === '/auth/v1/user'));
  service.signOut();
  assert.equal(await service.session(), null);
});

test('no session cannot query businesses or requests', async () => {
  const { service, calls } = fixture([]);
  await assert.rejects(service.listBusinesses(), /SESSION_REQUIRED/);
  await assert.rejects(service.listRequests(A), /SESSION_REQUIRED/);
  assert.equal(calls.length, 0);
});

test('one active membership selects its real business; stored preference is validated', async () => {
  const { service } = fixture([...authRoutes,
    [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: A, user_id: USER, is_active: true }, { business_id: OTHER, user_id: USER, is_active: false }]}],
    [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: A, name: 'Negocio A' }] }],
  ]);
  await service.signIn('owner@example.com', 'test-password');
  const businesses = await service.listBusinesses();
  assert.deepEqual(businesses.map(item => item.id), [A]);
  assert.equal(chooseBusiness(businesses, null)?.id, A);
  assert.equal(chooseBusiness(businesses, OTHER)?.id, A);
  assert.equal(chooseBusiness([{ id: A }, { id: B }], B)?.id, B);
  assert.equal(chooseBusiness([], OTHER), null);
});

test('requests and contacts are limited to the selected, authorized business', async () => {
  const { service, calls } = fixture([...authRoutes,
    [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: A, user_id: USER, is_active: true }]}],
    [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: A, name: 'Negocio A' }] }],
    [(url) => url.pathname.endsWith('/requests'), { body: [{ id: REQUEST, business_id: A, contact_id: B, reference: 'SOL-REAL', service: 'Reformas', status: 'Nuevo', priority: 1, created_at: '2026-09-30T10:00:00Z' }] }],
    [(url) => url.pathname.endsWith('/contacts'), { body: [{ id: B, business_id: A, display_name: 'Cliente real', email: 'real@example.com' }] }],
  ]);
  await service.signIn('owner@example.com', 'test-password');
  await service.listBusinesses();
  await assert.rejects(service.listRequests(OTHER), /BUSINESS_NOT_AUTHORIZED/);
  const rows = await service.listRequests(A);
  assert.equal(rows[0].reference, 'SOL-REAL');
  assert.equal(rows[0].contact.display_name, 'Cliente real');
  assert.equal(rows.length, 1);
  for (const call of calls.filter(({ target }) => /\/rest\/v1\/(requests|contacts)$/.test(target.pathname))) {
    assert.equal(call.target.searchParams.get('business_id'), `eq.${A}`);
    assert.equal(call.options.headers.Authorization, `Bearer ${jwt()}`);
  }
});

test('failed real read fails closed without local mock fallback', async () => {
  const { service } = fixture([...authRoutes,
    [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: A, user_id: USER, is_active: true }]}],
    [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: A, name: 'Negocio A' }] }],
    [(url) => url.pathname.endsWith('/requests'), { ok: false, status: 500, body: { message: 'PRIVATE SQL DETAIL' } }],
  ]);
  await service.signIn('owner@example.com', 'test-password');
  await service.listBusinesses();
  await assert.rejects(service.listRequests(A), /READ_FAILED/);
});

test('expired Auth response clears session and cannot reuse prior business access', async () => {
  const { service } = fixture([...authRoutes,
    [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: A, user_id: USER, is_active: true }]}],
    [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: A, name: 'Negocio A' }] }],
    [(url) => url.pathname.endsWith('/requests'), { ok: false, status: 401, body: {} }],
  ]);
  await service.signIn('owner@example.com', 'test-password');
  await service.listBusinesses();
  await assert.rejects(service.listRequests(A), /SESSION_EXPIRED/);
  assert.equal(await service.session(), null);
  await assert.rejects(service.listRequests(A), /SESSION_REQUIRED/);
});

test('unexpected cross-business rows are rejected even after an authorized selection', async () => {
  const { service } = fixture([...authRoutes,
    [(url) => url.pathname.endsWith('/business_users'), { body: [{ business_id: A, user_id: USER, is_active: true }]}],
    [(url) => url.pathname.endsWith('/businesses'), { body: [{ id: A, name: 'Negocio A' }] }],
    [(url) => url.pathname.endsWith('/requests'), { body: [{ id: REQUEST, business_id: OTHER, reference: 'FOREIGN' }] }],
  ]);
  await service.signIn('owner@example.com', 'test-password');
  await service.listBusinesses();
  await assert.rejects(service.listRequests(A), /READ_FAILED/);
});

test('real list and basic detail render only supplied fields, without simulated actions', () => {
  const row = { id: REQUEST, reference: 'SOL-REAL', service: 'Reformas', status: 'Nuevo', priority: 1, created_at: '2026-09-30T10:00:00Z', contact: { display_name: '<Cliente>', email: 'real@example.com' } };
  const list = renderRequestRows([row]);
  const detail = renderBasicDetail(row);
  assert.match(list, /SOL-REAL/);
  assert.match(list, /&lt;Cliente&gt;/);
  assert.match(detail, /SOL-REAL/);
  assert.doesNotMatch(list + detail, /change-status|mark-follow-up-contacted|save-request-edit|suggestedResponse|Marta López|Guardado/);
});

test('real mode gates local state and has no frontend service role', () => {
  const script = fs.readFileSync(path.join(root, 'js/script.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(root, 'js/data/product-data.js'), 'utf8');
  assert.match(script, /isRealProductMode \? \[\] : loadRequests\(\)/);
  assert.match(script, /if \(isRealProductMode\) return;/);
  assert.match(script, /get\("submit"\) !== "supabase-dev"/);
  assert.match(html, /js\/data\/product-data\.js/);
  assert.match(html, /js\/real-product\.js/);
  assert.doesNotMatch(data, /service_role|sb_secret_/);
});

test('local demo sector links preserve the explicit local mode', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const links = [...html.matchAll(/href="([^"]*sector=[^"]*)">Probar demo<\/a>/g)]
    .map(match => match[1]);
  assert.equal(links.length, 6);
  for (const href of links) assert.match(href, /(?:\?|&)mode=local(?:&|$)/);
});

test('product controller renders authorized rows and complete read-only detail after sign-in', async () => {
  const nodes = new Map();
  const node = key => {
    if (!nodes.has(key)) nodes.set(key, {
      value: key === '#status-filter' || key === '#service-filter' ? 'Todos' : '',
      hidden: false, innerHTML: '', textContent: '', dataset: {}, handlers: {},
      classList: { toggle() {} },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      setAttribute() {}, removeAttribute() {},
      replaceChildren() { this.innerHTML = ''; },
      querySelector: sub => node(key + ' ' + sub),
    });
    return nodes.get(key);
  };
  node('#real-email').value = 'owner@example.com';
  node('#real-password').value = 'password';
  const views = ['solicitudes', 'detalle-solicitud', 'real-pending'].map(name => ({ dataset: { view: name }, hidden: true, classList: { toggle() {} } }));
  const service = {
    session: async () => null, signIn: async () => ({ id: USER }), signOut() {},
    listBusinesses: async () => [{ id: A, name: 'Negocio A' }],
    listRequests: async id => {
      assert.equal(id, A);
      return [{ id: REQUEST, business_id: A, reference: 'REF-REAL', service: 'Baño', status: 'Nuevo', priority: null, created_at: '2026-09-30T10:00:00Z', contact: { display_name: 'Cliente DEV' } }];
    },
    listFollowUpContext: async id => {
      assert.equal(id, A);
      return { followUps: [], activities: [] };
    },
    getRequestDetail: async (businessId, requestId) => {
      assert.equal(businessId, A);
      assert.equal(requestId, REQUEST);
      return {
        request: { id: REQUEST, business_id: A, reference: 'REF-REAL', title: 'Baño', service: 'Baño', description: 'Necesidad real', status: 'Nuevo', priority: null, created_at: '2026-09-30T10:00:00Z', enrichment_status: 'legacy', internal_summary: 'Resumen real', suggested_reply: 'Borrador real' },
        contact: { display_name: 'Cliente DEV', email: 'cliente@example.test', phone: '' },
        form: { name: 'Solicitud' }, answers: [], activities: [], notes: [], attachments: [], zone: null,
      };
    },
  };
  const context = vm.createContext({
    document: { querySelector: node, querySelectorAll: selector => selector === '[data-view]' ? views : [] },
    location: { search: '' }, URLSearchParams, Intl,
    localStorage: { getItem: () => OTHER, setItem() {}, removeItem() {} },
    ProductData: { createDataService: () => service },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8'), context);
  await node('#real-sign-in').handlers.submit({ preventDefault() {} });
  assert.equal(node('.app-shell').hidden, false);
  assert.match(node('#requests-list').innerHTML, /REF-REAL/);
  assert.doesNotMatch(node('#requests-list').innerHTML, /Marta López|change-status|mark-follow-up-contacted/);
  await context.RealProductDemo.openDetail(REQUEST);
  assert.match(node('#request-detail-view-content').innerHTML, /REF-REAL/);
  assert.match(node('#request-detail-view-content').innerHTML, /Resumen real/);
  assert.match(node('#request-detail-view-content').innerHTML, /Borrador real/);
  assert.doesNotMatch(node('#request-detail-view-content').innerHTML, /suggestedResponse|save-request-edit/);
  node('#request-detail-view-content').handlers.click({ target: { closest: selector => selector === '[data-real-back]' } });
  assert.equal(views.find(view => view.dataset.view === 'solicitudes').hidden, false);
  assert.equal(views.find(view => view.dataset.view === 'detalle-solicitud').hidden, true);
});
