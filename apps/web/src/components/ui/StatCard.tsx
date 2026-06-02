import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  accent?: "blue" | "green" | "orange" | "purple";
}

const accentMap = {
  blue: "bg-primary-400/10 text-primary-500",
  green: "bg-emerald-400/10 text-emerald-600",
  orange: "bg-orange-400/10 text-orange-500",
  purple: "bg-violet-400/10 text-violet-600",
};

export function StatCard({ icon, label, value, unit, trend, accent = "blue" }: StatCardProps) {
  return (
    <div className="glass flex flex-col gap-3 rounded-3xl p-4 shadow-soft">
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", accentMap[accent])}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-navy-600">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-navy-900">
          {value}
          {unit && <span className="ml-0.5 text-sm font-normal text-navy-600">{unit}</span>}
        </p>
        {trend && <p className="mt-1 text-xs text-primary-500">{trend}</p>}
      </div>
    </div>
  );
}
