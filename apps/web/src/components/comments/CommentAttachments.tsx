import { useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { ImageLightbox } from "../ui/ImageLightbox";
import type { EntityAttachment } from "../../lib/types";
import { cn } from "../../lib/cn";

function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CommentAttachments({ attachments }: { attachments: EntityAttachment[] }) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => isImageMime(a.mimeType));
  const files = attachments.filter((a) => !isImageMime(a.mimeType));

  return (
    <>
      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((f) => {
            const url = `/api/files/${f.id}`;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setLightbox({ src: url, alt: f.filename })}
                className="overflow-hidden rounded-xl ring-1 ring-sky-200/80 transition hover:ring-primary-300"
              >
                <img src={url} alt={f.filename} className="h-20 w-20 object-cover" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((f) => (
            <a
              key={f.id}
              href={`/api/files/${f.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-xs text-primary-600 hover:bg-white",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{f.filename}</span>
              <span className="shrink-0 text-navy-400">{formatSize(f.sizeBytes)}</span>
            </a>
          ))}
        </div>
      )}
      <ImageLightbox
        src={lightbox?.src ?? ""}
        alt={lightbox?.alt ?? ""}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

export function AttachmentPreviewChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${index}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-navy-700"
        >
          {file.type.startsWith("image/") ? (
            <ImageIcon className="h-3 w-3 shrink-0" />
          ) : (
            <FileText className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="shrink-0 text-navy-500 hover:text-red-600"
            aria-label="첨부 제거"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
