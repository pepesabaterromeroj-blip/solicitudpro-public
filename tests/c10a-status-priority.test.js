const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual panel; replace only browser elements and the external network.
function panel(fetch = async () => { throw new Error('Unexpected network'); }) {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', innerHTML: '', textContent: '', hidden: false,
      classList: { toggle() {} }, listeners: {}, addEventListener(t, fn) { this.listeners[t] = fn; },
      removeAttribute() {}, querySelector() { return node('button'); } });
    return nodes.get(id);
  };
  const context = vm.createContext({ document: { querySelector: node }, fetch, URL, URLSearchParams,
    window: { location: { href: 'http://localhost/panel', search: '' }, history: { replaceState() {} } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.js'), 'utf8'), context);
  return { nodes, run: (code) => vm.runInContext(code, context) };
}
const request = { id: '11111111-1111-4111-8111-111111111111', business_id: '22222222-2222-4222-8222-222222222222', status: 'Nuevo', priority: null, won_at: null, lost_at: null };

test('C10A validates values and maintains closure dates without editing unrelated fields', () => {
  const p = panel();
  p.run(`var original = ${JSON.stringify(request)}`);
  const patch = JSON.parse(p.run("JSON.stringify(buildRequestPatch(original, 'Ganado', '1'))"));
  assert.equal(patch.status, 'Ganado');
  assert.equal(patch.priority, 1);
  assert.ok(Number.isFinite(Date.parse(patch.won_at)));
  assert.equal(patch.lost_at, null);
  assert.deepEqual(Object.keys(patch).sort(), ['lost_at', 'priority', 'status', 'won_at']);
  assert.throws(() => p.run("buildRequestPatch(original, 'Archivado', '1')"));
  for (const value of ['0', '4', '1x', '', 'undefined']) assert.throws(() => p.run(`buildRequestPatch(original, 'Nuevo', '${value}')`));
  assert.equal(p.run("buildRequestPatch(original, 'Nuevo', 'none').priority"), null);
  assert.deepEqual(JSON.parse(p.run("JSON.stringify(buildRequestPatch({...original, status:'Ganado', won_at:'2026-09-01T00:00:00Z'}, 'Nuevo', '2'))")), {status:'Nuevo',priority:2,won_at:null,lost_at:null});
});

test('C10A sends only a scoped PATCH and requires one confirmed matching row', async () => {
  let captured;
  let rows = [{...request, priority: 1}];
  const p = panel(async (url, options) => { captured = {url, options}; return {ok:true,json:async()=>rows}; });
  p.run(`var original = ${JSON.stringify(request)}`);
  await assert.rejects(p.run("updateRequest(original, 'Nuevo', '1')"));
  assert.equal(captured, undefined);
  p.run("state.accessToken = 'test-session';");
  await p.run("updateRequest(original, 'Nuevo', '1')");
  assert.equal(captured.options.method, 'PATCH');
  assert.ok(captured.url.includes('id=eq.' + request.id));
  assert.ok(captured.url.includes('business_id=eq.' + request.business_id));
  assert.equal(captured.options.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(captured.options.body), {status:'Nuevo', priority:1});
  rows = [];
  await assert.rejects(p.run("updateRequest(original, 'Nuevo', '1')"));
  rows = [{...request, business_id:'another-business', priority:1}];
  await assert.rejects(p.run("updateRequest(original, 'Nuevo', '1')"));
});

test('C10A discards a delayed write response after logout', async () => {
  let resolve;
  const p = panel(() => new Promise(r => { resolve = r; }));
  p.run(`var original = ${JSON.stringify(request)}; state.accessToken = 'test-session';`);
  const pending = p.run("updateRequest(original, 'Nuevo', '1')");
  p.nodes.get('#sign-out').listeners.click();
  resolve({ok:true,json:async()=>[{...request,priority:1}]});
  await assert.rejects(pending);
  assert.equal(p.run('state.accessToken'), null);
  assert.equal(p.run('state.requests.length'), 0);
});

function prepareEditor(p) {
  p.run(`state.accessToken = 'test-session'; state.requests = [${JSON.stringify(request)}];
    state.detail = {request: state.requests[0], fields:[], answers:[], followUps:[], activities:[], attachments:[]};
    var editor = {querySelector(selector) { return selector === '[name=status]' ? {value:'Enviado'} : selector === '[name=priority]' ? {value:'1'} : {}; }};`);
}

test('C10A renders only confirmed changes and recalculates filters and metrics', async () => {
  let resolve;
  const p = panel(() => new Promise(r => { resolve = r; }));
  prepareEditor(p);
  const pending = p.run('saveRequestChanges(editor)');
  assert.equal(p.run('state.requests[0].status'), 'Nuevo');
  assert.equal(p.run('state.detail.request.priority'), null);
  resolve({ok:true,json:async()=>[{...request,status:'Enviado',priority:1}]});
  await pending;
  assert.equal(p.run('state.detail.request.status'), 'Enviado');
  assert.match(p.nodes.get('#request-list').innerHTML, /Enviado/);
  assert.equal(p.nodes.get('#metric-new').textContent, '0');
  assert.equal(p.nodes.get('#metric-high').textContent, '1');
  p.nodes.get('#status-filter').value = 'Nuevo';
  p.run('renderRequests()');
  assert.equal(p.nodes.get('#metric-visible').textContent, '0');
  p.run('resetFilters()');
  assert.equal(p.nodes.get('#metric-visible').textContent, '1');
});

test('C10A write errors preserve confirmed values and never expose server details', async () => {
  const p = panel(async () => ({ok:false,json:async()=>({message:'private server details'})}));
  prepareEditor(p);
  await p.run('saveRequestChanges(editor)');
  assert.equal(p.run('state.requests[0].status'), 'Nuevo');
  assert.equal(p.run('state.detail.request.priority'), null);
  assert.match(p.nodes.get('#message').textContent, /No se pudo confirmar/);
  assert.doesNotMatch(p.nodes.get('#message').textContent, /private server details/);
  assert.equal(p.run('state.saving'), false);
});

test('C10A prevents overlapping refresh and write operations', async () => {
  let calls = 0;
  const p = panel(async () => { calls++; return {ok:true,json:async()=>[]}; });
  prepareEditor(p);
  p.run('state.loading = true');
  await p.run('saveRequestChanges(editor)');
  assert.equal(calls, 0);
});
