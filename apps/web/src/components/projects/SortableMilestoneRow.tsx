import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Trash2 } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { formatMilestoneDue, MILESTONE_STATUS_OPTIONS } from "../../lib/projectUtils";
import type { ProjectMilestone } from "../../lib/types";
import { cn } from "../../lib/cn";

type Props = {
  milestone: ProjectMilestone;
  canWrite: boolean;
  onToggleDone: (id: string, status: string) => void;
  onEdit: (m: ProjectMilestone) => void;
  onDelete: (id: string, title: string) => void;
};

export function SortableMilestoneRow({
  milestone: m,
  canWrite,
  onToggleDone,
  onEdit,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: m.id,
    disabled: !canWrite,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <GlassCard className="flex items-center gap-2 p-3">
        {canWrite && (
          <button
            type="button"
            className="shrink-0 touch-none rounded-lg p-1 text-navy-300 hover:text-navy-500"
            aria-label="순서 변경"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => onToggleDone(m.id, m.status)}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition",
            m.status === "done"
              ? "border-emerald-200 bg-emerald-500/15 text-emerald-600"
              : "border-sky-200 bg-white/60 text-navy-400 hover:border-primary-300",
            !canWrite && "opacity-60",
          )}
          aria-label={m.status === "done" ? "완료 취소" : "완료"}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => canWrite && onEdit(m)}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
        >
          <p
            className={cn(
              "font-medium text-navy-900",
              m.status === "done" && "text-navy-500 line-through",
            )}
          >
            {m.title}
          </p>
          <p className="text-xs text-navy-500">
            {MILESTONE_STATUS_OPTIONS.find((o) => o.value === m.status)?.label} ·{" "}
            {formatMilestoneDue(m.dueAt)}
          </p>
          {m.description?.trim() && (
            <p className="mt-0.5 line-clamp-2 text-xs text-navy-400">{m.description}</p>
          )}
        </button>
        {canWrite && (
          <>
            <button
              type="button"
              onClick={() => onEdit(m)}
              className="rounded-lg p-2 text-navy-500 hover:bg-sky-50 hover:text-primary-600"
              aria-label="수정"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(m.id, m.title)}
              className="rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
              aria-label="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </GlassCard>
    </div>
  );
}
