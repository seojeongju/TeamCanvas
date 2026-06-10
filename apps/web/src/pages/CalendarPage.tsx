import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Link2, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { AgendaView } from "../components/calendar/AgendaView";
import { CalendarViewSwitcher } from "../components/calendar/CalendarViewSwitcher";
import { MonthView } from "../components/calendar/MonthView";
import { TimeGridView } from "../components/calendar/TimeGridView";
import { AGENDA_DAYS } from "../lib/calendarUtils";
import { CreateEventModal } from "../components/modals/CreateEventModal";
import { EventDetailSheet } from "../components/modals/EventDetailSheet";
import { IcalFeedModal } from "../components/modals/IcalFeedModal";
import { GoogleCalendarPanel } from "../components/calendar/GoogleCalendarPanel";
import { CalendarSourceLegend, TodayEventsList } from "../components/calendar/TodayEventsList";
import { splitCalendarEvents } from "../lib/calendarEventSources";
import { useEvent, useEventReminders, useEvents, useMarkReminderDelivered, useTasks } from "../hooks/useData";
import { dedupeCalendarEvents } from "../lib/todayEventsGroup";
import { tasksToCalendarEvents } from "../lib/taskUtils";
import { useHolidays } from "../hooks/useOrgSettings";
import { eventsForDay, getViewRange, getWeekDays, type CalendarViewMode } from "../lib/calendarUtils";
import { toDateLocal } from "../lib/dates";
import type { EventTemplateId } from "../lib/eventTemplates";
import type { CalendarEvent } from "../lib/types";
import { api } from "../lib/api";
import { useCurrentOrgId } from "../stores/orgStore";
import { Button } from "../components/ui/Button";

export function CalendarPage() {
  const qc = useQueryClient();
  const routerNavigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = useCurrentOrgId();
  const today = new Date();
  const [exporting, setExporting] = useState(false);
  const [showIcalFeed, setShowIcalFeed] = useState(false);
  const deepLinkEventId = searchParams.get("event");
  const { data: deepLinkData } = useEvent(deepLinkEventId && !deepLinkEventId.startsWith("task-due:") ? deepLinkEventId : undefined);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [focusDate, setFocusDate] = useState(today);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<Date | null>(null);
  const [prefillRange, setPrefillRange] = useState<{ start: number; end: number } | null>(null);
  const [templateId, setTemplateId] = useState<EventTemplateId | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedEventDay, setSelectedEventDay] = useState<Date | null>(null);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [focusExcludeDate, setFocusExcludeDate] = useState<string | undefined>(undefined);
  const [googleToast, setGoogleToast] = useState<string | null>(null);

  const { from, to } = getViewRange(viewMode, focusDate);
  const { data } = useEvents(from, to);
  const { data: tasksData } = useTasks();
  const { data: holidaysData } = useHolidays(from, to);
  const calendarEvents = data?.events ?? [];
  const holidays = holidaysData?.holidays ?? [];

  const events = useMemo(() => {
    const taskEvents = tasksToCalendarEvents(tasksData?.tasks ?? [], from, to);
    return dedupeCalendarEvents(calendarEvents, taskEvents);
  }, [calendarEvents, tasksData?.tasks, from, to]);

  const reminderRange = useMemo(() => {
    const from = Date.now();
    return { from, to: from + 24 * 60 * 60 * 1000 };
  }, []);
  const { data: reminderData } = useEventReminders(reminderRange.from, reminderRange.to);
  const reminders = reminderData?.reminders ?? [];
  const markDelivered = useMarkReminderDelivered();

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      return focusDate.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
    }
    if (viewMode === "week") {
      const days = getWeekDays(focusDate);
      const start = days[0];
      const end = days[6];
      return `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
    }
    if (viewMode === "agenda") {
      const end = new Date(focusDate);
      end.setDate(end.getDate() + AGENDA_DAYS - 1);
      return `${focusDate.getMonth() + 1}/${focusDate.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
    }
    return `${focusDate.getFullYear()}년 ${focusDate.getMonth() + 1}월`;
  }, [viewMode, focusDate]);

  const todayEvents = eventsForDay(events, today).sort((a, b) => a.startAt - b.startAt);
  const hasPersonalGoogle = useMemo(
    () => splitCalendarEvents(events).personalGoogleEvents.length > 0,
    [events],
  );

  const navigate = (delta: number) => {
    setFocusDate((d) => {
      const next = new Date(d);
      if (viewMode === "month") next.setMonth(next.getMonth() + delta);
      else if (viewMode === "week") next.setDate(next.getDate() + delta * 7);
      else if (viewMode === "agenda") next.setDate(next.getDate() + delta * AGENDA_DAYS);
      else next.setDate(next.getDate() + delta);
      return next;
    });
  };

  const openCreate = (opts?: {
    date?: Date;
    range?: { start: number; end: number };
    template?: EventTemplateId;
  }) => {
    setEditEvent(null);
    setCreatePrefillDate(opts?.date ?? null);
    setPrefillRange(opts?.range ?? null);
    setTemplateId(opts?.template ?? null);
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setCreatePrefillDate(null);
    setPrefillRange(null);
    setTemplateId(null);
    setEditEvent(null);
    setFocusExcludeDate(undefined);
  };

  const handleEdit = (event: CalendarEvent, focusedDay?: Date | null) => {
    setSelectedEvent(null);
    setSelectedEventDay(null);
    setEditEvent(event);
    setFocusExcludeDate(focusedDay ? toDateLocal(focusedDay.getTime()) : undefined);
    setShowCreate(true);
  };

  const handleEventClick = (event: CalendarEvent, day?: Date) => {
    if (event.sourceType === "google") {
      setGoogleToast("내 Google 일정입니다. 읽기 전용이며 팀원에게 노출되지 않습니다.");
      return;
    }
    if (event.sourceType === "task" && event.taskId) {
      routerNavigate(`/tasks?task=${event.taskId}`);
      return;
    }
    setSelectedEvent(event);
    setSelectedEventDay(day ?? null);
  };

  useEffect(() => {
    const google = searchParams.get("google");
    if (!google) return;
    const messages: Record<string, string> = {
      connected: "Google 캘린더가 연결되었습니다.",
      denied: "Google 캘린더 연결이 취소되었습니다.",
      error: "Google 캘린더 연결에 실패했습니다.",
    };
    setGoogleToast(messages[google] ?? null);
    if (google === "connected") {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["google-calendar"] });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("google");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, qc]);

  useEffect(() => {
    if (!googleToast) return;
    const t = window.setTimeout(() => setGoogleToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [googleToast]);

  useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId) return;

    const clearParam = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("event");
      setSearchParams(next, { replace: true });
    };

    const openEvent = (event: CalendarEvent) => {
      if (event.sourceType === "task" && event.taskId) {
        clearParam();
        routerNavigate(`/tasks?task=${event.taskId}`);
        return;
      }
      setFocusDate(new Date(event.startAt));
      setSelectedEvent(event);
      clearParam();
    };

    const inView = calendarEvents.find((e) => e.id === eventId);
    if (inView) {
      openEvent(inView);
      return;
    }

    if (deepLinkData?.event) {
      openEvent(deepLinkData.event);
    }
  }, [searchParams, calendarEvents, deepLinkData?.event, routerNavigate, setSearchParams]);

  const handleExportIcal = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const exportFrom = from;
      const exportTo = Math.max(to, from + 90 * 86400000);
      const blob = await api.downloadIcal(orgId, exportFrom, exportTo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teamcanvas-calendar.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="일정"
        subtitle="팀 캘린더"
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => setShowIcalFeed(true)}
              disabled={!orgId}
              className="!min-h-9 !px-3 !py-2 text-sm"
              title="캘린더 구독"
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={handleExportIcal}
              disabled={exporting || !orgId}
              className="!min-h-9 !px-3 !py-2 text-sm"
              title="iCal 다운로드"
            >
              <Download className="h-4 w-4" />
              {exporting ? "..." : "iCal"}
            </Button>
          </div>
        }
      />

      <CalendarViewSwitcher value={viewMode} onChange={setViewMode} />

      <GoogleCalendarPanel />

      <CalendarSourceLegend hasPersonalGoogle={hasPersonalGoogle} />

      {googleToast && (
        <GlassCard className="border border-primary-200 bg-primary-50/80 p-3 text-sm text-primary-800">
          {googleToast}
        </GlassCard>
      )}

      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-700 hover:bg-sky-100/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <span className="text-lg font-semibold text-navy-900">{headerLabel}</span>
            {viewMode !== "month" && (
              <button
                type="button"
                onClick={() => setFocusDate(new Date())}
                className="mt-0.5 block w-full text-xs text-primary-500"
              >
                오늘
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-700 hover:bg-sky-100/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          {viewMode === "month" && (
            <MonthView
              year={focusDate.getFullYear()}
              month={focusDate.getMonth()}
              events={events}
              holidays={holidays}
              onDayClick={(date) => openCreate({ date })}
              onEventClick={handleEventClick}
            />
          )}
          {viewMode === "week" && (
            <TimeGridView
              days={getWeekDays(focusDate)}
              events={events}
              onEventClick={handleEventClick}
              onRangeSelect={(start, end) => openCreate({ range: { start, end } })}
            />
          )}
          {viewMode === "day" && (
            <TimeGridView
              days={[focusDate]}
              events={events}
              onEventClick={handleEventClick}
              onRangeSelect={(start, end) => openCreate({ range: { start, end } })}
            />
          )}
          {viewMode === "agenda" && (
            <AgendaView
              focusDate={focusDate}
              events={events}
              onEventClick={handleEventClick}
              onDayClick={(date) => openCreate({ date })}
            />
          )}
        </div>
      </GlassCard>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">오늘</h2>
        {todayEvents.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-navy-600">오늘 일정이 없습니다.</p>
            <button
              type="button"
              onClick={() => openCreate({ date: new Date() })}
              className="mt-3 rounded-xl bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-400/20"
            >
              + 일정 추가
            </button>
          </GlassCard>
        ) : (
          <TodayEventsList
            events={todayEvents}
            onEventClick={(event) => handleEventClick(event, today)}
          />
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
                  {new Date(r.remindAt).toLocaleString("ko-KR")} · 시작{" "}
                  {new Date(r.startAt).toLocaleString("ko-KR")}
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
        type="button"
        onClick={() => openCreate({ date: focusDate })}
        aria-label="일정 추가"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateEventModal
        open={showCreate}
        onClose={closeCreate}
        prefillDate={createPrefillDate ?? (prefillRange ? new Date(prefillRange.start) : null)}
        prefillRange={prefillRange}
        templateId={templateId}
        editEvent={editEvent}
        focusExcludeDate={focusExcludeDate}
        existingEvents={events}
      />

      <EventDetailSheet
        event={selectedEvent}
        focusedDay={selectedEventDay}
        onClose={() => {
          setSelectedEvent(null);
          setSelectedEventDay(null);
        }}
        onEdit={handleEdit}
        onEventUpdated={(updated) => setSelectedEvent(updated)}
      />

      {showIcalFeed && <IcalFeedModal onClose={() => setShowIcalFeed(false)} />}
    </div>
  );
}
