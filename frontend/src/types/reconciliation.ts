// Mirrors backend/app/models.py. Amounts arrive as plain JSON numbers in GBP.

export type MatchStatus = 'EXACT_MATCH' | 'TOLERANCE_MATCH' | 'ANOMALY' | 'RESOLVED';

export type AnomalyType =
  | 'AMOUNT_VARIANCE'
  | 'SETTLEMENT_DATE_SHIFT'
  | 'VAT_MISMATCH'
  | 'MISSING_TAX_RECORD'
  | 'WITHHOLDING_GAP'
  | 'DUPLICATE_SETTLEMENT'
  | 'ORPHAN_ERP_ACCRUAL'
  | 'UNBOOKED_BANK_DEBIT'
  | 'INCOMPLETE_SOURCE_DATA';

export type TaxStatus = 'REGISTERED' | 'CERTIFICATE_MISSING' | 'NOT_REGISTERED';
export type TaxCheck =
  | 'VERIFIED'
  | 'VAT_MISMATCH'
  | 'RATE_MISSING'
  | 'CERTIFICATE_MISSING'
  | 'NOT_REGISTERED';
export type ResolutionAction = 'APPROVE_VARIANCE' | 'FLAG_FOR_CREDIT_NOTE' | 'REJECT';
export type RunStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type StreamStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface ToleranceConfig {
  amount_tolerance_gbp: number;
  date_window_days: number;
}

export interface Resolution {
  action: ResolutionAction;
  resolution_note: string;
  resolved_at: string;
  anomaly_type: AnomalyType;
  variance_gbp: number;
}

export interface ReconciledRecord {
  tx_id: string;
  invoice_ref: string;
  counterparty: string;
  erp_amount_gbp: number | null;
  erp_date: string | null;
  vat_rate: number | null;
  bank_amount_gbp: number | null;
  bank_date: string | null;
  bank_settlement_count: number;
  tax_status: TaxStatus;
  tax_vat_amount_gbp: number | null;
  scenario_code: string | null;
  status: MatchStatus;
  matched_in_pass: number;
  anomaly_type: AnomalyType | null;
  variance_gbp: number;
  date_shift_days: number | null;
  tax_check: TaxCheck;
  explanation: string;
  resolution: Resolution | null;
}

export interface Kpis {
  total_records: number;
  total_ledger_volume_gbp: number;
  exact_count: number;
  tolerance_count: number;
  anomaly_count: number;
  resolved_count: number;
  match_rate_pct: number;
  net_unreconciled_variance_gbp: number;
  gross_unreconciled_exposure_gbp: number;
}

export interface ScenarioInfo {
  code: string;
  anomaly_type: AnomalyType;
  label: string;
  description: string;
  tx_id: string;
  active: boolean;
}

export interface RunState {
  run_id: number;
  status: RunStatus;
  processed: number;
  total: number;
  percent: number;
  pass_number: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface ReconciliationProgress {
  run_id: number;
  status: RunStatus;
  pass_number: number;
  pass_name: string;
  processed: number;
  total: number;
  percent: number;
  tx_id: string | null;
  decided: boolean;
  classification: MatchStatus | null;
}

export interface BatchState {
  entity: string;
  batch_id: string;
  data_notice: string;
  sequence: number;
  generated_at: string;
  tolerance: ToleranceConfig;
  default_tolerance: ToleranceConfig;
  kpis: Kpis;
  records: ReconciledRecord[];
  scenarios: ScenarioInfo[];
  run: RunState;
}

export interface SchemaColumn {
  header: string;
  kind: string;
  required: boolean;
  description: string;
}

export interface LedgerSchema {
  sheet: string;
  columns: SchemaColumn[];
  max_rows: number;
  max_upload_bytes: number;
}

export interface VerifyResult {
  valid: boolean;
  row_count: number;
  errors: string[];
}

/** The run in progress, as seen by this tab. */
export interface LiveRun {
  runId: number;
  verdicts: Record<string, MatchStatus>;
  progress: ReconciliationProgress | null;
  /** True while this tab has seen every step, so per-record verdicts are complete. */
  overlay: boolean;
}
