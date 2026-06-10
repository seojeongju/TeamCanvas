import { useEffect, useMemo, useState } from "react";
import { TaskEmptyState } from "./TaskEmptyState";
import { TaskFolderGroup } from "./TaskFolderGroup";
import { ListPagination } from "./ListPagination";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import {
  TASK_LIST_PAGE_SIZE,
  groupTasksByLabel,
  groupTasksByTitle,
  pageCount,
  paginateItems,
  type TaskFolderGroupData,
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

function folderGroupsForStatus(status: TaskStatus, tasks: Task[]): TaskFolderGroupData[] {
  if (status === "done") return groupTasksByLabel(tasks);
  return groupTasksByTitle(tasks);
}

function sectionHint(status: TaskStatus, folderGroups: TaskFolderGroupData[]): string | undefined {
  if (status === "done") return "라벨별 폴더";
  if (folderGroups.some((g) => g.tasks.length > 1)) return "제목별 폴더";
  return undefined;
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
        const folderGroups = folderGroupsForStatus(group.id, group.tasks);
        const rawPage = sectionPages[group.id] ?? 0;
        const totalSectionPages = pageCount(folderGroups.length);
        const sectionPage = clampPage(rawPage, totalSectionPages);
        const visibleFolders = paginateItems(folderGroups, sectionPage);
        const hint = sectionHint(group.id, folderGroups);

        return (
          <section key={group.id}>
            <SectionHeader
              label={group.label}
              status={group.id}
              count={group.tasks.length}
              hint={hint}
              page={sectionPage}
              totalPages={totalSectionPages}
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
                  byLabel={group.id === "done"}
                />
              ))}
            </div>
            <ListPagination
              page={sectionPage}
              totalPages={totalSectionPages}
              totalItems={folderGroups.length}
              pageSize={TASK_LIST_PAGE_SIZE}
              onPageChange={(page) => setSectionPage(group.id, page)}
              itemLabel={group.id === "done" ? "폴더" : "항목"}
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
  page,
  totalPages,
}: {
  label: string;
  status: TaskStatus;
  count: number;
  hint?: string;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} aria-hidden />
        <h3 className="text-sm font-semibold text-navy-800">{label}</h3>
        <span className="rounded-full bg-sky-100/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-navy-600">
          {count}
        </span>
        {hint && <span className="text-[10px] text-navy-400">· {hint}</span>}
      </div>
      {totalPages > 1 && (
        <span className="shrink-0 text-[10px] tabular-nums text-navy-500">
          {page + 1}/{totalPages} 페이지
        </span>
      )}
    </div>
  );
}
