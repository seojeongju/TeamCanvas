import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import type { TaskLabel } from "../../lib/types";
import { cn } from "../../lib/cn";

export const LABEL_PRESET_COLORS = [
  "#4A9FE8",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

type LabelPillPickerProps = {
  title?: string;
  labels: TaskLabel[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  mode?: "single" | "multiple";
  onCreateLabel: (data: { name: string; color: string }) => Promise<TaskLabel>;
  onDeleteLabel?: (labelId: string) => Promise<unknown>;
  isCreating?: boolean;
  isDeleting?: boolean;
  emptyMessage?: string;
};

export function LabelPillPicker({
  title = "라벨",
  labels,
  selectedIds,
  onChange,
  mode = "multiple",
  onCreateLabel,
  onDeleteLabel,
  isCreating = false,
  isDeleting = false,
  emptyMessage = "라벨을 만들어 분류하세요.",
}: LabelPillPickerProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_PRESET_COLORS[0]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedSet = new Set(selectedIds);

  const toggleLabel = (label: TaskLabel) => {
    if (mode === "single") {
      if (!selectedSet.has(label.id)) onChange([label.id]);
      return;
    }
    const next = selectedSet.has(label.id)
      ? selectedIds.filter((id) => id !== label.id)
      : [...selectedIds, label.id];
    onChange(next);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await onCreateLabel({ name: newName.trim(), color: newColor });
    onChange(mode === "single" ? [created.id] : [...selectedIds, created.id]);
    setNewName("");
    setShowNew(false);
  };

  const handleDelete = async (label: TaskLabel) => {
    if (!onDeleteLabel) return;
    const ok = window.confirm(`"${label.name}" 라벨을 삭제할까요?\n연결된 프로젝트·일정에서도 제거됩니다.`);
    if (!ok) return;
    setDeletingId(label.id);
    try {
      await onDeleteLabel(label.id);
      if (selectedSet.has(label.id)) {
        onChange(selectedIds.filter((id) => id !== label.id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-navy-600" aria-hidden />
          <p className="text-sm font-medium text-navy-700">{title}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="!min-h-8 !px-2 !py-1 text-xs"
          onClick={() => setShowNew((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          새 라벨
        </Button>
      </div>

      {showNew && (
        <div className="mb-3 space-y-2 rounded-2xl bg-sky-50/80 p-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="라벨 이름"
          />
          <div className="flex flex-wrap gap-2">
            {LABEL_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full border-2",
                  newColor === c ? "border-navy-800" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`색상 ${c}`}
              />
            ))}
          </div>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !newName.trim()}
          >
            추가
          </Button>
        </div>
      )}

      {labels.length === 0 ? (
        <p className="text-xs text-navy-500">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label) => {
            const active = selectedSet.has(label.id);
            const isRemoving = deletingId === label.id;
            return (
              <div
                key={label.id}
                className={cn(
                  "inline-flex items-center overflow-hidden rounded-full transition",
                  active ? "text-white shadow-sm" : "bg-white/80 text-navy-700 ring-1 ring-sky-200",
                  isRemoving && "opacity-50",
                )}
                style={active ? { backgroundColor: label.color } : undefined}
              >
                <button
                  type="button"
                  onClick={() => toggleLabel(label)}
                  disabled={isRemoving || isDeleting}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium transition",
                    active && mode === "multiple" && "pr-1",
                  )}
                >
                  {label.name}
                </button>
                {onDeleteLabel && (
                  <button
                    type="button"
                    onClick={() => handleDelete(label)}
                    disabled={isRemoving || isDeleting}
                    className={cn(
                      "flex h-full items-center justify-center px-1.5 transition hover:bg-black/10",
                      active ? "text-white/90" : "text-navy-400 hover:text-red-600",
                    )}
                    aria-label={`${label.name} 라벨 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function findLabelIdByColor(labels: TaskLabel[], color: string): string | null {
  const match = labels.find((l) => l.color.toLowerCase() === color.toLowerCase());
  return match?.id ?? null;
}
