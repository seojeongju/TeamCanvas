import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-navy-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div
        className={cn(
          "glass-strong relative z-10 w-full max-w-lg rounded-t-3xl p-6 shadow-soft sm:rounded-3xl safe-bottom",
          "animate-in slide-in-from-bottom duration-200",
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-navy-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
