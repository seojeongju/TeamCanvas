import { useState } from "react";
import { ListTree, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  useCreateTaskSubtask,
  useTaskSubtasks,
  useUpdateTaskSubtaskStatus,
} from "../../hooks/useData";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import { cn } from "../../lib/cn";
import type { TaskStatus } from "../../lib/types";

export function TaskSubtasksSection({ taskId }: { taskId: string }) {
  const { data } = useTaskSubtasks(taskId);
  const create = useCreateTaskSubtask();
  const updateStatus = useUpdateTaskSubtaskStatus();
  const [title, setTitle] = useState("");

  const subtasks = data?.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.status === "done").length;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({ taskId, title: title.trim() });
    setTitle("");
  };

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <ListTree className="h-4 w-4 text-navy-600" />
        <h3 className="text-sm font-semibold text-navy-800">
          서브태스크 {subtasks.length > 0 ? `${doneCount}/${subtasks.length}` : ""}
        </h3>
      </div>

      <div className="space-y-1.5">
        {subtasks.length === 0 ? (
          <p className="text-xs text-navy-500">하위 작업을 추가해 보세요.</p>
        ) : (
          subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-2 rounded-xl bg-sky-50/80 px-2 py-1.5"
            >
              <select
                value={sub.status}
                onChange={(e) =>
                  updateStatus.mutate({
                    subtaskId: sub.id,
                    parentTaskId: taskId,
                    status: e.target.value as TaskStatus,
                  })
                }
                className="shrink-0 rounded-lg border-0 bg-white/80 px-1.5 py-1 text-[10px] font-medium text-navy-700"
              >
                {TASK_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-sm",
                  sub.status === "done" ? "text-navy-400 line-through" : "text-navy-800",
                )}
              >
                {sub.title}
              </span>
              <span className="shrink-0 text-[10px] text-navy-400">{sub.assignee}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="서브태스크 제목"
          className="!min-h-9 flex-1 text-sm"
        />
        <Button type="submit" disabled={create.isPending || !title.trim()} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
