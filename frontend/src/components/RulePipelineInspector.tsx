import { ArrowDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { api, ApiError } from '../lib/api';
import { errorText } from '../lib/errorText';
import { STATUS_META } from '../lib/statusMeta';
import type { BatchState, LedgerSchema, MatchStatus } from '../types/reconciliation';
import { TemplateVerifier } from './TemplateVerifier';

const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

const PASSES: { number: 1 | 2 | 3; status: MatchStatus }[] = [
  { number: 1, status: 'EXACT_MATCH' },
  { number: 2, status: 'TOLERANCE_MATCH' },
  { number: 3, status: 'ANOMALY' },
];

export function RulePipelineInspector({ state }: { state: BatchState }) {
  const i18n = useI18n();
  const { t, tn, fmt } = i18n;
  const [schema, setSchema] = useState<LedgerSchema | null>(null);
  const [schemaFailure, setSchemaFailure] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    api.ledgerSchema().then(
      (loaded) => active && setSchema(loaded),
      (cause: unknown) =>
        active && setSchemaFailure(cause instanceof ApiError ? cause : new ApiError('GENERIC', '')),
    );
    return () => {
      active = false;
    };
  }, []);

  const { kpis, tolerance } = state;
  const passThree = kpis.anomaly_count + kpis.resolved_count;
  const counts = { 1: kpis.exact_count, 2: kpis.tolerance_count, 3: passThree };
  const ruleParams = {
    amount: fmt.money(tolerance.amount_tolerance),
    days: tn('unit.days', tolerance.date_window_days),
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="pipeline-title" className="panel p-4">
        <h2 id="pipeline-title" className="panel-title mb-4">
          {t('rules.pipelineTitle')}
        </h2>
        <ol className="grid gap-2">
          {PASSES.map(({ number, status }, index) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            return (
              <li key={number}>
                {index > 0 && <ArrowDown aria-hidden="true" className="mx-auto mb-2 h-4 w-4 text-slate-600" />}
                <div className={`rounded-md border p-3 ${meta.badge}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {t('rules.pass', { number, name: t(`pass.${number}`) })}
                    </h3>
                    <span className="num whitespace-nowrap text-sm">{tn('unit.records', counts[number])}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{t(`passRule.${number}`, ruleParams)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          {t('rules.footnote', {
            total: fmt.integer(passThree),
            resolved: fmt.integer(kpis.resolved_count),
          })}
        </p>
      </section>

      <section aria-labelledby="schema-title" className="panel p-4">
        <h2 id="schema-title" className="panel-title mb-4">
          {t('schema.title')}
          {schema ? ` · ${t('schema.sheet', { sheet: schema.sheet })}` : ''}
        </h2>
        <TemplateVerifier maxUploadBytes={schema?.max_upload_bytes ?? DEFAULT_MAX_UPLOAD_BYTES} />
        {schemaFailure && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {errorText(i18n, schemaFailure)}
          </p>
        )}
        {schema && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-slate-500">{t('schema.englishNote')}</p>
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">{t('schema.caption')}</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-2 py-2">{t('schema.column')}</th>
                  <th scope="col" className="px-2 py-2">{t('schema.type')}</th>
                  <th scope="col" className="px-2 py-2">{t('schema.required')}</th>
                  <th scope="col" className="px-2 py-2">{t('schema.description')}</th>
                </tr>
              </thead>
              <tbody>
                {schema.columns.map((column) => (
                  <tr key={column.header} className="border-t border-edge align-top">
                    <th scope="row" lang="en" className="num px-2 py-2 text-left font-normal text-slate-100">
                      {column.header}
                    </th>
                    <td className="num px-2 py-2 text-cyan-300">{column.kind}</td>
                    <td className="px-2 py-2 text-slate-300">
                      {column.required ? t('common.yes') : t('common.no')}
                    </td>
                    <td lang="en" className="px-2 py-2 text-slate-400">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
