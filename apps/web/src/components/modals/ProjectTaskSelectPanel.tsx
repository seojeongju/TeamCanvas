import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTasks } from "../../hooks/useData";
import { taskStatusLabel } from "../../lib/statusVisuals";
import { cn } from "../../lib/cn";
import type { Project, Task } from "../../lib/types";

type Props = {
  projects: Project[];
  projectsLoading?: boolean;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  selectedTaskIds: Set<string>;
  onChangeTaskIds: (ids: Set<string>) => void;
  /** 업무 목록을 불러올 프로젝트. 내보내기에서는 원본(현재) 프로젝트 */
  taskSourceProjectId: string;
  projectSearchPlaceholder?: string;
  emptyProjectsText?: string;
};

export function ProjectTaskSelectPanel({
  projects,
  projectsLoading,
  selectedProjectId,
  onSelectProject,
  selectedTaskIds,
  onChangeTaskIds,
  taskSourceProjectId,
  projectSearchPlaceholder = "프로젝트 검색",
  emptyProjectsText = "선택할 프로젝트가 없습니다.",
}: Props) {
  const [query, setQuery] = useState("");
  const [tasksOpen, setTasksOpen] = useState(true);
  const [taskQuery, setTaskQuery] = useState("");

  const { data: tasksData, isLoading: tasksLoading } = useTasks(
    taskSourceProjectId ? { projectId: taskSourceProjectId } : undefined,
  );

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.description?.toLowerCase().includes(q) ?? false);
    });
  }, [projects, query]);

  const rootTasks = useMemo(() => {
    const list = (tasksData?.tasks ?? []).filter((t) => !t.parentTaskId);
    const q = taskQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [tasksData?.tasks, taskQuery]);

  useEffect(() => {
    setTaskQuery("");
    setTasksOpen(true);
  }, [taskSourceProjectId, selectedProjectId]);

  const toggleTask = (taskId: string) => {
    const next = new Set(selectedTaskIds);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    onChangeTaskIds(next);
  };

  const selectAllVisible = () => {
    onChangeTaskIds(new Set(rootTasks.map((t) => t.id)));
  };

  const clearTasks = () => onChangeTaskIds(new Set());

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={projectSearchPlaceholder}
        className="w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-primary-400"
      />

      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-sky-100/80 p-2">
        {projectsLoading ? (
          <p className="p-3 text-center text-sm text-navy-500">불러오는 중...</p>
        ) : filteredProjects.length === 0 ? (
          <p className="p-3 text-center text-sm text-navy-500">{emptyProjectsText}</p>
        ) : (
          filteredProjects.map((p) => {
            const selected = selectedProjectId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProject(p.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition",
                  selected ? "bg-primary-400/10" : "hover:bg-sky-50/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
                    selected ? "border-primary-500 bg-primary-500" : "border-sky-200",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-navy-900">{p.name}</span>
                  <span className="text-xs text-navy-500">
                    업무 {p.taskCount ?? 0}건 · 마일스톤 {p.milestoneCount ?? 0}건
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {selectedProjectId && taskSourceProjectId && (
        <div className="overflow-hidden rounded-xl border border-sky-100/80">
          <button
            type="button"
            onClick={() => setTasksOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 bg-sky-50/70 px-3 py-2.5 text-left"
          >
            <span className="text-sm font-medium text-navy-800">
              업무 선택
              <span className="ml-1.5 text-xs font-normal text-navy-500">
                {selectedTaskIds.size}/{rootTasks.length || (tasksData?.tasks?.length ?? 0)}건
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 text-navy-500 transition", tasksOpen && "rotate-180")}
            />
          </button>

          {tasksOpen && (
            <div className="space-y-2 p-2">
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={taskQuery}
                  onChange={(e) => setTaskQuery(e.target.value)}
                  placeholder="업무 검색"
                  className="min-w-0 flex-1 rounded-lg border border-sky-100/80 bg-white/70 px-2.5 py-1.5 text-xs text-navy-900 outline-none focus:border-primary-400"
                />
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium text-primary-600 hover:bg-primary-400/10"
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={clearTasks}
                  className="shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-medium text-navy-500 hover:bg-sky-50"
                >
                  해제
                </button>
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto">
                {tasksLoading ? (
                  <p className="p-3 text-center text-xs text-navy-500">업무 불러오는 중...</p>
                ) : rootTasks.length === 0 ? (
                  <p className="p-3 text-center text-xs text-navy-500">복사할 업무가 없습니다.</p>
                ) : (
                  rootTasks.map((task) => (
                    <TaskPickRow
                      key={task.id}
                      task={task}
                      checked={selectedTaskIds.has(task.id)}
                      onToggle={() => toggleTask(task.id)}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskPickRow({
  task,
  checked,
  onToggle,
}: {
  task: Task;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition",
        checked ? "bg-primary-400/10" : "hover:bg-sky-50/60",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-sky-200"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-navy-900">{task.title}</span>
        <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-navy-500">
          <span>{taskStatusLabel(task.status)}</span>
          {task.due && <span>· 마감 {task.due}</span>}
          {(task.subtaskCount ?? 0) > 0 && <span>· 하위 {task.subtaskCount}건</span>}
        </span>
      </span>
    </label>
  );
}
