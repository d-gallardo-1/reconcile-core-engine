import { useCallback, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useI18n } from '../i18n/I18nProvider';
import { workAtRisk } from '../lib/atRisk';
import type { BatchState } from '../types/reconciliation';

interface ReplaceGuard {
  /** Runs `action` at once when nothing would be lost; otherwise asks first. */
  guard: (action: () => void) => void;
  /** The confirmation dialog to render, or `null`. */
  dialog: ReactNode;
}

/**
 * Protects actions that replace the batch (reset, currency change, upload).
 * The dialog says exactly what would be discarded.
 */
export function useReplaceGuard(state: BatchState): ReplaceGuard {
  const { t, tn } = useI18n();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const risk = workAtRisk(state);

  const guard = useCallback(
    (action: () => void) => {
      if (risk.any) setPending(() => action);
      else action();
    },
    [risk.any],
  );

  const lines: string[] = [];
  if (risk.uploadedLabel !== null) lines.push(t('confirm.uploaded', { label: risk.uploadedLabel }));
  if (risk.resolutions > 0) lines.push(tn('confirm.resolutions', risk.resolutions));
  if (risk.scenarios > 0) lines.push(tn('confirm.scenarios', risk.scenarios));
  lines.push(t('confirm.irreversible'));

  const dialog = pending && (
    <ConfirmDialog
      title={t('confirm.title')}
      lines={lines}
      confirmLabel={t('confirm.proceed')}
      cancelLabel={t('confirm.cancel')}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        setPending(null);
        pending();
      }}
    />
  );
  return { guard, dialog };
}
