export const ATTACHMENT_BUCKET = "request-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "application/pdf": ["pdf"],
};

export class AttachmentUploadError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status: number,
    code: string,
  ) {
    super(message);
    this.name = "AttachmentUploadError";
    this.status = status;
    this.code = code;
  }
}

type AttachmentContext = {
  businessId: string;
  requestId: string;
};

export type PreparedAttachment = AttachmentContext & {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
};

type AttachmentMetadata = {
  id: string;
  business_id: string;
  request_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number | string;
};

type OperationResult = { error: unknown | null };

export type AttachmentDependencies = {
  findMetadata: (prepared: PreparedAttachment) => Promise<AttachmentMetadata | null>;
  upload: (prepared: PreparedAttachment) => Promise<OperationResult>;
  objectExists: (prepared: PreparedAttachment) => Promise<boolean>;
  insertMetadata: (prepared: PreparedAttachment) => Promise<OperationResult>;
  remove: (prepared: PreparedAttachment) => Promise<OperationResult>;
  log: (event: Record<string, unknown>) => void;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function detectMime(bytes: Uint8Array) {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";

  if (ascii(bytes, 4, 4) === "ftyp") {
    const brands = ascii(bytes, 8, Math.min(Math.max(bytes.length - 8, 0), 56));
    if (/(heic|heix|hevc|hevx|heis|heim)/.test(brands)) return "image/heic";
    if (/(mif1|msf1)/.test(brands)) return "image/heif";
  }

  return null;
}

function sanitizeFilename(value: string, fallbackExtension: string) {
  const basename = value.split(/[\\/]/).pop() ?? "";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const shortened = Array.from(cleaned).slice(0, 180).join("");
  return shortened || `archivo.${fallbackExtension}`;
}

async function sha256Bytes(value: Uint8Array) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", value));
}

function uuidFromDigest(digest: Uint8Array) {
  const value = digest.slice(0, 16);
  value[6] = (value[6] & 0x0f) | 0x50;
  value[8] = (value[8] & 0x3f) | 0x80;
  const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function prepareAttachment(file: File, context: AttachmentContext): Promise<PreparedAttachment> {
  if (file.size < 1) {
    throw new AttachmentUploadError("El archivo está vacío.", 422, "empty_file");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentUploadError("El archivo supera el límite de 10 MB.", 413, "file_too_large");
  }

  const declaredMime = file.type.toLowerCase().split(";", 1)[0].trim();
  const allowedExtensions = MIME_EXTENSIONS[declaredMime];
  if (!allowedExtensions) {
    throw new AttachmentUploadError("Tipo de archivo no permitido.", 415, "mime_not_allowed");
  }

  const safeFilename = sanitizeFilename(file.name, allowedExtensions[0]);
  const originalExtension = safeFilename.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions.includes(originalExtension)) {
    throw new AttachmentUploadError("La extensión no coincide con el tipo permitido.", 415, "extension_mismatch");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectMime(bytes);
  if (detectedMime !== declaredMime) {
    throw new AttachmentUploadError(
      "El contenido del archivo no coincide con el tipo declarado.",
      415,
      "signature_mismatch",
    );
  }

  const contentDigest = await sha256Bytes(bytes);
  const identityMaterial = new TextEncoder().encode(
    `${context.requestId}:${Array.from(contentDigest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
  );
  const id = uuidFromDigest(await sha256Bytes(identityMaterial));
  const extension = originalExtension === "jpeg" ? "jpeg" : allowedExtensions[0];

  return {
    ...context,
    id,
    storagePath: `${context.businessId}/${context.requestId}/${id}.${extension}`,
    fileName: safeFilename,
    mimeType: declaredMime,
    sizeBytes: file.size,
    bytes,
  };
}

function metadataMatches(metadata: AttachmentMetadata, prepared: PreparedAttachment) {
  return metadata.id === prepared.id
    && metadata.business_id === prepared.businessId
    && metadata.request_id === prepared.requestId
    && metadata.storage_path === prepared.storagePath
    && metadata.file_name === prepared.fileName
    && metadata.mime_type === prepared.mimeType
    && Number(metadata.size_bytes) === prepared.sizeBytes;
}

export async function persistAttachment(
  prepared: PreparedAttachment,
  dependencies: AttachmentDependencies,
) {
  const existing = await dependencies.findMetadata(prepared);
  if (existing) {
    if (!metadataMatches(existing, prepared)) {
      throw new AttachmentUploadError("El adjunto existente no coincide con el reintento.", 409, "replay_mismatch");
    }
    return { wasReplayed: true };
  }

  const upload = await dependencies.upload(prepared);
  if (upload.error) {
    const replay = await dependencies.findMetadata(prepared);
    if (replay && metadataMatches(replay, prepared)) return { wasReplayed: true };

    if (!await dependencies.objectExists(prepared)) {
      dependencies.log({ event: "attachment_upload", outcome: "storage_failed" });
      throw new AttachmentUploadError("No se pudo almacenar el archivo.", 502, "storage_failed");
    }
  }

  const metadata = await dependencies.insertMetadata(prepared);
  if (!metadata.error) return { wasReplayed: false };

  const replay = await dependencies.findMetadata(prepared);
  if (replay && metadataMatches(replay, prepared)) return { wasReplayed: true };

  const cleanup = await dependencies.remove(prepared);
  dependencies.log({
    event: "attachment_upload",
    outcome: cleanup.error ? "metadata_failed_cleanup_failed" : "metadata_failed_compensated",
    attachment_id: prepared.id,
  });
  throw new AttachmentUploadError(
    cleanup.error
      ? "No se pudo completar el adjunto y requiere revisión técnica."
      : "No se pudieron registrar los metadatos del archivo.",
    500,
    cleanup.error ? "metadata_failed_cleanup_failed" : "metadata_failed",
  );
}
