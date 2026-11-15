export type RpcResult = {
  data: unknown;
  error: { message?: string } | null;
};

export type WorkerDependencies = {
  workerSecret: string;
  now: () => Date;
  rpc: (name: string, params: Record<string, unknown>) => Promise<RpcResult>;
  log: (event: Record<string, unknown>) => void;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CLAIM_LIMIT = 10;
const MIN_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 3600;
const DEFAULT_LEASE_SECONDS = 300;
const MAX_ERROR_LENGTH = 500;

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function operationFrom(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
}

function hasExactFields(
  payload: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  return required.every((field) => Object.hasOwn(payload, field)) &&
    Object.keys(payload).every((field) => allowed.has(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function objectValue(parent: Record<string, unknown>, key: string) {
  const value = parent[key];
  return isRecord(value) ? value : {};
}

function emailDocument(title: string, heading: string, content: string) {
  return `<!doctype html>
<html lang="es" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${htmlEscape(title)}</title>
</head>
<body style="margin:0;background:#f4f6f8;color:#1f2937;font-family:Arial,sans-serif;">
  <div lang="es" dir="ltr" style="max-width:640px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 18px;color:#44546a;font-size:14px;font-weight:700;letter-spacing:.02em;">SolicitudPro</p>
      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:#111827;">${htmlEscape(heading)}</h1>
      ${content}
    </div>
  </div>
</body>
</html>`;
}

function detailRow(label: string, value: string) {
  if (!value) return "";
  return `<p style="margin:0 0 10px;font-size:16px;line-height:1.5;"><strong>${htmlEscape(label)}:</strong> ${htmlEscape(value)}</p>`;
}

export function renderEmailJob(emailType: string, rawContext: unknown) {
  const context = isRecord(rawContext) ? rawContext : {};
  const business = objectValue(context, "business");
  const customer = objectValue(context, "customer");
  const request = objectValue(context, "request");
  const reference = textValue(request.reference, "Sin referencia");
  const service = textValue(request.service);
  const businessName = textValue(business.name, "el negocio");

  if (emailType === "customer_confirmation") {
    const customerName = textValue(customer.name);
    const greeting = customerName ? `Hola, ${customerName}:` : "Hola:";
    const subject = `Solicitud recibida · ${reference}`;
    const text = [
      greeting,
      "",
      `Hemos recibido tu solicitud para ${businessName}.`,
      `Referencia: ${reference}`,
      service ? `Servicio: ${service}` : "",
      "",
      "El negocio revisará la información y podrá ponerse en contacto contigo para continuar.",
      "Por ahora no necesitas hacer nada más.",
      "",
      "Gracias,",
      "SolicitudPro",
    ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
    const html = emailDocument(
      subject,
      "Hemos recibido tu solicitud",
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${htmlEscape(greeting)}</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Hemos recibido tu solicitud para ${htmlEscape(businessName)}.</p>
      <div style="margin:0 0 20px;padding:16px;background:#f8fafc;border-radius:8px;">
        ${detailRow("Referencia", reference)}
        ${detailRow("Servicio", service)}
      </div>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">El negocio revisará la información y podrá ponerse en contacto contigo para continuar.</p>
      <p style="margin:0;font-size:16px;line-height:1.6;">Por ahora no necesitas hacer nada más.</p>`,
    );
    return { subject, text, html };
  }

  if (emailType !== "business_notification") {
    throw new Error("Unsupported email type");
  }

  const customerName = textValue(customer.name, "No indicado");
  const customerEmail = textValue(customer.email);
  const customerPhone = textValue(customer.phone);
  const urgency = textValue(request.urgency);
  const summary = textValue(request.internal_summary) || textValue(request.description, "Sin descripción adicional.");
  const answers = Array.isArray(context.answers)
    ? context.answers
      .filter(isRecord)
      .map((answer) => ({
        label: textValue(answer.label),
        value: textValue(answer.value),
      }))
      .filter((answer) => answer.label && answer.value)
    : [];
  const subject = `Nueva solicitud · ${reference}`;
  const detailsText = [
    `Referencia: ${reference}`,
    service ? `Servicio: ${service}` : "",
    urgency ? `Urgencia: ${urgency}` : "",
    `Cliente: ${customerName}`,
    customerEmail ? `Email: ${customerEmail}` : "",
    customerPhone ? `Teléfono: ${customerPhone}` : "",
    ...answers.map((answer) => `${answer.label}: ${answer.value}`),
  ].filter(Boolean);
  const text = [
    "Nueva solicitud recibida en SolicitudPro",
    "",
    ...detailsText,
    "",
    "Resumen",
    summary,
    "",
    "Revisa la solicitud en SolicitudPro para decidir el siguiente paso.",
  ].join("\n");
  const answerRows = answers.map((answer) => detailRow(answer.label, answer.value)).join("\n");
  const html = emailDocument(
    subject,
    "Nueva solicitud",
    `<div style="margin:0 0 20px;padding:16px;background:#f8fafc;border-radius:8px;">
      ${detailRow("Referencia", reference)}
      ${detailRow("Servicio", service)}
      ${detailRow("Urgencia", urgency)}
      ${detailRow("Cliente", customerName)}
      ${detailRow("Email", customerEmail)}
      ${detailRow("Teléfono", customerPhone)}
      ${answerRows}
    </div>
    <h2 style="margin:0 0 10px;font-size:18px;line-height:1.4;color:#111827;">Resumen</h2>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${htmlEscape(summary)}</p>
    <p style="margin:0;font-size:16px;line-height:1.6;">Revisa la solicitud en SolicitudPro para decidir el siguiente paso.</p>`,
  );
  return { subject, text, html };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function timingSafeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function isAuthorized(request: Request, secret: string) {
  if (!secret) return false;
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  return Boolean(match && timingSafeEqual(match[1], secret));
}

async function readPayload(request: Request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return null;
  }
  try {
    const payload = await request.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function sanitizeError(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\bAuthorization\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, "Authorization=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:sb_secret_|service_role=)[^\s,;]+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, MAX_ERROR_LENGTH) : null;
}

function firstRow(data: unknown) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function invokeRpc(
  dependencies: WorkerDependencies,
  name: string,
  params: Record<string, unknown>,
) {
  const result = await dependencies.rpc(name, params);
  if (result.error) {
    dependencies.log({ event: "email_job_worker", operation: name, outcome: "rpc_error" });
    return { response: response({ error: "No se pudo completar la operación." }, 500) };
  }
  return { data: result.data };
}

export async function handleWorkerRequest(
  request: Request,
  dependencies: WorkerDependencies,
) {
  const operation = operationFrom(request);
  if (!["claim", "sent", "failed"].includes(operation)) {
    return response({ error: "Recurso no disponible." }, 404);
  }
  if (request.method !== "POST") {
    return response({ error: "Método no permitido." }, 405);
  }
  if (!isAuthorized(request, dependencies.workerSecret)) {
    return response({ error: "Acceso no autorizado." }, 401);
  }

  const payload = await readPayload(request);
  if (!payload) return response({ error: "Solicitud no válida." }, 400);

  if (operation === "claim") {
    if (!hasExactFields(payload, [], ["limit", "lease_seconds"])) {
      return response({ error: "Solicitud no válida." }, 400);
    }
    const limit = payload.limit ?? 1;
    const leaseSeconds = payload.lease_seconds ?? DEFAULT_LEASE_SECONDS;
    if (
      !Number.isInteger(limit) ||
      Number(limit) < 1 ||
      Number(limit) > MAX_CLAIM_LIMIT ||
      !Number.isInteger(leaseSeconds) ||
      Number(leaseSeconds) < MIN_LEASE_SECONDS ||
      Number(leaseSeconds) > MAX_LEASE_SECONDS
    ) {
      return response({ error: "Solicitud no válida." }, 400);
    }

    const result = await invokeRpc(dependencies, "claim_email_jobs", {
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (result.response) return result.response;
    const jobs = Array.isArray(result.data)
      ? result.data.map((job) => {
        if (!isRecord(job) || typeof job.email_type !== "string") return job;
        return {
          ...job,
          rendered: renderEmailJob(job.email_type, job.context),
        };
      })
      : [];
    return response({ jobs }, 200);
  }

  if (!hasExactFields(
    payload,
    operation === "sent" ? ["job_id", "claim_token"] : ["job_id", "claim_token", "error"],
    operation === "failed" ? ["retry_at"] : [],
  )) {
    return response({ error: "Solicitud no válida." }, 400);
  }
  if (!isUuid(payload.job_id) || !isUuid(payload.claim_token)) {
    return response({ error: "Solicitud no válida." }, 400);
  }

  if (operation === "sent") {
    const result = await invokeRpc(dependencies, "resolve_email_job_sent", {
      p_job_id: payload.job_id,
      p_claim_token: payload.claim_token,
    });
    if (result.response) return result.response;
    const job = firstRow(result.data);
    return job
      ? response({ job: job as Record<string, unknown> }, 200)
      : response({ error: "El claim ya no es válido." }, 409);
  }

  const error = sanitizeError(payload.error);
  if (!error) return response({ error: "Solicitud no válida." }, 400);

  let retryAt: string | null = null;
  if (payload.retry_at !== undefined && payload.retry_at !== null) {
    if (typeof payload.retry_at !== "string") {
      return response({ error: "Solicitud no válida." }, 400);
    }
    const retryDate = new Date(payload.retry_at);
    if (
      Number.isNaN(retryDate.getTime()) ||
      retryDate.getTime() <= dependencies.now().getTime()
    ) {
      return response({ error: "Solicitud no válida." }, 400);
    }
    retryAt = retryDate.toISOString();
  }

  const result = await invokeRpc(dependencies, "resolve_email_job_failed", {
    p_job_id: payload.job_id,
    p_claim_token: payload.claim_token,
    p_error: error,
    p_retry_at: retryAt,
  });
  if (result.response) return result.response;
  const job = firstRow(result.data);
  return job
    ? response({ job: job as Record<string, unknown> }, 200)
    : response({ error: "El claim ya no es válido." }, 409);
}
