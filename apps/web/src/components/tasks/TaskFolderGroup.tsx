import { useState } from "react";
import { ChevronDown, Folder } from "lucide-react";
import { TaskCard } from "./TaskCard";
import type { TaskTitleGroup } from "../../lib/taskGroup";
import type { Task, TaskStatus } from "../../lib/types";
import { cn } from "../../lib/cn";

export function TaskFolderGroup({
  group,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite,
}: {
  group: TaskTitleGroup;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (group.tasks.length === 1) {
    return (
      <TaskCard
        task={group.tasks[0]}
        onOpen={onOpen}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
        canWrite={canWrite}
        compact
      />
    );
  }

  const accent = group.tasks[0]?.status === "doing"
    ? "bg-primary-400"
    : group.tasks[0]?.status === "done"
      ? "bg-emerald-400"
      : "bg-sky-400";

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100/80 bg-white/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sky-50/50"
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Folder className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900">{group.title}</p>
          <p className="text-xs text-navy-600">{group.tasks.length}건 · 탭하여 펼치기</p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-700">
          {group.tasks.length}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-navy-500 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-sky-100/80 px-3 pb-3 pt-2">
          {group.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={onOpen}
              onEdit={onEdit}
              onStatusChange={onStatusChange}
              canWrite={canWrite}
              compact
              inFolder
            />
          ))}
        </div>
      )}
    </div>
  );
}
