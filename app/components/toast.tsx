"use client";

type ToastProps = {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
};

export default function Toast({ message, tone, onClose }: ToastProps) {
  return (
    <div className="fixed right-4 top-4 z-[60] w-full max-w-sm">
      <div
        role={tone === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
          tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <p>{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
