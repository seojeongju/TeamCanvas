import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { CreateTaskModal } from "../components/modals/CreateTaskModal";
import { useTasks, useUpdateTask } from "../hooks/useData";
import { cn } from "../lib/cn";
import type { Task } from "../lib/types";

const columns = [
  { id: "todo" as const, label: "할 일", color: "border-sky-300" },
  { id: "doing" as const, label: "진행 중", color: "border-primary-400" },
  { id: "done" as const, label: "완료", color: "border-emerald-400" },
];

export function TasksPage() {
  const { data } = useTasks();
  const updateTask = useUpdateTask();
  const [showCreate, setShowCreate] = useState(false);
  const tasks = data?.tasks ?? [];

  const cycleStatus = (task: Task) => {
    const next = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
    updateTask.mutate({ id: task.id, status: next });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="업무" subtitle="Kanban 보드" />

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="min-w-[260px] flex-1">
              <div className={cn("mb-3 flex items-center gap-2 border-l-4 pl-2", col.color)}>
                <h3 className="text-sm font-semibold text-navy-800">{col.label}</h3>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-600">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <GlassCard key={task.id} className="p-4" onClick={() => cycleStatus(task)}>
                    <p className="font-medium text-navy-900">{task.title}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-navy-600">
                      <span>{task.assignee}</span>
                      <span
                        className={cn(
                          "rounded-lg px-2 py-0.5",
                          task.due === "완료"
                            ? "bg-emerald-100 text-emerald-700"
                            : task.due === "오늘"
                              ? "bg-orange-100 text-orange-600"
                              : "bg-sky-100 text-navy-600",
                        )}
                      >
                        {task.due || "—"}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-navy-600/70">카드를 탭하면 상태가 변경됩니다</p>

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
