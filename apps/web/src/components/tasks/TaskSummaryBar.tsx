import { GlassCard } from "../ui/GlassCard";

interface TaskSummaryBarProps {
  dueToday: number;
  overdue: number;
  mine: number;
  doing: number;
}

export function TaskSummaryBar({ dueToday, overdue, mine, doing }: TaskSummaryBarProps) {
  const items = [
    { label: "오늘 마감", value: dueToday, accent: "text-orange-600" },
    { label: "지연", value: overdue, accent: overdue > 0 ? "text-red-600" : "text-navy-700" },
    { label: "내 업무", value: mine, accent: "text-primary-600" },
    { label: "진행 중", value: doing, accent: "text-emerald-600" },
  ];

  return (
    <GlassCard className="grid grid-cols-4 gap-2 p-3">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className={`text-lg font-bold leading-tight ${item.accent}`}>{item.value}</p>
          <p className="mt-0.5 text-[10px] font-medium text-navy-600">{item.label}</p>
        </div>
      ))}
    </GlassCard>
  );
}
