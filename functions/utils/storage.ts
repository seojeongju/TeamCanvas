export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function logoExtension(mimeType: string): string | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return null;
}

export function orgLogoKey(orgId: string, ext: string): string {
  return `orgs/${orgId}/logo.${ext}`;
}
