export type RpcResult = { data: unknown; error: { message?: string } | null };

export type WorkerDependencies = {
  workerSecret: string;
  now: () => Date;
  rpc: (name: string, params: Record<string, unknown>) => Promise<RpcResult>;
  log: (event: Record<string, unknown>) => void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSIENT_CODES = new Set(["timeout", "network", "rate_limited", "gateway_5xx", "gateway_temporary"]);
const PERMANENT_CODES = new Set(["invalid_output", "invalid_context", "configuration"]);
const TECHNICAL_CONTENT = /<\/?[a-z][^>]*>|system\s+prompt|developer\s+message|api[_ -]?key|service[_ -]?role|authorization\s*[:=]|bearer\s+|stack\s+trace|traceback|sb_secret_|\bsk-[a-z0-9]/i;

function response(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactFields(payload: Record<string, unknown>, required: string[], optional: string[] = []) {
  const allowed = new Set([...required, ...optional]);
  return required.every((field) => Object.hasOwn(payload, field)) &&
    Object.keys(payload).every((field) => allowed.has(field));
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

function authorized(request: Request, secret: string) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer ([^\s]+)$/);
  return Boolean(secret && match && timingSafeEqual(match[1], secret));
}

function normalizeText(value: unknown, minimum: number, maximum: number) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length < minimum || normalized.length > maximum || TECHNICAL_CONTENT.test(normalized)) return null;
  return normalized;
}

function firstRow(data: unknown) {
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

async function readPayload(request: Request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return null;
  try {
    const payload = await request.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function invokeRpc(dependencies: WorkerDependencies, name: string, params: Record<string, unknown>) {
  const result = await dependencies.rpc(name, params);
  if (result.error) {
    dependencies.log({ event: "request_enrichment_worker", operation: name, outcome: "rpc_error" });
    return { errorResponse: response({ error: "No se pudo completar la operación." }, 500) };
  }
  return { data: result.data };
}

export async function handleRequestEnrichmentWorkerRequest(request: Request, dependencies: WorkerDependencies) {
  const operation = new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!["claim", "complete", "failed"].includes(operation)) return response({ error: "Recurso no disponible." }, 404);
  if (request.method !== "POST") return response({ error: "Método no permitido." }, 405);
  if (!authorized(request, dependencies.workerSecret)) return response({ error: "Acceso no autorizado." }, 401);

  const payload = await readPayload(request);
  if (!payload) return response({ error: "Solicitud no válida." }, 400);

  if (operation === "claim") {
    if (!exactFields(payload, [], ["request_id", "limit", "lease_seconds"])) return response({ error: "Solicitud no válida." }, 400);
    const requestId = payload.request_id ?? null;
    const limit = payload.limit ?? 1;
    const leaseSeconds = payload.lease_seconds ?? 900;
    if ((requestId !== null && !isUuid(requestId)) || !Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > 5 || leaseSeconds !== 900) {
      return response({ error: "Solicitud no válida." }, 400);
    }
    const result = await invokeRpc(dependencies, "claim_request_enrichments", {
      p_request_id: requestId,
      p_limit: limit,
      p_lease_seconds: leaseSeconds,
    });
    if (result.errorResponse) return result.errorResponse;
    return response({ jobs: Array.isArray(result.data) ? result.data : [] }, 200);
  }

  const identityFields = ["business_id", "request_id", "claim_token"];
  if (!identityFields.every((field) => isUuid(payload[field]))) return response({ error: "Solicitud no válida." }, 400);

  if (operation === "complete") {
    if (!exactFields(payload, [...identityFields, "internal_summary", "suggested_reply"])) return response({ error: "Solicitud no válida." }, 400);
    const summary = normalizeText(payload.internal_summary, 20, 600);
    const reply = normalizeText(payload.suggested_reply, 40, 1200);
    if (!summary || !reply) return response({ error: "Salida de generación no válida." }, 400);
    const result = await invokeRpc(dependencies, "complete_request_enrichment", {
      p_business_id: payload.business_id,
      p_request_id: payload.request_id,
      p_claim_token: payload.claim_token,
      p_internal_summary: summary,
      p_suggested_reply: reply,
    });
    if (result.errorResponse) return result.errorResponse;
    const job = firstRow(result.data);
    return job ? response({ job: job as Record<string, unknown> }, 200) : response({ error: "El claim ya no es válido." }, 409);
  }

  if (!exactFields(payload, [...identityFields, "error_code"], ["retry_at"]) || typeof payload.error_code !== "string") {
    return response({ error: "Solicitud no válida." }, 400);
  }
  const errorCode = payload.error_code;
  if (!TRANSIENT_CODES.has(errorCode) && !PERMANENT_CODES.has(errorCode)) return response({ error: "Solicitud no válida." }, 400);
  let retryAt: string | null = null;
  if (payload.retry_at !== undefined && payload.retry_at !== null) {
    if (!TRANSIENT_CODES.has(errorCode) || typeof payload.retry_at !== "string") return response({ error: "Solicitud no válida." }, 400);
    const retryDate = new Date(payload.retry_at);
    if (Number.isNaN(retryDate.getTime()) || retryDate.getTime() <= dependencies.now().getTime()) return response({ error: "Solicitud no válida." }, 400);
    retryAt = retryDate.toISOString();
  }
  const result = await invokeRpc(dependencies, "fail_request_enrichment", {
    p_business_id: payload.business_id,
    p_request_id: payload.request_id,
    p_claim_token: payload.claim_token,
    p_error_code: errorCode,
    p_retry_at: retryAt,
  });
  if (result.errorResponse) return result.errorResponse;
  const job = firstRow(result.data);
  return job ? response({ job: job as Record<string, unknown> }, 200) : response({ error: "El claim ya no es válido." }, 409);
}
