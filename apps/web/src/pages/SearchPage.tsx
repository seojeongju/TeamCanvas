import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckSquare, ChevronRight, Search, Users } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { GlassCard } from "../components/ui/GlassCard";
import { Input } from "../components/ui/Input";
import { useSearch } from "../hooks/useData";
import type { SearchResult } from "../lib/types";
import { cn } from "../lib/cn";

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: typeof Search; color: string }
> = {
  event: { label: "일정", icon: CalendarDays, color: "text-violet-600 bg-violet-500/10" },
  task: { label: "업무", icon: CheckSquare, color: "text-emerald-600 bg-emerald-500/10" },
  member: { label: "멤버", icon: Users, color: "text-primary-600 bg-primary-400/10" },
};

export function SearchPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, isFetching } = useSearch(query);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const results = data?.results ?? [];
  const grouped = {
    event: results.filter((r) => r.type === "event"),
    task: results.filter((r) => r.type === "task"),
    member: results.filter((r) => r.type === "member"),
  };

  return (
    <div className="space-y-6">
      <PageHeader title="검색" subtitle="일정 · 업무 · 프로젝트 · 멤버" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
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
          {(["event", "task", "member"] as const).map((type) => {
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
