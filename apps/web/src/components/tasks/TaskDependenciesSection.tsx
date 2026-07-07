import { useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import {
  useAddTaskDependency,
  useRemoveTaskDependency,
  useTaskDependencies,
  useTasks,
} from "../../hooks/useData";
import { taskStatusLabel } from "../../lib/statusVisuals";
import { cn } from "../../lib/cn";
import type { Task } from "../../lib/types";

export function TaskDependenciesSection({
  task,
}: {
  task: Task;
}) {
  const { data } = useTaskDependencies(task.id);
  const { data: tasksData } = useTasks();
  const add = useAddTaskDependency();
  const remove = useRemoveTaskDependency();
  const [pickId, setPickId] = useState("");

  const dependencies = data?.dependencies ?? [];
  const candidates = (tasksData?.tasks ?? []).filter(
    (t) => t.id !== task.id && !dependencies.some((d) => d.dependsOnTaskId === t.id),
  );

  const incomplete = dependencies.filter((d) => d.status !== "done");

  return (
    <div className="mt-4 border-t border-sky-100/80 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-navy-600" />
        <h3 className="text-sm font-semibold text-navy-800">
          선행 업무 {dependencies.length > 0 ? `(${dependencies.length})` : ""}
        </h3>
      </div>
      <p className="mb-3 text-xs text-navy-500">선행 업무가 완료되어야 이 업무를 완료할 수 있습니다.</p>

      {incomplete.length > 0 && (
        <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          미완료 선행 업무 {incomplete.length}건 — 완료 처리가 제한됩니다.
        </p>
      )}

      <div className="space-y-1.5">
        {dependencies.length === 0 ? (
          <p className="text-xs text-navy-500">연결된 선행 업무가 없습니다.</p>
        ) : (
          dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-sky-50/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy-800">{dep.title}</p>
                <p
                  className={cn(
                    "text-[10px] font-medium",
                    dep.status === "done" ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {taskStatusLabel(dep.status as Task["status"])}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove.mutate({ taskId: task.id, dependencyId: dep.id })}
                disabled={remove.isPending}
                className="shrink-0 rounded-lg p-1 text-navy-400 hover:bg-white hover:text-red-500"
                aria-label="의존성 제거"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {candidates.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2 text-xs text-navy-800"
          >
            <option value="">선행 업무 선택...</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            className="!min-h-9 shrink-0"
            disabled={!pickId || add.isPending}
            onClick={async () => {
              if (!pickId) return;
              await add.mutateAsync({ taskId: task.id, dependsOnTaskId: pickId });
              setPickId("");
            }}
          >
            <Plus className="h-4 w-4" />
            추가
          </Button>
        </div>
      )}
    </div>
  );
}
