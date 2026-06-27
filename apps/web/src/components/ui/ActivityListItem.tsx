import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
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

type ActivityListItemProps = {
  actorName: string;
  summary: string;
  time: string;
  action: string;
  kind?: "task" | "project" | "audit";
  href?: string | null;
  className?: string;
  trailing?: ReactNode;
};

export function ActivityListItem({
  actorName,
  summary,
  time,
  action,
  kind,
  href,
  className,
  trailing,
}: ActivityListItemProps) {
  const tone = resolveActivityTone(action, summary);
  const Icon = activityToneIcon(action, kind);
  const Marker = activityToneMarkerIcon(tone);

  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 overflow-hidden rounded-xl",
        href && "transition hover:bg-sky-50/60",
        className,
      )}
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
      <div className="min-w-0 flex-1 py-2 pr-2">
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
        <p className={cn("mt-0.5", activityToneSummaryClass(tone))}>{summary}</p>
      </div>
      {trailing}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
