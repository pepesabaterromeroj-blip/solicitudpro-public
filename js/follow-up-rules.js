(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.FollowUpRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createFollowUpPlan(request) {
    const status = request.status || "Nuevo";
    const urgency = request.urgency || "Este mes";

    if (["Ganado", "Perdido"].includes(status)) {
      return {
        hours: 0,
        label: "Cerrado",
        action: "No requiere seguimiento comercial activo.",
      };
    }

    if (urgency === "Hoy" || status === "Nuevo") {
      return {
        hours: 24,
        label: "24 h",
        action:
          "Contactar en las próximas 24 horas para confirmar la necesidad y acordar el siguiente paso.",
      };
    }

    if (
      status === "Enviado" ||
      status === "En preparación" ||
      urgency === "Esta semana"
    ) {
      return {
        hours: 48,
        label: "48 h",
        action:
          status === "Enviado"
            ? "Preguntar en 48 horas si ha podido revisar el presupuesto y resolver dudas."
            : "Retomar el contacto en 48 horas para completar datos o preparar la propuesta.",
      };
    }

    return {
      hours: 72,
      label: "72 h",
      action:
        "Retomar el contacto en 72 horas para confirmar si mantiene el interés y definir la siguiente acción.",
    };
  }

  return { createFollowUpPlan };
});
