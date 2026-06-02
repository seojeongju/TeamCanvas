import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { CreateEventModal } from "../components/modals/CreateEventModal";
import { useEventReminders, useEvents, useMarkReminderDelivered } from "../hooks/useData";
import { colorClass, startOfDay, endOfDay } from "../lib/dates";
import { cn } from "../lib/cn";
import { api } from "../lib/api";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarPage() {
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [showCreate, setShowCreate] = useState(false);

  const monthStart = startOfDay(new Date(current.year, current.month, 1).getTime());
  const monthEnd = endOfDay(new Date(current.year, current.month + 1, 0).getTime());
  const { data } = useEvents(monthStart, monthEnd);
  const events = data?.events ?? [];
  const { data: reminderData } = useEventReminders(Date.now(), Date.now() + 24 * 60 * 60 * 1000);
  const reminders = reminderData?.reminders ?? [];
  const markDelivered = useMarkReminderDelivered();
  const [rsvpEventId, setRsvpEventId] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Array<{ user_id: string; name: string; email: string | null; rsvp: string }>>([]);

  const daysInMonth = getDaysInMonth(current.year, current.month);
  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const monthLabel = `${current.year}년 ${current.month + 1}월`;

  const eventDays = new Set(
    events.map((e) => new Date(e.startAt).getDate()),
  );

  const todayEvents = events.filter(
    (e) => e.startAt >= startOfDay(today.getTime()) && e.startAt <= endOfDay(today.getTime()),
  );

  const handleRsvp = async (eventId: string, rsvp: "accepted" | "declined") => {
    await api.updateEventRsvp(eventId, { rsvp });
  };

  const openAttendees = async (eventId: string) => {
    const result = await api.getEventAttendees(eventId);
    setAttendees(result.attendees);
    setRsvpEventId(eventId);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="일정" subtitle="팀 캘린더" />

      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() =>
              setCurrent((c) =>
                c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-700 hover:bg-sky-100/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-semibold text-navy-900">{monthLabel}</span>
          <button
            onClick={() =>
              setCurrent((c) =>
                c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-700 hover:bg-sky-100/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "py-1 text-xs font-medium",
                i === 0 ? "text-red-400" : i === 6 ? "text-primary-500" : "text-navy-600",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday =
              day === today.getDate() &&
              current.month === today.getMonth() &&
              current.year === today.getFullYear();
            const hasEvent = eventDays.has(day);

            return (
              <button
                key={day}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition",
                  isToday
                    ? "bg-primary-400 font-bold text-white shadow-glow"
                    : "text-navy-800 hover:bg-sky-100/50",
                )}
              >
                {day}
                {hasEvent && !isToday && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-400" />
                )}
              </button>
            );
          })}
        </div>
      </GlassCard>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">오늘</h2>
        {todayEvents.length === 0 ? (
          <GlassCard className="p-6 text-center text-sm text-navy-600">오늘 일정이 없습니다.</GlassCard>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event) => (
              <GlassCard key={event.id} className="flex items-center gap-3 p-4">
                <div className={`h-full min-h-10 w-1 rounded-full ${colorClass(event.color)}`} />
                <div className="flex-1">
                  <p className="font-medium text-navy-900">{event.title}</p>
                  <p className="text-xs text-navy-600">
                    {event.time} · {event.teamName}
                  </p>
                  {event.recurrenceRule && (
                    <p className="mt-0.5 text-[11px] text-primary-600">반복: {event.recurrenceRule}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-700"
                      onClick={() => handleRsvp(event.id, "accepted")}
                    >
                      참석
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-700"
                      onClick={() => handleRsvp(event.id, "declined")}
                    >
                      불참
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-primary-400/10 px-2 py-1 text-[11px] font-medium text-primary-700"
                      onClick={() => openAttendees(event.id)}
                    >
                      참석자
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">다가오는 알림</h2>
        {reminders.length === 0 ? (
          <GlassCard className="p-4 text-sm text-navy-600">24시간 내 예정된 알림이 없습니다.</GlassCard>
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 5).map((r) => (
              <GlassCard key={r.id} className="p-4">
                <p className="font-medium text-navy-900">{r.title}</p>
                <p className="mt-1 text-xs text-navy-600">
                  {new Date(r.remindAt).toLocaleString("ko-KR")} · 시작 {new Date(r.startAt).toLocaleString("ko-KR")}
                </p>
                <button
                  type="button"
                  className="mt-2 rounded-lg bg-primary-400/10 px-2.5 py-1 text-xs font-medium text-primary-600"
                  onClick={() => markDelivered.mutate(r.id)}
                  disabled={markDelivered.isPending}
                >
                  확인
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateEventModal open={showCreate} onClose={() => setShowCreate(false)} />

      {rsvpEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" onClick={() => setRsvpEventId(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-navy-900">참석자 목록</h3>
            <div className="mt-3 space-y-2">
              {attendees.length === 0 ? (
                <p className="text-xs text-navy-600">등록된 참석자가 없습니다.</p>
              ) : (
                attendees.map((a) => (
                  <div key={a.user_id} className="flex items-center justify-between rounded-lg bg-navy-800/5 px-2 py-1.5">
                    <span className="text-xs text-navy-800">{a.name}</span>
                    <span className="text-[11px] text-navy-600">{a.rsvp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
