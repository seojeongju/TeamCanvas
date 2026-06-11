import { cn } from "../../lib/cn";
import { colorClass } from "../../lib/dates";
import {
  calendarEventAriaLabel,
  calendarEventInteractionClassName,
} from "../../lib/calendarEventUi";
import { isPersonalGoogleEvent, personalGoogleEventClassName } from "../../lib/calendarEventSources";
import type { CalendarEvent } from "../../lib/types";
import { useAuthStore } from "../../stores/authStore";
import { useEventPreviewTooltip } from "./EventPreviewTooltip";

type BarShape = {
  roundLeft: boolean;
  roundRight: boolean;
};

export function CalendarEventTrigger({
  event,
  day,
  onClick,
  label,
  className,
  style,
  variant = "chip",
  barShape,
}: {
  event: CalendarEvent;
  day?: Date;
  onClick: () => void;
  label: string;
  className?: string;
  style?: React.CSSProperties;
  variant?: "bar" | "chip" | "block";
  barShape?: BarShape;
}) {
  const viewerId = useAuthStore((s) => s.user?.id);
  const personal = isPersonalGoogleEvent(event);
  const task = event.sourceType === "task";
  const {
    triggerRef,
    tooltipId,
    tooltipVisible,
    tooltipPortal,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
  } = useEventPreviewTooltip(event, day);

  const shapeClass =
    variant === "bar" && barShape
      ? cn(
          barShape.roundLeft && "rounded-l-md",
          barShape.roundRight && "rounded-r-md",
          !barShape.roundLeft && "rounded-l-none",
          !barShape.roundRight && "rounded-r-none",
        )
      : variant === "chip"
        ? "rounded"
        : "rounded-md";

  const sizeClass =
    variant === "bar"
      ? "min-h-0 truncate px-1 text-left text-[9px] font-medium leading-[14px] text-white"
      : variant === "chip"
        ? "truncate px-0.5 text-[9px] font-medium text-white"
        : "absolute inset-x-0.5 z-10 overflow-hidden px-1 py-0.5 text-left text-[10px] font-medium text-white shadow-sm";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={style}
        aria-label={calendarEventAriaLabel(event, day, viewerId)}
        aria-describedby={tooltipVisible ? tooltipId : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(
          sizeClass,
          shapeClass,
          colorClass(event.color),
          calendarEventInteractionClassName(),
          task && "ring-1 ring-white/30 hover:ring-2 hover:ring-amber-200/60",
          personal && personalGoogleEventClassName(),
          personal && "hover:ring-red-300/80",
          className,
        )}
      >
        {variant === "block" ? <span className="line-clamp-2">{label}</span> : label}
      </button>
      {tooltipPortal}
    </>
  );
}
