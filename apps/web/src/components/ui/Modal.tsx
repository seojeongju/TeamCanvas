import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 헤더 제목 옆(닫기 버튼 앞) 액션 */
  headerActions?: ReactNode;
  /** 헤더 하단 고정 영역(상태 탭 등) */
  headerExtra?: ReactNode;
  /** 하단 고정 영역(저장/삭제 버튼 등) */
  footer?: ReactNode;
  /** 본문 패딩 제거가 필요할 때 */
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  headerActions,
  headerExtra,
  footer,
  bodyClassName,
}: ModalProps) {
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
          "glass-strong relative z-10 flex w-full max-w-lg max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl shadow-soft sm:max-h-[85vh] sm:rounded-3xl",
          "animate-in slide-in-from-bottom duration-200",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="shrink-0 border-b border-sky-100/80 bg-white/95 px-6 pb-3 pt-6 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <h2 id="modal-title" className="text-xl font-bold text-navy-900">
              {title}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-navy-600 hover:bg-sky-100/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {headerExtra}
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4",
            !footer && "pb-6 safe-bottom",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-sky-100/80 bg-white/95 px-6 py-4 backdrop-blur-sm safe-bottom">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
