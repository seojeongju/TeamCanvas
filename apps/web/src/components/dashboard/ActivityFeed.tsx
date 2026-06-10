import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
import type { OrgActivityItem } from "../../lib/types";

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
  isLoading,
  isError,
}: {
  items: OrgActivityItem[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-navy-500">활동을 불러오는 중…</p>
      </GlassCard>
    );
  }

  if (isError) {
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-red-500">활동을 불러오지 못했습니다.</p>
      </GlassCard>
    );
  }

  if (items.length === 0) {
    return (
      <GlassCard className="p-6 text-center">
        <Activity className="mx-auto mb-2 h-8 w-8 text-navy-300" />
        <p className="text-sm text-navy-600">아직 기록된 활동이 없습니다.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="divide-y divide-sky-100/80 p-0">
      {items.map((item) => {
        const inner = (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navy-800">
                <span className="font-medium">{item.actorName}</span>
                <span className="text-navy-600"> · {item.summary}</span>
              </p>
              <p className="mt-0.5 text-xs text-navy-500">{formatRelativeTime(item.createdAt)}</p>
            </div>
            {item.link && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-navy-400" />}
          </div>
        );

        if (item.link) {
          return (
            <Link
              key={item.id}
              to={item.link}
              className="block transition hover:bg-sky-50/60"
            >
              {inner}
            </Link>
          );
        }

        return (
          <div key={item.id} className="block">
            {inner}
          </div>
        );
      })}
    </GlassCard>
  );
}
