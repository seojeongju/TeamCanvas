import { useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateTaskLabel,
  useTaskLabels,
  useUpdateTask,
} from "../../hooks/useData";
import type { Task, TaskLabel } from "../../lib/types";
import { cn } from "../../lib/cn";

const PRESET_COLORS = ["#4A9FE8", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export function TaskLabelsSection({ task }: { task: Task }) {
  const { data: labelsData } = useTaskLabels();
  const createLabel = useCreateTaskLabel();
  const updateTask = useUpdateTask();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const allLabels = labelsData?.labels ?? [];
  const taskLabelIds = new Set((task.labels ?? []).map((l) => l.id));

  const toggleLabel = (label: TaskLabel) => {
    const next = taskLabelIds.has(label.id)
      ? (task.labels ?? []).filter((l) => l.id !== label.id).map((l) => l.id)
      : [...(task.labels ?? []).map((l) => l.id), label.id];
    updateTask.mutate({ id: task.id, labelIds: next });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await createLabel.mutateAsync({ name: newName.trim(), color: newColor });
    updateTask.mutate({
      id: task.id,
      labelIds: [...(task.labels ?? []).map((l) => l.id), created.id],
    });
    setNewName("");
    setShowNew(false);
  };

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-navy-600" />
          <h3 className="text-sm font-semibold text-navy-800">라벨</h3>
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
            {PRESET_COLORS.map((c) => (
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
          <Button type="button" onClick={handleCreate} disabled={createLabel.isPending || !newName.trim()}>
            추가
          </Button>
        </div>
      )}

      {allLabels.length === 0 ? (
        <p className="text-xs text-navy-500">라벨을 만들어 프로젝트를 분류하세요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {allLabels.map((label) => {
            const active = taskLabelIds.has(label.id);
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => toggleLabel(label)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition",
                  active ? "text-white shadow-sm" : "bg-white/80 text-navy-700 ring-1 ring-sky-200",
                )}
                style={active ? { backgroundColor: label.color } : undefined}
              >
                {label.name}
                {active && <X className="h-3 w-3 opacity-80" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
