const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { createDataService } = require(path.join(root, 'js/data/product-data.js'));
const { renderFullDetail } = require(path.join(root, 'js/real-product.js'));

const BUSINESS = '11111111-1111-4111-8111-111111111111';
const OTHER_BUSINESS = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const REQUEST = '44444444-4444-4444-8444-444444444444';
const CONTACT = '55555555-5555-4555-8555-555555555555';
const FORM = '66666666-6666-4666-8666-666666666666';
const FIELD = '77777777-7777-4777-8777-777777777777';
const ATTACHMENT = '88888888-8888-4888-8888-888888888888';
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
  const fixtureResult = fixture([...authRoutes, ...routes]);
  await fixtureResult.service.signIn('owner@example.test', 'test-password');
  await fixtureResult.service.listBusinesses();
  return fixtureResult;
}

const requestRow = {
  id: REQUEST, business_id: BUSINESS, contact_id: CONTACT, form_config_id: FORM,
  reference: 'REF-REAL', title: 'Reforma de baño', service: 'Baño', description: 'Renovar baño completo.',
  status: 'Nuevo', priority: 2, urgency: 'media', source: 'form', created_at: '2026-09-30T10:00:00Z',
  enrichment_status: 'completed', enriched_at: '2026-09-30T10:01:00Z',
  internal_summary: 'Solicitud clara para reforma integral.', suggested_reply: 'Hola, revisaremos tu solicitud.',
};

function detailRoutes({ request = requestRow, answers = true, attachments = true, attachmentPath = `${BUSINESS}/${REQUEST}/${ATTACHMENT}.jpg` } = {}) {
  return [
    [(url) => url.pathname.endsWith('/requests'), { body: request ? [request] : [] }],
    [(url) => url.pathname.endsWith('/contacts'), { body: [{ id: CONTACT, business_id: BUSINESS, display_name: 'Cliente DEV', email: 'cliente@example.test', phone: '600000000' }] }],
    [(url) => url.pathname.endsWith('/form_configs'), { body: [{ id: FORM, business_id: BUSINESS, name: 'Solicitud de reforma' }] }],
    [(url) => url.pathname.endsWith('/form_fields'), { body: [{ id: FIELD, business_id: BUSINESS, form_config_id: FORM, label: 'Zona o municipio', display_order: 2 }] }],
    [(url) => url.pathname.endsWith('/request_custom_answers'), { body: answers ? [{ request_id: REQUEST, business_id: BUSINESS, form_field_id: FIELD, field_key: 'zona', label_snapshot: 'Zona o municipio', value_text: 'Valencia', value_jsonb: 'Valencia' }] : [] }],
    [(url) => url.pathname.endsWith('/activities'), { body: [
      { request_id: REQUEST, business_id: BUSINESS, actor_type: 'automation', type: 'request_enrichment_generated', title: 'RAW AUTOMATION', detail: 'PRIVATE', created_at: '2026-09-30T10:01:00Z' },
      { request_id: REQUEST, business_id: BUSINESS, actor_type: 'user', type: 'internal_note', title: 'Nota interna', detail: 'Llamar por la tarde.', created_at: '2026-09-30T10:02:00Z' },
      { request_id: REQUEST, business_id: BUSINESS, actor_type: 'system', type: 'unknown_internal_event', title: 'PRIVATE RAW TITLE', detail: 'PRIVATE RAW DETAIL', created_at: '2026-09-30T10:03:00Z' },
    ] }],
    [(url) => url.pathname.endsWith('/attachments'), { body: attachments ? [{ id: ATTACHMENT, request_id: REQUEST, business_id: BUSINESS, storage_path: attachmentPath, file_name: 'foto baño.jpg', mime_type: 'image/jpeg', size_bytes: 2048, created_at: '2026-09-30T10:04:00Z' }] : [] }],
    [(url) => url.pathname.includes('/storage/v1/object/sign/request-attachments/'), { body: { signedURL: `/object/sign/request-attachments/${BUSINESS}/${REQUEST}/${ATTACHMENT}.jpg?token=temporary` } }],
  ];
}

test('authorized detail projects real relations and signs only its canonical private attachment', async () => {
  const { service, calls } = await authorizedService(detailRoutes());
  const detail = await service.getRequestDetail(BUSINESS, REQUEST);

  assert.equal(detail.request.reference, 'REF-REAL');
  assert.equal(detail.contact.display_name, 'Cliente DEV');
  assert.deepEqual(detail.answers, [{ label: 'Zona o municipio', value: 'Valencia' }]);
  assert.equal(detail.zone, 'Valencia');
  assert.equal(detail.activities.length, 2);
  assert.equal(detail.notes.length, 1);
  assert.equal(detail.attachments[0].file_name, 'foto baño.jpg');
  assert.match(detail.attachments[0].access_url, /^https:\/\/rinrgjancwvcvpzjyqmu\.supabase\.co\/storage\/v1\/object\/sign\/request-attachments\//);
  assert.equal(detail.attachments[0].storage_path, undefined);

  const relational = calls.filter(({ target }) => /\/rest\/v1\/(requests|contacts|form_configs|form_fields|request_custom_answers|activities|attachments)$/.test(target.pathname));
  for (const { target, options } of relational) {
    assert.equal(options.headers.Authorization, `Bearer ${jwt}`);
    assert.equal(target.searchParams.get('business_id'), `eq.${BUSINESS}`);
  }
  assert.equal(relational.find(({ target }) => target.pathname.endsWith('/requests')).target.searchParams.get('id'), `eq.${REQUEST}`);
  const requestSelect = relational.find(({ target }) => target.pathname.endsWith('/requests')).target.searchParams.get('select');
  assert.doesNotMatch(requestSelect, /claim|attempt|retry|lease/);
});

test('foreign or missing request returns the same empty result and does not query its relations', async () => {
  const { service, calls } = await authorizedService(detailRoutes({ request: null }));
  assert.equal(await service.getRequestDetail(BUSINESS, REQUEST), null);
  assert.equal(calls.filter(({ target }) => /request_custom_answers|activities|attachments|contacts|form_configs|form_fields/.test(target.pathname)).length, 0);
  await assert.rejects(service.getRequestDetail(OTHER_BUSINESS, REQUEST), /BUSINESS_NOT_AUTHORIZED/);
});

test('detail keeps empty answers and attachments explicit without inventing values', async () => {
  const { service } = await authorizedService(detailRoutes({ answers: false, attachments: false }));
  const detail = await service.getRequestDetail(BUSINESS, REQUEST);
  assert.deepEqual(detail.answers, []);
  assert.deepEqual(detail.attachments, []);
  assert.equal(detail.zone, null);
});

test('detail rejects an attachment path outside the authorized request namespace', async () => {
  const foreignPath = `${OTHER_BUSINESS}/${REQUEST}/${ATTACHMENT}.jpg`;
  const { service } = await authorizedService(detailRoutes({ attachmentPath: foreignPath }));
  await assert.rejects(service.getRequestDetail(BUSINESS, REQUEST), /READ_FAILED/);
});

test('completed enrichment remains an escaped unsent read-only draft while base actions are available elsewhere', () => {
  const html = renderFullDetail({ request: requestRow, contact: { display_name: 'Cliente', email: 'a@example.test', phone: '' }, form: null, answers: [], activities: [], notes: [], attachments: [], zone: null });
  assert.match(html, /Generado/);
  assert.match(html, /Solicitud clara para reforma integral/);
  assert.match(html, /Borrador/);
  assert.match(html, /No enviada ni aprobada/);
  assert.match(html, /Hola, revisaremos tu solicitud/);
  assert.match(html, /<p class="real-detail-draft">Hola, revisaremos tu solicitud\.<\/p>/);
  assert.doesNotMatch(html, /data-action="(?:approve|send|edit)|claim|attempt|retry|lease/i);
});

test('all C14 states have human labels without technical errors', () => {
  const labels = { pending: 'Pendiente', processing: 'Generando', failed: 'No disponible', legacy: 'Solicitud anterior' };
  for (const [status, label] of Object.entries(labels)) {
    const html = renderFullDetail({ request: { ...requestRow, enrichment_status: status, internal_summary: null, suggested_reply: null }, contact: null, form: null, answers: [], activities: [], notes: [], attachments: [], zone: null });
    assert.match(html, new RegExp(label));
    assert.doesNotMatch(html, /SQL|stack|claim|attempt|retry|lease/i);
  }
});

test('activities use safe known labels and notes allow creation without edit or delete', () => {
  const html = renderFullDetail({
    request: requestRow, contact: null, form: null, answers: [], attachments: [], zone: null,
    activities: [
      { actor_type: 'automation', type: 'request_enrichment_generated', title: 'PRIVATE', detail: 'PRIVATE', created_at: null },
      { actor_type: 'system', type: 'unknown_internal_event', title: 'PRIVATE RAW', detail: 'PRIVATE RAW', created_at: null },
    ],
    notes: [{ actor_type: 'user', type: 'internal_note', detail: '<b>Nota real</b>', created_at: null }],
  });
  assert.match(html, /Resumen y respuesta sugerida generados/);
  assert.match(html, /Automatización/);
  assert.match(html, /Actividad registrada/);
  assert.match(html, /&lt;b&gt;Nota real&lt;\/b&gt;/);
  assert.match(html, /textarea[^>]+maxlength="2000"/);
  assert.match(html, /Añadir nota/);
  assert.doesNotMatch(html, /PRIVATE|Editar nota|Eliminar nota/);
});

test('real detail renders safe empty sections and attachment metadata without internal paths', () => {
  const html = renderFullDetail({
    request: { ...requestRow, suggested_reply: '<script>alert(1)</script>' }, contact: null, form: null,
    answers: [], activities: [], notes: [], zone: null,
    attachments: [{ file_name: 'foto baño.jpg', mime_type: 'image/jpeg', size_bytes: 2048, created_at: null, access_url: 'https://rinrgjancwvcvpzjyqmu.supabase.co/storage/v1/object/sign/request-attachments/file.jpg?token=temporary' }],
  });
  assert.match(html, /Sin respuestas registradas/);
  assert.match(html, /Sin notas internas/);
  assert.match(html, /foto baño\.jpg/);
  assert.match(html, /2 KB/);
  assert.match(html, /Abrir archivo/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /storage_path|business_id|request_id|service_role|sb_secret_/);
});

test('C18C-2 remains isolated from local mock mode and privileged credentials', () => {
  const data = fs.readFileSync(path.join(root, 'js/data/product-data.js'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'js/script.js'), 'utf8');
  assert.match(controller, /get\('mode'\) !== 'local'/);
  assert.match(script, /isRealProductMode \? \[\] : loadRequests\(\)/);
  assert.doesNotMatch(data + controller, /service_role|sb_secret_|Marta López|suggestedResponse/);
});
