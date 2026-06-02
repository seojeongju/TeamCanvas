import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, CreditCard, ArrowLeft, Shield } from "lucide-react";
import { cn } from "../../lib/cn";

const navItems = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "대시보드" },
  { to: "/admin/organizations", icon: Building2, label: "조직" },
  { to: "/admin/plans", icon: CreditCard, label: "플랜" },
];

export function AdminShell() {
  const navigate = useNavigate();

  return (
    <div className="bg-mesh min-h-dvh">
      <header className="glass-strong safe-top sticky top-0 z-20 border-b border-white/60 px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-500" />
            <span className="font-bold text-navy-900">TeamCanvas Admin</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-navy-600 hover:text-primary-500"
          >
            <ArrowLeft className="h-4 w-4" />
            앱으로
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-primary-400/15 text-primary-600"
                    : "text-navy-700 hover:bg-white/50",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-w-0 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
