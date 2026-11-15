const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function panel(fetch = async () => { throw new Error('Unexpected network'); }) {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', innerHTML: '', textContent: '', hidden: false, disabled: false,
      classList: { toggle() {} }, listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; },
      querySelector() { return node('button'); }, closest() { return null; },
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: node }, fetch, URL, URLSearchParams,
    window: { location: { href: 'http://localhost/panel', search: '' }, history: { replaceState() {} }, confirm: () => true },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.js'), 'utf8'), context);
  return { nodes, run: (code) => vm.runInContext(code, context) };
}

const request = {
  id: '11111111-1111-4111-8111-111111111111',
  business_id: '22222222-2222-4222-8222-222222222222',
  status: 'Nuevo', priority: null, archived_at: null,
};
const followUp = {
  id: '33333333-3333-4333-8333-333333333333',
  request_id: request.id, business_id: request.business_id, status: 'pending', completed_at: null,
};

test('C10B completes only a pending follow-up with a confirmed scoped PATCH', async () => {
  let captured;
  const confirmed = { ...followUp, status: 'completed', completed_at: '2026-09-09T10:00:00.000Z' };
  const p = panel(async (url, options) => { captured = { url, options }; return { ok: true, json: async () => [confirmed] }; });
  p.run(`state.accessToken = 'test-session'; var follow = ${JSON.stringify(followUp)};`);
  const result = JSON.parse(await p.run('completeFollowUp(follow).then(JSON.stringify)'));
  assert.equal(result.status, 'completed');
  assert.equal(captured.options.method, 'PATCH');
  assert.ok(captured.url.includes(`id=eq.${followUp.id}`));
  assert.ok(captured.url.includes(`business_id=eq.${request.business_id}`));
  const patch = JSON.parse(captured.options.body);
  assert.equal(patch.status, 'completed');
  assert.match(patch.completed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(captured.options.headers.Prefer, 'return=representation');
  await assert.rejects(p.run(`completeFollowUp({...follow, status: 'cancelled'})`));
});

test('C10B archives through a confirmed request PATCH and never uses DELETE', async () => {
  let captured;
  const confirmed = { ...request, archived_at: '2026-09-09T10:00:00.000Z' };
  const p = panel(async (url, options) => { captured = { url, options }; return { ok: true, json: async () => [confirmed] }; });
  p.run(`state.accessToken = 'test-session'; var current = ${JSON.stringify(request)};`);
  const result = JSON.parse(await p.run('archiveRequest(current).then(JSON.stringify)'));
  assert.equal(result.archived_at, confirmed.archived_at);
  assert.equal(captured.options.method, 'PATCH');
  assert.ok(captured.url.includes(`id=eq.${request.id}`));
  assert.ok(captured.url.includes(`business_id=eq.${request.business_id}`));
  assert.match(JSON.parse(captured.options.body).archived_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.notEqual(captured.options.method, 'DELETE');
});

test('C10B keeps active, archived and all request views coherent with metrics', () => {
  const p = panel();
  p.run(`state.requests = [
    ${JSON.stringify(request)},
    ${JSON.stringify({ ...request, id: '44444444-4444-4444-8444-444444444444', archived_at: '2026-09-01T12:00:00.000Z' })}
  ];`);
  p.nodes.get('#archive-filter').value = 'active';
  assert.equal(p.run('filteredViews().length'), 1);
  p.nodes.get('#archive-filter').value = 'archived';
  assert.equal(p.run('filteredViews().length'), 1);
  p.nodes.get('#archive-filter').value = 'all';
  assert.equal(p.run('filteredViews().length'), 2);
});

test('C10B renders the server-confirmed completion time separately from the due time', () => {
  const p = panel();
  p.run(`renderDetail({
    request: ${JSON.stringify(request)}, contact: null, business: null, sector: null, form: null,
    fields: [], answers: [], activities: [], attachments: [],
    followUps: [{...${JSON.stringify(followUp)}, status: 'completed', due_at: '2026-09-01T08:00:00.000Z', completed_at: '2026-09-09T10:30:00.000Z'}]
  })`);
  const detailHtml = p.nodes.get('#detail-content').innerHTML;
  assert.match(detailHtml, /Fecha prevista:/);
  assert.match(detailHtml, /Completado el:/);
  assert.match(detailHtml, /12:30/);
});

test('C10B gives archived requests an amber visual tag', () => {
  const css = fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.css'), 'utf8');
  assert.match(css, /\.tag\.archived\s*\{[^}]*border-color:\s*#ead298;[^}]*background:\s*var\(--warning-soft\);[^}]*color:\s*var\(--warning\)/);
});
