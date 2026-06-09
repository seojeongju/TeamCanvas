import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../lib/cn";
import { getBackNavigation } from "../../lib/navigation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
  showBack,
  backTo,
  backLabel,
}: PageHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const back = getBackNavigation(location.pathname);
  const visible = showBack ?? back.show;
  const target = backTo ?? back.to;
  const label = backLabel ?? back.label;

  return (
    <header className={cn("space-y-3", className)}>
      {visible && (
        <button
          type="button"
          onClick={() => navigate(target)}
          className="-ml-1 flex items-center gap-0.5 text-sm font-medium text-navy-600 transition hover:text-navy-900"
          aria-label={`${label}으로 돌아가기`}
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          {label}
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] font-bold leading-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-sm text-navy-600">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
