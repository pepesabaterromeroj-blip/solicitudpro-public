const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createRequestDetailView,
  createRequestEditForm,
  normalizeRequestEditValues,
} = require("../js/request-detail.js");

test("creates a complete and escaped request detail view", () => {
  const html = createRequestDetailView({
    id: "lead-1",
    name: "<Laura>",
    email: "laura@example.com",
    phone: "+34 600 000 000",
    service: "Reformas",
    description: "Reforma completa del bano principal.",
    budget: "1.000 - 3.000 EUR",
    urgency: "Este mes",
    status: "Presupuesto enviado",
    formattedCreatedAt: "12 jun 2026",
    formattedNextFollowUpDate: "14 jun 2026",
    followUpCadence: "Seguimiento en 48 h",
    nextFollowUp: "Confirmar si ha revisado el presupuesto.",
    internalSummary: "Solicitud lista para revisar.",
    suggestedQuestions: ["medidas aproximadas", "fotos del estado actual"],
    suggestedResponse: "Hola Laura, hemos recibido tu solicitud.",
    attachments: [{ name: "bano.jpg", size: 204800 }],
    activityHistory: [
      {
        date: "2026-06-12",
        type: "created",
        label: "Solicitud creada",
        detail: "Entrada desde formulario demo.",
      },
      {
        date: "2026-06-13",
        type: "status",
        label: "Estado actualizado",
        detail: "Nuevo -> <Presupuesto enviado>",
      },
    ],
  });

  assert.match(html, /Detalle de solicitud/);
  assert.match(html, /&lt;Laura&gt;/);
  assert.doesNotMatch(html, /<Laura>/);
  assert.match(html, /Presupuesto enviado/);
  assert.match(html, /Seguimiento en 48 h/);
  assert.match(html, /medidas aproximadas/);
  assert.match(html, /bano\.jpg/);
  assert.match(html, /data-action="copy-message"/);
  assert.match(html, /data-channel="whatsapp"/);
  assert.match(html, /data-channel="email"/);
  assert.match(html, /data-action="edit-request"/);
  assert.match(html, /Historial de actividad/);
  assert.match(html, /Solicitud creada/);
  assert.match(html, /Nuevo -&gt; &lt;Presupuesto enviado&gt;/);
  assert.doesNotMatch(html, /Nuevo -> <Presupuesto enviado>/);
});

test("creates an escaped edit form with the current commercial values", () => {
  const html = createRequestEditForm(
    {
      id: "lead-1",
      name: '<Laura "Demo">',
      email: "laura@example.com",
      phone: "+34 600 000 000",
      service: "Reformas",
      description: "Reforma completa del bano principal.",
      budget: "1.000 - 3.000 EUR",
      urgency: "Este mes",
      status: "Presupuesto enviado",
    },
    {
      statuses: ["Nuevo", "Presupuesto enviado"],
      services: ["Reformas", "Electricidad"],
      budgets: ["1.000 - 3.000 EUR", "Mas de 3.000 EUR"],
      urgencies: ["Este mes", "Sin prisa"],
    }
  );

  assert.match(html, /data-action="save-request-edit"/);
  assert.match(html, /name="name" value="&lt;Laura &quot;Demo&quot;&gt;"/);
  assert.match(html, /<option value="Reformas" selected>/);
  assert.match(html, /<option value="Presupuesto enviado" selected>/);
  assert.doesNotMatch(html, /<Laura "Demo">/);
});

test("normalizes editable request values before persistence", () => {
  const normalized = normalizeRequestEditValues({
    name: "  Laura Demo  ",
    email: "  LAURA@example.com ",
    phone: " +34 600 000 000 ",
    service: " Reformas ",
    description: "  Reforma del bano con cambio de ducha.  ",
    budget: " 1.000 - 3.000 EUR ",
    urgency: " Este mes ",
    status: " Revisado ",
  });

  assert.deepEqual(normalized, {
    name: "Laura Demo",
    email: "LAURA@example.com",
    phone: "+34 600 000 000",
    service: "Reformas",
    description: "Reforma del bano con cambio de ducha.",
    budget: "1.000 - 3.000 EUR",
    urgency: "Este mes",
    status: "Revisado",
  });
});
