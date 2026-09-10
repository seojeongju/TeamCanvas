export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

/** 브라우저가 file.type을 비워 보내는 경우 확장자로 MIME 추론 */
export function resolveAttachmentMime(filename: string, mimeType: string): string | null {
  if (mimeType && ATTACHMENT_MIME_TYPES.has(mimeType)) return mimeType;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  const inferred = MIME_BY_EXT[ext];
  if (inferred && ATTACHMENT_MIME_TYPES.has(inferred)) return inferred;
  return null;
}

export function logoExtension(mimeType: string): string | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export function attachmentExtension(filename: string, mimeType: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "text/plain": "txt",
  };
  return map[mimeType] ?? "bin";
}

export function orgLogoKey(orgId: string, ext: string): string {
  return `orgs/${orgId}/logo.${ext}`;
}

export function attachmentKey(
  orgId: string,
  entityType: string,
  entityId: string,
  fileId: string,
  ext: string,
): string {
  return `orgs/${orgId}/attachments/${entityType}/${entityId}/${fileId}.${ext}`;
}
