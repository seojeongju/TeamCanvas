import { cn } from "../../lib/cn";

interface DeveloperCreditProps {
  className?: string;
  variant?: "default" | "compact";
}

export function DeveloperCredit({ className, variant = "default" }: DeveloperCreditProps) {
  return (
    <p
      className={cn(
        "text-center text-navy-600/60",
        variant === "compact" ? "text-[10px]" : "text-xs",
        className,
      )}
    >
      개발자{" "}
      <span className="font-medium text-navy-600/80">(주)와우쓰리디</span>
    </p>
  );
}
