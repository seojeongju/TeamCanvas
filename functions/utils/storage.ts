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
