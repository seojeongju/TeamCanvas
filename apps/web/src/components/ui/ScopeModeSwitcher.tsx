import { cn } from "../../lib/cn";
import type { WorkScopeMode } from "../../lib/workScope";

const MODES: { id: WorkScopeMode; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "mine", label: "내 보기" },
  { id: "team", label: "팀별" },
];

type Props = {
  value: WorkScopeMode;
  onChange: (mode: WorkScopeMode) => void;
  /** 업무: 내 업무 / 프로젝트: 내 프로젝트 */
  mineLabel?: string;
  teamLabel?: string;
  className?: string;
};

/**
 * 목록 범위 전환 — 전체 / 나에게 배정·담당 / 소속 팀.
 */
export function ScopeModeSwitcher({
  value,
  onChange,
  mineLabel = "내 보기",
  teamLabel = "팀별",
  className,
}: Props) {
  const labels: Record<WorkScopeMode, string> = {
    all: "전체",
    mine: mineLabel,
    team: teamLabel,
  };

  return (
    <div
      className={cn("inline-flex rounded-xl bg-sky-100/50 p-0.5", className)}
      role="tablist"
      aria-label="보기 범위"
    >
      {MODES.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3",
              active ? "bg-white text-navy-900 shadow-sm" : "text-navy-500 hover:text-navy-700",
            )}
          >
            {labels[m.id]}
          </button>
        );
      })}
    </div>
  );
}
