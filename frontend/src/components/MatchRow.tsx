import { CircleAlert, CircleCheck } from 'lucide-react';
import { EM_DASH, formatDate, formatGbp, formatVariance } from '../lib/format';
import { TAX_CHECK_LABEL } from '../lib/statusMeta';
import type { MatchStatus, ReconciledRecord } from '../types/reconciliation';
import { PendingBadge, StatusBadge } from './StatusBadge';

function AmountAndDate({ amount, date, note }: { amount: number | null; date: string | null; note?: string }) {
  if (amount === null) return <span className="text-slate-500">{EM_DASH} no entry</span>;
  return (
    <>
      <span className="num block text-slate-100">{formatGbp(amount)}</span>
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
  onOpen: (txId: string) => void;
}

export function MatchRow({ record, liveStatus, current, onOpen }: Props) {
  const tax = TAX_CHECK_LABEL[record.tax_check];
  const TaxIcon = tax.ok ? CircleCheck : CircleAlert;
  const variance = record.variance_gbp;
  return (
    <tr className={`border-t border-edge align-top ${current ? 'bg-tolerance/10' : 'hover:bg-slate-800/40'}`}>
      <th scope="row" className="whitespace-nowrap px-3 py-3 text-left font-normal">
        <button
          type="button"
          className="num font-semibold text-cyan-300 underline-offset-2 hover:underline"
          onClick={() => onOpen(record.tx_id)}
          aria-label={`Open details for ${record.tx_id}`}
        >
          {record.tx_id}
        </button>
        <span className="num block text-xs text-slate-500">{record.invoice_ref}</span>
      </th>
      <td className="px-3 py-3 text-slate-200">{record.counterparty}</td>
      <td className="px-3 py-3 text-right">
        <AmountAndDate amount={record.erp_amount_gbp} date={record.erp_date} />
      </td>
      <td className="px-3 py-3 text-right">
        <AmountAndDate
          amount={record.bank_amount_gbp}
          date={record.bank_date}
          note={record.bank_settlement_count > 1 ? `×${record.bank_settlement_count} settlements` : undefined}
        />
      </td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${tax.ok ? 'text-slate-300' : 'text-red-300'}`}>
          <TaxIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {tax.label}
        </span>
      </td>
      <td className={`num whitespace-nowrap px-3 py-3 text-right ${variance === 0 ? 'text-slate-500' : variance < 0 ? 'text-red-300' : 'text-amber-300'}`}>
        {formatVariance(variance)}
      </td>
      <td className="px-3 py-3">
        {liveStatus === null ? <PendingBadge /> : <StatusBadge status={liveStatus ?? record.status} />}
      </td>
    </tr>
  );
}
