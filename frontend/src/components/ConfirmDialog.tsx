import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

interface Props {
  title: string;
  /** What will happen, one sentence per line. */
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before an action that discards work. Focus starts on Cancel, so a stray
 * Enter does not confirm, and Escape cancels.
 */
export function ConfirmDialog({ title, lines, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); // do not also close a drawer underneath
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-md rounded-lg border border-audited/50 bg-panel p-5 shadow-2xl"
      >
        <h2 id={titleId} className="flex items-center gap-2 text-base font-semibold text-slate-50">
          <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-300" />
          {title}
        </h2>
        <ul id={bodyId} className="mt-3 space-y-1 text-sm text-slate-300">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
