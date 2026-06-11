import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, MapPin } from "lucide-react";
import { cn } from "../../lib/cn";
import { buildEventPreviewMeta } from "../../lib/calendarEventUi";
import { isPersonalGoogleEvent } from "../../lib/calendarEventSources";
import type { CalendarEvent } from "../../lib/types";
import { useMemberNameMap } from "../../hooks/useAdmin";
import { useAuthStore } from "../../stores/authStore";
import type { EventDisplayContext } from "../../lib/todayEventsGroup";

const SHOW_DELAY_MS = 300;
const TOOLTIP_WIDTH = 280;

type TooltipPlacement = "top" | "bottom";

function TooltipCard({
  event,
  day,
  placement,
  style,
  id,
  displayCtx,
}: {
  event: CalendarEvent;
  day?: Date;
  placement: TooltipPlacement;
  style: React.CSSProperties;
  id: string;
  displayCtx: EventDisplayContext;
}) {
  const meta = buildEventPreviewMeta(event, day, displayCtx);
  const personal = isPersonalGoogleEvent(event);

  return (
    <div
      id={id}
      role="tooltip"
      style={style}
      className={cn(
        "pointer-events-none fixed z-[200] w-[280px] rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur-sm",
        personal ? "border-red-200/80" : "border-sky-100/90",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-navy-900">{meta.title}</p>
        {personal && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500/80" aria-hidden />}
      </div>
      <p className="mt-1 text-xs text-navy-600">{meta.when}</p>
      <p className="mt-0.5 text-xs text-navy-500">{meta.source}</p>
      {meta.location && (
        <p className="mt-1 flex items-center gap-1 text-xs text-navy-600">
          <MapPin className="h-3 w-3 shrink-0 text-navy-400" aria-hidden />
          <span className="truncate">{meta.location}</span>
        </p>
      )}
      {meta.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-navy-500">{meta.description}</p>
      )}
      <p className="mt-2 border-t border-sky-100/80 pt-2 text-[10px] text-primary-600">
        클릭하여 상세 보기
      </p>
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border bg-white/95",
          placement === "top"
            ? "bottom-0 translate-y-1/2 border-t-0 border-l-0 border-sky-100/90"
            : "top-0 -translate-y-1/2 border-b-0 border-r-0 border-sky-100/90",
          personal && "border-red-200/80",
        )}
      />
    </div>
  );
}

export function useEventPreviewTooltip(event: CalendarEvent, day?: Date, disabled = false) {
  const viewerId = useAuthStore((s) => s.user?.id);
  const memberNames = useMemberNameMap();
  const displayCtx: EventDisplayContext = { viewerId, memberNames };
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>("top");
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));

    const preferTop = rect.top > 120;
    const placementNext: TooltipPlacement = preferTop ? "top" : "bottom";
    const top = placementNext === "top" ? rect.top - 8 : rect.bottom + 8;

    setPlacement(placementNext);
    setCoords({ top, left });
  }, []);

  const scheduleShow = useCallback(() => {
    if (disabled) return;
    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      updatePosition();
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, [clearShowTimer, disabled, updatePosition]);

  const hide = useCallback(() => {
    clearShowTimer();
    setVisible(false);
  }, [clearShowTimer]);

  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [visible, updatePosition]);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  const tooltipPortal =
    visible &&
    createPortal(
      <TooltipCard
        id={tooltipId}
        event={event}
        day={day}
        displayCtx={displayCtx}
        placement={placement}
        style={{
          top: coords.top,
          left: coords.left,
          transform: placement === "top" ? "translateY(-100%)" : "none",
        }}
      />,
      document.body,
    );

  return {
    triggerRef,
    tooltipId,
    tooltipVisible: visible,
    tooltipPortal,
    onMouseEnter: scheduleShow,
    onMouseLeave: hide,
    onFocus: () => {
      if (disabled) return;
      updatePosition();
      setVisible(true);
    },
    onBlur: hide,
  };
}
