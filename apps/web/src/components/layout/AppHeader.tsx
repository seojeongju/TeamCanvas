import { useNavigate } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { OrgSwitcher } from "./OrgSwitcher";
import { cn } from "../../lib/cn";

export function AppHeader() {
  const navigate = useNavigate();

  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <OrgSwitcher />
      </div>
      <button
        type="button"
        onClick={() => navigate("/search")}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-600 transition hover:bg-sky-100/60",
        )}
        aria-label="검색"
      >
        <Search className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => navigate("/more")}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-navy-600 transition hover:bg-sky-100/60",
        )}
        aria-label="더보기"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}
