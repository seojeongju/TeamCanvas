import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import {
  activityActionLabel,
  formatActivityDateTime,
  parseActivitySummaryDetails,
} from "../../lib/activityDetails";
import {
  activityToneAccentClass,
  activityToneBadgeClass,
  activityToneIcon,
  activityToneIconClass,
  activityToneLabel,
  activityToneMarkerIcon,
  activityToneSummaryClass,
  resolveActivityTone,
} from "../../lib/statusVisuals";

type ExpandableActivityItemProps = {
  actorName: string;
  summary: string;
  time: string;
  action: string;
  createdAt?: number;
  field?: string | null;
  kind?: "task" | "project" | "audit";
  className?: string;
  defaultExpanded?: boolean;
  trailing?: ReactNode;
};

export function ExpandableActivityItem({
  actorName,
  summary,
  time,
  action,
  createdAt,
  field,
  kind,
  className,
  defaultExpanded = false,
  trailing,
}: ExpandableActivityItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const tone = resolveActivityTone(action, summary);
  const Icon = activityToneIcon(action, kind);
  const Marker = activityToneMarkerIcon(tone);
  const details = parseActivitySummaryDetails(summary);
  const actionLabel = activityActionLabel(action, kind);

  return (
    <div className={cn("overflow-hidden rounded-xl", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 text-left transition hover:bg-sky-50/60"
      >
        <div className={cn("mt-2 h-8 w-1 shrink-0 rounded-full", activityToneAccentClass(tone))} />
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            activityToneIconClass(tone),
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 py-2 pr-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-navy-800">{actorName}</span>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                activityToneBadgeClass(tone),
              )}
            >
              <Marker className="h-3 w-3" aria-hidden />
              {activityToneLabel(tone)}
            </span>
            <span className="text-[10px] text-navy-400">{time}</span>
          </div>
          <p className={cn("mt-0.5 line-clamp-2", activityToneSummaryClass(tone))}>{summary}</p>
        </div>
        {trailing}
        <ChevronDown
          className={cn(
            "mt-2.5 mr-2 h-4 w-4 shrink-0 text-navy-400 transition",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <div
          id={panelId}
          className="border-t border-sky-100/80 bg-sky-50/40 px-3 py-3 pl-[3.25rem]"
        >
          <dl className="space-y-2 text-xs">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 font-medium text-navy-500">유형</dt>
              <dd className="min-w-0 text-navy-800">{actionLabel}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 font-medium text-navy-500">작성자</dt>
              <dd className="min-w-0 text-navy-800">{actorName}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 font-medium text-navy-500">시각</dt>
              <dd className="min-w-0 text-navy-800">
                {createdAt != null ? formatActivityDateTime(createdAt) : time}
              </dd>
            </div>
            {field && (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 font-medium text-navy-500">필드</dt>
                <dd className="min-w-0 text-navy-800">{field}</dd>
              </div>
            )}
            {details.map((row) => (
              <div key={`${row.label}-${row.value}`} className="flex gap-3">
                <dt className="w-16 shrink-0 font-medium text-navy-500">{row.label}</dt>
                <dd className="min-w-0 text-navy-800">
                  {row.before != null && row.after != null ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-navy-500 line-through">
                        {row.before}
                      </span>
                      <span className="text-navy-400" aria-hidden>
                        →
                      </span>
                      <span className="rounded-md bg-primary-400/10 px-1.5 py-0.5 font-medium text-primary-700">
                        {row.after}
                      </span>
                    </span>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
