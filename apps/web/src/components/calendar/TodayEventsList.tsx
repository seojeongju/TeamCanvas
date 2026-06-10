import { useMemo, useState } from "react";
import { ChevronDown, Folder } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import {
  eventListSubtitle,
  groupTodayEvents,
  type TodayEventGroup,
} from "../../lib/todayEventsGroup";
import type { CalendarEvent } from "../../lib/types";
import { cn } from "../../lib/cn";

function TodayEventRow({
  event,
  onClick,
  compact,
}: {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <GlassCard
        className={cn(
          "flex items-center gap-3 transition hover:bg-sky-50/50",
          compact ? "p-3" : "p-4",
        )}
      >
        <div className={cn("w-1 shrink-0 rounded-full", colorClass(event.color), compact ? "min-h-8" : "min-h-10")} />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-navy-900", compact && "text-sm")}>{event.title}</p>
          <p className="text-xs text-navy-600">{eventListSubtitle(event)}</p>
          {event.recurrenceRule && (
            <p className="mt-0.5 text-[11px] text-primary-600">
              반복: {formatRecurrenceRule(event.recurrenceRule)}
            </p>
          )}
        </div>
      </GlassCard>
    </button>
  );
}

function TodayEventFolder({
  group,
  expanded,
  onToggle,
  onEventClick,
}: {
  group: TodayEventGroup;
  expanded: boolean;
  onToggle: () => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const accentColor = group.items[0]?.color ?? "#4A9FE8";

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100/80 bg-white/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sky-50/50"
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", colorClass(accentColor))}>
          <Folder className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900">{group.title}</p>
          <p className="text-xs text-navy-600">{group.items.length}건 · 탭하여 펼치기</p>
        </div>
        <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-navy-700">
          {group.items.length}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-navy-500 transition", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="space-y-1.5 border-t border-sky-100/80 px-3 pb-3 pt-2">
          {group.items.map((event) => (
            <TodayEventRow
              key={event.id}
              event={event}
              compact
              onClick={() => onEventClick(event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TodayEventsList({
  events,
  onEventClick,
}: {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}) {
  const groups = useMemo(() => groupTodayEvents(events), [events]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {groups.map((group) =>
        group.items.length === 1 ? (
          <TodayEventRow
            key={group.items[0].id}
            event={group.items[0]}
            onClick={() => onEventClick(group.items[0])}
          />
        ) : (
          <TodayEventFolder
            key={group.key}
            group={group}
            expanded={expandedKeys.has(group.key)}
            onToggle={() => toggleGroup(group.key)}
            onEventClick={onEventClick}
          />
        ),
      )}
    </div>
  );
}
