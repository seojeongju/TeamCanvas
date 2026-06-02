type ToastTone = "info" | "error";

export function ToastMessage({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: ToastTone;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
      <div
        className={`w-full max-w-lg rounded-2xl px-4 py-3 text-sm text-white shadow-lg ${
          tone === "error" ? "bg-red-500/95" : "bg-navy-900/95"
        }`}
        role="status"
        aria-live="polite"
        onClick={onClose}
      >
        {message}
      </div>
    </div>
  );
}
