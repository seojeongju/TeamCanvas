import { useMemo } from "react";
import type { Project, ProjectMilestone, Task } from "../../lib/types";
import { formatMilestoneDue } from "../../lib/projectUtils";
import { cn } from "../../lib/cn";

type GanttRow = {
  id: string;
  label: string;
  startAt: number;
  endAt: number;
  kind: "milestone" | "task";
  done: boolean;
};

type Props = {
  project: Project;
  milestones: ProjectMilestone[];
  tasks: Task[];
};

export function ProjectGanttChart({ project, milestones, tasks }: Props) {
  const { rows, rangeStart, rangeEnd, weekLabels } = useMemo(() => {
    const rows: GanttRow[] = [];
    const projectStart = project.startAt ?? Date.now();

    for (const m of milestones) {
      if (!m.dueAt) continue;
      rows.push({
        id: m.id,
        label: m.title,
        startAt: projectStart,
        endAt: m.dueAt,
        kind: "milestone",
        done: m.status === "done",
      });
    }

    for (const t of tasks) {
      if (!t.dueAt || t.status === "done") continue;
      const endAt = t.dueAt;
      const startAt = endAt - 3 * 86400000;
      rows.push({
        id: t.id,
        label: t.title,
        startAt: Math.max(startAt, projectStart),
        endAt,
        kind: "task",
        done: false,
      });
    }

    if (project.endAt) {
      // ensure range includes project end
    }

    const allDates = [
      project.startAt,
      project.endAt,
      ...rows.map((r) => r.startAt),
      ...rows.map((r) => r.endAt),
    ].filter((d): d is number => d != null);

    if (allDates.length === 0) {
      return { rows: [], rangeStart: 0, rangeEnd: 0, weekLabels: [] as { at: number; label: string }[] };
    }

    const min = Math.min(...allDates);
    const max = Math.max(...allDates);
    const pad = Math.max((max - min) * 0.04, 86400000);
    const rangeStart = min - pad;
    const rangeEnd = max + pad;

    const weekLabels: { at: number; label: string }[] = [];
    const weekMs = 7 * 86400000;
    let cursor = rangeStart;
    while (cursor <= rangeEnd) {
      const d = new Date(cursor);
      weekLabels.push({
        at: cursor,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
      cursor += weekMs;
    }

    return { rows: rows.sort((a, b) => a.endAt - b.endAt), rangeStart, rangeEnd, weekLabels };
  }, [project, milestones, tasks]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-navy-500">
        마일스톤 기한 또는 미완료 업무 마감일이 있으면 Gantt 차트가 표시됩니다.
      </p>
    );
  }

  const span = rangeEnd - rangeStart || 1;
  const pct = (at: number) => Math.min(100, Math.max(0, ((at - rangeStart) / span) * 100));
  const barStyle = (row: GanttRow) => {
    const left = pct(row.startAt);
    const width = Math.max(pct(row.endAt) - left, 1.5);
    return { left: `${left}%`, width: `${width}%` };
  };

  return (
    <div className="space-y-3 overflow-x-auto">
      <div className="min-w-[280px]">
        <div className="relative mb-2 flex h-6 border-b border-sky-100/80 text-[10px] text-navy-400">
          {weekLabels.map((w) => (
            <span
              key={w.at}
              className="absolute -translate-x-1/2"
              style={{ left: `${pct(w.at)}%` }}
            >
              {w.label}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <div className="w-28 shrink-0 truncate text-xs text-navy-700" title={row.label}>
                <span
                  className={cn(
                    "mr-1 inline-block h-1.5 w-1.5 rounded-full",
                    row.kind === "milestone" ? "bg-primary-400" : "bg-orange-400",
                  )}
                />
                {row.label}
              </div>
              <div className="relative h-6 min-w-0 flex-1 rounded-lg bg-sky-50/80">
                <div
                  className={cn(
                    "absolute top-1 bottom-1 rounded-md opacity-90",
                    row.done && "opacity-50",
                    row.kind === "milestone" ? "bg-primary-400/70" : "bg-orange-400/60",
                  )}
                  style={barStyle(row)}
                  title={`${row.label} · ${formatMilestoneDue(row.endAt)}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-3 text-[10px] text-navy-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary-400" /> 마일스톤
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" /> 업무 마감
          </span>
        </div>
      </div>
    </div>
  );
}
