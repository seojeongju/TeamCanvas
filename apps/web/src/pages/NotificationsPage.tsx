import { useNavigate } from "react-router-dom";
import { CheckCheck, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/useData";
import { cn } from "../lib/cn";
import type { Notification } from "../lib/types";

const TYPE_LABELS: Record<string, string> = {
  task_assigned: "업무 배정",
  task_due_soon: "마감 임박",
  task_comment: "업무 댓글",
  task_mention: "멘션",
};

function typeLabel(type?: string) {
  if (!type) return null;
  return TYPE_LABELS[type] ?? null;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleOpen = async (notif: Notification) => {
    if (notif.unread) {
      await markRead.mutateAsync(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
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

      {notifications.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">알림이 없습니다.</GlassCard>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const label = typeLabel(notif.type);
            const clickable = Boolean(notif.link);

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
                  {clickable && (
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-navy-400" />
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
