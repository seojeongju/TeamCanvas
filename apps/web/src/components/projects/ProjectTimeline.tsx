import { useMemo } from "react";
import type { Project, ProjectMilestone } from "../../lib/types";
import { formatMilestoneDue } from "../../lib/projectUtils";
import { cn } from "../../lib/cn";

type Props = {
  project: Project;
  milestones: ProjectMilestone[];
};

type TimelineItem = {
  id: string;
  label: string;
  at: number;
  kind: "start" | "milestone" | "end" | "today";
  done?: boolean;
};

export function ProjectTimeline({ project, milestones }: Props) {
  const { items, rangeStart, rangeEnd } = useMemo(() => {
    const points: TimelineItem[] = [];
    if (project.startAt) points.push({ id: "start", label: "시작", at: project.startAt, kind: "start" });
    for (const m of milestones) {
      if (m.dueAt) {
        points.push({
          id: m.id,
          label: m.title,
          at: m.dueAt,
          kind: "milestone",
          done: m.status === "done",
        });
      }
    }
    if (project.endAt) points.push({ id: "end", label: "종료", at: project.endAt, kind: "end" });

    if (points.length === 0) return { items: [], rangeStart: 0, rangeEnd: 0 };

    const sorted = [...points].sort((a, b) => a.at - b.at);
    const min = sorted[0].at;
    const max = sorted[sorted.length - 1].at;
    const pad = Math.max((max - min) * 0.05, 86400000);
    const rangeStart = min - pad;
    const rangeEnd = max + pad;

    const now = Date.now();
    const withToday =
      now >= rangeStart && now <= rangeEnd
        ? [...sorted, { id: "today", label: "오늘", at: now, kind: "today" as const }]
        : sorted;

    return { items: withToday.sort((a, b) => a.at - b.at), rangeStart, rangeEnd };
  }, [project, milestones]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-navy-500">
        시작일·종료일 또는 마일스톤 기한을 설정하면 타임라인이 표시됩니다.
      </p>
    );
  }

  const span = rangeEnd - rangeStart || 1;
  const pct = (at: number) => Math.min(100, Math.max(0, ((at - rangeStart) / span) * 100));

  return (
    <div className="space-y-3">
      <div className="relative h-2 rounded-full bg-sky-100/80">
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-80"
          style={{
            width: `${pct(project.endAt ?? items[items.length - 1].at)}%`,
            backgroundColor: project.color,
          }}
        />
        {items.map((item) => (
          <span
            key={item.id}
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm",
              item.kind === "today" && "h-3.5 w-3.5 bg-amber-400 border-amber-200 z-10",
              item.kind === "start" && "bg-emerald-500",
              item.kind === "end" && "bg-navy-500",
              item.kind === "milestone" && (item.done ? "bg-emerald-500" : "bg-primary-400"),
            )}
            style={{ left: `${pct(item.at)}%` }}
            title={`${item.label} · ${formatMilestoneDue(item.at)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-navy-600">
        {items.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                item.kind === "today" && "bg-amber-400",
                item.kind === "start" && "bg-emerald-500",
                item.kind === "end" && "bg-navy-500",
                item.kind === "milestone" && (item.done ? "bg-emerald-500" : "bg-primary-400"),
              )}
            />
            {item.label}
            <span className="text-navy-400">{formatMilestoneDue(item.at)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
