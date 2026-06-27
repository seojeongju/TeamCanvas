import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { ActivityListItem } from "../ui/ActivityListItem";
import { GlassCard } from "../ui/GlassCard";
import { useProjectActivities } from "../../hooks/useData";
import { cn } from "../../lib/cn";
import type { ProjectActivity } from "../../lib/types";

const ACTION_FILTERS = [
  { id: "all", label: "전체" },
  { id: "updated", label: "수정" },
  { id: "milestone", label: "마일스톤" },
  { id: "member", label: "멤버" },
] as const;

type ActionFilter = (typeof ACTION_FILTERS)[number]["id"];

function matchesFilter(action: string, filter: ActionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "updated") return action === "created" || action === "updated" || action === "ownership_transferred";
  if (filter === "milestone") return action.startsWith("milestone");
  if (filter === "member") return action.startsWith("member");
  return true;
}

export function ProjectActivitySection({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProjectActivities(projectId);
  const [filter, setFilter] = useState<ActionFilter>("all");

  const activities = useMemo(() => {
    const list = data?.activities ?? [];
    return list.filter((a) => matchesFilter(a.action, filter));
  }, [data?.activities, filter]);

  if (isLoading) {
    return <GlassCard className="p-4 text-sm text-navy-600">활동 이력 불러오는 중...</GlassCard>;
  }

  if (isError) {
    return <GlassCard className="p-4 text-sm text-red-500">활동 이력을 불러오지 못했습니다.</GlassCard>;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-sky-600" />
        <h2 className="text-sm font-semibold text-navy-800">활동 이력</h2>
        <span className="text-xs text-navy-500">{(data?.activities ?? []).length}건</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              filter === f.id
                ? "bg-primary-400/15 text-primary-700"
                : "bg-white/60 text-navy-600 hover:bg-white/90",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {activities.length === 0 ? (
        <GlassCard className="p-6 text-center text-sm text-navy-500">
          {filter === "all" ? "아직 기록된 활동이 없습니다." : "해당 유형의 활동이 없습니다."}
        </GlassCard>
      ) : (
        <div className="space-y-1">
          {activities.map((a: ProjectActivity) => (
            <GlassCard key={a.id} className="p-0">
              <ActivityListItem
                actorName={a.actorName}
                summary={a.summary}
                time={a.time}
                action={a.action}
                kind="project"
                className="px-2"
              />
            </GlassCard>
          ))}
        </div>
      )}
    </section>
  );
}
