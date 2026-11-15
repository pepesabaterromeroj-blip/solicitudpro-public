import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ATTACHMENT_BUCKET,
  AttachmentUploadError,
  MAX_ATTACHMENT_BYTES,
  persistAttachment,
  prepareAttachment,
  type PreparedAttachment,
} from "./attachment-upload.ts";
import { scheduleEmailWorkerWake } from "./email-worker-wake.ts";
import { scheduleRequestEnrichmentWake } from "./request-enrichment-wake.ts";

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function getAllowedOrigins() {
  const configuredOrigins = Deno.env.get("PUBLIC_FORM_ALLOWED_ORIGINS");
  return new Set(
    (configuredOrigins ? configuredOrigins.split(",") : DEFAULT_DEV_ORIGINS)
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function corsHeaders(origin: string | null) {
  if (!origin || !getAllowedOrigins().has(origin)) return { "Content-Type": "application/json" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function response(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

function errorResponse(message: string, status: number, origin: string | null, retryAfter?: number) {
  const headers = corsHeaders(origin);
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

type SubmissionRoute = { kind: "submission"; businessSlug: string; formSlug: string };
type AttachmentRoute = {
  kind: "attachment";
  businessSlug: string;
  formSlug: string;
  reference: string;
};

function routeParams(url: URL): SubmissionRoute | AttachmentRoute | null {
  const attachmentMatch = url.pathname.match(
    /\/api\/public\/forms\/([^/]+)\/([^/]+)\/requests\/([^/]+)\/attachments\/?$/,
  );
  if (attachmentMatch) {
    return {
      kind: "attachment",
      businessSlug: decodeURIComponent(attachmentMatch[1]),
      formSlug: decodeURIComponent(attachmentMatch[2]),
      reference: decodeURIComponent(attachmentMatch[3]),
    };
  }
  const submissionMatch = url.pathname.match(
    /\/api\/public\/forms\/([^/]+)\/([^/]+)\/requests\/?$/,
  );
  return submissionMatch
    ? {
      kind: "submission",
      businessSlug: decodeURIComponent(submissionMatch[1]),
      formSlug: decodeURIComponent(submissionMatch[2]),
    }
    : null;
}

function rpcErrorStatus(message: string) {
  if (message.includes("SP_BUSINESS_OR_FORM_NOT_FOUND")) return 404;
  if (message.includes("SP_RATE_LIMITED")) return 429;
  if (message.startsWith("SP_")) return 422;
  return 500;
}

function getPositiveInteger(name: string, fallback: number) {
  const value = Number(Deno.env.get(name) ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function validIdempotencyKey(request: Request) {
  const value = request.headers.get("Idempotency-Key")?.trim();
  return value && /^[A-Za-z0-9._:-]{16,128}$/.test(value) ? value : null;
}

function safeLog(event: Record<string, unknown>) {
  console.info(JSON.stringify(event));
}

async function handleAttachmentUpload(
  request: Request,
  route: AttachmentRoute,
  origin: string | null,
  supabase: ReturnType<typeof createClient>,
) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return errorResponse("La subida debe incluir un archivo.", 415, origin);
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_ATTACHMENT_BYTES + MAX_MULTIPART_OVERHEAD_BYTES) {
    return errorResponse("El archivo supera el límite de 10 MB.", 413, origin);
  }

  const idempotencyKey = validIdempotencyKey(request);
  if (!idempotencyKey || !/^[A-Z]{3}-[0-9]+$/i.test(route.reference)) {
    return errorResponse("La solicitud no está disponible para adjuntos.", 404, origin);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("No hemos podido leer el archivo.", 400, origin);
  }
  if (Array.from(formData.keys()).some((key) => key !== "file")) {
    return errorResponse("La subida contiene campos no permitidos.", 400, origin);
  }
  const files = formData.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return errorResponse("Debes adjuntar exactamente un archivo.", 400, origin);
  }

  const { data: authorizationData, error: authorizationError } = await supabase.rpc(
    "authorize_public_attachment_upload",
    {
      p_business_slug: route.businessSlug,
      p_form_slug: route.formSlug,
      p_reference: route.reference,
      p_idempotency_key_hash: await sha256(idempotencyKey),
    },
  );
  if (authorizationError) {
    safeLog({ event: "attachment_upload", outcome: "authorization_error" });
    return errorResponse("No se pudo validar la solicitud.", 500, origin);
  }
  const authorization = Array.isArray(authorizationData) ? authorizationData[0] : authorizationData;
  if (!authorization?.business_id || !authorization?.request_id) {
    return errorResponse("La solicitud no está disponible para adjuntos.", 404, origin);
  }

  try {
    const prepared = await prepareAttachment(files[0], {
      businessId: authorization.business_id,
      requestId: authorization.request_id,
    });
    const separator = prepared.storagePath.lastIndexOf("/");
    const folder = prepared.storagePath.slice(0, separator);
    const objectName = prepared.storagePath.slice(separator + 1);
    const findMetadata = async (candidate: PreparedAttachment) => {
      const { data, error } = await supabase
        .from("attachments")
        .select("id,business_id,request_id,storage_path,file_name,mime_type,size_bytes")
        .eq("id", candidate.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    const result = await persistAttachment(prepared, {
      findMetadata,
      upload: async (candidate) => {
        const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(
          candidate.storagePath,
          candidate.bytes,
          { contentType: candidate.mimeType, cacheControl: "3600", upsert: false },
        );
        return { error };
      },
      objectExists: async () => {
        const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).list(folder, {
          limit: 2,
          search: objectName,
        });
        return !error && data.some((object) => object.name === objectName);
      },
      insertMetadata: async (candidate) => {
        const { error } = await supabase.from("attachments").insert({
          id: candidate.id,
          business_id: candidate.businessId,
          request_id: candidate.requestId,
          storage_path: candidate.storagePath,
          file_name: candidate.fileName,
          mime_type: candidate.mimeType,
          size_bytes: candidate.sizeBytes,
          source: "public_form",
        });
        return { error };
      },
      remove: async (candidate) => {
        const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([candidate.storagePath]);
        return { error };
      },
      log: safeLog,
    });

    safeLog({ event: "attachment_upload", outcome: result.wasReplayed ? "replayed" : "created", attachment_id: prepared.id });
    return response({
      attachment_id: prepared.id,
      filename: prepared.fileName,
      mime_type: prepared.mimeType,
      size_bytes: prepared.sizeBytes,
      status: "stored",
    }, result.wasReplayed ? 200 : 201, origin);
  } catch (error) {
    if (error instanceof AttachmentUploadError) return errorResponse(error.message, error.status, origin);
    safeLog({ event: "attachment_upload", outcome: "unexpected_error" });
    return errorResponse("No se pudo completar la subida del archivo.", 500, origin);
  }
}

async function handleSubmission(
  request: Request,
  route: SubmissionRoute,
  origin: string | null,
  supabase: ReturnType<typeof createClient>,
  ipHashSecret: string,
) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse("No hemos podido validar la solicitud.", 415, origin);
  }
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return errorResponse("La solicitud es demasiado grande.", 413, origin);

  const rawBody = await request.text();
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse("La solicitud es demasiado grande.", 413, origin);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("No hemos podido validar la solicitud.", 400, origin);
  }
  const idempotencyKey = validIdempotencyKey(request);
  if (!idempotencyKey) return errorResponse("No hemos podido validar la solicitud.", 400, origin);

  const rateLimitMax = getPositiveInteger("PUBLIC_FORM_RATE_LIMIT_MAX", 3);
  const rateLimitWindowSeconds = getPositiveInteger("PUBLIC_FORM_RATE_LIMIT_WINDOW_SECONDS", 60);
  const { data, error } = await supabase.rpc("submit_public_form_submission_with_enrichment_wake", {
    p_business_slug: route.businessSlug,
    p_form_slug: route.formSlug,
    p_payload: payload,
    p_idempotency_key_hash: await sha256(idempotencyKey),
    p_payload_hash: await sha256(rawBody),
    p_requester_hash: await hmacSha256(clientAddress(request), ipHashSecret),
    p_rate_limit_max: Math.min(rateLimitMax, 20),
    p_rate_limit_window_seconds: Math.min(Math.max(rateLimitWindowSeconds, 10), 3600),
  });
  if (error) {
    const status = rpcErrorStatus(error.message);
    safeLog({ event: "public_form_submission", outcome: "rejected", status });
    return errorResponse(
      status === 404 ? "Este formulario no está disponible." : "No hemos podido validar la solicitud.",
      status,
      origin,
      status === 429 ? rateLimitWindowSeconds : undefined,
    );
  }
  const submission = Array.isArray(data) ? data[0] : data;
  safeLog({ event: "public_form_submission", outcome: "created" });
  scheduleEmailWorkerWake();
  scheduleRequestEnrichmentWake(submission?.request_id);
  return response({
    reference: submission?.reference,
    message: submission?.confirmation_text ?? "Hemos recibido tu solicitud.",
  }, submission?.was_replayed ? 200 : 201, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (origin && !getAllowedOrigins().has(origin)) return errorResponse("Origen no permitido.", 403, origin);
  if (request.method === "OPTIONS") {
    return origin
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : errorResponse("Origen no permitido.", 403, origin);
  }

  const route = routeParams(new URL(request.url));
  if (!route || request.method !== "POST") return errorResponse("Recurso no disponible.", 404, origin);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ipHashSecret = Deno.env.get("PUBLIC_FORM_IP_HASH_SECRET");
  if (!projectUrl || !serviceRoleKey || (route.kind === "submission" && !ipHashSecret)) {
    console.error(JSON.stringify({ event: route.kind, outcome: "configuration_error" }));
    return errorResponse("No se pudo procesar la operación. Inténtalo de nuevo.", 500, origin);
  }

  const supabase = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return route.kind === "attachment"
    ? handleAttachmentUpload(request, route, origin, supabase)
    : handleSubmission(request, route, origin, supabase, ipHashSecret!);
});
