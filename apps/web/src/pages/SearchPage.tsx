import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckSquare, ChevronRight, Flag, FolderKanban, Search, Users } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Input } from "../components/ui/Input";
import { useSearch } from "../hooks/useData";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "../lib/searchUtils";
import type { SearchResult, SearchResultType } from "../lib/types";
import { cn } from "../lib/cn";

const TYPE_FILTERS: { id: SearchResultType | "all"; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "event", label: "일정" },
  { id: "task", label: "업무" },
  { id: "project", label: "프로젝트" },
  { id: "milestone", label: "마일스톤" },
  { id: "member", label: "멤버" },
];

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: typeof Search; color: string }
> = {
  event: { label: "일정", icon: CalendarDays, color: "text-violet-600 bg-violet-500/10" },
  task: { label: "업무", icon: CheckSquare, color: "text-emerald-600 bg-emerald-500/10" },
  project: { label: "프로젝트", icon: FolderKanban, color: "text-sky-600 bg-sky-500/10" },
  milestone: { label: "마일스톤", icon: Flag, color: "text-amber-600 bg-amber-500/10" },
  member: { label: "멤버", icon: Users, color: "text-primary-600 bg-primary-400/10" },
};

export function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SearchResultType | "all">("all");
  const [recent, setRecent] = useState<string[]>(() => getRecentSearches());

  const searchType = typeFilter === "all" ? undefined : typeFilter;
  const { data, isFetching } = useSearch(query, searchType);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (query.length >= 2) {
      addRecentSearch(query);
      setRecent(getRecentSearches());
    }
  }, [query]);

  const results = data?.results ?? [];
  const grouped = {
    event: results.filter((r) => r.type === "event"),
    task: results.filter((r) => r.type === "task"),
    project: results.filter((r) => r.type === "project"),
    milestone: results.filter((r) => r.type === "milestone"),
    member: results.filter((r) => r.type === "member"),
  };

  const displayTypes =
    typeFilter === "all"
      ? (["event", "task", "project", "milestone", "member"] as const)
      : ([typeFilter] as const);

  const runSearch = (term: string) => {
    setQ(term);
    setQuery(term.trim());
  };

  return (
    <div className="space-y-6">
      <PageHeader title="검색" subtitle="일정 · 업무 · 프로젝트 · 마일스톤 · 멤버" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q);
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-600/40" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목, 설명, 이름, 이메일 검색"
          className="pl-9"
          autoFocus
        />
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
              typeFilter === f.id
                ? "bg-primary-400/15 text-primary-700"
                : "bg-white/60 text-navy-600 hover:bg-white/90",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!query && recent.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-navy-700">최근 검색</p>
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                setRecent([]);
              }}
              className="text-xs text-navy-500 hover:text-navy-700"
            >
              전체 삭제
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => runSearch(term)}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs text-navy-700 transition hover:bg-sky-100"
              >
                {term}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {!query ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">
          검색어를 입력하세요.
        </GlassCard>
      ) : isFetching && results.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">검색 중...</GlassCard>
      ) : results.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-navy-600">
          「{query}」에 대한 결과가 없습니다.
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {displayTypes.map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <section key={type}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-800">
                  <span className={cn("rounded-lg p-1", meta.color)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {meta.label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <GlassCard
                      key={`${item.type}-${item.id}`}
                      className="flex cursor-pointer items-center gap-3 p-4 transition hover:bg-sky-50/40"
                      onClick={() => navigate(item.link)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-navy-900">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-navy-600">{item.subtitle}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-navy-400" />
                    </GlassCard>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
