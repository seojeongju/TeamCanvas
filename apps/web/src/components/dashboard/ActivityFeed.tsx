import { Activity, ChevronRight, RotateCcw } from "lucide-react";
import { ActivityListItem } from "../ui/ActivityListItem";
import { GlassCard } from "../ui/GlassCard";
import { ListPagination } from "../tasks/ListPagination";
import { cn } from "../../lib/cn";
import type { OrgActivityItem, OrgMember } from "../../lib/types";

export const ACTIVITY_PAGE_SIZE = 10;

export type ActivityFeedFilters = {
  actorId: string;
  dateFrom: string;
  dateTo: string;
};

const selectClass =
  "min-h-10 w-full rounded-xl border border-sky-200/80 bg-white/80 px-3 text-sm text-navy-800 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export function ActivityFeed({
  items,
  total,
  page,
  pageSize = ACTIVITY_PAGE_SIZE,
  members,
  filters,
  onFiltersChange,
  onPageChange,
  isLoading,
  isError,
}: {
  items: OrgActivityItem[];
  total: number;
  page: number;
  pageSize?: number;
  members: OrgMember[];
  filters: ActivityFeedFilters;
  onFiltersChange: (filters: ActivityFeedFilters) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  isError?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(filters.actorId || filters.dateFrom || filters.dateTo);

  const handleFilterChange = (patch: Partial<ActivityFeedFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const handleResetFilters = () => {
    onFiltersChange({ actorId: "", dateFrom: "", dateTo: "" });
  };

  return (
    <div className="space-y-3">
      <GlassCard className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="activity-actor" className="mb-1 block text-xs font-medium text-navy-600">
              사용자
            </label>
            <select
              id="activity-actor"
              value={filters.actorId}
              onChange={(e) => handleFilterChange({ actorId: e.target.value })}
              className={selectClass}
            >
              <option value="">전체 사용자</option>
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="activity-date-from" className="mb-1 block text-xs font-medium text-navy-600">
              시작일
            </label>
            <input
              id="activity-date-from"
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
              className={selectClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="activity-date-to" className="mb-1 block text-xs font-medium text-navy-600">
              종료일
            </label>
            <input
              id="activity-date-to"
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
              className={selectClass}
            />
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-sky-200/80 px-3 text-xs font-medium text-navy-600 transition hover:bg-sky-50/80",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </button>
          )}
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard className="p-4">
          <p className="text-sm text-navy-500">활동을 불러오는 중…</p>
        </GlassCard>
      ) : isError ? (
        <GlassCard className="p-4">
          <p className="text-sm text-red-500">활동을 불러오지 못했습니다.</p>
        </GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="p-6 text-center">
          <Activity className="mx-auto mb-2 h-8 w-8 text-navy-300" />
          <p className="text-sm text-navy-600">
            {hasActiveFilters ? "조건에 맞는 활동이 없습니다." : "아직 기록된 활동이 없습니다."}
          </p>
        </GlassCard>
      ) : (
        <>
          <GlassCard className="divide-y divide-sky-100/80 p-0">
            {items.map((item) => (
              <ActivityListItem
                key={item.id}
                actorName={item.actorName}
                summary={item.summary}
                time={formatRelativeTime(item.createdAt)}
                action={item.action}
                kind={item.kind}
                href={item.link}
                className="px-2"
                trailing={
                  item.link ? (
                    <ChevronRight className="mt-3 mr-2 h-4 w-4 shrink-0 text-navy-400" />
                  ) : undefined
                }
              />
            ))}
          </GlassCard>

          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
