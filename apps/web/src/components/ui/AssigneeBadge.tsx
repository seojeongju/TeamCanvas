import { cn } from "../../lib/cn";
import { assigneeAvatarClass, assigneeChipClass } from "../../lib/assigneeColors";
import { getInitials } from "../../lib/taskUtils";

type Props = {
  name: string;
  assigneeId?: string | null;
  /** avatar: 이니셜 원만 / chip: 원+이름 / name: 연한 배경 이름만 */
  variant?: "avatar" | "chip" | "name";
  size?: "sm" | "md";
  className?: string;
};

export function AssigneeBadge({
  name,
  assigneeId,
  variant = "chip",
  size = "md",
  className,
}: Props) {
  const label = name?.trim() || "미배정";
  const avatarSize = size === "sm" ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  const avatar = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        avatarSize,
        assigneeAvatarClass(assigneeId, label),
      )}
      aria-hidden
    >
      {getInitials(label)}
    </span>
  );

  if (variant === "avatar") {
    return (
      <span className={cn("inline-flex", className)} title={label}>
        {avatar}
      </span>
    );
  }

  if (variant === "name") {
    return (
      <span
        className={cn(
          "inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 font-medium",
          textSize,
          assigneeChipClass(assigneeId, label),
          className,
        )}
        title={label}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg py-0.5 pl-0.5 pr-2",
        assigneeChipClass(assigneeId, label),
        className,
      )}
      title={label}
    >
      {avatar}
      <span className={cn("truncate font-medium", textSize)}>{label}</span>
    </span>
  );
}
