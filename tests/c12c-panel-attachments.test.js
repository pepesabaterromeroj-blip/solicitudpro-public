const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.js'), 'utf8');
test('Panel assets share a version so older cached scripts cannot replace the current panel', () => {
  const html = fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.html'), 'utf8');
  const scriptVersion = html.match(/src="panel-product-readonly\.js\?v=([a-z0-9-]+)"/)?.[1];
  const styleVersion = html.match(/href="panel-product-readonly\.css\?v=([a-z0-9-]+)"/)?.[1];
  assert.ok(scriptVersion);
  assert.equal(scriptVersion, styleVersion);
});
const request = { id: '11111111-1111-4111-8111-111111111111', business_id: '22222222-2222-4222-8222-222222222222' };
const attachment = (mime = 'image/jpeg', ext = 'jpg') => ({
  id: '33333333-3333-4333-8333-333333333333',
  request_id: request.id, business_id: request.business_id,
  storage_path: `${request.business_id}/${request.id}/33333333-3333-4333-8333-333333333333.${ext}`,
  file_name: 'Foto de prueba.jpg', mime_type: mime, size_bytes: 2048,
});
function panel(fetch = async () => { throw new Error('Unexpected network'); }) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', innerHTML: '', textContent: '', hidden: false, disabled: false, listeners: {},
      classList: { toggle() {} }, addEventListener(type, listener) { this.listeners[type] = listener; },
      querySelector: node, querySelectorAll: () => [], close() { this.open = false; },
      showModal() { this.open = true; }, removeAttribute() {}, focus() {},
    });
    return nodes.get(id);
  };
  const context = vm.createContext({ document: { querySelector: node }, fetch, URL, URLSearchParams, atob,
    window: { location: { href: 'http://localhost/panel', search: '' }, history: { replaceState() {} } },
  });
  vm.runInContext(source, context);
  return { nodes, run: code => vm.runInContext(code, context) };
}
test('C12C empty, loading and error states are safe and distinct', () => {
  const p = panel();
  assert.match(p.run('attachmentsMarkup({ attachments: [] })'), /Esta solicitud no tiene fotos ni archivos adjuntos\./);
  assert.match(p.run("attachmentsMarkup({ attachmentsStatus: 'loading' })"), /Cargando adjuntos/);
  assert.match(p.run("attachmentsMarkup({ attachmentsStatus: 'error' })"), /No se pudieron cargar los adjuntos\./);
});
test('C12C common images have previews, escaped labels and usable actions', () => {
  const p = panel();
  for (const [mime, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
    const item = { ...attachment(mime, ext), file_name: '<script>foto</script>', previewUrl: 'https://example.test/signed' };
    const html = p.run(`attachmentsMarkup({ attachments: [${JSON.stringify(item)}] })`);
    assert.match(html, /<img /); assert.match(html, /Ver foto/); assert.match(html, /2 KB/);
    assert.ok(!html.includes('<script>')); assert.match(html, /referrerpolicy="no-referrer"/);
  }
});
test('C12C HEIC, HEIF and PDF remain secondary readable files without broken previews', () => {
  const p = panel();
  for (const [mime, ext] of [['image/heic', 'heic'], ['image/heif', 'heif'], ['application/pdf', 'pdf']]) {
    const html = p.run(`attachmentsMarkup({ attachments: [${JSON.stringify(attachment(mime, ext))}] })`);
    assert.ok(!html.includes('<img ')); assert.match(html, /Abrir archivo/);
    assert.ok(!html.includes('image/')); assert.ok(!html.includes('application/'));
  }
});
test('C12C signing uses owner JWT, short expiry and canonical path, never a public URL', async () => {
  let captured;
  const item = attachment();
  const p = panel(async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ signedURL: `/object/sign/request-attachments/${item.storage_path}?token=test` }) };
  });
  p.run("state.accessToken = 'owner-session'");
  const url = await p.run(`signAttachment(${JSON.stringify(item)}, ${JSON.stringify(request)})`);
  assert.match(url, /\/storage\/v1\/object\/sign\//);
  assert.equal(captured.options.headers.Authorization, 'Bearer owner-session');
  assert.deepEqual(JSON.parse(captured.options.body), { expiresIn: 120 });
  await assert.rejects(p.run(`signAttachment(${JSON.stringify({ ...item, business_id: 'other' })}, ${JSON.stringify(request)})`));
  await assert.rejects(p.run(`signAttachment(${JSON.stringify({ ...item, storage_path: '../other' })}, ${JSON.stringify(request)})`));
});
test('C12C rejects signing failures, foreign origins, public URLs and changed sessions', async () => {
  for (const payload of [{ signedURL: 'https://evil.test/object/sign/a?token=test' }, { signedURL: '/object/public/a' }, {}]) {
    const p = panel(async () => ({ ok: true, json: async () => payload }));
    p.run("state.accessToken = 'owner-session'");
    await assert.rejects(p.run(`signAttachment(${JSON.stringify(attachment())}, ${JSON.stringify(request)})`));
  }
  const p = panel(async () => ({ ok: false })); p.run("state.accessToken = 'owner-session'");
  await assert.rejects(p.run(`signAttachment(${JSON.stringify(attachment())}, ${JSON.stringify(request)})`), /ATTACHMENT_ACCESS_FAILED/);
});
test('C12C metadata query scopes request and business, orders consistently, handles failures independently', async () => {
  let captured;
  const p = panel(async url => { captured = url; return { ok: true, json: async () => [] }; });
  p.run(`state.accessToken = 'owner-session'; state.detail = { request: ${JSON.stringify(request)} };`);
  await p.run('loadRequestAttachments(state.detail.request, state.detailVersion)');
  assert.match(captured, /request_id=eq\.11111111/); assert.match(captured, /business_id=eq\.22222222/);
  assert.match(captured, /order=created_at.asc,id.asc/);
  assert.match(p.nodes.get('#attachment-content').innerHTML, /no tiene fotos/);
  const failed = panel(async () => ({ ok: false }));
  failed.run(`state.accessToken = 'owner-session'; state.detail = { request: ${JSON.stringify(request)} };`);
  await failed.run('loadRequestAttachments(state.detail.request, state.detailVersion)');
  assert.match(failed.nodes.get('#attachment-content').innerHTML, /No se pudieron cargar los adjuntos\./);
  assert.equal(failed.run('state.detail.request.id'), request.id);
});
test('C12C multiple images keep their order and precede secondary documents', () => {
  const p = panel();
  const items = [ { ...attachment('application/pdf', 'pdf'), file_name: 'Documento.pdf' },
    { ...attachment('image/png', 'png'), file_name: 'Primera.png' },
    { ...attachment('image/webp', 'webp'), file_name: 'Segunda.webp' } ];
  const html = p.run(`attachmentsMarkup({ attachments: ${JSON.stringify(items)} })`);
  assert.ok(html.indexOf('Primera.png') < html.indexOf('Segunda.webp'));
  assert.ok(html.indexOf('Segunda.webp') < html.indexOf('Documento.pdf'));
});
test('C12C delayed signing and metadata responses are discarded after session/detail changes', async () => {
  let finish;
  const item = attachment();
  const p = panel(() => new Promise(resolve => { finish = resolve; }));
  p.run("state.accessToken = 'owner-session'");
  const signing = p.run(`signAttachment(${JSON.stringify(item)}, ${JSON.stringify(request)})`);
  p.run('state.accessToken = null');
  finish({ ok: true, json: async () => ({ signedURL: `/object/sign/request-attachments/${item.storage_path}?token=test` }) });
  await assert.rejects(signing, /ATTACHMENT_ACCESS_FAILED/);
  p.run(`state.accessToken = 'owner-session'; state.detail = { request: ${JSON.stringify(request)} };`);
  const reading = p.run('loadRequestAttachments(state.detail.request, state.detailVersion)');
  p.run('closeDetail(false)');
  finish({ ok: true, json: async () => [item] });
  await reading;
  assert.equal(p.run('state.detail'), null);
  assert.equal(p.nodes.get('#detail-content').innerHTML, '');
});
test('C12C image opening renews access and opens the native keyboard-accessible dialog', async () => {
  const item = attachment();
  let signs = 0;
  const p = panel(async () => { signs++; return { ok: true, json: async () => ({ signedURL: `/object/sign/request-attachments/${item.storage_path}?token=test` }) }; });
  p.run(`state.accessToken = 'owner-session'; state.detail = { request: ${JSON.stringify(request)}, attachments: [${JSON.stringify(item)}] }; var trigger = { dataset: { openAttachment: '${item.id}' }, disabled: false };`);
  await p.run('openAttachment(trigger)');
  assert.equal(signs, 1); assert.equal(p.nodes.get('#photo-dialog').open, true);
  assert.match(p.nodes.get('#photo-image').alt, /Foto adjunta/);
  assert.equal(p.run('trigger.disabled'), false);
  p.run('closePhoto()'); assert.equal(p.nodes.get('#photo-dialog').open, false);
  await p.run('openAttachment(trigger)'); assert.equal(signs, 2);
  const html = fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.html'), 'utf8');
  assert.match(html, /<dialog[^>]*aria-labelledby="photo-title"/); assert.match(html, /autofocus>Cerrar foto/);
});
test('C12C frontend adds no persistent URLs, privileged credentials or metadata/storage writes', () => {
  const feature = source.slice(source.indexOf('const PREVIEW_IMAGE_TYPES'), source.indexOf('function escapeHtml'));
  assert.ok(!/service_role|sb_secret_|localStorage|sessionStorage|console\./.test(feature));
  assert.ok(!/method: ['"](?:PUT|PATCH|DELETE)/.test(feature));
  assert.ok(!feature.includes('/object/public/'));
});

test('C12C tablet filters use flexible columns instead of overflowing the viewport', () => {
  const css = fs.readFileSync(path.join(__dirname, '../dev/panel-product-readonly.css'), 'utf8');
  const tablet = css.slice(css.indexOf('@media (max-width: 1040px)'));
  assert.match(tablet, /\.filter-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);\s*\}/);
});
