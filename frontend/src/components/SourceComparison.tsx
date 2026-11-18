import { BookOpen, Landmark, ReceiptText, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EM_DASH, formatDate, formatGbp, humanize } from '../lib/format';
import { TAX_CHECK_LABEL } from '../lib/statusMeta';
import type { ReconciledRecord } from '../types/reconciliation';

function SourceCard(props: { icon: LucideIcon; source: string; name: string; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="rounded-md border border-edge bg-obsidian p-3">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {props.source} · {props.name}
      </h4>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">{props.children}</dl>
    </div>
  );
}

function Row({ label, children, alert }: { label: string; children: ReactNode; alert?: boolean }) {
  return (
    <>
      <dt className="text-slate-400">{label}</dt>
      <dd className={`num text-right ${alert ? 'text-red-300' : 'text-slate-100'}`}>{children}</dd>
    </>
  );
}

/** The three sources of one transaction, side by side. */
export function SourceComparison({ record }: { record: ReconciledRecord }) {
  const tax = TAX_CHECK_LABEL[record.tax_check];
  const bankTotal =
    record.bank_amount_gbp === null ? null : record.bank_amount_gbp * record.bank_settlement_count;
  return (
    <div className="grid gap-3">
      <SourceCard icon={BookOpen} source="Source A" name="ERP General Ledger">
        <Row label="Gross amount" alert={record.erp_amount_gbp === null}>
          {record.erp_amount_gbp === null ? 'No entry' : formatGbp(record.erp_amount_gbp)}
        </Row>
        <Row label="Posting date">{formatDate(record.erp_date)}</Row>
        <Row label="VAT rate">
          {record.vat_rate === null ? EM_DASH : `${(record.vat_rate * 100).toFixed(0)}%`}
        </Row>
      </SourceCard>
      <SourceCard icon={Landmark} source="Source B" name="Bank Settlement Feed">
        <Row label="Per settlement" alert={record.bank_amount_gbp === null}>
          {record.bank_amount_gbp === null ? 'No settlement' : formatGbp(record.bank_amount_gbp)}
        </Row>
        <Row label="Settlements" alert={record.bank_settlement_count !== 1}>
          {record.bank_settlement_count}
        </Row>
        <Row label="Total settled">{formatGbp(bankTotal)}</Row>
        <Row label="Clearing date">{formatDate(record.bank_date)}</Row>
      </SourceCard>
      <SourceCard icon={ReceiptText} source="Source C" name="Tax / VAT Registry">
        <Row label="Registry status" alert={record.tax_status !== 'REGISTERED'}>
          {humanize(record.tax_status)}
        </Row>
        <Row label="VAT recorded">{formatGbp(record.tax_vat_amount_gbp)}</Row>
        <Row label="Check" alert={!tax.ok}>
          {tax.label}
        </Row>
      </SourceCard>
    </div>
  );
}
