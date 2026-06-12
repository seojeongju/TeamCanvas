import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkLabel?: string;
  children: ReactNode;
};

export function DashboardWidgetSection({ title, subtitle, linkTo, linkLabel = "전체 보기", children }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
          {subtitle && <p className="text-xs text-navy-500">{subtitle}</p>}
        </div>
        {linkTo && (
          <Link to={linkTo} className="flex shrink-0 items-center gap-0.5 text-sm text-primary-500">
            {linkLabel} <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
