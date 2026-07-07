import { useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "./Button";
import { ImageLightbox } from "./ImageLightbox";
import { useDeleteEntityFile, useEntityFiles, useUploadEntityFile } from "../../hooks/useData";
import { cn } from "../../lib/cn";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mimeType: string) {
  return mimeType.startsWith("image/");
}

export function EntityFilesSection({
  entityType,
  entityId,
}: {
  entityType: "task" | "event" | "project";
  entityId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useEntityFiles(entityType, entityId);
  const upload = useUploadEntityFile();
  const remove = useDeleteEntityFile();
  const files = data?.files ?? [];
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const onPick = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      await upload.mutateAsync({ entityType, entityId, file });
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-navy-600" />
          <h3 className="text-sm font-semibold text-navy-800">첨부파일 {files.length}</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="!min-h-8 !px-2 !py-1 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload className="h-3.5 w-3.5" />
          {upload.isPending ? "업로드 중..." : "추가"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onPick(e.dataTransfer.files);
        }}
        className={cn(
          "mb-3 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition",
          dragOver
            ? "border-primary-400 bg-primary-400/5"
            : "border-sky-200/80 bg-sky-50/30 hover:border-sky-300",
        )}
      >
        <p className="text-xs text-navy-500">파일·이미지를 여기에 놓거나 버튼으로 추가하세요</p>
        <p className="mt-1 text-[10px] text-navy-400">PDF, 이미지, 문서 · 최대 25MB</p>
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-navy-500">아직 첨부된 파일이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f) => {
            const image = isImageMime(f.mimeType);
            const fileUrl = `/api/files/${f.id}`;
            return (
              <div key={f.id} className="overflow-hidden rounded-2xl bg-sky-50/80">
                {image ? (
                  <button
                    type="button"
                    onClick={() => setLightbox({ src: fileUrl, alt: f.filename })}
                    className="block w-full"
                  >
                    <img
                      src={fileUrl}
                      alt={f.filename}
                      className="aspect-video w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : null}
                <div className="flex items-center gap-2 px-2 py-2">
                  {image ? (
                    <ImageIcon className="h-4 w-4 shrink-0 text-navy-500" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-navy-500" />
                  )}
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-xs text-primary-600 hover:underline"
                  >
                    {f.filename}
                  </a>
                  <button
                    type="button"
                    onClick={() => remove.mutate({ fileId: f.id, entityType, entityId })}
                    disabled={remove.isPending}
                    className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                    aria-label="첨부 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="px-2 pb-2 text-[10px] text-navy-400">{formatSize(f.sizeBytes)}</p>
              </div>
            );
          })}
        </div>
      )}

      <ImageLightbox
        src={lightbox?.src ?? ""}
        alt={lightbox?.alt ?? ""}
        open={!!lightbox}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
