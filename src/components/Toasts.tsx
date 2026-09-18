export type ToastItem = { id: number; text: string; color?: string };

export default function Toasts({ toasts }: { toasts: ToastItem[] }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast-item">
          <span
            className="toast-dot"
            style={{ backgroundColor: t.color ?? "#62d3b5" }}
          />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
