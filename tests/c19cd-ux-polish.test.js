const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const realProduct = require(path.join(root, 'js/real-product.js'));
const requestDetail = require(path.join(root, 'js/request-detail.js'));
const scriptSource = fs.readFileSync(path.join(root, 'js/script.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function detailWithReply(reply) {
  return {
    request: {
      id: '44444444-4444-4444-8444-444444444444',
      business_id: '11111111-1111-4111-8111-111111111111',
      reference: 'REF-010', title: 'Reforma de baño', service: 'Baño',
      description: 'Renovar el baño completo.', status: 'Nuevo', priority: 2,
      created_at: '2026-10-13T10:00:00Z', suggested_reply: reply,
    },
    contact: { display_name: 'Cliente DEV', email: 'cliente@example.test', phone: '600000000' },
    form: { name: 'Solicitud de reforma' },
    answers: [], activities: [], notes: [], followUps: [], communications: [], attachments: [],
  };
}

test('copies exactly the suggested reply without invoking product services', async () => {
  assert.equal(typeof realProduct.copySuggestedReply, 'function');
  const writes = [];
  const reply = 'Hola.\n\nEsta es la respuesta sugerida exacta.';

  const copied = await realProduct.copySuggestedReply(reply, async value => writes.push(value));

  assert.equal(copied, true);
  assert.deepEqual(writes, [reply]);
});

test('uses the modern clipboard only when it confirms the write', async () => {
  const writes = [];
  const root = {
    isSecureContext: true,
    navigator: { clipboard: { writeText: async value => writes.push(value) } },
  };

  const copied = await realProduct.writeClipboard(root, 'Respuesta exacta.');

  assert.equal(copied, true);
  assert.deepEqual(writes, ['Respuesta exacta.']);
});

test('propagates a modern clipboard rejection without reporting success', async () => {
  const root = {
    isSecureContext: true,
    navigator: {
      clipboard: {
        writeText: async () => { throw new Error('clipboard denied'); },
      },
    },
  };

  await assert.rejects(realProduct.writeClipboard(root, 'Respuesta exacta.'), /clipboard denied/);
});

test('uses and cleans the fallback when execCommand confirms the copy', async () => {
  const removed = [];
  const textarea = {
    style: {},
    setAttribute() {},
    select() {},
    remove() { removed.push(true); },
  };
  const root = {
    isSecureContext: false,
    navigator: {},
    document: {
      createElement: () => textarea,
      body: { appendChild() {} },
      execCommand: command => command === 'copy',
    },
  };

  const copied = await realProduct.writeClipboard(root, 'Respuesta exacta.');

  assert.equal(copied, true);
  assert.deepEqual(removed, [true]);
});

test('reports fallback failure without a false positive and cleans the textarea', async () => {
  let removed = 0;
  const textarea = {
    style: {},
    setAttribute() {},
    select() {},
    remove() { removed += 1; },
  };
  const root = {
    isSecureContext: false,
    navigator: {},
    document: {
      createElement: () => textarea,
      body: { appendChild() {} },
      execCommand: () => false,
    },
  };

  const copied = await realProduct.writeClipboard(root, 'Respuesta exacta.');

  assert.equal(copied, false);
  assert.equal(realProduct.copyFeedbackMessage(copied), 'No se pudo copiar.');
  assert.equal(removed, 1);
});

test('cleans the fallback and propagates an exception during copy', async () => {
  let removed = 0;
  const textarea = {
    style: {},
    setAttribute() {},
    select() {},
    remove() { removed += 1; },
  };
  const root = {
    isSecureContext: false,
    navigator: {},
    document: {
      createElement: () => textarea,
      body: { appendChild() {} },
      execCommand: () => { throw new Error('clipboard unavailable'); },
    },
  };

  await assert.rejects(realProduct.writeClipboard(root, 'Respuesta exacta.'), /clipboard unavailable/);
  assert.equal(removed, 1);
});

test('renders human priority labels in the real request list', () => {
  const expected = new Map([[1, 'Alta'], [2, 'Media'], [3, 'Baja'], [null, 'Sin prioridad'], [99, 'Sin prioridad']]);

  for (const [priority, label] of expected) {
    const html = realProduct.renderRequestRows([{
      id: `request-${priority}`,
      reference: `REF-${priority}`,
      service: 'Baño',
      status: 'Nuevo',
      priority,
      created_at: '2026-10-13T10:00:00Z',
    }]);
    assert.match(html, new RegExp(`>Prioridad<\\/span><strong>${label}<\\/strong>`));
    assert.doesNotMatch(html, /<strong>[123]<\/strong>/);
  }
});

test('distinguishes archived requests in the real list using the real archived_at field', () => {
  const html = realProduct.renderRequestRows([{
    id: 'request-archived',
    reference: 'REF-ARCH',
    service: 'Baño',
    status: 'Nuevo',
    priority: 2,
    archived_at: '2026-10-13T12:00:00Z',
    created_at: '2026-10-13T10:00:00Z',
  }]);

  assert.match(html, /class="request-card request-row is-archived"/);
  assert.match(html, /class="request-archive-badge"[^>]*>Archivada</);
});

test('renders copy only for a non-empty suggested reply', () => {
  const withReply = realProduct.renderFullDetail(detailWithReply('Respuesta lista para copiar.'));
  const withoutReply = realProduct.renderFullDetail(detailWithReply('   '));

  assert.match(withReply, /data-real-copy-response/);
  assert.match(withReply, />Copiar respuesta</);
  assert.doesNotMatch(withoutReply, /data-real-copy-response/);
});

test('resets a primary view to a predictable top position', () => {
  assert.equal(typeof realProduct.resetPageScroll, 'function');
  const calls = [];
  realProduct.resetPageScroll({ scrollTo: options => calls.push(options) });

  assert.deepEqual(calls, [{ top: 0, left: 0, behavior: 'auto' }]);
});

test('opening the local detail preserves the top scroll reset while moving focus', () => {
  assert.match(
    scriptSource,
    /showView\("detalle-solicitud"\);\s*activeDetailContainer\.focus\(\{\s*preventScroll:\s*true\s*\}\);/
  );
});

test('follow-up screen exposes the three approved state filters', () => {
  assert.match(indexSource, /data-follow-up-filter="pending"[^>]*>Pendientes</);
  assert.match(indexSource, /data-follow-up-filter="contacted"[^>]*>Contactados</);
  assert.match(indexSource, /data-follow-up-filter="all"[^>]*>Todos</);
});

test('local follow-ups filter pending, contacted and all without losing rows', () => {
  const rows = [
    { id: 'pending', status: 'Nuevo' },
    { id: 'contacted', status: 'Nuevo', followUpContactedAt: '2026-10-21T10:00:00.000Z' },
  ];

  assert.deepEqual(requestDetail.filterLocalFollowUps(rows, 'pending').map(row => row.id), ['pending']);
  assert.deepEqual(requestDetail.filterLocalFollowUps(rows, 'contacted').map(row => row.id), ['contacted']);
  assert.deepEqual(requestDetail.filterLocalFollowUps(rows, 'all').map(row => row.id), ['pending', 'contacted']);
});

test('local contact transition is reversible and restores the previous follow-up', () => {
  const pending = {
    id: 'local-1',
    nextFollowUpDate: '2026-10-22',
    nextFollowUp: 'Llamar para confirmar medidas.',
  };

  const contacted = requestDetail.markLocalFollowUpContacted(pending, {
    contactedAt: '2026-10-21T10:00:00.000Z',
    nextFollowUpDate: '2026-10-24',
    nextFollowUp: 'Revisar si necesita algún detalle adicional.',
  });
  assert.equal(contacted.followUpContactedAt, '2026-10-21T10:00:00.000Z');
  assert.deepEqual(contacted.previousFollowUp, {
    nextFollowUpDate: '2026-10-22',
    nextFollowUp: 'Llamar para confirmar medidas.',
  });

  const restored = requestDetail.unmarkLocalFollowUpContacted(contacted);
  assert.equal(restored.followUpContactedAt, undefined);
  assert.equal(restored.previousFollowUp, undefined);
  assert.equal(restored.nextFollowUpDate, pending.nextFollowUpDate);
  assert.equal(restored.nextFollowUp, pending.nextFollowUp);
});

test('local undo preserves a follow-up recalculated after the contact transition', () => {
  const contacted = requestDetail.markLocalFollowUpContacted({
    id: 'local-1',
    nextFollowUpDate: '2026-10-22',
    nextFollowUp: 'Llamar para confirmar medidas.',
  }, {
    contactedAt: '2026-10-21T10:00:00.000Z',
    nextFollowUpDate: '2026-10-24',
    nextFollowUp: 'Revisar si necesita algún detalle adicional.',
  });
  contacted.nextFollowUpDate = '2026-10-30';
  contacted.nextFollowUp = 'Seguimiento recalculado tras editar la solicitud.';

  const restored = requestDetail.unmarkLocalFollowUpContacted(contacted);
  assert.equal(restored.nextFollowUpDate, '2026-10-30');
  assert.equal(restored.nextFollowUp, 'Seguimiento recalculado tras editar la solicitud.');
});

test('local detail replaces the pending CTA with contacted state and a secondary undo', () => {
  const html = requestDetail.createRequestDetailView({
    id: 'local-1', name: 'Cliente ficticio', reference: 'SOL-001', service: 'Baño',
    status: 'Nuevo', urgency: 'Esta semana', description: 'Reforma ficticia.',
    followUpCadence: '72 h', formattedNextFollowUpDate: '24 oct 2026',
    nextFollowUp: 'Revisar el avance.', followUpContactedAt: '2026-10-21T10:00:00.000Z',
    activityHistory: [], attachments: [], customAnswers: {},
  });

  assert.match(html, /✓ Contactado/);
  assert.match(html, /data-action="unmark-follow-up-contacted"/);
  assert.match(html, />Desmarcar</);
  assert.doesNotMatch(html, /data-action="mark-follow-up-contacted"/);
});

test('local detail does not offer follow-up completion for terminal requests', () => {
  for (const status of ['Ganado', 'Perdido']) {
    const html = requestDetail.createRequestDetailView({
      id: `local-${status}`, name: 'Cliente ficticio', reference: 'SOL-002', service: 'Baño',
      status, urgency: 'Sin prisa', description: 'Solicitud cerrada ficticia.',
      followUpCadence: 'Cerrado', formattedNextFollowUpDate: 'Sin próxima fecha',
      nextFollowUp: 'Solicitud cerrada.', activityHistory: [], attachments: [], customAnswers: {},
    });
    assert.doesNotMatch(html, /data-action="mark-follow-up-contacted"/);
    assert.doesNotMatch(html, /data-action="unmark-follow-up-contacted"/);
  }
});

test('real follow-up list filters pending, contacted and all with CTA only while pending', () => {
  const requests = [{
    id: 'request-1', reference: 'REF-001', title: 'Baño', status: 'Nuevo',
    contact: { display_name: 'Cliente DEV' }, automatic_follow_up_milestone_hours: 0,
    next_follow_up_at: null,
  }];
  const context = { followUps: [
    { id: 'follow-pending', request_id: 'request-1', status: 'pending', action_text: 'Llamar', due_at: '2026-10-22T10:00:00Z', assigned_to: 'user-1' },
    { id: 'follow-contacted', request_id: 'request-1', status: 'completed', action_text: 'Confirmar medidas', completed_at: '2026-10-21T10:00:00Z', assigned_to: 'user-1' },
  ], activities: [] };

  const pending = realProduct.renderFollowUpRows(requests, context, 'pending');
  const contacted = realProduct.renderFollowUpRows(requests, context, 'contacted');
  const all = realProduct.renderFollowUpRows(requests, context, 'all');

  assert.match(pending, /Llamar/);
  assert.match(pending, /data-real-complete-follow-up="follow-pending"/);
  assert.doesNotMatch(pending, /Confirmar medidas/);
  assert.match(contacted, /✓ Contactado/);
  assert.match(contacted, /Confirmar medidas/);
  assert.doesNotMatch(contacted, /data-real-complete-follow-up/);
  assert.match(all, /Llamar/);
  assert.match(all, /Confirmar medidas/);
});

test('real UI offers reopen only for completed manual tasks on active requests', () => {
  const request = {
    id: 'request-1', business_id: 'business-1', reference: 'REF-001', title: 'Baño', status: 'Nuevo', archived_at: null,
    contact: { display_name: 'Cliente DEV' }, automatic_follow_up_milestone_hours: 0, next_follow_up_at: null,
  };
  const completedManual = {
    id: 'follow-manual', business_id: 'business-1', request_id: 'request-1', status: 'completed',
    action_text: 'Confirmar medidas', completed_at: '2026-10-21T10:00:00Z', assigned_to: 'user-1', cadence_hours: null, channel: 'internal',
  };
  const automatic = { ...completedManual, id: 'follow-automatic', assigned_to: null, cadence_hours: 24, channel: 'call' };

  const active = realProduct.renderFollowUpRows([request], { followUps: [completedManual, automatic], activities: [] }, 'contacted');
  const archived = realProduct.renderFollowUpRows([{ ...request, archived_at: '2026-10-22T10:00:00Z' }], { followUps: [completedManual], activities: [] }, 'contacted');
  const closed = realProduct.renderFollowUpRows([{ ...request, status: 'Ganado' }], { followUps: [completedManual], activities: [] }, 'contacted');
  const detail = realProduct.renderFullDetail({ ...detailWithReply('Borrador.'), followUps: [completedManual] });

  assert.match(active, /data-real-reopen-follow-up="follow-manual"[^>]*>Desmarcar/);
  assert.doesNotMatch(active, /data-real-reopen-follow-up="follow-automatic"/);
  assert.doesNotMatch(archived, /data-real-reopen-follow-up/);
  assert.doesNotMatch(closed, /data-real-reopen-follow-up/);
  assert.match(detail, /data-real-reopen-follow-up="follow-manual"[^>]*>Desmarcar/);
});

test('real follow-up origin does not label an assigned C15 task as manual', () => {
  const request = {
    id: 'request-1', business_id: 'business-1', reference: 'REF-001', title: 'Baño', status: 'Nuevo', archived_at: null,
    contact: { display_name: 'Cliente DEV' }, automatic_follow_up_milestone_hours: 24, next_follow_up_at: null,
  };
  const assignedAutomatic = {
    id: 'follow-automatic', business_id: 'business-1', request_id: 'request-1', status: 'completed',
    action_text: 'Confirmar disponibilidad', completed_at: '2026-10-21T10:00:00Z', assigned_to: 'user-1', cadence_hours: 24, channel: 'call',
  };

  const html = realProduct.renderFollowUpRows([request], { followUps: [assignedAutomatic], activities: [] }, 'contacted');

  assert.match(html, /Origen: Planificado por el sistema/);
  assert.doesNotMatch(html, /Origen: Manual/);
  assert.doesNotMatch(html, /data-real-reopen-follow-up/);
});

test('real controller handles reopen with refresh and honest partial-activity feedback', () => {
  const source = fs.readFileSync(path.join(root, 'js', 'real-product.js'), 'utf8');
  assert.match(source, /service\.reopenManualFollowUp\(activeBusiness\.id, followUp, request\)/);
  assert.match(source, /FOLLOW_UP_REOPENED_ACTIVITY_FAILED/);
  assert.equal(realProduct.followUpPartialMessage(true), 'El seguimiento se reabrió, pero no pudo registrarse en Actividad. La lista se ha actualizado.');
  assert.match(source, /refreshDetailAfterWrite\(requestId\)/);
});

test('real all filter excludes cancelled and skipped tasks instead of presenting them as pending', () => {
  const requests = [{
    id: 'request-1', reference: 'REF-001', title: 'Baño', status: 'Nuevo',
    contact: { display_name: 'Cliente DEV' }, automatic_follow_up_milestone_hours: 0,
    next_follow_up_at: null,
  }];
  const context = { followUps: [
    { id: 'follow-cancelled', request_id: 'request-1', status: 'cancelled', action_text: 'No mostrar cancelado' },
    { id: 'follow-skipped', request_id: 'request-1', status: 'skipped', action_text: 'No mostrar omitido' },
  ], activities: [] };

  const html = realProduct.renderFollowUpRows(requests, context, 'all');
  assert.doesNotMatch(html, /No mostrar cancelado|No mostrar omitido|data-real-complete-follow-up/);
});

test('real pending and all filters preserve automatic context after a completed manual task', () => {
  const requests = [{
    id: 'request-1', reference: 'REF-001', title: 'Baño', status: 'Nuevo',
    contact: { display_name: 'Cliente DEV' }, automatic_follow_up_milestone_hours: 48,
    next_follow_up_at: '2026-10-30T10:00:00Z',
  }];
  const context = { followUps: [
    { id: 'follow-completed', request_id: 'request-1', status: 'completed', action_text: 'Contacto anterior', completed_at: '2026-10-21T10:00:00Z' },
  ], activities: [] };

  const pending = realProduct.renderFollowUpRows(requests, context, 'pending');
  const all = realProduct.renderFollowUpRows(requests, context, 'all');
  assert.match(pending, /Contexto automático/);
  assert.match(pending, /Seguimiento recomendado/);
  assert.match(all, /✓ Contactado/);
  assert.match(all, /Contexto automático/);
});
