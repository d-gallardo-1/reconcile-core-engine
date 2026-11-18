import { Flame } from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { rankExposure } from '../lib/exposure';
import type { BatchState } from '../types/reconciliation';

interface Props {
  state: BatchState;
  onOpen: (txId: string) => void;
}

/** "Start here": the open anomalies that carry most of the money at stake. */
export function ExposurePanel({ state, onOpen }: Props) {
  const { t, fmt } = useI18n();
  const ranking = useMemo(() => rankExposure(state.records), [state.records]);

  return (
    <section aria-labelledby="exposure-title" className="panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="exposure-title" className="panel-title flex items-center gap-2">
          <Flame aria-hidden="true" className="h-4 w-4 text-red-300" />
          {t('exposure.title')}
        </h2>
        <p className="num text-sm text-slate-300">{fmt.money(ranking.total)}</p>
      </div>
      <p className="mb-3 text-xs text-slate-400">{t('exposure.hint')}</p>

      {ranking.items.length === 0 ? (
        <p className="text-sm text-slate-400">{t('exposure.empty')}</p>
      ) : (
        <ol className="grid gap-2 lg:grid-cols-2 xl:grid-cols-5">
          {ranking.items.map(({ record, amount, share }) => (
            <li key={record.tx_id}>
              <button
                type="button"
                onClick={() => onOpen(record.tx_id)}
                aria-label={t('row.open', { id: record.tx_id })}
                className="flex h-full w-full flex-col gap-1 rounded-md border border-anomaly/40 bg-anomaly/5 p-3 text-left transition-colors hover:bg-anomaly/15"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="num text-sm font-semibold text-cyan-300">{record.tx_id}</span>
                  <span className="num text-sm font-semibold text-red-300">{fmt.money(amount)}</span>
                </span>
                <span className="truncate text-xs text-slate-300">{record.counterparty}</span>
                {record.anomaly_type && (
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                    {t(`anomaly.${record.anomaly_type}`)}
                  </span>
                )}
                <progress className="mt-1" max={100} value={share} aria-hidden="true" />
                <span className="num text-[11px] text-slate-400">
                  {t('exposure.share', { percent: fmt.percent(share) })}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {ranking.restCount > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {t('exposure.rest', { count: fmt.integer(ranking.restCount) })}
        </p>
      )}
    </section>
  );
}
