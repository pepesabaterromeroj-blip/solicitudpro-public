const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function panel(fetch = async () => { throw new Error('Unexpected network'); }) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      innerHTML: '', textContent: '', value: '', hidden: false, open: false,
      classList: { toggle() {} }, addEventListener() {}, removeAttribute() {},
      querySelector: node, querySelectorAll: () => [],
    });
    return nodes.get(id);
  };
  const context = vm.createContext({ document: { querySelector: node }, fetch, URL, URLSearchParams, atob,
    window: { location: { href: 'http://localhost/panel', search: '' }, history: { replaceState() {} } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.js'), 'utf8'), context);
  return { nodes, run: code => vm.runInContext(code, context) };
}
const request = { id: '11111111-1111-4111-8111-111111111111', business_id: '22222222-2222-4222-8222-222222222222' };

test('C18B detail reads C14/C15 without requesting enrichment claims or retry internals', async () => {
  const queries = [];
  const p = panel(async url => { queries.push(new URL(url)); return { ok: true, json: async () => [] }; });
  p.run("state.accessToken = 'session'");
  await p.run(`loadRequestDetail('${request.id}', false)`);
  const fields = queries[0].searchParams.get('select').split(',');
  for (const field of ['enrichment_status', 'enriched_at', 'suggested_reply', 'internal_summary', 'automatic_follow_up_milestone_hours']) assert.ok(fields.includes(field), field);
  assert.ok(!fields.some(field => /claim|attempt|lease|retry/.test(field)));
});

test('C18B translates every enrichment state and escapes the unsent draft', () => {
  const p = panel();
  for (const [status, label] of Object.entries({ pending: 'Pendiente', processing: 'Generando', completed: 'Generado', failed: 'No disponible', legacy: 'Solicitud anterior' })) {
    assert.ok(p.run(`enrichmentMarkup({enrichment_status:'${status}'})`).includes(label));
  }
  const html = p.run(`enrichmentMarkup({enrichment_status:'completed',internal_summary:'Resumen',suggested_reply:'<script>draft</script>',enriched_at:'2026-09-30T10:00:00Z'})`);
  assert.match(html, /Borrador/); assert.match(html, /no enviada/); assert.match(html, /revis/);
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>|<button|<textarea/);
});

test('C18B follow-up milestones and reason allowlist never render unknown codes or metadata', () => {
  const p = panel();
  for (const [hours, text] of [[0, 'Sin seguimiento automático'], [24, '24 h'], [48, '48 h'], [72, '72 h']]) assert.equal(p.run(`milestoneLabel(${hours})`), text);
  for (const [reason, expected] of [['manual_follow_up_overdue', 'Existe un seguimiento manual vencido.'], ['high_priority_no_recent_activity', 'Solicitud prioritaria sin actividad humana reciente.'], ['no_recent_activity', 'No hay actividad humana reciente.']]) {
    const html = p.run(`activityMarkup({actor_type:'automation',type:'request_follow_up_24h',reason_code:'${reason}'})`);
    assert.match(html, /Automatización/); assert.doesNotMatch(html, new RegExp(reason + '|PRIVATE'));
    assert.ok(html.includes(expected));
  }
  const fallback = p.run(`activityMarkup({actor_type:'automation',type:'request_follow_up_48h',title:'RAW_CODE',detail:'PRIVATE',reason_code:'RAW_CODE'})`);
  assert.match(fallback, /Seguimiento recomendado\./); assert.doesNotMatch(fallback, /RAW_CODE|PRIVATE/);
  const human = p.run(`activityMarkup({actor_type:'user',type:'internal_note',title:'Nota interna',detail:'<b>Nota</b>'})`);
  assert.match(human, /Acción humana/); assert.match(human, /&lt;b&gt;/);
  assert.match(p.run(`activityMarkup({actor_type:'automation',type:'request_enrichment_generated'})`), /Resumen y respuesta sugerida/);
});

test('C18B communications use only the scoped RPC and retain only the four safe columns', async () => {
  let called = 0;
  const p = panel(async (url, options) => {
    called++;
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/get_request_communications');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { p_request_id: request.id });
    assert.equal(options.headers.Authorization, 'Bearer session');
    return { ok: true, json: async () => [{ email_type: 'customer_confirmation', status: 'sent', created_at: '2026-09-30T10:00:00Z', sent_at: '2026-09-30T10:01:00Z', claim_token: 'PRIVATE', last_error: 'PRIVATE' }] };
  });
  p.run(`state.accessToken='session'; state.detailVersion=1; state.detail={request:${JSON.stringify(request)}}`);
  await p.run('loadRequestCommunications(state.detail.request, 1)');
  assert.equal(called, 1);
  const rows = JSON.parse(p.run('JSON.stringify(state.detail.communications)'));
  assert.deepEqual(Object.keys(rows[0]).sort(), ['created_at', 'email_type', 'sent_at', 'status']);
  const html = p.nodes.get('#communication-content').innerHTML;
  assert.match(html, /Confirmación al cliente|Enviado/); assert.doesNotMatch(html, /PRIVATE/);
  await assert.rejects(p.run("getRows('email_jobs')"), /READ_ONLY_GUARD/);
});

test('C18B empty, loading and failed communication reads are isolated and safe', async () => {
  const p = panel(async () => ({ ok: false, json: async () => ({ error: 'PRIVATE' }) }));
  assert.match(p.run("communicationsMarkup({communicationsStatus:'loading'})"), /Cargando/);
  assert.match(p.run("communicationsMarkup({communications:[]})"), /No hay comunicaciones/);
  p.run(`state.accessToken='session'; state.detailVersion=1; state.detail={request:${JSON.stringify(request)}}`);
  await p.run('loadRequestCommunications(state.detail.request, 1)');
  assert.equal(p.run('state.detail.communicationsStatus'), 'error');
  assert.match(p.nodes.get('#communication-content').innerHTML, /No se pudieron cargar/);
  assert.doesNotMatch(p.nodes.get('#communication-content').innerHTML, /PRIVATE|Supabase/);
});

test('C18B late communication response cannot repopulate a closed detail or a signed-out session', async () => {
  let resolve;
  const p = panel(() => new Promise(done => { resolve = done; }));
  p.run(`state.accessToken='session'; state.detailVersion=1; state.detail={request:${JSON.stringify(request)}}`);
  const pending = p.run('loadRequestCommunications(state.detail.request, 1)');
  p.run('state.accessToken=null; closeDetail(false)');
  resolve({ ok: true, json: async () => [] });
  await pending;
  assert.equal(p.run('state.detail'), null);
  assert.equal(p.nodes.get('#detail-content').innerHTML, '');
});

test('C18B loads the complete detail and renders the integrated reads without changing C10 actions', async () => {
  const seen = [];
  const p = panel(async (url, options) => {
    const parsed = new URL(url);
    seen.push(parsed);
    const table = parsed.pathname.split('/').pop();
    let data = [];
    if (table === 'requests') data = [{ ...request, status: 'Nuevo', enrichment_status: 'completed', internal_summary: 'Resumen ficticio', suggested_reply: 'Borrador ficticio', automatic_follow_up_milestone_hours: 24 }];
    if (table === 'activities' && parsed.searchParams.get('type') === 'neq.internal_note') data = [{ actor_type: 'automation', type: 'request_follow_up_24h', reason_code: 'manual_follow_up_overdue' }];
    if (table === 'get_request_communications') {
      assert.equal(options.method, 'POST');
      data = [{ email_type: 'business_notification', status: 'sent', created_at: null, sent_at: null }];
    }
    return { ok: true, json: async () => data };
  });
  p.run("state.accessToken='session'");
  await p.run(`loadRequestDetail('${request.id}', false)`);
  const html = p.nodes.get('#detail-content').innerHTML;
  for (const text of ['Resumen ficticio', 'Borrador ficticio', '24 h', 'seguimiento manual vencido', 'Comunicaciones', 'request-update-form', 'internal-note-form', 'data-archive-request', 'Fotos y adjuntos']) assert.ok(html.includes(text), text);
  assert.match(p.nodes.get('#communication-content').innerHTML, /Aviso al negocio.*Enviado/);
  assert.equal(p.run('state.detail.communicationsStatus'), 'ready');
  const activityRead = seen.find(url => url.searchParams.get('type') === 'neq.internal_note');
  assert.ok(activityRead.searchParams.get('select').includes('reason_code:metadata->>reason_code'));
  assert.ok(!activityRead.searchParams.get('select').split(',').includes('metadata'));
  assert.ok(!seen.some(url => url.pathname.endsWith('/email_jobs')));
});
