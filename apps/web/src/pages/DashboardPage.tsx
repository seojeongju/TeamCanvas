import { useMemo, useState } from "react";
import { ChevronRight, Plus, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { TeamFlowCard } from "../components/dashboard/TeamFlowCard";
import { TodayEventsList } from "../components/calendar/TodayEventsList";
import { CreateEventModal } from "../components/modals/CreateEventModal";
import { useAuthStore } from "../stores/authStore";
import { useOrgDetail, useEvents, useTasks } from "../hooks/useData";
import { useLogout } from "../hooks/useAuth";
import { eventsForDay } from "../lib/calendarUtils";
import { endOfDay, startOfDay } from "../lib/dates";
import { tasksToCalendarEvents } from "../lib/taskUtils";
import { dedupeCalendarEvents } from "../lib/todayEventsGroup";
import type { CalendarEvent } from "../lib/types";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: orgData } = useOrgDetail();
  const from = startOfDay(Date.now());
  const to = endOfDay(Date.now());
  const { data: eventsData } = useEvents(from, to);
  const { data: tasksData } = useTasks();
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<Date | null>(null);
  const logout = useLogout();
  const navigate = useNavigate();

  const org = orgData?.organization;
  const stats = orgData?.stats;
  const tasks = tasksData?.tasks ?? [];
  const todayEvents = useMemo(() => {
    const calendarEvents = eventsData?.events ?? [];
    const taskEvents = tasksToCalendarEvents(tasks, from, to);
    const merged = dedupeCalendarEvents(calendarEvents, taskEvents);
    return eventsForDay(merged, new Date(from)).sort((a, b) => a.startAt - b.startAt);
  }, [eventsData?.events, tasks, from, to]);
  const doingTasks = tasks.filter((t) => t.status === "doing").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const now = Date.now();
  const nextEvent =
    [...todayEvents]
      .sort((a, b) => a.startAt - b.startAt)
      .find((e) => e.endAt > now) ?? null;

  const handleEventClick = (event: CalendarEvent) => {
    if (event.sourceType === "google") {
      navigate("/calendar");
      return;
    }
    if (event.sourceType === "task" && event.taskId) {
      navigate(`/tasks?task=${event.taskId}`);
      return;
    }
    navigate(`/calendar?event=${event.id}`);
  };

  const firstName = user?.name?.replace(/^\S+\s/, "").split(" ")[0] ?? user?.name ?? "팀원";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`안녕하세요, ${firstName}님`}
        subtitle={org?.name ?? "조직"}
        action={
          <button
            type="button"
            onClick={async () => {
              await logout.mutateAsync();
              navigate("/login", { replace: true });
            }}
            disabled={logout.isPending}
            className="glass flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-navy-700 hover:bg-white/90 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? "..." : "로그아웃"}
          </button>
        }
      />

      <TeamFlowCard
        eventsToday={todayEvents.length}
        doingTasks={doingTasks}
        totalTasks={tasks.length}
        doneTasks={doneTasks}
        members={stats?.members ?? 1}
        teams={stats?.teams ?? 1}
        nextEvent={nextEvent}
        onAddEvent={() => {
          setCreatePrefillDate(new Date());
          setShowCreate(true);
        }}
      />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">오늘 일정</h2>
          <Link to="/calendar" className="flex items-center gap-0.5 text-sm text-primary-500">
            전체 보기 <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {todayEvents.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-sm text-navy-600">오늘 예정된 일정이 없습니다.</p>
            <button
              type="button"
              onClick={() => {
                setCreatePrefillDate(new Date());
                setShowCreate(true);
              }}
              className="mt-3 rounded-xl bg-primary-400/10 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-400/20"
            >
              + 일정 추가
            </button>
          </GlassCard>
        ) : (
          <TodayEventsList events={todayEvents} onEventClick={handleEventClick} />
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          setCreatePrefillDate(new Date());
          setShowCreate(true);
        }}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
        aria-label="일정 추가"
      >
        <Plus className="h-6 w-6" />
      </button>

      <CreateEventModal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setCreatePrefillDate(null);
        }}
        prefillDate={createPrefillDate}
      />
    </div>
  );
}
