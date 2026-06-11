import { NavLink } from "react-router-dom";
import { CalendarDays, FolderKanban, Home, Bell, Search } from "lucide-react";
import { useNotifications } from "../../hooks/useData";
import { cn } from "../../lib/cn";

const tabs = [
  { to: "/", icon: Home, label: "홈" },
  { to: "/calendar", icon: CalendarDays, label: "일정" },
  { to: "/projects", icon: FolderKanban, label: "프로젝트" },
  { to: "/search", icon: Search, label: "검색" },
  { to: "/notifications", icon: Bell, label: "알림", showBadge: true },
] as const;

export function BottomNav() {
  const { data } = useNotifications();
  const unreadCount = (data?.notifications ?? []).filter((n) => n.unread).length;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg px-4 pb-2">
        <div className="glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-soft">
          {tabs.map(({ to, icon: Icon, label, ...rest }) => {
            const showBadge = "showBadge" in rest && rest.showBadge && unreadCount > 0;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-1.5 text-[10px] font-medium transition-all",
                    isActive
                      ? "bg-primary-400/12 text-primary-600"
                      : "text-navy-500 hover:text-navy-800",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
                      {showBadge && (
                        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
