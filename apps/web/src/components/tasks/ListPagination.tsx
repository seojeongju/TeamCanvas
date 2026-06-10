import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";

export function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= pageSize) return null;

  const from = page * pageSize + 1;
  const to = Math.min(totalItems, (page + 1) * pageSize);

  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <p className="text-[10px] text-navy-500">
        {from}–{to} / {totalItems}건
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100/80 text-navy-600 transition",
            page <= 0 ? "opacity-40" : "hover:bg-sky-50/80",
          )}
          aria-label="이전 페이지"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[3.5rem] text-center text-[10px] font-medium tabular-nums text-navy-700">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-sky-100/80 text-navy-600 transition",
            page >= totalPages - 1 ? "opacity-40" : "hover:bg-sky-50/80",
          )}
          aria-label="다음 페이지"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
