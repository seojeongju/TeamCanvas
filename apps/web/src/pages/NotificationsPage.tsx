import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { ListPagination } from "../components/tasks/ListPagination";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/useData";
import { usePaginatedList } from "../hooks/usePaginatedList";
import { cn } from "../lib/cn";
import { resolveNotificationLink } from "../lib/notificationLinks";
import { startOfDay } from "../lib/dates";
import type { Notification } from "../lib/types";

const TYPE_LABELS: Record<string, string> = {
  task_assigned: "업무 배정",
  task_due_soon: "마감 임박",
  task_comment: "업무 댓글",
  task_mention: "멘션",
  task_status: "상태 변경",
  task_overdue: "업무 지연",
  event_attendee: "일정 초대",
  event_reminder: "일정 알림",
  event_comment: "일정 댓글",
  event_mention: "일정 멘션",
  project_comment: "프로젝트 댓글",
  project_mention: "프로젝트 멘션",
  project_member_added: "프로젝트 초대",
  project_status: "프로젝트 상태",
  milestone_done: "마일스톤 완료",
  milestone_due: "마일스톤 마감",
};

type ReadFilter = "all" | "unread";

function typeLabel(type?: string) {
  if (!type) return null;
  return TYPE_LABELS[type] ?? null;
}

function groupLabel(createdAt: number): string {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  if (createdAt >= todayStart) return "오늘";
  if (createdAt >= yesterdayStart) return "어제";
  if (createdAt >= weekStart) return "이번 주";
  return "이전";
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  const notifications = data?.notifications ?? [];
  const filtered = useMemo(
    () => (readFilter === "unread" ? notifications.filter((n) => n.unread) : notifications),
    [notifications, readFilter],
  );

  const {
    visible: visibleNotifications,
    page,
    setPage,
    totalPages,
    totalItems,
    pageSize,
  } = usePaginatedList(filtered, readFilter);

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const n of visibleNotifications) {
      const key = groupLabel(n.createdAt ?? Date.now());
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    const order = ["오늘", "어제", "이번 주", "이전"];
    return order.filter((k) => map.has(k)).map((k) => ({ label: k, items: map.get(k)! }));
  }, [visibleNotifications]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleOpen = async (notif: Notification) => {
    if (notif.unread) {
      await markRead.mutateAsync(notif.id);
    }
    const link = resolveNotificationLink(notif);
    if (link) navigate(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="알림"
        subtitle={unreadCount > 0 ? `${unreadCount}개의 새 알림` : "모든 알림을 확인했습니다"}
        action={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="!min-h-9 !px-3 !py-2 text-sm text-primary-600"
            >
              <CheckCheck className="h-4 w-4" />
              모두 읽음
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1.5">
        {(
          [
            { id: "all", label: "전체" },
            { id: "unread", label: "읽지 않음" },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setReadFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              readFilter === f.id
                ? "bg-primary-400/15 text-primary-700"
                : "bg-white/60 text-navy-600 hover:bg-white/90",
            )}
          >
            {f.label}
            {f.id === "unread" && unreadCount > 0 && ` (${unreadCount})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">
          {readFilter === "unread" ? "읽지 않은 알림이 없습니다." : "알림이 없습니다."}
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.label}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-500">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((notif) => {
                  const label = typeLabel(notif.type);
                  const link = resolveNotificationLink(notif);
                  const clickable = Boolean(link);

                  return (
                    <GlassCard
                      key={notif.id}
                      className={cn(
                        "p-4 transition",
                        notif.unread && "ring-2 ring-primary-400/20",
                        clickable && "cursor-pointer hover:bg-sky-50/40 active:scale-[0.99]",
                      )}
                      onClick={clickable ? () => handleOpen(notif) : undefined}
                    >
                      <div className="flex items-start gap-3">
                        {notif.unread && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                        )}
                        <div className={cn("min-w-0 flex-1", !notif.unread && "ml-5")}>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-navy-900">{notif.title}</p>
                            {label && (
                              <span className="shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-navy-600">
                                {label}
                              </span>
                            )}
                          </div>
                          {notif.body && <p className="mt-0.5 text-sm text-navy-600">{notif.body}</p>}
                          <p className="mt-1 text-xs text-navy-600/60">{notif.time}</p>
                        </div>
                        {clickable && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-navy-400" />}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          ))}
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
