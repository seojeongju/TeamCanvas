import { useRef } from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "./Button";
import { useDeleteEntityFile, useEntityFiles, useUploadEntityFile } from "../../hooks/useData";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EntityFilesSection({
  entityType,
  entityId,
}: {
  entityType: "task" | "event";
  entityId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useEntityFiles(entityType, entityId);
  const upload = useUploadEntityFile();
  const remove = useDeleteEntityFile();
  const files = data?.files ?? [];

  const onPick = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    await upload.mutateAsync({ entityType, entityId, file });
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
          accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
          onChange={(e) => onPick(e.target.files)}
        />
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-navy-500">PDF, 이미지, 문서 등을 첨부할 수 있습니다.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-2xl bg-sky-50/80 px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-navy-500" />
              <a
                href={`/api/files/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-primary-600 hover:underline"
              >
                {f.filename}
              </a>
              <span className="shrink-0 text-[10px] text-navy-500">{formatSize(f.sizeBytes)}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
