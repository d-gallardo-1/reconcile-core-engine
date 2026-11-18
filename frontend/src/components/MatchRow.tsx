import { CircleAlert, CircleCheck } from 'lucide-react';
import { EM_DASH, formatDate } from '../i18n/format';
import { useI18n } from '../i18n/I18nProvider';
import { isSelectable } from '../lib/selection';
import { TAX_CHECK_OK } from '../lib/statusMeta';
import type { MatchStatus, ReconciledRecord } from '../types/reconciliation';
import { PendingBadge, StatusBadge } from './StatusBadge';

function AmountAndDate({ amount, date, note }: { amount: number | null; date: string | null; note?: string }) {
  const { t, fmt } = useI18n();
  if (amount === null) {
    return (
      <span className="text-slate-400">
        {EM_DASH} {t('row.noEntry')}
      </span>
    );
  }
  return (
    <>
      <span className="num block text-slate-100">{fmt.money(amount)}</span>
      <span className="num block text-xs text-slate-400">
        {formatDate(date)}
        {note ? ` · ${note}` : ''}
      </span>
    </>
  );
}

interface Props {
  record: ReconciledRecord;
  /** ``undefined`` outside a live run; ``null`` while the record is still queued. */
  liveStatus: MatchStatus | null | undefined;
  current: boolean;
  selected: boolean;
  onToggle: (txId: string) => void;
  onOpen: (txId: string) => void;
}

export function MatchRow({ record, liveStatus, current, selected, onToggle, onOpen }: Props) {
  const { t, fmt } = useI18n();
  const taxOk = TAX_CHECK_OK[record.tax_check] ?? false;
  const TaxIcon = taxOk ? CircleCheck : CircleAlert;
  const variance = record.variance;
  const tone = current || selected ? 'bg-tolerance/10' : 'hover:bg-slate-800/40';
  return (
    <tr className={`border-t border-edge align-top ${tone}`}>
      <td className="w-8 px-3 py-3">
        {isSelectable(record) && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(record.tx_id)}
            aria-label={t('bulk.select', { id: record.tx_id })}
            className="h-4 w-4 accent-cyan-500"
          />
        )}
      </td>
      <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-normal">
        <button
          type="button"
          className="num inline-flex min-h-6 items-center font-semibold text-cyan-300 underline-offset-2 hover:underline"
          onClick={() => onOpen(record.tx_id)}
          aria-label={t('row.open', { id: record.tx_id })}
        >
          {record.tx_id}
        </button>
        <span className="num block text-xs text-slate-400">{record.invoice_ref}</span>
      </th>
      <td className="px-3 py-3 text-slate-200">{record.counterparty}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <AmountAndDate amount={record.erp_amount} date={record.erp_date} />
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <AmountAndDate
          amount={record.bank_amount}
          date={record.bank_date}
          note={
            record.bank_settlement_count > 1
              ? t('row.settlements', { count: record.bank_settlement_count })
              : undefined
          }
        />
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${taxOk ? 'text-slate-300' : 'text-red-300'}`}>
          <TaxIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t(`taxCheck.${record.tax_check}`)}
        </span>
      </td>
      <td className={`num whitespace-nowrap px-3 py-3 text-right ${variance === 0 ? 'text-slate-400' : variance < 0 ? 'text-red-300' : 'text-amber-300'}`}>
        {fmt.signedMoney(variance)}
      </td>
      <td className="px-3 py-3">
        {liveStatus === null ? <PendingBadge /> : <StatusBadge status={liveStatus ?? record.status} />}
      </td>
    </tr>
  );
}
