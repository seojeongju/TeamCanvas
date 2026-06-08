import { useState } from "react";
import { CalendarDays, CheckSquare, Users, TrendingUp, ChevronRight, Plus, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { StatCard } from "../components/ui/StatCard";
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
  const doingTasks = (tasksData?.tasks ?? []).filter((t) => t.status === "doing").length;

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
            className="glass flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-navy-700 hover:bg-white/90 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? "..." : "로그아웃"}
          </button>
        }
      />

      <GlassCard className="overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-500">Team Flow</p>
            <p className="mt-1 text-lg font-bold text-navy-900">오늘의 팀 현황</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-400/10">
            <TrendingUp className="h-6 w-6 text-primary-500" />
          </div>
        </div>

        <div className="relative mt-5 h-36">
          <div className="absolute left-1/2 top-2 -translate-x-1/2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-400 text-white shadow-glow">
              <Users className="h-6 w-6" />
            </div>
            <p className="mt-1 text-center text-[10px] font-medium text-navy-600">조직</p>
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 120">
            <path d="M150 56 L80 90" stroke="#B8D9F5" strokeWidth="2" fill="none" strokeDasharray="4 4" />
            <path d="M150 56 L220 90" stroke="#B8D9F5" strokeWidth="2" fill="none" strokeDasharray="4 4" />
            <path d="M150 56 L150 100" stroke="#4A9FE8" strokeWidth="2" fill="none" />
          </svg>
          <div className="absolute bottom-0 left-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 shadow-soft">
              <CalendarDays className="h-5 w-5 text-violet-500" />
            </div>
            <p className="mt-1 text-[10px] text-navy-600">일정 {events.length}</p>
          </div>
          <div className="absolute bottom-0 right-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/90 shadow-soft">
              <CheckSquare className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="mt-1 text-[10px] text-navy-600">진행 {doingTasks}</p>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-400/20 shadow-soft">
              <Users className="h-5 w-5 text-primary-500" />
            </div>
            <p className="mt-1 text-center text-[10px] text-navy-600">{stats?.members ?? 1}명</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<CalendarDays className="h-5 w-5" />} label="오늘 일정" value={events.length} unit="건" accent="blue" />
        <StatCard icon={<CheckSquare className="h-5 w-5" />} label="진행 업무" value={doingTasks} unit="건" accent="green" />
        <StatCard icon={<Users className="h-5 w-5" />} label="팀 멤버" value={stats?.members ?? 1} unit="명" accent="purple" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="활성 팀" value={stats?.teams ?? 1} unit="개" accent="orange" />
      </div>

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
