import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-navy-600">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
