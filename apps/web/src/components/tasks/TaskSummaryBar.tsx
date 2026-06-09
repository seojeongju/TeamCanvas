import { AlertCircle, CalendarClock, CheckCircle2, User } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import { cn } from "../../lib/cn";

interface TaskSummaryBarProps {
  dueToday: number;
  overdue: number;
  mine: number;
  doing: number;
}

export function TaskSummaryBar({ dueToday, overdue, mine, doing }: TaskSummaryBarProps) {
  const items = [
    { label: "오늘 마감", value: dueToday, icon: CalendarClock, accent: "text-orange-600", bg: "bg-orange-500/10" },
    { label: "지연", value: overdue, icon: AlertCircle, accent: overdue > 0 ? "text-red-600" : "text-navy-700", bg: overdue > 0 ? "bg-red-500/10" : "bg-sky-50" },
    { label: "내 업무", value: mine, icon: User, accent: "text-primary-600", bg: "bg-primary-400/10" },
    { label: "진행 중", value: doing, icon: CheckCircle2, accent: "text-emerald-600", bg: "bg-emerald-500/10" },
  ];

  return (
    <GlassCard className="grid grid-cols-4 divide-x divide-sky-100/80 p-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex flex-col items-center px-1 py-2.5">
            <span className={cn("mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg", item.bg)}>
              <Icon className={cn("h-3.5 w-3.5", item.accent)} strokeWidth={2} />
            </span>
            <p className={cn("text-lg font-bold leading-none tabular-nums", item.accent)}>{item.value}</p>
            <p className="mt-1 text-center text-[10px] font-medium leading-tight text-navy-600">{item.label}</p>
          </div>
        );
      })}
    </GlassCard>
  );
}
