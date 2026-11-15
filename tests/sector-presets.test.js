const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  SECTOR_PRESETS,
  createSectorRequestPayload,
  getSectorFromSearch,
  getNextSectorReference,
  getSectorPreset,
  getSectorFormConfig,
  getSectorExperience,
  getSectorRequestSeeds,
  getSectorStorageKey,
} = require("../js/sector-presets.js");

const root = path.join(__dirname, "..");

test("defines the initial and priority sector presets", () => {
  assert.deepEqual(Object.keys(SECTOR_PRESETS), [
    "reformas",
    "electricidad",
    "fontaneria",
    "academias",
    "climatizacion",
    "cristaleria",
  ]);

  assert.equal(getSectorPreset("reformas").label, "Reformas");
  assert.equal(getSectorPreset("electricidad").label, "Electricidad");
  assert.equal(getSectorPreset("fontaneria").label, "Fontanería");
  assert.equal(getSectorPreset("academias").label, "Academias");
  assert.equal(getSectorPreset("climatizacion").label, "Climatización");
  assert.equal(getSectorPreset("cristaleria").label, "Cristalerías");
});

test("returns only sector-specific local storage keys for valid sectors", () => {
  assert.equal(
    getSectorStorageKey("reformas"),
    "solicitudpro-demo:v1.1:reformas"
  );
  assert.equal(
    getSectorStorageKey("fontaneria"),
    "solicitudpro-demo:v1.1:fontaneria"
  );
  assert.equal(
    getSectorStorageKey("climatizacion"),
    "solicitudpro-demo:v1.1:climatizacion"
  );
  assert.equal(
    getSectorStorageKey("cristaleria"),
    "solicitudpro-demo:v1.1:cristaleria"
  );
  assert.equal(getSectorStorageKey("invalido"), null);
  assert.equal(getSectorPreset("invalido"), null);
});

test("keeps complete request seeds isolated for every active sector", () => {
  const sectorIds = Object.keys(SECTOR_PRESETS);
  const allRequestIds = new Set();
  const allReferences = new Set();

  sectorIds.forEach((sectorId) => {
    const preset = getSectorPreset(sectorId);
    const requests = getSectorRequestSeeds(sectorId);

    assert.equal(requests.length, 5);
    assert.ok(requests.every((request) => request.sector === sectorId));
    assert.ok(requests.every((request) => request.id && request.reference));
    assert.ok(requests.every((request) => request.name && request.email));
    assert.ok(requests.every((request) => request.phone !== undefined));
    assert.ok(requests.every((request) => request.service && request.description));
    assert.ok(requests.every((request) => request.urgency && request.status));
    assert.ok(requests.every((request) => request.origin && request.createdAt));
    assert.ok(requests.every((request) => request.nextFollowUpDate));
    assert.ok(requests.every((request) => Array.isArray(request.attachments)));
    assert.ok(requests.every((request) => Array.isArray(request.activityHistory)));
    assert.ok(requests.every((request) => request.customAnswers));
    assert.ok(requests.some((request) => request.id === preset.featuredRequestId));

    requests.forEach((request) => {
      assert.ok(!allRequestIds.has(request.id));
      assert.ok(!allReferences.has(request.reference));
      allRequestIds.add(request.id);
      allReferences.add(request.reference);
    });
  });
});

test("returns independent copies of sector request seeds", () => {
  const firstRead = getSectorRequestSeeds("reformas");
  firstRead[0].name = "Cambio local";
  firstRead[0].attachments.push({ name: "temporal.jpg" });

  const secondRead = getSectorRequestSeeds("reformas");
  assert.notEqual(secondRead[0].name, "Cambio local");
  assert.equal(secondRead[0].attachments.length, 1);
});

test("defines concise client forms for every sector demo", () => {
  const expectedFields = {
    reformas: ["tipoReforma", "zona", "description", "plazoDeseado", "attachments", "name", "email", "phone"],
    electricidad: ["tipoTrabajo", "riesgoUrgencia", "zona", "description", "attachments", "name", "phone", "email"],
    fontaneria: ["tipoIncidencia", "aguaActivaUrgencia", "zona", "description", "attachments", "name", "phone", "email"],
    academias: ["materia", "nivel", "objetivo", "modalidad", "disponibilidad", "attachments", "name", "email", "phone"],
    climatizacion: ["tipoTrabajo", "urgencia", "zona", "tipoEquipo", "description", "attachments", "name", "email", "phone"],
    cristaleria: ["tipoTrabajo", "urgencia", "zona", "medidasAproximadas", "description", "attachments", "name", "email", "phone"],
  };

  Object.entries(expectedFields).forEach(([sectorId, fieldNames]) => {
    const form = getSectorFormConfig(sectorId);
    assert.ok(form);
    assert.equal(form.fields.length, fieldNames.length);
    assert.deepEqual(form.fields.map((field) => field.name), fieldNames);
    assert.ok(form.title && form.description && form.confirmationText);
    assert.ok(form.submitLabel && form.referencePrefix);
  });

  assert.equal(getSectorFormConfig("invalido"), null);
});

test("keeps Fontanería select values compatible with its published development form", () => {
  const form = getSectorFormConfig("fontaneria");
  const fields = Object.fromEntries(form.fields.map((field) => [field.name, field]));

  assert.deepEqual(fields.tipoIncidencia.options, [
    "Fuga",
    "Desagüe atascado",
    "Grifo o cisterna",
    "Tubería",
    "Calentador",
    "Otro",
  ]);
  assert.deepEqual(fields.aguaActivaUrgencia.options, [
    "Agua activa",
    "Hoy",
    "24-48 horas",
    "Esta semana",
    "Sin prisa",
  ]);
});

test("generates the next reference inside the active sector only", () => {
  Object.keys(SECTOR_PRESETS).forEach((sectorId) => {
    assert.equal(
      getNextSectorReference(sectorId, getSectorRequestSeeds(sectorId)),
      `${getSectorFormConfig(sectorId).referencePrefix}-006`
    );
  });
});

test("creates client requests from the active sector form configuration", () => {
  Object.keys(SECTOR_PRESETS).forEach((sectorId) => {
    const form = getSectorFormConfig(sectorId);
    const values = {
      name: "Contacto de prueba",
      email: "contacto@example.com",
      phone: "+34 600 000 000",
      description: "Necesito una orientación clara para preparar el siguiente paso.",
    };

    form.fields.forEach((field) => {
      if (field.type === "select") {
        values[field.name] = field.options[0];
      } else if (field.type === "text" || field.type === "textarea") {
        values[field.name] = values[field.name] || "Información de ejemplo";
      }
    });

    const payload = createSectorRequestPayload(
      sectorId,
      values,
      getSectorRequestSeeds(sectorId)
    );

    assert.equal(payload.sector, sectorId);
    assert.equal(payload.reference, `${form.referencePrefix}-006`);
    assert.equal(payload.name, values.name);
    assert.equal(payload.email, values.email);
    assert.equal(payload.customAnswers[form.fields[0].name], values[form.fields[0].name]);
  });
});

test("creates sector-specific internal summaries, labels, questions, replies, and next actions", () => {
  const reformas = getSectorExperience("reformas", getSectorRequestSeeds("reformas")[0]);
  assert.match(reformas.internalSummary, /baño/i);
  assert.ok(reformas.dataPendingLabels.includes("Medidas pendientes"));
  assert.ok(reformas.sectorTags.includes("Zona confirmada"));
  assert.match(reformas.suggestedQuestions.join(" "), /foto del estado actual/i);
  assert.match(reformas.suggestedResponse, /orientarte mejor/i);
  assert.doesNotMatch(reformas.suggestedResponse, /presupuesto exacto|automático/i);

  const electricidad = getSectorExperience("electricidad", getSectorRequestSeeds("electricidad")[0]);
  assert.match(electricidad.internalSummary, /Avería eléctrica/);
  assert.match(electricidad.suggestedQuestions.join(" "), /chispas|olor a quemado|humo/i);
  assert.match(electricidad.suggestedResponse, /no manipules cables ni el cuadro eléctrico/i);
  assert.doesNotMatch(electricidad.suggestedQuestions.join(" "), /abrir el cuadro|manipular cables/i);

  const fontaneria = getSectorExperience("fontaneria", getSectorRequestSeeds("fontaneria")[0]);
  assert.ok(fontaneria.sectorTags.includes("Agua activa"));
  assert.match(fontaneria.suggestedQuestions.join(" "), /sigue saliendo agua/i);
  assert.match(fontaneria.suggestedResponse, /no retrases el contacto/i);

  const academias = getSectorExperience("academias", getSectorRequestSeeds("academias")[0]);
  assert.match(academias.internalSummary, /Matemáticas/);
  assert.ok(academias.dataPendingLabels.includes("Horario pendiente"));
  assert.match(academias.suggestedQuestions.join(" "), /disponibilidad horaria/i);
  assert.doesNotMatch(
    `${academias.suggestedQuestions.join(" ")} ${academias.suggestedResponse}`,
    /fecha de nacimiento|diagnóstico|informe médico/i
  );

  const climatizacion = getSectorExperience("climatizacion", getSectorRequestSeeds("climatizacion")[0]);
  assert.match(climatizacion.internalSummary, /aire acondicionado|climatización/i);
  assert.match(climatizacion.suggestedQuestions.join(" "), /equipo|enfría|instalación/i);
  assert.match(climatizacion.suggestedResponse, /revisaremos/i);

  const cristaleria = getSectorExperience("cristaleria", getSectorRequestSeeds("cristaleria")[0]);
  assert.match(cristaleria.internalSummary, /cristal|ventana|cerramiento/i);
  assert.match(cristaleria.suggestedQuestions.join(" "), /medidas|foto/i);
  assert.match(cristaleria.suggestedResponse, /medidas/i);
});

test("provides sector-specific simulated email copy that remains safe and local", () => {
  const reformas = getSectorExperience("reformas", getSectorRequestSeeds("reformas")[0]).emailCopy;
  assert.match(reformas.businessSubject, /reforma/i);
  assert.match(reformas.businessIntro, /fotos, medidas aproximadas y disponibilidad para visita/i);
  assert.match(reformas.clientBody, /solicitud de reforma/i);
  assert.doesNotMatch(reformas.clientBody, /presupuesto exacto|automático/i);

  const electricidad = getSectorExperience("electricidad", getSectorRequestSeeds("electricidad")[0]).emailCopy;
  assert.match(electricidad.businessSubject, /eléctrica/i);
  assert.match(electricidad.clientBody, /no manipules la instalación/i);
  assert.doesNotMatch(`${electricidad.businessIntro} ${electricidad.clientBody}`, /abre el cuadro|manipula cables/i);

  const fontaneria = getSectorExperience("fontaneria", getSectorRequestSeeds("fontaneria")[0]).emailCopy;
  assert.match(fontaneria.businessSubject, /fontanería/i);
  assert.match(fontaneria.clientBody, /no retrases el contacto por subirla/i);

  const academias = getSectorExperience("academias", getSectorRequestSeeds("academias")[0]).emailCopy;
  assert.match(academias.businessSubject, /clases/i);
  assert.match(academias.clientBody, /materia, nivel, objetivo y disponibilidad/i);
  assert.doesNotMatch(`${academias.businessIntro} ${academias.clientBody}`, /fecha de nacimiento|diagnóstico|informe médico/i);
});

test("uses the active sector for storage, requests, selected context, and reset", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(script, /const STORAGE_KEY = activeSectorStorageKey/);
  assert.match(script, /request && request\.sector === activeSector/);
  assert.match(script, /function getDefaultSelectedRequestId\(\)/);
  assert.match(script, /featuredRequestId/);
  assert.match(script, /requests = getDemoRequests\(\);/);
  assert.match(script, /sector: activeSector/);
  assert.match(script, /window\.localStorage\.removeItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(script, /localStorage\.clear\(\)/);
  assert.match(script, /function submitSectorFormToSupabaseDev/);
  assert.match(script, /receive-public-form\/api\/public\/forms/);
});

test("resolves direct sector URLs and keeps invalid or empty URLs on the selector", () => {
  assert.equal(getSectorFromSearch("?sector=reformas").activeSector, "reformas");
  assert.equal(getSectorFromSearch("?sector=electricidad").activeSector, "electricidad");
  assert.equal(getSectorFromSearch("?sector=fontaneria").activeSector, "fontaneria");
  assert.equal(getSectorFromSearch("?sector=academias").activeSector, "academias");
  assert.equal(getSectorFromSearch("?sector=climatizacion").activeSector, "climatizacion");
  assert.equal(getSectorFromSearch("?sector=cristaleria").activeSector, "cristaleria");

  assert.deepEqual(getSectorFromSearch("").selection, {
    isRequired: true,
    notice: "",
  });
  assert.deepEqual(getSectorFromSearch("?sector=invalido").selection, {
    isRequired: true,
    notice: "Elige una demo disponible.",
  });
});

test("provides a sector selector before the existing demo shell", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(html, /id="sector-selector"/);
  assert.match(html, /¿Qué demo quieres probar\?/);
  assert.match(html, /data-sector-id="reformas"/);
  assert.match(html, /data-sector-id="electricidad"/);
  assert.match(html, /data-sector-id="fontaneria"/);
  assert.match(html, /data-sector-id="academias"/);
  assert.match(html, /data-sector-id="climatizacion"/);
  assert.match(html, /data-sector-id="cristaleria"/);
  assert.match(html, /href="\?mode=local"[^>]*>Cambiar demo sectorial/);
  assert.match(html, /<script src="js\/sector-presets\.js"><\/script>/);
  assert.match(script, /getSectorFromSearch,/);
  assert.match(script, /getSectorRequestSeeds,/);
  assert.match(script, /getSectorFormConfig,/);
  assert.match(script, /getSectorExperience,/);
  assert.match(script, /getSectorStorageKey,/);
  assert.match(script, /let activeSector = sectorRoute\.activeSector/);
  assert.match(script, /const STORAGE_KEY = activeSectorStorageKey/);
  assert.match(script, /getSectorRequestSeeds\(activeSector\)/);
  assert.match(script, /sector: activeSector/);
  assert.doesNotMatch(script, /requests\.find\(\(request\) => request\.name === "Marta López"\)/);
});

test("renders one form container and creates sector-scoped client requests", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");

  assert.match(html, /id="sector-form-fields"/);
  assert.match(script, /function renderSectorForm\(\)/);
  assert.match(script, /createSectorRequestPayload\(activeSector, formValues, requests\)/);
  assert.match(script, /customAnswers: requestPayload\.customAnswers/);
  assert.match(script, /sector: activeSector/);
});

test("uses the active sector experience in detail, follow-ups, and local request rows", () => {
  const script = fs.readFileSync(path.join(root, "js", "script.js"), "utf8");
  const detail = fs.readFileSync(path.join(root, "js", "request-detail.js"), "utf8");

  assert.match(script, /const sectorExperience = getSectorExperience\(request\.sector, request\)/);
  assert.match(script, /sectorDataFields: sectorExperience\?\.detailFields/);
  assert.match(script, /getSectorExperience\(request\.sector, request\)\?\.contactedAction/);
  assert.match(detail, /request\.sectorDataFields/);
  assert.match(detail, /request\.sectorDataTitle/);
  assert.match(detail, /request\.sectorTags/);
});
