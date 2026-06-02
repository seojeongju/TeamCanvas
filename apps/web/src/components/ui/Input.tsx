import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, "-").toLowerCase();

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-navy-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "min-h-12 w-full rounded-2xl border border-sky-200/80 bg-white/80 px-4 text-[15px] text-navy-800 placeholder:text-navy-600/50 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20",
          className,
        )}
        {...props}
      />
    </div>
  );
}
