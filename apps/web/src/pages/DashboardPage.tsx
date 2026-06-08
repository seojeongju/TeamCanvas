import { useState } from "react";
import { ChevronRight, Plus, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { TeamFlowCard } from "../components/dashboard/TeamFlowCard";
import { CreateEventModal } from "../components/modals/CreateEventModal";
import { useAuthStore } from "../stores/authStore";
import { useOrgDetail, useTodayEvents, useTasks } from "../hooks/useData";
import { useLogout } from "../hooks/useAuth";
import { colorClass } from "../lib/dates";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: orgData } = useOrgDetail();
  const { data: eventsData } = useTodayEvents();
  const { data: tasksData } = useTasks();
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefillDate, setCreatePrefillDate] = useState<Date | null>(null);
  const logout = useLogout();
  const navigate = useNavigate();

  const org = orgData?.organization;
  const stats = orgData?.stats;
  const events = eventsData?.events ?? [];
  const tasks = tasksData?.tasks ?? [];
  const doingTasks = tasks.filter((t) => t.status === "doing").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const now = Date.now();
  const nextEvent =
    [...events]
      .sort((a, b) => a.startAt - b.startAt)
      .find((e) => e.endAt > now) ?? null;

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
        eventsToday={events.length}
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
        {events.length === 0 ? (
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
          <div className="space-y-2">
            {events.map((event) => (
              <GlassCard key={event.id} className="flex items-center gap-3 p-4">
                <div className={`h-10 w-1 rounded-full ${colorClass(event.color)}`} />
                <div className="flex-1">
                  <p className="font-medium text-navy-900">{event.title}</p>
                  <p className="text-xs text-navy-600">
                    {event.time} · {event.teamName}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
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
