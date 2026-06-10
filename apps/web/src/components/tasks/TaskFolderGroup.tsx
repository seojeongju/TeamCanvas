import { useEffect, useState } from "react";
import { ChevronDown, Folder, Tag } from "lucide-react";
import { TaskCard } from "./TaskCard";
import { ListPagination } from "./ListPagination";
import type { TaskFolderGroupData } from "../../lib/taskGroup";
import { TASK_LIST_PAGE_SIZE, pageCount, paginateItems } from "../../lib/taskGroup";
import type { Task, TaskStatus } from "../../lib/types";
import { colorClass } from "../../lib/dates";
import { cn } from "../../lib/cn";

const KNOWN_LABEL_BG = new Set([
  "bg-primary-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-orange-400",
  "bg-red-400",
  "bg-pink-400",
  "bg-red-500",
  "bg-sky-400",
]);

function folderAccentClass(group: TaskFolderGroupData): string {
  if (group.accentColor) {
    const cls = colorClass(group.accentColor);
    return KNOWN_LABEL_BG.has(cls) ? cls : "";
  }
  const status = group.tasks[0]?.status;
  if (status === "doing") return "bg-primary-400";
  if (status === "done") return "bg-emerald-400";
  return "bg-sky-400";
}

export function TaskFolderGroup({
  group,
  onOpen,
  onEdit,
  onStatusChange,
  canWrite,
  byLabel = false,
}: {
  group: TaskFolderGroupData;
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  canWrite: boolean;
  /** 라벨 폴더 UI (완료 프로젝트) */
  byLabel?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [innerPage, setInnerPage] = useState(0);

  useEffect(() => {
    setInnerPage(0);
  }, [group.key, group.tasks.length]);

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

  const accentClass = folderAccentClass(group);
  const accentStyle =
    group.accentColor && !accentClass ? { backgroundColor: group.accentColor } : undefined;
  const FolderIcon = byLabel ? Tag : Folder;
  const innerTotalPages = pageCount(group.tasks.length);
  const safeInnerPage = Math.max(0, Math.min(innerPage, innerTotalPages - 1));
  const visibleTasks = expanded ? paginateItems(group.tasks, safeInnerPage) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100/80 bg-white/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sky-50/50"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            accentClass,
          )}
          style={accentStyle}
        >
          <FolderIcon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900">{group.title}</p>
          <p className="text-xs text-navy-600">
            {group.tasks.length}건 · 탭하여 {expanded ? "접기" : "펼치기"}
          </p>
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
          {visibleTasks.map((task) => (
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
          <ListPagination
            page={safeInnerPage}
            totalPages={innerTotalPages}
            totalItems={group.tasks.length}
            pageSize={TASK_LIST_PAGE_SIZE}
            onPageChange={setInnerPage}
            itemLabel="건"
          />
        </div>
      )}
    </div>
  );
}
