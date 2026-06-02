import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { useNotifications } from "../hooks/useData";
import { cn } from "../lib/cn";

export function NotificationsPage() {
  const { data } = useNotifications();
  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="알림"
        subtitle={unreadCount > 0 ? `${unreadCount}개의 새 알림` : "모든 알림을 확인했습니다"}
      />

      {notifications.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">알림이 없습니다.</GlassCard>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <GlassCard
              key={notif.id}
              className={cn("p-4", notif.unread && "ring-2 ring-primary-400/20")}
            >
              <div className="flex items-start gap-3">
                {notif.unread && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                )}
                <div className={cn(!notif.unread && "ml-5")}>
                  <p className="font-medium text-navy-900">{notif.title}</p>
                  {notif.body && <p className="mt-0.5 text-sm text-navy-600">{notif.body}</p>}
                  <p className="mt-1 text-xs text-navy-600/60">{notif.time}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
