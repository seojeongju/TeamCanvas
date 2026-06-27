import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "../ui/GlassCard";
import { TaskEmptyState } from "./TaskEmptyState";
import { TaskFolderGroup } from "./TaskFolderGroup";
import { ListPagination } from "./ListPagination";
import { TaskStatusTabs, taskCountsByStatus } from "./TaskStatusTabs";
import { TASK_COLUMNS } from "../../lib/taskUtils";
import {
  TASK_LIST_PAGE_SIZE,
  groupTasksByLabel,
  groupTasksByTitle,
  pageCount,
  paginateItems,
  type TaskFolderGroupData,
} from "../../lib/taskGroup";
import type { Task, TaskStatus } from "../../lib/types";

interface TaskListViewProps {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onCreate?: () => void;
  canWrite?: boolean;
  statusTab?: TaskStatus;
  onStatusTabChange?: (status: TaskStatus) => void;
}

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

function tasksForStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks
    .filter((t) => t.status === status)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function TaskListView({
  tasks,
  onOpen,
  onEdit,
  onStatusChange,
  onCreate,
  canWrite = true,
  statusTab,
  onStatusTabChange,
}: TaskListViewProps) {
  const [internalTab, setInternalTab] = useState<TaskStatus>("todo");
  const activeTab = statusTab ?? internalTab;
  const setActiveTab = onStatusTabChange ?? setInternalTab;
  const [sectionPages, setSectionPages] = useState<Partial<Record<TaskStatus, number>>>({});

  const counts = useMemo(() => taskCountsByStatus(tasks), [tasks]);
  const activeColumn = TASK_COLUMNS.find((c) => c.id === activeTab)!;
  const activeTasks = useMemo(() => tasksForStatus(tasks, activeTab), [tasks, activeTab]);

  useEffect(() => {
    if (statusTab) setInternalTab(statusTab);
  }, [statusTab]);

  useEffect(() => {
    setSectionPages({});
  }, [tasks]);

  useEffect(() => {
    if (statusTab) return;
    if (counts[activeTab] > 0) return;
    const fallback = TASK_COLUMNS.find((c) => counts[c.id] > 0);
    if (fallback) setActiveTab(fallback.id);
  }, [counts, activeTab, statusTab, setActiveTab]);

  if (tasks.length === 0) {
    return <TaskEmptyState onCreate={onCreate} />;
  }

  const setSectionPage = (status: TaskStatus, page: number) => {
    setSectionPages((prev) => ({ ...prev, [status]: page }));
  };

  const folderGroups = folderGroupsForStatus(activeTab, activeTasks);
  const rawPage = sectionPages[activeTab] ?? 0;
  const totalSectionPages = pageCount(folderGroups.length);
  const sectionPage = clampPage(rawPage, totalSectionPages);
  const visibleFolders = paginateItems(folderGroups, sectionPage);
  const hint = sectionHint(activeTab, folderGroups);

  return (
    <div className="space-y-3">
      <TaskStatusTabs active={activeTab} onChange={setActiveTab} counts={counts} />

      <section role="tabpanel" aria-label={activeColumn.label}>
        {activeTasks.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-navy-600">
            {activeColumn.label} 업무가 없습니다
          </GlassCard>
        ) : (
          <>
            {(hint || totalSectionPages > 1) && (
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
                {hint ? <p className="text-xs text-navy-500">{hint}</p> : <span />}
                {totalSectionPages > 1 && (
                  <span className="shrink-0 text-[10px] tabular-nums text-navy-500">
                    {sectionPage + 1}/{totalSectionPages} 페이지
                  </span>
                )}
              </div>
            )}
            <div className="space-y-2">
              {visibleFolders.map((folderGroup) => (
                <TaskFolderGroup
                  key={`${activeTab}-${folderGroup.key}`}
                  group={folderGroup}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  canWrite={canWrite}
                  byLabel={activeTab === "done"}
                />
              ))}
            </div>
            <ListPagination
              page={sectionPage}
              totalPages={totalSectionPages}
              totalItems={folderGroups.length}
              pageSize={TASK_LIST_PAGE_SIZE}
              onPageChange={(page) => setSectionPage(activeTab, page)}
              itemLabel={activeTab === "done" ? "폴더" : "항목"}
            />
          </>
        )}
      </section>
    </div>
  );
}
