const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { renderFullDetail } = require(path.join(root, 'js/real-product.js'));
const { createRequestDetailView } = require(path.join(root, 'js/request-detail.js'));
const styles = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scriptSource = fs.readFileSync(path.join(root, 'js/script.js'), 'utf8');

const realDetail = {
  request: {
    id: '44444444-4444-4444-8444-444444444444',
    business_id: '11111111-1111-4111-8111-111111111111',
    reference: 'REF-010', title: 'Reforma de baño', service: 'Baño',
    description: 'Renovar el baño completo.', status: 'Nuevo', priority: 2,
    urgency: 'media', created_at: '2026-10-13T10:00:00Z',
    enrichment_status: 'completed', enriched_at: '2026-10-13T10:01:00Z',
    internal_summary: 'Solicitud preparada para revisión.',
    suggested_reply: 'Hola, revisaremos tu solicitud.',
    automatic_follow_up_milestone_hours: 24,
    next_follow_up_at: '2026-10-14T10:00:00Z',
    next_action: 'Confirmar medidas.',
  },
  contact: { display_name: 'Cliente DEV', email: 'cliente@example.test', phone: '600000000' },
  form: { name: 'Solicitud de reforma' },
  zone: 'Valencia',
  answers: [{ label: 'Disponibilidad', value: 'Por la tarde' }],
  activities: [{ actor_type: 'user', type: 'internal_note', title: 'Nota interna', detail: 'Llamar por la tarde.', created_at: '2026-10-13T11:00:00Z' }],
  notes: [{ detail: 'Llamar por la tarde.', created_at: '2026-10-13T11:00:00Z' }],
  followUps: [{ id: '55555555-5555-4555-8555-555555555555', action_text: 'Confirmar medidas', status: 'pending', due_at: '2026-10-14T10:00:00Z' }],
  communications: [{ email_type: 'customer_confirmation', status: 'sent', created_at: '2026-10-13T10:00:00Z', sent_at: '2026-10-13T10:02:00Z' }],
  attachments: [{ file_name: 'foto.jpg', mime_type: 'image/jpeg', size_bytes: 2048, created_at: '2026-10-13T10:00:00Z', access_url: 'https://example.test/file' }],
};

test('real detail uses the compact hierarchy without removing information or C18D controls', () => {
  const html = renderFullDetail(realDetail);
  for (const className of [
    'real-detail-hero', 'real-detail-top-grid', 'real-detail-overview',
    'real-detail-management', 'real-detail-enrichment-grid',
    'real-detail-work-grid', 'real-detail-history-grid',
  ]) assert.match(html, new RegExp(`class="[^"]*${className}`), className);

  for (const text of [
    'REF-010', 'Cliente DEV', 'Reforma de baño', 'Valencia', 'Renovar el baño completo.',
    'Disponibilidad', 'Solicitud preparada para revisión.', 'Hola, revisaremos tu solicitud.',
    'Actividad', 'Notas internas', 'Seguimiento', 'Comunicaciones', 'Adjuntos',
  ]) assert.match(html, new RegExp(text));

  assert.match(html, /Respuesta sugerida · Borrador/);
  assert.match(html, /No enviada ni aprobada/);
  assert.match(html, /data-real-request-update/);
  assert.match(html, /data-real-archive-request/);
  assert.match(html, /data-real-note-form/);
  assert.match(html, /data-real-complete-follow-up/);
  assert.match(html, /data-real-copy-response/);
  assert.doesNotMatch(html, /data-action="send|Enviar respuesta/);
});

test('local detail keeps all five panels in one stable layout track', () => {
  const html = createRequestDetailView({
    id: 'lead-1', reference: 'REF-001', name: 'Lucía', email: 'lucia@example.test',
    phone: '600000000', service: 'Reformas', description: 'Reforma de baño.',
    budget: '1.000 - 3.000 EUR', urgency: 'Este mes', status: 'Nuevo', origin: 'Formulario',
    formattedCreatedAt: '13 oct 2026', formattedNextFollowUpDate: '14 oct 2026',
    followUpCadence: '24 h', nextFollowUp: 'Confirmar medidas.', internalSummary: 'Resumen.',
    suggestedQuestions: ['¿Medidas?'], suggestedResponse: 'Respuesta.', attachments: [], activityHistory: [],
  });
  assert.match(html, /<div class="request-detail-panels">/);
  assert.equal((html.match(/data-detail-panel=/g) || []).length, 5);
  assert.match(html, /data-detail-panel="seguimiento"/);
  assert.match(html, /data-detail-panel="actividad"/);
  assert.match(styles, /\.request-detail-panels\s*{[^}]*display:\s*grid;/s);
  assert.match(styles, /\.request-detail-tab-panel\s*{[^}]*grid-area:\s*1\s*\/\s*1;/s);
  assert.match(styles, /\.request-detail-tab-panel\[hidden\]\s*{[^}]*visibility:\s*hidden;/s);
  assert.match(styles, /\.detail-flow-controls\s*>\s*\.copy-button\[hidden\]\s*{[^}]*visibility:\s*hidden;/s);
  assert.match(scriptSource, /focus\(\{\s*preventScroll:\s*true\s*\}\)/);
});

test('local and real modes keep their identification visibly separated', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'js/real-product.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert.match(html, /dashboard-local-badge"[^>]*>Datos ficticios locales/);
  assert.match(html, /Demo local · datos de ejemplo · no se envían mensajes reales/);
  assert.match(controller, /Supabase DEV · datos reales/);
  assert.match(controller, /dashboard-local-badge[^\n]+setAttribute\('hidden'/);
  assert.match(styles, /\.dashboard-local-badge\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
});
