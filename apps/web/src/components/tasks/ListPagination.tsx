import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "건",
  variant = "default",
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  /** 칸반 열 하단용 컴팩트 스타일 */
  variant?: "default" | "compact";
}) {
  if (totalPages <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min(totalItems, (page + 1) * pageSize);
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        isCompact
          ? "mt-2 border-t border-sky-100/60 pt-2"
          : "mt-2 rounded-xl border border-sky-100/80 bg-sky-50/40 px-3 py-2",
      )}
    >
      <p className={cn("text-navy-600", isCompact ? "text-[11px]" : "text-xs")}>
        {from}–{to} / {totalItems}
        {itemLabel}
      </p>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "flex items-center justify-center rounded-lg text-navy-600 transition",
            isCompact ? "h-7 w-7 hover:bg-white/70" : "h-8 w-8 border border-sky-100/80",
            page <= 0 ? "opacity-40" : "hover:bg-sky-50/80",
          )}
          aria-label="이전 페이지"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span
          className={cn(
            "min-w-[3.25rem] text-center font-medium tabular-nums text-navy-700",
            isCompact ? "text-[11px]" : "text-xs",
          )}
        >
          {page + 1}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "flex items-center justify-center rounded-lg text-navy-600 transition",
            isCompact ? "h-7 w-7 hover:bg-white/70" : "h-8 w-8 border border-sky-100/80",
            page >= totalPages - 1 ? "opacity-40" : "hover:bg-sky-50/80",
          )}
          aria-label="다음 페이지"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
