import { useMemo, useState } from "react";
import { ChevronDown, Folder, Lock } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { colorClass, formatRecurrenceRule } from "../../lib/dates";
import {
  CALENDAR_LEGEND_COLORS,
  isPersonalGoogleEvent,
  personalGoogleEventClassName,
  splitCalendarEvents,
} from "../../lib/calendarEventSources";
import {
  eventListSubtitle,
  groupTodayEvents,
  type EventDisplayContext,
  type TodayEventGroup,
} from "../../lib/todayEventsGroup";
import type { CalendarEvent } from "../../lib/types";
import { cn } from "../../lib/cn";
import { calendarEventAriaLabel, eventPreviewTitle } from "../../lib/calendarEventUi";
import { useMemberNameMap } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import { useEventPreviewTooltip } from "./EventPreviewTooltip";

function TodayEventRow({
  event,
  onClick,
  compact,
  personal,
  displayCtx,
}: {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
  personal?: boolean;
  displayCtx: EventDisplayContext;
}) {
  const {
    triggerRef,
    tooltipId,
    tooltipVisible,
    tooltipPortal,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
  } = useEventPreviewTooltip(event);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onClick}
        aria-label={calendarEventAriaLabel(event, undefined, displayCtx)}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full cursor-pointer text-left transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/80"
      >
        <GlassCard
          className={cn(
            "flex items-center gap-3 transition hover:bg-sky-50/60 hover:shadow-md",
            compact ? "p-3" : "p-4",
            personal && "border border-red-200/80 bg-red-50/30",
          )}
        >
        <div
          className={cn(
            "w-1 shrink-0 rounded-full",
            colorClass(event.color),
            compact ? "min-h-8" : "min-h-10",
            personal && personalGoogleEventClassName(),
          )}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-navy-900", compact && "text-sm")}>{eventPreviewTitle(event)}</p>
          <p className="text-xs text-navy-600">{eventListSubtitle(event, displayCtx)}</p>
          {event.recurrenceRule && (
            <p className="mt-0.5 text-[11px] text-primary-600">
              반복: {formatRecurrenceRule(event.recurrenceRule)}
            </p>
          )}
        </div>
        {personal && <Lock className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />}
        </GlassCard>
      </button>
      {tooltipPortal}
    </>
  );
}

function TodayEventFolder({
  group,
  expanded,
  onToggle,
  onEventClick,
  personal,
  displayCtx,
}: {
  group: TodayEventGroup;
  expanded: boolean;
  onToggle: () => void;
  onEventClick: (event: CalendarEvent) => void;
  personal?: boolean;
  displayCtx: EventDisplayContext;
}) {
  const accentColor = group.items[0]?.color ?? "#4A9FE8";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white/50",
        personal ? "border-red-200/80" : "border-sky-100/80",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-sky-50/50"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            colorClass(accentColor),
            personal && personalGoogleEventClassName(),
          )}
        >
          <Folder className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-navy-900">{group.title}</p>
          <p className="text-xs text-navy-600">
            {group.items.length}건 · 탭하여 펼치기
            {personal ? " · 비공개" : ""}
          </p>
        </div>
        {personal && <Lock className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />}
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
              personal={personal}
              displayCtx={displayCtx}
              onClick={() => onEventClick(event)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodayEventGroupList({
  groups,
  expandedKeys,
  onToggleGroup,
  onEventClick,
  personal,
  displayCtx,
}: {
  groups: TodayEventGroup[];
  expandedKeys: Set<string>;
  onToggleGroup: (key: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  personal?: boolean;
  displayCtx: EventDisplayContext;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      {groups.map((group) =>
        group.items.length === 1 ? (
          <TodayEventRow
            key={group.items[0].id}
            event={group.items[0]}
            personal={personal}
            displayCtx={displayCtx}
            onClick={() => onEventClick(group.items[0])}
          />
        ) : (
          <TodayEventFolder
            key={group.key}
            group={group}
            personal={personal}
            displayCtx={displayCtx}
            expanded={expandedKeys.has(group.key)}
            onToggle={() => onToggleGroup(group.key)}
            onEventClick={onEventClick}
          />
        ),
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
  const viewerId = useAuthStore((s) => s.user?.id);
  const memberNames = useMemberNameMap();
  const displayCtx: EventDisplayContext = { viewerId, memberNames };
  const { teamEvents, personalGoogleEvents } = useMemo(() => splitCalendarEvents(events), [events]);
  const teamGroups = useMemo(() => groupTodayEvents(teamEvents), [teamEvents]);
  const personalGroups = useMemo(() => groupTodayEvents(personalGoogleEvents), [personalGoogleEvents]);
  const [expandedTeamKeys, setExpandedTeamKeys] = useState<Set<string>>(new Set());
  const [expandedPersonalKeys, setExpandedPersonalKeys] = useState<Set<string>>(new Set());

  const toggleTeamGroup = (key: string) => {
    setExpandedTeamKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePersonalGroup = (key: string) => {
    setExpandedPersonalKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {teamGroups.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-600">
            팀 · 내 일정
          </h3>
          <TodayEventGroupList
            groups={teamGroups}
            expandedKeys={expandedTeamKeys}
            onToggleGroup={toggleTeamGroup}
            onEventClick={onEventClick}
            displayCtx={displayCtx}
          />
        </section>
      )}

      {personalGroups.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-red-500" aria-hidden />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700">
              내 Google 일정
            </h3>
          </div>
          <p className="mb-2 text-[11px] text-navy-500">
            개인 일정입니다. 팀원에게 노출되지 않습니다.
          </p>
          <TodayEventGroupList
            groups={personalGroups}
            expandedKeys={expandedPersonalKeys}
            onToggleGroup={togglePersonalGroup}
            onEventClick={onEventClick}
            personal
            displayCtx={displayCtx}
          />
        </section>
      )}
    </div>
  );
}

/** 캘린더 뷰 범례용 */
export function CalendarSourceLegend({ hasPersonalGoogle }: { hasPersonalGoogle: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-navy-600">
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn("h-2.5 w-6 rounded", colorClass(CALENDAR_LEGEND_COLORS.teamApp))}
          aria-hidden
        />
        <span>
          팀 · 앱 일정
          <span className="ml-0.5 text-navy-400">(유형별 색상)</span>
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn("h-2.5 w-6 rounded ring-1 ring-white/30", colorClass(CALENDAR_LEGEND_COLORS.taskDue))}
          aria-hidden
        />
        업무 마감
      </span>
      {hasPersonalGoogle && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "h-2.5 w-6 rounded",
              colorClass(CALENDAR_LEGEND_COLORS.google),
              personalGoogleEventClassName(),
            )}
            aria-hidden
          />
          내 Google (비공개)
        </span>
      )}
    </div>
  );
}

export { isPersonalGoogleEvent };
