import { Bell, ChevronRight, Clock } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import {
  formatReminderLead,
  getReminderStatus,
} from "../../lib/eventReminders";
import type { EventReminder } from "../../lib/types";

type UpcomingRemindersPanelProps = {
  reminders: EventReminder[];
  isLoading?: boolean;
  isError?: boolean;
  onOpenEvent: (eventId: string) => void;
  onDismiss: (reminderId: string) => void;
  isDismissing?: boolean;
};

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UpcomingRemindersPanel({
  reminders,
  isLoading,
  isError,
  onOpenEvent,
  onDismiss,
  isDismissing,
}: UpcomingRemindersPanelProps) {
  if (isLoading) {
    return (
      <GlassCard className="p-4 text-sm text-navy-600">알림을 불러오는 중...</GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard className="border border-red-200 bg-red-50/50 p-4 text-sm text-red-700">
        알림을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </GlassCard>
    );
  }

  if (reminders.length === 0) {
    return (
      <GlassCard className="p-5 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100/80 text-primary-500">
          <Bell className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-navy-800">24시간 내 예정된 알림이 없습니다</p>
        <p className="mt-1 text-xs text-navy-500">
          일정 추가 시 「상세 옵션 → 알림」에서 미리 알림을 설정할 수 있습니다.
        </p>
      </GlassCard>
    );
  }

  const now = Date.now();

  return (
    <div className="space-y-2">
      {reminders.slice(0, 8).map((r) => {
        const status = getReminderStatus(r.remindAt, now);
        return (
          <GlassCard
            key={r.id}
            className="cursor-pointer p-4 transition hover:bg-sky-50/40 active:scale-[0.99]"
            onClick={() => onOpenEvent(r.eventId)}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  status === "overdue" ? "bg-amber-100 text-amber-700" : "bg-primary-400/15 text-primary-600",
                )}
              >
                <Bell className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-navy-900">{r.title}</p>
                  {status === "overdue" && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      알림 시간 지남
                    </span>
                  )}
                  {status === "due" && (
                    <span className="rounded-full bg-primary-400/15 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                      지금 알림
                    </span>
                  )}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-navy-600">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 opacity-70" />
                    알림 {formatWhen(r.remindAt)}
                  </span>
                  <span className="text-navy-400">·</span>
                  <span>시작 {formatWhen(r.startAt)}</span>
                </p>
                <p className="mt-1 text-[11px] text-navy-500">
                  {formatReminderLead(r.reminderMinutes)} 미리 알림
                </p>
              </div>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-navy-400" />
            </div>
            <div className="mt-3 flex justify-end border-t border-sky-50 pt-2">
              <button
                type="button"
                className="rounded-lg bg-sky-100/80 px-2.5 py-1 text-xs font-medium text-navy-700 transition hover:bg-sky-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(r.id);
                }}
                disabled={isDismissing}
              >
                확인
              </button>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
