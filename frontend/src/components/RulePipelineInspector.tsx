import { ArrowDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatGbp } from '../lib/format';
import { STATUS_META } from '../lib/statusMeta';
import type { BatchState, LedgerSchema, MatchStatus } from '../types/reconciliation';
import { TemplateVerifier } from './TemplateVerifier';

interface PassCard {
  number: number;
  name: string;
  status: MatchStatus;
  rule: string;
  count: number;
}

function passes(state: BatchState): PassCard[] {
  const { kpis, tolerance } = state;
  return [
    {
      number: 1,
      name: 'Exact Match',
      status: 'EXACT_MATCH',
      rule: 'One ERP entry, one bank settlement and a verified registry record with identical amount, VAT and settlement date.',
      count: kpis.exact_count,
    },
    {
      number: 2,
      name: 'Fuzzy / Tolerance Match',
      status: 'TOLERANCE_MATCH',
      rule: `Same three-way structure, with |variance| ≤ ${formatGbp(tolerance.amount_tolerance_gbp)} and |settlement shift| ≤ ${tolerance.date_window_days} day(s). Covers wire fees, FX rounding and clearing lag.`,
      count: kpis.tolerance_count,
    },
    {
      number: 3,
      name: 'Unreconciled Anomaly Detection',
      status: 'ANOMALY',
      rule: 'Everything left over is an anomaly and gets the most specific cause: unbooked debit, orphan accrual, duplicate settlement, withholding gap, registry or VAT mismatch, incomplete source data, amount or date outside tolerance.',
      count: kpis.anomaly_count + kpis.resolved_count,
    },
  ];
}

export function RulePipelineInspector({ state }: { state: BatchState }) {
  const [schema, setSchema] = useState<LedgerSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.ledgerSchema().then(
      (loaded) => active && setSchema(loaded),
      (cause: unknown) => active && setSchemaError(cause instanceof Error ? cause.message : 'Schema unavailable.'),
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="pipeline-title" className="panel p-4">
        <h2 id="pipeline-title" className="panel-title mb-4">
          3-Pass Matching Pipeline
        </h2>
        <ol className="grid gap-2">
          {passes(state).map((pass, index) => {
            const meta = STATUS_META[pass.status];
            const Icon = meta.icon;
            return (
              <li key={pass.number}>
                {index > 0 && <ArrowDown aria-hidden="true" className="mx-auto mb-2 h-4 w-4 text-slate-600" />}
                <div className={`rounded-md border p-3 ${meta.badge}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                      Pass {pass.number} · {pass.name}
                    </h3>
                    <span className="num text-sm">
                      {pass.count} record{pass.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{pass.rule}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Rules are deterministic: the same batch and tolerances always give the same verdicts.
          Of the {state.kpis.anomaly_count + state.kpis.resolved_count} pass-3 records,{' '}
          {state.kpis.resolved_count} carry an auditor decision.
        </p>
      </section>

      <section aria-labelledby="schema-title" className="panel p-4">
        <h2 id="schema-title" className="panel-title mb-4">
          Ledger Workbook Schema {schema ? `· sheet "${schema.sheet}"` : ''}
        </h2>
        <TemplateVerifier maxUploadBytes={schema?.max_upload_bytes ?? 2 * 1024 * 1024} />
        {schemaError && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {schemaError}
          </p>
        )}
        {schema && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">Columns of the ledger input sheet</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th scope="col" className="px-2 py-2">Column</th>
                  <th scope="col" className="px-2 py-2">Type</th>
                  <th scope="col" className="px-2 py-2">Required</th>
                  <th scope="col" className="px-2 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {schema.columns.map((column) => (
                  <tr key={column.header} className="border-t border-edge align-top">
                    <th scope="row" className="num px-2 py-2 text-left font-normal text-slate-100">{column.header}</th>
                    <td className="num px-2 py-2 text-cyan-300">{column.kind}</td>
                    <td className="px-2 py-2 text-slate-300">{column.required ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-2 text-slate-400">{column.description}</td>
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
