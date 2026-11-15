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
      querySelector() { return node('button'); }, querySelectorAll() { return []; }, closest() { return null; },
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: { querySelector: node }, fetch, URL, URLSearchParams, atob,
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
const userId = '33333333-3333-4333-8333-333333333333';

test('C10C derives the authenticated user id from the signed access token subject', () => {
  const payload = Buffer.from(JSON.stringify({ sub: userId })).toString('base64url');
  const p = panel();
  assert.equal(p.run(`accessTokenSubject('header.${payload}.signature')`), userId);
  assert.equal(p.run("accessTokenSubject('not-a-jwt')"), null);
});

test('C10C creates an internal note only through a server-confirmed activity insert', async () => {
  let captured;
  const confirmed = {
    id: '44444444-4444-4444-8444-444444444444',
    business_id: request.business_id, request_id: request.id,
    actor_type: 'user', actor_user_id: userId, type: 'internal_note', title: 'Nota interna',
    detail: 'Cliente prefiere llamada por la tarde.', created_at: '2026-09-09T10:00:00.000Z',
  };
  const p = panel(async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => [confirmed] };
  });
  p.run(`state.accessToken = 'test-session'; state.userId = '${userId}'; var current = ${JSON.stringify(request)};`);

  const result = JSON.parse(await p.run("addInternalNote(current, '  Cliente prefiere llamada por la tarde.  ').then(JSON.stringify)"));

  assert.equal(result.id, confirmed.id);
  assert.equal(captured.options.method, 'POST');
  assert.ok(captured.url.includes('/rest/v1/activities?'));
  assert.equal(captured.options.headers.Prefer, 'return=representation');
  const note = JSON.parse(captured.options.body);
  assert.deepEqual(note, {
    business_id: request.business_id,
    request_id: request.id,
    actor_type: 'user',
    actor_user_id: userId,
    type: 'internal_note',
    title: 'Nota interna',
    detail: 'Cliente prefiere llamada por la tarde.',
  });
});

test('C10C keeps notes out of the generic activity block and renders them as internal history', () => {
  const note = {
    id: '44444444-4444-4444-8444-444444444444', business_id: request.business_id, request_id: request.id,
    actor_user_id: userId, detail: 'Pendiente confirmar medidas.', created_at: '2026-09-09T10:00:00.000Z',
  };
  const p = panel();
  p.run(`state.userId = '${userId}'; state.userEmail = 'owner.reformas.dev@solicitudpro.test'; renderDetail({ request: ${JSON.stringify(request)}, contact: null, business: null, sector: null, form: null, fields: [], answers: [], followUps: [], activities: [], notes: [${JSON.stringify(note)}], attachments: [] })`);
  const html = p.nodes.get('#detail-content').innerHTML;
  assert.match(html, /Notas internas/);
  assert.match(html, /Solo visible para tu equipo\./);
  assert.match(html, /Pendiente confirmar medidas\./);
  assert.match(html, /owner\.reformas\.dev@solicitudpro\.test/);
  assert.match(html, /class="internal-note"/);
});

test('C10C integrates the confirmed note into an already open detail even when it started without note history', async () => {
  const confirmed = {
    id: '44444444-4444-4444-8444-444444444444',
    business_id: request.business_id, request_id: request.id,
    actor_type: 'user', actor_user_id: userId, type: 'internal_note', title: 'Nota interna',
    detail: 'Presupuesto enviado por WhatsApp.', created_at: '2026-09-09T10:00:00.000Z',
  };
  const p = panel(async () => ({ ok: true, json: async () => [confirmed] }));
  p.run(`state.accessToken = 'test-session'; state.userId = '${userId}'; state.userEmail = 'owner.reformas.dev@solicitudpro.test'; renderDetail({ request: ${JSON.stringify(request)}, contact: null, business: null, sector: null, form: null, fields: [], answers: [], followUps: [], activities: [], attachments: [] }); var noteForm = { querySelector(selector) { if (selector === 'fieldset') return { disabled: false }; if (selector === '[name=note]') return { value: 'Presupuesto enviado por WhatsApp.' }; return null; } };`);

  const result = JSON.parse(await p.run('saveInternalNote(noteForm).then(() => JSON.stringify({ notes: state.detail.notes, message: elements.message.textContent }))'));
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].detail, 'Presupuesto enviado por WhatsApp.');
  assert.match(result.message, /guardada en Supabase dev/i);
});

test('C10C rejects an empty note before making a network request', async () => {
  const p = panel();
  p.run(`state.accessToken = 'test-session'; state.userId = '${userId}'; var current = ${JSON.stringify(request)};`);
  await assert.rejects(p.run("addInternalNote(current, '   ')"), /NOTE_NOT_ALLOWED/);
});
