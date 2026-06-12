import { Search, User } from "lucide-react";
import { cn } from "../../lib/cn";
import type { ProjectSortKey } from "../../lib/projectListUtils";
import type { Team } from "../../lib/types";

const selectClass =
  "min-h-9 shrink-0 rounded-xl border border-sky-100/80 bg-white/70 px-3 text-xs font-medium text-navy-900 outline-none focus:border-primary-400";

type Props = {
  teams: Team[];
  teamId: string;
  sort: ProjectSortKey;
  mineOnly: boolean;
  query: string;
  onTeamChange: (teamId: string) => void;
  onSortChange: (sort: ProjectSortKey) => void;
  onMineToggle: () => void;
  onQueryChange: (query: string) => void;
};

export function ProjectListFilters({
  teams,
  teamId,
  sort,
  mineOnly,
  query,
  onTeamChange,
  onSortChange,
  onMineToggle,
  onQueryChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-navy-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="프로젝트 검색"
          className={cn(selectClass, "w-full pl-8")}
        />
      </div>

      <button
        type="button"
        onClick={onMineToggle}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition",
          mineOnly
            ? "bg-primary-400 text-white shadow-sm"
            : "bg-white/80 text-navy-700 ring-1 ring-sky-100/90 hover:bg-white",
        )}
      >
        <User className="h-3.5 w-3.5" />
        내 프로젝트
      </button>

      {teams.length > 0 && (
        <select value={teamId} onChange={(e) => onTeamChange(e.target.value)} className={selectClass}>
          <option value="">전체 팀</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      <select value={sort} onChange={(e) => onSortChange(e.target.value as ProjectSortKey)} className={selectClass}>
        <option value="updated">최근 수정순</option>
        <option value="name">이름순</option>
        <option value="progress">진행률순</option>
      </select>
    </div>
  );
}
