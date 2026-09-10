import { useRef } from "react";
import { FileText, ImageIcon, Paperclip, Upload, X } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  ATTACHMENT_ACCEPT,
  formatAttachmentSize,
  isImageMime,
  validateAttachmentFile,
} from "../../lib/attachmentLimits";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string | null;
  onError?: (message: string | null) => void;
  disabled?: boolean;
};

/**
 * 생성 모달용 — 저장 전 로컬 파일 선택. 엔티티 생성 후 업로드한다.
 */
export function PendingAttachmentsField({
  files,
  onChange,
  error,
  onError,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    let lastError: string | null = null;
    for (const file of Array.from(list)) {
      const check = validateAttachmentFile(file);
      if (!check.ok) {
        lastError = check.error;
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    onChange(next);
    onError?.(lastError);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
    onError?.(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-sm font-medium text-navy-700">
          <Paperclip className="h-3.5 w-3.5" />
          첨부파일 (선택)
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-400/10 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          파일 추가
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ATTACHMENT_ACCEPT}
          disabled={disabled}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!disabled) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed px-3 py-4 text-center transition",
          "border-sky-200/80 bg-sky-50/30",
        )}
      >
        <p className="text-xs text-navy-500">이미지·PDF·문서를 놓거나 추가하세요</p>
        <p className="mt-0.5 text-[10px] text-navy-400">파일당 최대 25MB</p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, index) => {
            const image = isImageMime(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-2 rounded-xl bg-sky-50/80 px-2.5 py-2"
              >
                {image ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-navy-500" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-navy-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-navy-800">{file.name}</p>
                  <p className="text-[10px] text-navy-400">{formatAttachmentSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  disabled={disabled}
                  className="rounded-lg p-1 text-navy-400 hover:bg-white hover:text-red-500"
                  aria-label="첨부 제거"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
