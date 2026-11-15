#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const AUTHORIZED_DEV_ORIGIN = "https://rinrgjancwvcvpzjyqmu.supabase.co";
const BUSINESS_SLUG = "reformas-demo-dev";
const FORM_SLUG = "solicitud";
const DEV_ENDPOINT = `${AUTHORIZED_DEV_ORIGIN}/functions/v1/receive-public-form/api/public/forms/${BUSINESS_SLUG}/${FORM_SLUG}/requests`;
const EMAIL_ENV_NAME = "SOLICITUDPRO_DEV_TEST_CUSTOMER_EMAIL";

function generateRunId(now = new Date(), randomUUID = crypto.randomUUID) {
  const date = now.toISOString();
  const compactDate = date.slice(0, 10).replaceAll("-", "");
  const compactTime = date.slice(11, 19).replaceAll(":", "");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `SP-E2E-${compactDate}-${compactTime}-${suffix}`;
}

function generateIdempotencyKey(randomUUID = crypto.randomUUID) {
  return `sp-e2e-dev-${randomUUID()}`;
}

function buildPayload({ email, runId }) {
  return {
    contact: {
      display_name: "Prueba E2E SolicitudPro DEV",
      email,
      phone: "",
    },
    answers: {
      tipo_reforma: "Baño",
      zona: "Valencia",
      descripcion: `Prueba automática DEV de SolicitudPro. Identificador: ${runId}.`,
      plazo: "En las próximas semanas",
    },
    metadata: {
      source: "dev_e2e_request_tool",
      sector: "reformas",
    },
    privacy_notice_version: "demo-sectorial-dev-2026-09",
  };
}

function sanitizePayload(payload, emailConfigured) {
  return {
    ...payload,
    contact: {
      ...payload.contact,
      email: emailConfigured ? "[configurado]" : "[no configurado]",
    },
  };
}

function parseArgs(argv) {
  const parsed = { send: false, json: false, email: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--send") {
      parsed.send = true;
    } else if (argument === "--json") {
      parsed.json = true;
    } else if (argument === "--email") {
      parsed.email = String(argv[index + 1] || "").trim();
      index += 1;
    } else if (argument.startsWith("--email=")) {
      parsed.email = argument.slice("--email=".length).trim();
    } else {
      return { error: `Argumento no reconocido: ${argument}` };
    }
  }

  return parsed;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAuthorizedDevEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.origin === AUTHORIZED_DEV_ORIGIN
      && url.protocol === "https:"
      && url.hostname === "rinrgjancwvcvpzjyqmu.supabase.co"
      && url.port === "";
  } catch {
    return false;
  }
}

function baseResult({ mode, runId }) {
  return {
    mode,
    success: false,
    run_id: runId,
  };
}

async function parseResponseBody(response) {
  try {
    const body = await response.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

async function runDevRequest(options = {}) {
  const argv = options.argv || [];
  const env = options.env || {};
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = options.endpoint || DEV_ENDPOINT;
  const now = options.now ? options.now() : new Date();
  const randomUUID = options.randomUUID || crypto.randomUUID;
  const args = parseArgs(argv);
  const runId = generateRunId(now, randomUUID);
  const mode = args.send ? "real-dev-e2e" : "dev-dry-run";

  if (args.error) {
    return {
      exitCode: 2,
      result: {
        ...baseResult({ mode, runId }),
        error_code: "INVALID_ARGUMENT",
        message: args.error,
      },
    };
  }

  const configuredEmail = String(args.email || env[EMAIL_ENV_NAME] || "").trim();
  const payloadEmail = configuredEmail || "dev-email-not-configured@example.invalid";
  const payload = buildPayload({ email: payloadEmail, runId });

  if (!args.send) {
    return {
      exitCode: 0,
      result: {
        mode,
        success: true,
        run_id: runId,
        endpoint,
        business_slug: BUSINESS_SLUG,
        form_slug: FORM_SLUG,
        payload: sanitizePayload(payload, Boolean(configuredEmail)),
        operation: "POST no enviado",
      },
    };
  }

  if (!isAuthorizedDevEndpoint(endpoint)) {
    return {
      exitCode: 2,
      result: {
        ...baseResult({ mode, runId }),
        error_code: "NON_DEV_ENDPOINT",
        message: "ABORTED: NON-DEV ENDPOINT",
      },
    };
  }

  if (!configuredEmail || !isValidEmail(configuredEmail)) {
    return {
      exitCode: 2,
      result: {
        ...baseResult({ mode, runId }),
        error_code: "MISSING_DEV_TEST_EMAIL",
        message: `Configura ${EMAIL_ENV_NAME} en .env.local antes de usar --send.`,
      },
    };
  }

  const idempotencyKey = generateIdempotencyKey(randomUUID);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const body = await parseResponseBody(response);

    if (!response.ok) {
      return {
        exitCode: 3,
        result: {
          ...baseResult({ mode, runId }),
          http_status: response.status,
          error_code: "HTTP_ERROR",
          message: "El endpoint DEV rechazó la solicitud.",
        },
      };
    }

    const result = {
      mode,
      success: true,
      run_id: runId,
      http_status: response.status,
    };
    if (typeof body.reference === "string" && body.reference) {
      result.reference = body.reference;
    }
    if (typeof body.request_id === "string" && body.request_id) {
      result.request_id = body.request_id;
    }

    return { exitCode: 0, result };
  } catch {
    return {
      exitCode: 4,
      result: {
        ...baseResult({ mode, runId }),
        error_code: "NETWORK_ERROR",
        message: "No se pudo conectar con el endpoint DEV.",
      },
    };
  }
}

function formatResult(result, options = {}) {
  if (options.json) {
    return JSON.stringify(result, null, 2);
  }

  const lines = [
    result.mode === "dev-dry-run" ? "DEV DRY RUN" : "DEV REAL E2E TEST",
    `Estado: ${result.success ? "SUCCESS" : "FAILED"}`,
    `run_id: ${result.run_id}`,
  ];

  if (result.endpoint) lines.push(`Endpoint: ${result.endpoint}`);
  if (result.business_slug) lines.push(`businessSlug: ${result.business_slug}`);
  if (result.form_slug) lines.push(`formSlug: ${result.form_slug}`);
  if (result.payload) lines.push(`Payload sanitizado:\n${JSON.stringify(result.payload, null, 2)}`);
  if (result.operation) lines.push(`Operación: ${result.operation}`);
  if (Number.isInteger(result.http_status)) lines.push(`HTTP status: ${result.http_status}`);
  if (result.reference) lines.push(`Referencia: ${result.reference}`);
  if (result.request_id) lines.push(`request_id: ${result.request_id}`);
  if (result.message) lines.push(result.message);

  return lines.join("\n");
}

function loadLocalEnvironment() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function main() {
  loadLocalEnvironment();
  const args = parseArgs(process.argv.slice(2));
  const execution = await runDevRequest({
    argv: process.argv.slice(2),
    env: process.env,
  });
  process.stdout.write(`${formatResult(execution.result, { json: Boolean(args.json) })}\n`);
  process.exitCode = execution.exitCode;
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write("FAILED: error interno de la herramienta DEV.\n");
    process.exitCode = 4;
  });
}

module.exports = {
  AUTHORIZED_DEV_ORIGIN,
  BUSINESS_SLUG,
  DEV_ENDPOINT,
  EMAIL_ENV_NAME,
  FORM_SLUG,
  buildPayload,
  formatResult,
  generateIdempotencyKey,
  generateRunId,
  isAuthorizedDevEndpoint,
  parseArgs,
  runDevRequest,
  sanitizePayload,
};
