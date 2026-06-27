import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, LogOut, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import {
  ActivityFeed,
  ACTIVITY_PAGE_SIZE,
  type ActivityFeedFilters,
} from "../components/dashboard/ActivityFeed";
import { DashboardInsightsPanel } from "../components/dashboard/DashboardInsights";
import { DashboardStatusFilterBar } from "../components/dashboard/DashboardStatusFilterBar";
import { DashboardWidgetSection } from "../components/dashboard/DashboardWidgetSection";
import { DashboardWidgetSettingsModal } from "../components/dashboard/DashboardWidgetSettingsModal";
import { MyTasksCard } from "../components/dashboard/MyTasksCard";
import { ProjectsOverviewCard } from "../components/dashboard/ProjectsOverviewCard";
import { TeamFlowCard } from "../components/dashboard/TeamFlowCard";
import { WeekMilestonesCard } from "../components/dashboard/WeekMilestonesCard";
import { TodayEventsList } from "../components/calendar/TodayEventsList";
import { CreateEventModal } from "../components/modals/CreateEventModal";
import { useAuthStore } from "../stores/authStore";
import {
  useDashboardInsights,
  useOrgDetail,
  useEvents,
  useOrgActivity,
  useTasks,
  useProjects,
} from "../hooks/useData";
import { useOrgMembers } from "../hooks/useAdmin";
import { useLogout } from "../hooks/useAuth";
import {
  getDashboardWidgetPrefs,
  getVisibleDashboardWidgets,
  saveDashboardWidgetPrefs,
  type DashboardWidgetId,
  type DashboardWidgetPrefs,
} from "../lib/dashboardWidgetPrefs";
import { eventsForDay } from "../lib/calendarUtils";
import { endOfDay, fromDateLocal, startOfDay } from "../lib/dates";
import { tasksToCalendarEvents } from "../lib/taskUtils";
import { expandCalendarEvents, resolveParentEventId } from "../lib/recurrence";
import { dedupeCalendarEvents } from "../lib/todayEventsGroup";
import {
  countDashboardProjects,
  countDashboardTasks,
  getDashboardStatusFilters,
  saveDashboardStatusFilters,
  type DashboardStatusFilters,
} from "../lib/dashboardStatusFilters";
import type { CalendarEvent } from "../lib/types";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: orgData } = useOrgDetail();
  const from = startOfDay(Date.now());
  const to = endOfDay(Date.now());
  const { data: eventsData } = useEvents(from, to);
  const { data: tasksData } = useTasks();
  const { data: projectsData } = useProjects();
  const { data: membersData } = useOrgMembers();
  const [widgetPrefs, setWidgetPrefs] = useState<DashboardWidgetPrefs>(() => getDashboardWidgetPrefs());
  const [statusFilters, setStatusFilters] = useState<DashboardStatusFilters>(() =>
    getDashboardStatusFilters(),
  );
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const [activityFilters, setActivityFilters] = useState<ActivityFeedFilters>({
    actorId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [activityPage, setActivityPage] = useState(0);
  const activityQuery = useMemo(
    () => ({
      limit: ACTIVITY_PAGE_SIZE,
      offset: activityPage * ACTIVITY_PAGE_SIZE,
      actorId: activityFilters.actorId || undefined,
      from: activityFilters.dateFrom ? startOfDay(fromDateLocal(activityFilters.dateFrom)) : undefined,
      to: activityFilters.dateTo ? endOfDay(fromDateLocal(activityFilters.dateTo)) : undefined,
    }),
    [activityFilters, activityPage],
  );
  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityError,
  } = useOrgActivity(activityQuery);
  const { data: insightsData, isLoading: insightsLoading } = useDashboardInsights();
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<Date | null>(null);

  useEffect(() => {
    setActivityPage(0);
  }, [activityFilters]);

  const handleWidgetPrefsChange = useCallback((prefs: DashboardWidgetPrefs) => {
    setWidgetPrefs(prefs);
    saveDashboardWidgetPrefs(prefs);
  }, []);

  const handleStatusFiltersChange = useCallback((filters: DashboardStatusFilters) => {
    setStatusFilters(filters);
    saveDashboardStatusFilters(filters);
  }, []);

  const visibleWidgets = useMemo(() => getVisibleDashboardWidgets(widgetPrefs), [widgetPrefs]);

  const logout = useLogout();
  const navigate = useNavigate();

  const org = orgData?.organization;
  const stats = orgData?.stats;
  const tasks = tasksData?.tasks ?? [];
  const projects = projectsData?.projects ?? [];
  const taskFilterCounts = useMemo(
    () => countDashboardTasks(tasks, user?.id),
    [tasks, user?.id],
  );
  const projectFilterCounts = useMemo(() => countDashboardProjects(projects), [projects]);
  const todayEvents = useMemo(() => {
    const calendarEvents = eventsData?.events ?? [];
    const taskEvents = tasksToCalendarEvents(tasks, from, to);
    const merged = dedupeCalendarEvents(calendarEvents, taskEvents);
    const expanded = expandCalendarEvents(merged, from, to);
    return eventsForDay(expanded, new Date(from)).sort((a, b) => a.startAt - b.startAt);
  }, [eventsData?.events, tasks, from, to]);
  const doingTasks = tasks.filter((t) => t.status === "doing").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const activeProjects = (projectsData?.projects ?? []).filter(
    (p) => p.status === "active" || p.status === "planning",
  ).length;
  const now = Date.now();
  const nextEvent =
    [...todayEvents]
      .sort((a, b) => a.startAt - b.startAt)
      .find((e) => e.endAt > now) ?? null;

  const handleEventClick = (event: CalendarEvent) => {
    if (event.sourceType === "google") {
      navigate(`/calendar?event=${encodeURIComponent(event.id)}`);
      return;
    }
    if (event.sourceType === "task" && event.taskId) {
      navigate(`/tasks?task=${event.taskId}`);
      return;
    }
    navigate(`/calendar?event=${resolveParentEventId(event)}`);
  };

  const firstName = user?.name?.replace(/^\S+\s/, "").split(" ")[0] ?? user?.name ?? "팀원";

  const renderWidget = (id: DashboardWidgetId) => {
    switch (id) {
      case "projects":
        return (
          <DashboardWidgetSection key={id} title="프로젝트" linkTo="/projects">
            <ProjectsOverviewCard projectFilter={statusFilters.project} />
          </DashboardWidgetSection>
        );
      case "today_events":
        return (
          <DashboardWidgetSection key={id} title="오늘 일정" linkTo="/calendar">
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
          </DashboardWidgetSection>
        );
      case "week_milestones":
        return (
          <DashboardWidgetSection
            key={id}
            title="이번 주 마일스톤"
            subtitle="7일 내 마감 예정"
            linkTo="/projects"
          >
            <WeekMilestonesCard />
          </DashboardWidgetSection>
        );
      case "my_tasks":
        return (
          <DashboardWidgetSection key={id} title="내 업무" subtitle="나에게 배정된 업무" linkTo="/tasks">
            <MyTasksCard taskFilter={statusFilters.task} />
          </DashboardWidgetSection>
        );
      case "insights":
        return (
          <div key={id}>
            <DashboardInsightsPanel
              insights={insightsData}
              isLoading={insightsLoading}
              taskFilter={statusFilters.task}
              projectFilter={statusFilters.project}
              onTaskFilterChange={(task) =>
                handleStatusFiltersChange({ ...statusFilters, task })
              }
              onProjectFilterChange={(project) =>
                handleStatusFiltersChange({ ...statusFilters, project })
              }
            />
          </div>
        );
      case "activity":
        return (
          <section key={id}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-navy-900">최근 활동</h2>
              <p className="text-xs text-navy-500">팀 업무·프로젝트·조직 변경 내역</p>
            </div>
            <ActivityFeed
              items={activityData?.items ?? []}
              total={activityData?.total ?? 0}
              page={activityPage}
              members={membersData?.members ?? []}
              filters={activityFilters}
              onFiltersChange={setActivityFilters}
              onPageChange={setActivityPage}
              isLoading={activityLoading}
              isError={activityError}
            />
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`안녕하세요, ${firstName}님`}
        subtitle={org?.name ?? "조직"}
        action={
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowWidgetSettings(true)}
              className="glass flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-medium text-navy-700 hover:bg-white/90"
            >
              <LayoutGrid className="h-4 w-4" />
              위젯
            </button>
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
          </div>
        }
      />

      <TeamFlowCard
        eventsToday={todayEvents.length}
        doingTasks={doingTasks}
        totalTasks={tasks.length}
        doneTasks={doneTasks}
        activeProjects={activeProjects}
        members={stats?.members ?? 1}
        teams={stats?.teams ?? 1}
        nextEvent={nextEvent}
        onAddEvent={() => {
          setCreatePrefillDate(new Date());
          setShowCreate(true);
        }}
      />

      <DashboardStatusFilterBar
        filters={statusFilters}
        taskCounts={taskFilterCounts}
        projectCounts={projectFilterCounts}
        onChange={handleStatusFiltersChange}
      />

      {visibleWidgets.map((id) => renderWidget(id))}

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

      <DashboardWidgetSettingsModal
        open={showWidgetSettings}
        prefs={widgetPrefs}
        onClose={() => setShowWidgetSettings(false)}
        onChange={handleWidgetPrefsChange}
      />
    </div>
  );
}
