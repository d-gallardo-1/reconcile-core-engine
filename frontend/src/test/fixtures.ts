import type {
  BatchState,
  ReconciledRecord,
  ReconciliationProgress,
  RunState,
} from '../types/reconciliation';

export function record(overrides: Partial<ReconciledRecord> = {}): ReconciledRecord {
  return {
    tx_id: 'TX-1',
    invoice_ref: 'INV-1',
    counterparty: 'Acme Test Ltd',
    currency: 'GBP',
    erp_amount: 120,
    erp_date: '2026-11-02',
    vat_rate: 0.2,
    bank_amount: 120,
    bank_date: '2026-11-02',
    bank_settlement_count: 1,
    tax_status: 'REGISTERED',
    tax_vat_amount: 20,
    scenario_code: null,
    status: 'EXACT_MATCH',
    matched_in_pass: 1,
    anomaly_type: null,
    variance: 0,
    date_shift_days: 0,
    tax_check: 'VERIFIED',
    explanation: 'English fallback sentence.',
    explanation_code: 'EXACT',
    explanation_params: {},
    resolution: null,
    ...overrides,
  };
}

export function runState(overrides: Partial<RunState> = {}): RunState {
  return {
    run_id: 1,
    status: 'RUNNING',
    processed: 0,
    total: 24,
    percent: 0,
    pass_number: 0,
    started_at: '2026-11-18T12:00:00Z',
    completed_at: null,
    ...overrides,
  };
}

export function batchState(overrides: Partial<BatchState> = {}): BatchState {
  const tolerance = { amount_tolerance: 15, date_window_days: 2 };
  return {
    entity: 'Test Entity',
    batch_id: 'B-1',
    data_notice: 'synthetic',
    sequence: 1,
    generated_at: '2026-11-18T12:00:00Z',
    currency: { code: 'GBP', minor_units: 2, max_amount_tolerance: 50, amount_tolerance_step: 0.5 },
    available_currencies: ['GBP', 'JPY'],
    tolerance,
    default_tolerance: tolerance,
    kpis: {
      total_records: 1,
      total_ledger_volume: 120,
      exact_count: 1,
      tolerance_count: 0,
      anomaly_count: 0,
      resolved_count: 0,
      match_rate_pct: 100,
      net_unreconciled_variance: 0,
      gross_unreconciled_exposure: 0,
    },
    records: [record()],
    scenarios: [],
    run: runState({ status: 'IDLE' }),
    ...overrides,
  };
}

export function progress(overrides: Partial<ReconciliationProgress> = {}): ReconciliationProgress {
  return {
    run_id: 1,
    status: 'RUNNING',
    pass_number: 1,
    pass_name: 'Exact Match',
    processed: 1,
    total: 24,
    percent: 4.2,
    tx_id: 'TX-1',
    decided: true,
    classification: 'EXACT_MATCH',
    ...overrides,
  };
}
