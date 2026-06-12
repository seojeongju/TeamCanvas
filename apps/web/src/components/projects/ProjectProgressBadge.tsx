import { cn } from "../../lib/cn";

type Props = {
  percent: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

export function ProjectProgressBadge({ percent, size = "sm", className }: Props) {
  if (percent == null) return null;

  const tone =
    percent >= 80
      ? "bg-emerald-500/15 text-emerald-700"
      : percent >= 40
        ? "bg-primary-400/15 text-primary-700"
        : "bg-amber-500/15 text-amber-700";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        tone,
        className,
      )}
    >
      {percent}%
    </span>
  );
}

export function ProjectProgressBar({
  percent,
  color = "#4A9FE8",
  className,
}: {
  percent: number | null | undefined;
  color?: string;
  className?: string;
}) {
  if (percent == null) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs text-navy-500">
        <span>진행률</span>
        <span className="font-medium text-navy-700">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sky-100/80">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
