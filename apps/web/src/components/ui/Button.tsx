import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "google" | "kakao";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-400 text-white shadow-glow hover:bg-primary-500 active:scale-[0.98]",
  secondary:
    "glass text-navy-800 hover:bg-white/90 active:scale-[0.98]",
  ghost: "text-navy-700 hover:bg-sky-100/60 active:scale-[0.98]",
  google:
    "bg-white text-navy-800 border border-sky-200 shadow-soft hover:bg-sky-50 active:scale-[0.98]",
  kakao:
    "bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00] active:scale-[0.98]",
};

export function Button({
  variant = "primary",
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[15px] font-semibold transition-all duration-200 disabled:opacity-50",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
