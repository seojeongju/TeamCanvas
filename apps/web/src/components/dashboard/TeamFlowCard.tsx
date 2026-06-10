import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CircleDot,
  Users,
  Users2,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";
import type { CalendarEvent } from "../../lib/types";

interface TeamFlowCardProps {
  eventsToday: number;
  doingTasks: number;
  totalTasks: number;
  doneTasks: number;
  members: number;
  teams: number;
  nextEvent?: CalendarEvent | null;
  onAddEvent?: () => void;
}

const metrics = [
  {
    key: "events",
    label: "오늘 일정",
    unit: "건",
    icon: CalendarDays,
    accent: "from-violet-500/15 to-violet-500/5 text-violet-600",
    iconBg: "bg-violet-500/15 text-violet-600",
    to: "/calendar",
  },
  {
    key: "tasks",
    label: "진행 프로젝트",
    unit: "건",
    icon: CheckSquare,
    accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    iconBg: "bg-emerald-500/15 text-emerald-600",
    to: "/tasks",
  },
  {
    key: "members",
    label: "팀 멤버",
    unit: "명",
    icon: Users,
    accent: "from-primary-400/15 to-primary-400/5 text-primary-600",
    iconBg: "bg-primary-400/15 text-primary-600",
    to: "/settings/members",
  },
  {
    key: "teams",
    label: "활성 팀",
    unit: "개",
    icon: Users2,
    accent: "from-orange-500/15 to-orange-500/5 text-orange-600",
    iconBg: "bg-orange-500/15 text-orange-600",
    to: "/settings/teams",
  },
] as const;

function todayLabel() {
  return new Date().toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function TeamFlowCard({
  eventsToday,
  doingTasks,
  totalTasks,
  doneTasks,
  members,
  teams,
  nextEvent,
  onAddEvent,
}: TeamFlowCardProps) {
  const values: Record<(typeof metrics)[number]["key"], number> = {
    events: eventsToday,
    tasks: doingTasks,
    members,
    teams,
  };

  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const hasWorkload = doingTasks > 0 || eventsToday > 0;

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-primary-400/8 via-transparent to-violet-500/5 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-600">
                <CircleDot className="h-3 w-3" />
                Team Flow
              </span>
              {hasWorkload && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  활동 중
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-bold text-navy-900">오늘의 팀 현황</h2>
            <p className="mt-0.5 text-xs text-navy-600">{todayLabel()}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {metrics.map(({ key, label, unit, icon: Icon, iconBg, to }) => (
            <Link
              key={key}
              to={to}
              className="group flex items-center gap-3 rounded-2xl border border-white/80 bg-white/70 px-3 py-3 transition hover:border-primary-400/30 hover:bg-white hover:shadow-soft active:scale-[0.98]"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  iconBg,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-navy-600">{label}</p>
                <p className="text-xl font-bold leading-tight text-navy-900">
                  {values[key]}
                  <span className="ml-0.5 text-xs font-normal text-navy-500">{unit}</span>
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-navy-400/50 transition group-hover:text-primary-500" />
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-sky-100/80 px-5 py-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-navy-700">프로젝트 완료율</span>
          <span className="text-navy-600">
            {doneTasks}/{totalTasks || 0}건 · {progress}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-navy-500">
          {doingTasks > 0 ? `진행 중 ${doingTasks}건` : "진행 중인 프로젝트가 없습니다"}
        </p>
      </div>

      <div className="border-t border-sky-100/80 bg-white/40 px-5 py-4">
        {nextEvent ? (
          <Link
            to="/calendar"
            className="flex items-center gap-3 rounded-2xl bg-sky-50/80 px-3 py-3 transition hover:bg-sky-100/80"
          >
            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-400 text-white">
              <span className="text-[10px] font-medium leading-none opacity-90">
                {new Date(nextEvent.startAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-primary-600">다음 일정</p>
              <p className="truncate font-semibold text-navy-900">{nextEvent.title}</p>
              <p className="truncate text-xs text-navy-600">{nextEvent.teamName}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
          </Link>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-sky-50/60 px-3 py-3">
            <div>
              <p className="text-[11px] font-medium text-navy-600">다음 일정</p>
              <p className="text-sm text-navy-800">오늘 예정된 일정이 없어요</p>
            </div>
            {onAddEvent && (
              <button
                type="button"
                onClick={onAddEvent}
                className="shrink-0 rounded-xl bg-primary-400 px-3 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-primary-500 active:scale-95"
              >
                + 일정
              </button>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
