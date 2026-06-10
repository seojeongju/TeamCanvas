import { useEffect, useMemo, useState } from "react";
import { TaskCard } from "./TaskCard";
import { TaskEmptyState } from "./TaskEmptyState";
import { TaskFolderGroup } from "./TaskFolderGroup";
import { ListPagination } from "./ListPagination";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import {
  TASK_LIST_PAGE_SIZE,
  groupTasksByLabel,
  pageCount,
  paginateItems,
} from "../../lib/taskGroup";
import { cn } from "../../lib/cn";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskListViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onCreate?: () => void;
  canWrite?: boolean;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-sky-400",
  doing: "bg-primary-400",
  done: "bg-emerald-400",
};

function clampPage(page: number, totalPages: number): number {
  return Math.max(0, Math.min(page, totalPages - 1));
}

export function TaskListView({
  tasks,
  onOpen,
  onEdit,
  onStatusChange,
  onCreate,
  canWrite = true,
}: TaskListViewProps) {
  const [sectionPages, setSectionPages] = useState<Partial<Record<TaskStatus, number>>>({});

  const grouped = useMemo(
    () =>
      TASK_COLUMNS.map((col) => ({
        ...col,
        tasks: tasks
          .filter((t) => t.status === col.id)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      })).filter((g) => g.tasks.length > 0),
    [tasks],
  );

  useEffect(() => {
    setSectionPages({});
  }, [tasks]);

  if (tasks.length === 0) {
    return <TaskEmptyState onCreate={onCreate} />;
  }

  const setSectionPage = (status: TaskStatus, page: number) => {
    setSectionPages((prev) => ({ ...prev, [status]: page }));
  };

  return (
    <div className="space-y-4">
      {grouped.map((group) => {
        const rawPage = sectionPages[group.id] ?? 0;

        if (group.id === "done") {
          const folderGroups = groupTasksByLabel(group.tasks);
          const totalSectionPages = pageCount(folderGroups.length);
          const sectionPage = clampPage(rawPage, totalSectionPages);
          const visibleFolders = paginateItems(folderGroups, sectionPage);

          return (
            <section key={group.id}>
              <SectionHeader
                label={group.label}
                status={group.id}
                count={group.tasks.length}
                hint="라벨별 폴더"
              />
              <div className="space-y-2">
                {visibleFolders.map((folderGroup) => (
                  <TaskFolderGroup
                    key={`${group.id}-${folderGroup.key}`}
                    group={folderGroup}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onStatusChange={onStatusChange}
                    canWrite={canWrite}
                    byLabel
                  />
                ))}
              </div>
              <ListPagination
                page={sectionPage}
                totalPages={totalSectionPages}
                totalItems={folderGroups.length}
                pageSize={TASK_LIST_PAGE_SIZE}
                onPageChange={(page) => setSectionPage(group.id, page)}
                itemLabel="폴더"
              />
            </section>
          );
        }

        const totalSectionPages = pageCount(group.tasks.length);
        const sectionPage = clampPage(rawPage, totalSectionPages);
        const visibleTasks = paginateItems(group.tasks, sectionPage);

        return (
          <section key={group.id}>
            <SectionHeader label={group.label} status={group.id} count={group.tasks.length} />
            <div className="space-y-2">
              {visibleTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  canWrite={canWrite}
                  compact
                />
              ))}
            </div>
            <ListPagination
              page={sectionPage}
              totalPages={totalSectionPages}
              totalItems={group.tasks.length}
              pageSize={TASK_LIST_PAGE_SIZE}
              onPageChange={(page) => setSectionPage(group.id, page)}
            />
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({
  label,
  status,
  count,
  hint,
}: {
  label: string;
  status: TaskStatus;
  count: number;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-0.5">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
        <h3 className="text-sm font-semibold text-navy-800">{label}</h3>
        <span className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-navy-600">
          {count}
        </span>
        {hint && <span className="text-[10px] text-navy-400">· {hint}</span>}
      </div>
    </div>
  );
}
