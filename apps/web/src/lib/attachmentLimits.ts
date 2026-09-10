/** 서버 ATTACHMENT_* 와 맞춤 — 클라이언트 사전 검증용 */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip,application/pdf,text/plain";

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

const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXT));

export function inferMimeFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return MIME_BY_EXT[ext] ?? null;
}

export function resolveAttachmentMime(filename: string, mimeType: string): string | null {
  if (mimeType && ALLOWED_MIME.has(mimeType)) return mimeType;
  const inferred = inferMimeFromFilename(filename);
  if (inferred && ALLOWED_MIME.has(inferred)) return inferred;
  return null;
}

export function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateAttachmentFile(file: File): { ok: true } | { ok: false; error: string } {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: `"${file.name}"은(는) 25MB를 초과합니다.` };
  }
  if (!resolveAttachmentMime(file.name, file.type)) {
    return {
      ok: false,
      error: `"${file.name}"은(는) 지원하지 않는 형식입니다. 이미지·PDF·문서·ZIP만 가능합니다.`,
    };
  }
  return { ok: true };
}

/** 스크린샷 등 이름 없는 붙여넣기 파일에 안전한 파일명 부여 */
export function normalizePastedFile(file: File): File {
  const hasRealName =
    file.name &&
    file.name !== "image.png" &&
    file.name !== "image.jpg" &&
    file.name !== "blob" &&
    !/^image\.(png|jpe?g|gif|webp)$/i.test(file.name);

  if (hasRealName) return file;

  const mime = resolveAttachmentMime(file.name, file.type) ?? file.type ?? "image/png";
  const ext =
    mime === "image/jpeg"
      ? "jpg"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/gif"
          ? "gif"
          : "png";
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  return new File([file], `붙여넣기-${stamp}.${ext}`, { type: mime });
}

/** clipboard에서 첨부 가능한 파일(주로 이미지) 추출 */
export function filesFromClipboardData(data: DataTransfer | null): File[] {
  if (!data) return [];

  const out: File[] = [];
  const items = data.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) out.push(normalizePastedFile(file));
    }
  }

  if (out.length === 0 && data.files?.length) {
    for (const file of Array.from(data.files)) {
      out.push(normalizePastedFile(file));
    }
  }

  return out;
}
