import { X } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-navy-900/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="이미지 확대"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="닫기"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className={cn("max-h-[90dvh] max-w-full rounded-2xl object-contain shadow-2xl")}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
