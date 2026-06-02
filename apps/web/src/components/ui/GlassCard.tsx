import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className, strong, onClick }: GlassCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={cn(
        "rounded-3xl shadow-soft transition-all duration-200",
        strong ? "glass-strong" : "glass",
        onClick && "cursor-pointer hover:shadow-glow active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </div>
  );
}
