import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        className="absolute inset-0 bg-navy-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div
        className={cn(
          "glass-strong relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col rounded-t-3xl shadow-soft sm:max-h-[85vh] sm:rounded-3xl",
          "animate-in slide-in-from-bottom duration-200",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-6">
          <h2 id="modal-title" className="text-xl font-bold text-navy-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
}
