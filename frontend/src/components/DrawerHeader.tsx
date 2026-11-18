import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { RefObject } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { Neighbours } from '../lib/navigation';
import type { ReconciledRecord } from '../types/reconciliation';

interface Props {
  record: ReconciledRecord;
  titleId: string;
  neighbours: Neighbours;
  onNavigate: (txId: string) => void;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement>;
}

/** Identity of the open record, its position in the list, and the step buttons. */
export function DrawerHeader({ record, titleId, neighbours, onNavigate, onClose, closeRef }: Props) {
  const { t, fmt } = useI18n();
  const { previous, next, position, total } = neighbours;
  return (
    <header className="flex items-start justify-between gap-3">
      <div>
        <h3 id={titleId} className="num text-lg font-semibold text-slate-50">
          {record.tx_id}
        </h3>
        <p className="text-sm text-slate-300">{record.counterparty}</p>
        <p className="num text-xs text-slate-500">{record.invoice_ref}</p>
      </div>
      <div className="flex items-center gap-1">
        {position > 0 && (
          <span className="num mr-1 text-xs text-slate-400" aria-live="polite">
            {t('drawer.position', { position: fmt.integer(position), total: fmt.integer(total) })}
          </span>
        )}
        <button
          type="button"
          className="btn px-2"
          disabled={previous === null}
          onClick={() => previous !== null && onNavigate(previous)}
          aria-label={t('drawer.previous')}
          title={t('drawer.keys')}
        >
          <ChevronUp aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn px-2"
          disabled={next === null}
          onClick={() => next !== null && onNavigate(next)}
          aria-label={t('drawer.next')}
          title={t('drawer.keys')}
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
        <button ref={closeRef} type="button" className="btn px-2" onClick={onClose} aria-label={t('drawer.close')}>
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
