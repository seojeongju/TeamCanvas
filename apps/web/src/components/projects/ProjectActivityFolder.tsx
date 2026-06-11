import { useState } from "react";
import { ChevronDown, FolderKanban, History } from "lucide-react";
import { useProjectActivities } from "../../hooks/useData";
import { cn } from "../../lib/cn";

export function ProjectActivityFolder({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectActivities(projectId);
  const [expanded, setExpanded] = useState(false);
  const activities = data?.activities ?? [];

  if (isLoading) {
    return <p className="text-xs text-navy-500">활동 이력 불러오는 중...</p>;
  }

  if (activities.length === 0) {
    return (
      <p className="rounded-xl bg-sky-50/50 px-3 py-2 text-xs text-navy-500">
        아직 기록된 활동이 없습니다.
      </p>
    );
  }

  const latest = activities[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100/80 bg-white/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sky-50/50"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/90">
          <FolderKanban className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">
            <History className="h-4 w-4 text-sky-600" />
            활동 이력
          </p>
          <p className="truncate text-xs text-navy-600">
            {activities.length}건 · {latest.actorName} · {latest.summary}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-700">
          {activities.length}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-navy-500 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-sky-100/80 px-3 pb-3 pt-2">
          {activities.map((a) => (
            <div key={a.id} className="rounded-xl bg-sky-50/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-navy-800">{a.actorName}</span>
                <span className="text-[10px] text-navy-500">{a.time}</span>
              </div>
              <p className="mt-0.5 text-sm text-navy-700">{a.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
