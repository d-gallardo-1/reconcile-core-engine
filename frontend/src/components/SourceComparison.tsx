import { BookOpen, Landmark, ReceiptText, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EM_DASH, formatDate } from '../i18n/format';
import { useI18n } from '../i18n/I18nProvider';
import { TAX_CHECK_OK } from '../lib/statusMeta';
import type { ReconciledRecord } from '../types/reconciliation';

function SourceCard(props: { icon: LucideIcon; title: string; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="rounded-md border border-edge bg-obsidian p-3">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {props.title}
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
  const { t, fmt } = useI18n();
  const taxOk = TAX_CHECK_OK[record.tax_check] ?? false;
  const bankTotal =
    record.bank_amount === null ? null : record.bank_amount * record.bank_settlement_count;
  return (
    <div className="grid gap-3">
      <SourceCard icon={BookOpen} title={t('source.a')}>
        <Row label={t('src.gross')} alert={record.erp_amount === null}>
          {record.erp_amount === null ? t('src.noEntry') : fmt.money(record.erp_amount)}
        </Row>
        <Row label={t('src.posting')}>{formatDate(record.erp_date)}</Row>
        <Row label={t('src.vatRate')}>
          {record.vat_rate === null ? EM_DASH : fmt.percent(record.vat_rate * 100)}
        </Row>
      </SourceCard>
      <SourceCard icon={Landmark} title={t('source.b')}>
        <Row label={t('src.perSettlement')} alert={record.bank_amount === null}>
          {record.bank_amount === null ? t('src.noSettlement') : fmt.money(record.bank_amount)}
        </Row>
        <Row label={t('src.settlements')} alert={record.bank_settlement_count !== 1}>
          {fmt.integer(record.bank_settlement_count)}
        </Row>
        <Row label={t('src.total')}>{fmt.money(bankTotal)}</Row>
        <Row label={t('src.clearing')}>{formatDate(record.bank_date)}</Row>
      </SourceCard>
      <SourceCard icon={ReceiptText} title={t('source.c')}>
        <Row label={t('src.registryStatus')} alert={record.tax_status !== 'REGISTERED'}>
          {t(`taxStatus.${record.tax_status}`)}
        </Row>
        <Row label={t('src.vatRecorded')}>{fmt.money(record.tax_vat_amount)}</Row>
        <Row label={t('src.check')} alert={!taxOk}>
          {t(`taxCheck.${record.tax_check}`)}
        </Row>
      </SourceCard>
    </div>
  );
}
