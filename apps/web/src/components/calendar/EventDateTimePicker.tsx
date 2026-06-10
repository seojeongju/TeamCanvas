import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { WheelPicker } from "../ui/WheelPicker";
import {
  formatDurationMinutes,
  formatEventDateLabel,
  formatEventTimePill,
  fromDatetimeLocal,
  setDateKeepTime,
  snapMinuteToStep,
  timePartsFromTimestamp,
  timestampFromTimeParts,
  toDatetimeLocal,
  toDateLocal,
  type TimeWheelParts,
} from "../../lib/dates";
import { cn } from "../../lib/cn";

const PERIODS = ["오전", "오후"] as const;
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5);

type ActiveField = "start" | "end";

interface EventDateTimePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onValidationChange?: (error: string | null) => void;
}

function applyTimeParts(datetime: string, parts: TimeWheelParts, snapMinute = false): string {
  if (!datetime) return datetime;
  const dateTs = fromDatetimeLocal(datetime);
  const minute = snapMinute ? snapMinuteToStep(parts.minute) : parts.minute;
  return toDatetimeLocal(timestampFromTimeParts(dateTs, { ...parts, minute }));
}

function parseHourInput(text: string): number | null {
  if (!text) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

function commitHourInput(text: string, current: number): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) return current;
  return Math.min(12, n);
}

function parseMinuteInput(text: string): number | null {
  if (!text) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > 59) return null;
  return n;
}

function commitMinuteInput(text: string, current: number): number {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) return current;
  return Math.min(59, n);
}

export function EventDateTimePicker({
  start,
  end,
  onStartChange,
  onEndChange,
  onValidationChange,
}: EventDateTimePickerProps) {
  const [activeField, setActiveField] = useState<ActiveField>("start");

  const startTs = start ? fromDatetimeLocal(start) : Date.now();
  const endTs = end ? fromDatetimeLocal(end) : startTs + 60 * 60 * 1000;
  const activeDatetime = activeField === "start" ? start : end;
  const activeTs = activeField === "start" ? startTs : endTs;
  const timeParts = timePartsFromTimestamp(activeTs);

  useEffect(() => {
    if (!start || !end) return;
    if (fromDatetimeLocal(end) <= fromDatetimeLocal(start)) {
      onValidationChange?.("종료 시간은 시작 시간보다 이후여야 합니다.");
    } else {
      onValidationChange?.(null);
    }
  }, [start, end, onValidationChange]);

  const updateActiveTime = (parts: TimeWheelParts, snapMinute = false) => {
    const next = applyTimeParts(activeDatetime, parts, snapMinute);
    if (activeField === "start") {
      onStartChange(next);
      const startTime = fromDatetimeLocal(next);
      const endTime = fromDatetimeLocal(end);
      if (endTime <= startTime) {
        onEndChange(toDatetimeLocal(startTime + 60 * 60 * 1000));
      }
    } else {
      onEndChange(next);
    }
  };

  const handleDateChange = (field: ActiveField, dateValue: string) => {
    if (!dateValue) return;
    const target = new Date(`${dateValue}T00:00:00`);
    if (field === "start") {
      const newStart = setDateKeepTime(startTs, target);
      onStartChange(toDatetimeLocal(newStart));
      if (fromDatetimeLocal(end) <= newStart) {
        onEndChange(toDatetimeLocal(newStart + 60 * 60 * 1000));
      }
    } else {
      onEndChange(toDatetimeLocal(setDateKeepTime(endTs, target)));
    }
  };

  const durationLabel =
    start && end && fromDatetimeLocal(end) > fromDatetimeLocal(start)
      ? formatDurationMinutes(fromDatetimeLocal(start), fromDatetimeLocal(end))
      : null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <DateColumn
          label="시작"
          ts={startTs}
          dateValue={toDateLocal(startTs)}
          timeLabel={formatEventTimePill(startTs)}
          active={activeField === "start"}
          onDateChange={(v) => handleDateChange("start", v)}
          onTimeClick={() => setActiveField("start")}
        />

        <ArrowRight className="mt-8 h-4 w-4 shrink-0 text-navy-400" aria-hidden />

        <DateColumn
          label="종료"
          ts={endTs}
          dateValue={toDateLocal(endTs)}
          timeLabel={formatEventTimePill(endTs)}
          active={activeField === "end"}
          onDateChange={(v) => handleDateChange("end", v)}
          onTimeClick={() => setActiveField("end")}
        />
      </div>

      <div className="rounded-2xl border border-sky-200/80 bg-white px-2 py-1">
        <div className="flex items-center justify-center">
          <WheelPicker
            items={PERIODS}
            value={timeParts.period}
            onChange={(period) => updateActiveTime({ ...timeParts, period })}
            ariaLabel="오전 또는 오후"
            className="max-w-[88px]"
          />
          <WheelPicker
            items={HOURS_12}
            value={timeParts.hour12}
            onChange={(hour12) => updateActiveTime({ ...timeParts, hour12 })}
            formatItem={(h) => String(h)}
            ariaLabel="시"
            className="max-w-[64px]"
            editable
            maxInputLength={2}
            parseInput={parseHourInput}
            commitInput={commitHourInput}
          />
          <span className="pb-1 text-xl font-semibold text-navy-900" aria-hidden>
            :
          </span>
          <WheelPicker
            items={MINUTES_5}
            value={timeParts.minute}
            onChange={(minute) => updateActiveTime({ ...timeParts, minute }, true)}
            formatItem={(m) => String(m).padStart(2, "0")}
            ariaLabel="분"
            className="max-w-[64px]"
            editable
            maxInputLength={2}
            parseInput={parseMinuteInput}
            commitInput={commitMinuteInput}
          />
        </div>
      </div>

      {durationLabel && (
        <p className="text-xs text-primary-600">소요 시간: {durationLabel}</p>
      )}
    </div>
  );
}

function DateColumn({
  label,
  ts,
  dateValue,
  timeLabel,
  active,
  onDateChange,
  onTimeClick,
}: {
  label: string;
  ts: number;
  dateValue: string;
  timeLabel: string;
  active: boolean;
  onDateChange: (value: string) => void;
  onTimeClick: () => void;
}) {
  return (
    <div className="min-w-0">
      <span className="sr-only">{label}</span>
      <label className="relative block cursor-pointer">
        <span className="block truncate text-sm font-medium text-navy-800">
          {formatEventDateLabel(ts)}
        </span>
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`${label} 날짜`}
        />
      </label>
      <button
        type="button"
        onClick={onTimeClick}
        className={cn(
          "mt-1.5 w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition",
          active
            ? "bg-navy-900/8 text-navy-900 ring-1 ring-navy-900/10"
            : "text-navy-700 hover:bg-sky-50",
        )}
        aria-pressed={active}
      >
        {timeLabel}
      </button>
    </div>
  );
}
