import { useMemo } from "react";
import { useFreeBusy } from "../../hooks/useData";
import { startOfDay, endOfDay } from "../../lib/dates";
import { cn } from "../../lib/cn";

const HOUR_START = 9;
const HOUR_END = 18;

export function FreeBusyPanel({
  userIds,
  userNames,
  focusDay,
}: {
  userIds: string[];
  userNames: Record<string, string>;
  focusDay: Date;
}) {
  const from = startOfDay(focusDay.getTime());
  const to = endOfDay(focusDay.getTime());
  const { data, isLoading } = useFreeBusy(userIds, from, to);

  const rows = useMemo(() => {
    if (!data?.users) return [];
    return userIds.map((id) => ({
      id,
      name: userNames[id] ?? id.slice(0, 6),
      blocks: data.users[id]?.blocks ?? [],
    }));
  }, [data, userIds, userNames]);

  if (userIds.length === 0) {
    return (
      <p className="text-xs text-navy-500">참석자를 선택하면 free/busy를 확인할 수 있습니다.</p>
    );
  }

  const totalHours = HOUR_END - HOUR_START;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-navy-700">팀원 일정 (free/busy)</p>
      <p className="text-[10px] text-navy-500">
        {focusDay.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" })}{" "}
        · 업무 시간 {HOUR_START}:00–{HOUR_END}:00
      </p>

      {isLoading ? (
        <p className="text-xs text-navy-500">불러오는 중...</p>
      ) : (
        <div className="space-y-2 rounded-xl border border-sky-100 bg-white/80 p-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <span className="w-16 shrink-0 truncate text-[10px] font-medium text-navy-700">
                {row.name}
              </span>
              <div className="relative h-5 flex-1 rounded-md bg-emerald-500/10">
                {row.blocks
                  .filter((b) => !b.allDay)
                  .map((b, i) => {
                    const dayStart = new Date(focusDay);
                    dayStart.setHours(HOUR_START, 0, 0, 0);
                    const dayEnd = new Date(focusDay);
                    dayEnd.setHours(HOUR_END, 0, 0, 0);
                    const start = Math.max(b.startAt, dayStart.getTime());
                    const end = Math.min(b.endAt, dayEnd.getTime());
                    if (end <= start) return null;
                    const left =
                      ((start - dayStart.getTime()) / (dayEnd.getTime() - dayStart.getTime())) * 100;
                    const width = ((end - start) / (dayEnd.getTime() - dayStart.getTime())) * 100;
                    return (
                      <div
                        key={`${row.id}-${i}`}
                        title={b.title ?? "바쁨"}
                        className={cn(
                          "absolute top-0.5 bottom-0.5 rounded-sm",
                          b.title ? "bg-red-400/70" : "bg-navy-400/50",
                        )}
                        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      />
                    );
                  })}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: totalHours }).map((_, h) => (
                    <div key={h} className="flex-1 border-l border-sky-100/60 first:border-l-0" />
                  ))}
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-navy-500">
            <span className="inline-block h-2 w-2 rounded-sm bg-red-400/70" /> 공개 일정 ·{" "}
            <span className="inline-block h-2 w-2 rounded-sm bg-navy-400/50" /> 비공개(바쁨)
          </p>
        </div>
      )}
    </div>
  );
}
