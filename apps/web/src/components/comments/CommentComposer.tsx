import { useRef, useState } from "react";
import { ImagePlus, Paperclip } from "lucide-react";
import { Button } from "../ui/Button";
import { MentionTextarea } from "../ui/MentionTextarea";
import { AttachmentPreviewChips } from "./CommentAttachments";
import { useUploadEntityFile } from "../../hooks/useData";
import { cn } from "../../lib/cn";

type Member = { id: string; name: string };

type Props = {
  members?: Member[];
  placeholder?: string;
  disabled?: boolean;
  useMention?: boolean;
  onSubmit: (body: string) => Promise<{ id: string }>;
  entityType: "task" | "project";
  entityId: string;
  className?: string;
};

export function CommentComposer({
  members = [],
  placeholder = "댓글 입력... (@이름 멘션)",
  disabled,
  useMention = true,
  onSubmit,
  entityType,
  entityId,
  className,
}: Props) {
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadEntityFile();

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setPendingFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || submitting) return;
    if (!body.trim() && pendingFiles.length === 0) return;

    setSubmitting(true);
    try {
      const text = body.trim() || (pendingFiles.length > 0 ? "첨부 파일" : "");
      const created = await onSubmit(text);
      for (const file of pendingFiles) {
        await upload.mutateAsync({
          entityType,
          entityId,
          file,
          commentId: created.id,
        });
      }
      setBody("");
      setPendingFiles([]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={cn("space-y-2", className)} onSubmit={handleSubmit}>
      {useMention ? (
        <MentionTextarea
          value={body}
          onChange={setBody}
          members={members}
          placeholder={placeholder}
          rows={2}
          onPaste={(e) => {
            const items = e.clipboardData?.files;
            if (items?.length) {
              e.preventDefault();
              addFiles(items);
            }
          }}
        />
      ) : (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="min-h-[44px] w-full resize-none rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2 text-sm text-navy-900 outline-none focus:border-primary-400"
          onPaste={(e) => {
            const items = e.clipboardData?.files;
            if (items?.length) {
              e.preventDefault();
              addFiles(items);
            }
          }}
        />
      )}

      <AttachmentPreviewChips
        files={pendingFiles}
        onRemove={(index) => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-navy-700"
            aria-label="파일 첨부"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-navy-700"
            aria-label="이미지 첨부"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
            onChange={(e) => {
              addFiles(e.target.files);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={submitting || disabled || (!body.trim() && pendingFiles.length === 0)}
          className="shrink-0"
        >
          {submitting ? "등록 중..." : "등록"}
        </Button>
      </div>
    </form>
  );
}
