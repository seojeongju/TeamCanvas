import { Search } from "lucide-react";
import { ScopeModeSwitcher } from "../ui/ScopeModeSwitcher";
import { cn } from "../../lib/cn";
import type { ProjectSortKey } from "../../lib/projectListUtils";
import type { WorkScopeMode } from "../../lib/workScope";
import type { Team } from "../../lib/types";

const selectClass =
  "min-h-9 shrink-0 rounded-xl border border-sky-100/80 bg-white/70 px-3 text-xs font-medium text-navy-900 outline-none focus:border-primary-400";

type Props = {
  teams: Team[];
  teamId: string;
  sort: ProjectSortKey;
  scopeMode: WorkScopeMode;
  query: string;
  onTeamChange: (teamId: string) => void;
  onSortChange: (sort: ProjectSortKey) => void;
  onScopeChange: (mode: WorkScopeMode) => void;
  onQueryChange: (query: string) => void;
};

export function ProjectListFilters({
  teams,
  teamId,
  sort,
  scopeMode,
  query,
  onTeamChange,
  onSortChange,
  onScopeChange,
  onQueryChange,
}: Props) {
  const teamPlaceholder =
    scopeMode === "team" ? (teamId ? "선택한 팀" : "소속 팀 전체") : "전체 팀";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ScopeModeSwitcher
          value={scopeMode}
          onChange={onScopeChange}
          mineLabel="내 프로젝트"
          teamLabel="팀별"
        />
        <select value={sort} onChange={(e) => onSortChange(e.target.value as ProjectSortKey)} className={selectClass}>
          <option value="updated">최근 수정순</option>
          <option value="name">이름순</option>
          <option value="progress">진행률순</option>
        </select>
      </div>

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

        {teams.length > 0 && (
          <select
            value={teamId}
            onChange={(e) => onTeamChange(e.target.value)}
            className={cn(
              selectClass,
              scopeMode === "team" && "border-primary-200 bg-primary-400/10 text-primary-700",
            )}
          >
            <option value="">{teamPlaceholder}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
