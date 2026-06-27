import { useState } from "react";
import { ChevronDown, FolderKanban, History } from "lucide-react";
import { ActivityListItem } from "../ui/ActivityListItem";
import { useProjectActivities } from "../../hooks/useData";
import {
  activityToneBadgeClass,
  activityToneIconClass,
  resolveActivityTone,
} from "../../lib/statusVisuals";
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
  const latestTone = resolveActivityTone(latest.action, latest.summary);

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
            activityToneIconClass(latestTone),
          )}
        >
          <FolderKanban className="h-5 w-5" aria-hidden />
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
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            activityToneBadgeClass(latestTone),
          )}
        >
          {activities.length}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-navy-500 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="space-y-0.5 border-t border-sky-100/80 px-1 pb-2 pt-1">
          {activities.map((a) => (
            <ActivityListItem
              key={a.id}
              actorName={a.actorName}
              summary={a.summary}
              time={a.time}
              action={a.action}
              kind="project"
            />
          ))}
        </div>
      )}
    </div>
  );
}
