import { NavLink } from "react-router-dom";
import { CalendarDays, CheckSquare, Home, Bell, Menu } from "lucide-react";
import { cn } from "../../lib/cn";

const tabs = [
  { to: "/", icon: Home, label: "홈" },
  { to: "/calendar", icon: CalendarDays, label: "일정" },
  { to: "/tasks", icon: CheckSquare, label: "업무" },
  { to: "/notifications", icon: Bell, label: "알림" },
  { to: "/more", icon: Menu, label: "더보기" },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-auto max-w-lg px-4 pb-2">
        <div className="glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-soft">
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-medium transition-all",
                  isActive
                    ? "bg-primary-400/15 text-primary-500"
                    : "text-navy-600 hover:text-navy-800",
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
