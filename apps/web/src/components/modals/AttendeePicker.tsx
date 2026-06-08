import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../lib/cn";

type Participant = {
  id: string;
  name: string;
  email: string | null;
};

interface AttendeePickerProps {
  participants: Participant[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AttendeePicker({ participants, selectedIds, onChange }: AttendeePickerProps) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => participants.filter((p) => selectedIds.includes(p.id)),
    [participants, selectedIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email?.toLowerCase().includes(q) ?? false),
    );
  }, [participants, query]);

  const toggle = (userId: string) => {
    onChange(
      selectedIds.includes(userId)
        ? selectedIds.filter((id) => id !== userId)
        : [...selectedIds, userId],
    );
  };

  const remove = (userId: string) => {
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-navy-700">참석자</p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary-400/15 px-2.5 py-1 text-xs font-medium text-primary-700"
            >
              {p.name}
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="rounded-full p-0.5 hover:bg-primary-400/20"
                aria-label={`${p.name} 제거`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-500" />
        <input
          type="search"
          placeholder="이름 또는 이메일 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-10 w-full rounded-xl border border-sky-200 bg-white pl-9 pr-3 text-sm text-navy-800 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
        />
      </div>

      <div className="max-h-36 space-y-1 overflow-auto rounded-xl border border-sky-100 bg-white/80 p-2">
        {participants.length === 0 ? (
          <p className="text-xs text-navy-500">선택 가능한 멤버가 없습니다.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-navy-500">검색 결과가 없습니다.</p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                  checked ? "bg-primary-400/10 text-primary-800" : "text-navy-700 hover:bg-sky-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                    checked ? "border-primary-400 bg-primary-400 text-white" : "border-sky-200",
                  )}
                >
                  {checked ? "✓" : ""}
                </span>
                <span className="font-medium">{p.name}</span>
                {p.email && <span className="truncate text-navy-500">{p.email}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
