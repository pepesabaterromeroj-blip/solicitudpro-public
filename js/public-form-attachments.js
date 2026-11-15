(function attachPublicFormAttachments(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.PublicFormAttachments = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createPublicFormAttachments() {
  const MAX_ATTACHMENT_FILES = 5;
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_ATTACHMENT_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ]);

  function validateAttachmentSelection(fileList) {
    const files = Array.from(fileList || []);

    if (files.length > MAX_ATTACHMENT_FILES) {
      return `Selecciona como máximo ${MAX_ATTACHMENT_FILES} archivos.`;
    }

    if (files.some((file) => !ACCEPTED_ATTACHMENT_TYPES.includes(file.type))) {
      return "Algún archivo tiene un formato no permitido. Usa JPEG, PNG, WebP, HEIC, HEIF o PDF.";
    }

    if (files.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
      return "Cada archivo debe pesar como máximo 10 MB.";
    }

    return "";
  }

  function createAttachmentItems(fileList) {
    return Array.from(fileList || []).map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified || 0}-${index}`,
      file,
      status: "pending",
      error: "",
    }));
  }

  async function uploadOneAttachment(item, context) {
    const formData = (context.formDataFactory || (() => new FormData()))();
    formData.append("file", item.file);
    const url = `${context.endpoint}/${encodeURIComponent(context.businessSlug)}/${encodeURIComponent(context.formSlug)}/requests/${encodeURIComponent(context.reference)}/attachments`;
    const response = await context.fetchImpl(url, {
      method: "POST",
      headers: { "Idempotency-Key": context.idempotencyKey },
      body: formData,
    });
    await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error("attachment_upload_failed");
    }
  }

  async function uploadAttachmentsSequentially(items, context) {
    for (const item of items) {
      if (item.status === "success") {
        continue;
      }

      item.status = "uploading";
      item.error = "";
      context.onStatusChange?.(items);

      try {
        await uploadOneAttachment(item, context);
        item.status = "success";
      } catch {
        item.status = "error";
        item.error = "No se pudo subir este archivo.";
      }

      context.onStatusChange?.(items);
    }

    return items;
  }

  function retryFailedAttachments(items, context) {
    const failedItems = items.filter((item) => item.status === "error");
    const onStatusChange = context.onStatusChange;
    return uploadAttachmentsSequentially(failedItems, {
      ...context,
      onStatusChange: () => onStatusChange?.(items),
    }).then(() => items);
  }

  return {
    ACCEPTED_ATTACHMENT_TYPES,
    MAX_ATTACHMENT_BYTES,
    MAX_ATTACHMENT_FILES,
    createAttachmentItems,
    retryFailedAttachments,
    uploadAttachmentsSequentially,
    validateAttachmentSelection,
  };
});
