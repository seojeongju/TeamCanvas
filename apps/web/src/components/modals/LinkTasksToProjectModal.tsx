import { useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useLinkTasksToProject, useTasks } from "../../hooks/useData";
import { cn } from "../../lib/cn";
import type { Project } from "../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

export function LinkTasksToProjectModal({ open, onClose, project }: Props) {
  const { data, isLoading } = useTasks();
  const linkTasks = useLinkTasksToProject();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.tasks ?? []).filter((t) => {
      if (t.projectId) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data?.tasks, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setSelected(new Set());
    setQuery("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.size === 0) return;
    await linkTasks.mutateAsync({
      projectId: project.id,
      taskIds: [...selected],
    });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="기존 업무 연결">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-navy-600">
          프로젝트에 연결되지 않은 업무를 선택하세요. 이미 다른 프로젝트에 연결된 업무는 표시되지 않습니다.
        </p>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="업무 검색"
          className="w-full rounded-xl border border-sky-100/80 bg-white/70 px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-primary-400"
        />

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-sky-100/80 p-2">
          {isLoading ? (
            <p className="p-3 text-center text-sm text-navy-500">불러오는 중...</p>
          ) : available.length === 0 ? (
            <p className="p-3 text-center text-sm text-navy-500">연결 가능한 업무가 없습니다.</p>
          ) : (
            available.map((task) => {
              const checked = selected.has(task.id);
              return (
                <label
                  key={task.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition",
                    checked ? "bg-primary-400/10" : "hover:bg-sky-50/60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(task.id)}
                    className="mt-0.5 h-4 w-4 rounded border-sky-200"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-navy-900">{task.title}</span>
                    {task.assignee && (
                      <span className="text-xs text-navy-500">담당 {task.assignee}</span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <Button type="submit" fullWidth disabled={linkTasks.isPending || selected.size === 0}>
          {linkTasks.isPending ? "연결 중..." : `${selected.size}건 연결`}
        </Button>
      </form>
    </Modal>
  );
}
