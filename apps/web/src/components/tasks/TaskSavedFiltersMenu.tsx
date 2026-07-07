import { useState } from "react";
import { Bookmark, ChevronDown, Trash2 } from "lucide-react";
import {
  useCreateTaskSavedFilter,
  useDeleteTaskSavedFilter,
  useTaskSavedFilters,
} from "../../hooks/useData";
import type { TaskFilters, TaskSavedFilter } from "../../lib/types";
import { cn } from "../../lib/cn";

type Props = {
  filters: TaskFilters;
  onApply: (filters: TaskFilters) => void;
};

function normalizeSavedFilters(raw: Record<string, unknown>): TaskFilters {
  const next: TaskFilters = { assignee: "all" };
  if (raw.assignee === "me" || raw.assignee === "all") next.assignee = raw.assignee;
  if (typeof raw.teamId === "string" && raw.teamId) next.teamId = raw.teamId;
  if (typeof raw.projectId === "string" && raw.projectId) next.projectId = raw.projectId;
  if (
    raw.status === "todo" ||
    raw.status === "doing" ||
    raw.status === "on_hold" ||
    raw.status === "done"
  ) {
    next.status = raw.status;
  }
  if (raw.overdue === true) next.overdue = true;
  if (raw.dueToday === true) next.dueToday = true;
  if (typeof raw.labelId === "string" && raw.labelId) next.labelId = raw.labelId;
  return next;
}

export function TaskSavedFiltersMenu({ filters, onApply }: Props) {
  const { data } = useTaskSavedFilters();
  const create = useCreateTaskSavedFilter();
  const remove = useDeleteTaskSavedFilter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const saved = (data?.filters ?? []).map((f) => ({
    ...f,
    filters: normalizeSavedFilters(f.filters as unknown as Record<string, unknown>),
  })) as TaskSavedFilter[];

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await create.mutateAsync({ name: trimmed, filters });
    setName("");
    setOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition",
          open
            ? "bg-primary-400 text-white"
            : "bg-white/80 text-navy-700 ring-1 ring-sky-100/90 hover:bg-white",
        )}
      >
        <Bookmark className="h-3.5 w-3.5" />
        저장 필터
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-2xl bg-white p-2 shadow-lg ring-1 ring-sky-100">
            {saved.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-navy-500">저장된 필터가 없습니다.</p>
            ) : (
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {saved.map((item) => (
                  <li key={item.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onApply(item.filters);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs text-navy-700 hover:bg-sky-50"
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(item.id)}
                      className="rounded-lg p-1 text-navy-400 hover:text-red-500"
                      aria-label="필터 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 border-t border-sky-100 pt-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="현재 필터 이름..."
                className="w-full rounded-lg border border-sky-100 px-2 py-1.5 text-xs outline-none focus:border-primary-400"
              />
              <button
                type="button"
                disabled={create.isPending || !name.trim()}
                onClick={() => void handleSave()}
                className="mt-1.5 w-full rounded-lg bg-primary-400 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                현재 필터 저장
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
