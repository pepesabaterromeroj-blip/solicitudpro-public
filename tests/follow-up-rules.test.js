const assert = require("node:assert/strict");
const { createFollowUpPlan } = require("../js/follow-up-rules.js");

const cases = [
  {
    name: "una solicitud urgente recibe contacto en 24 horas",
    request: { status: "Nuevo", urgency: "Hoy" },
    expected: { hours: 24, label: "24 h" },
  },
  {
    name: "una solicitud en preparación recibe seguimiento en 48 horas",
    request: { status: "En preparación", urgency: "Este mes" },
    expected: { hours: 48, label: "48 h" },
  },
  {
    name: "una propuesta enviada recibe seguimiento en 48 horas",
    request: { status: "Enviado", urgency: "Sin prisa" },
    expected: { hours: 48, label: "48 h" },
  },
  {
    name: "una oportunidad con seguimiento pendiente recibe seguimiento en 72 horas",
    request: { status: "Seguimiento pendiente", urgency: "Sin prisa" },
    expected: { hours: 72, label: "72 h" },
  },
];

cases.forEach(({ name, request, expected }) => {
  const plan = createFollowUpPlan(request);
  assert.equal(plan.hours, expected.hours, name);
  assert.equal(plan.label, expected.label, name);
  assert.ok(plan.action.length > 20, `${name}: debe incluir una accion clara`);
});

console.log(`OK: ${cases.length} reglas de seguimiento verificadas.`);
