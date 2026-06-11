import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useEventLinkedTasks } from "../../hooks/useData";
import { TASK_COLUMNS } from "../../lib/taskUtils";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  TASK_COLUMNS.map((c) => [c.id, c.label]),
);

export function EventLinkedTasksSection({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useEventLinkedTasks(eventId);
  const tasks = data?.tasks ?? [];

  if (isLoading) {
    return <p className="mb-3 text-xs text-navy-500">연결된 업무 불러오는 중…</p>;
  }

  if (tasks.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-sky-100/80 bg-sky-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-navy-800">연결된 업무 ({tasks.length})</h3>
      </div>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => navigate(`/tasks?task=${encodeURIComponent(t.id)}`)}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 text-left hover:bg-white"
            >
              <span className="truncate text-sm font-medium text-navy-800">{t.title}</span>
              <span className="shrink-0 text-[10px] text-navy-500">
                {STATUS_LABEL[t.status] ?? t.status} · {t.assignee}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
