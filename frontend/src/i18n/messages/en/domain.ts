// English reconciliation vocabulary: statuses, causes, explanations, scenarios
// and errors. The part after the last dot is a code sent by the backend, so
// these keys must not be renamed. Placeholders in {braces} must be kept.
// {delta} and {tolerance} arrive already formatted as currency amounts;
// {shift} arrives as a signed number such as +2.

export const domain = {
  'status.EXACT_MATCH': 'EXACT MATCH',
  'status.TOLERANCE_MATCH': 'TOLERANCE MATCH',
  'status.ANOMALY': 'ANOMALY DETECTED',
  'status.RESOLVED': 'RESOLVED / AUDITED',
  'status.pending': 'IN QUEUE',

  'pass.1': 'Exact Match',
  'pass.2': 'Fuzzy / Tolerance Match',
  'pass.3': 'Unreconciled Anomaly Detection',
  'passRule.1':
    'One ERP entry, one bank settlement and a verified registry record with identical amount, VAT and settlement date.',
  'passRule.2':
    'Same three-way structure, with |variance| ≤ {amount} and |settlement shift| ≤ {days}. Covers wire fees, FX rounding and clearing lag.',
  'passRule.3':
    'Everything left over is an anomaly and gets the first cause that applies: unbooked debit, orphan accrual, duplicate settlement, withholding gap, registry or VAT mismatch, missing VAT rate, amount outside tolerance, missing date, date outside the window.',

  'taxCheck.VERIFIED': 'VAT verified',
  'taxCheck.VAT_MISMATCH': 'VAT mismatch',
  'taxCheck.RATE_MISSING': 'VAT rate missing',
  'taxCheck.CERTIFICATE_MISSING': 'Certificate missing',
  'taxCheck.NOT_REGISTERED': 'Not in registry',
  'taxStatus.REGISTERED': 'Registered',
  'taxStatus.CERTIFICATE_MISSING': 'Certificate missing',
  'taxStatus.NOT_REGISTERED': 'Not registered',

  'anomaly.AMOUNT_VARIANCE': 'Amount variance',
  'anomaly.SETTLEMENT_DATE_SHIFT': 'Settlement date shift',
  'anomaly.VAT_MISMATCH': 'VAT mismatch',
  'anomaly.MISSING_TAX_RECORD': 'Missing tax record',
  'anomaly.WITHHOLDING_GAP': 'Withholding gap',
  'anomaly.DUPLICATE_SETTLEMENT': 'Duplicate settlement',
  'anomaly.ORPHAN_ERP_ACCRUAL': 'Orphan ERP accrual',
  'anomaly.UNBOOKED_BANK_DEBIT': 'Unbooked bank debit',
  'anomaly.INCOMPLETE_SOURCE_DATA': 'Incomplete source data',

  'action.APPROVE_VARIANCE': 'Approve Variance',
  'action.FLAG_FOR_CREDIT_NOTE': 'Flag for Credit Note',
  'action.REJECT': 'Reject Entry',

  'explanation.EXACT': 'ERP, bank and tax registry agree on amount, VAT and settlement date.',
  'explanation.TOLERANCE_AMOUNT': 'Auto-matched within tolerance: amount variance {delta}.',
  'explanation.TOLERANCE_DATE':
    'Auto-matched within tolerance: settlement shifted by {shift} day(s).',
  'explanation.TOLERANCE_AMOUNT_AND_DATE':
    'Auto-matched within tolerance: amount variance {delta} and settlement shifted by {shift} day(s).',
  'explanation.UNBOOKED_BANK_DEBIT':
    'Bank debit cleared with no matching ERP entry or VAT receipt.',
  'explanation.ORPHAN_ERP_ACCRUAL':
    'Recorded in the ERP ledger but no settlement found in the bank feed.',
  'explanation.DUPLICATE_SETTLEMENT':
    'Settled {count} times in the bank feed against one ERP entry ({delta} overpayment exposure).',
  'explanation.WITHHOLDING_GAP':
    'Bank settled {delta} against the ERP amount and the tax registry holds no retention certificate.',
  'explanation.MISSING_TAX_RECORD': 'Invoice is missing from the tax/VAT registry.',
  'explanation.VAT_MISMATCH': 'VAT recorded in the tax registry differs from the ERP VAT rate.',
  'explanation.VAT_RATE_MISSING':
    'The ERP entry has no VAT rate, so the registry VAT cannot be checked.',
  'explanation.AMOUNT_OUTSIDE_TOLERANCE':
    'Amount variance {delta} exceeds the {tolerance} tolerance.',
  'explanation.DATE_MISSING':
    'A posting or clearing date is missing, so the settlement cannot be dated.',
  'explanation.DATE_OUTSIDE_WINDOW':
    'Settlement shifted by {shift} day(s), outside the {window}-day window.',

  'scenario.SCN-301.label': 'Tax Gap',
  'scenario.SCN-301.description':
    'INV-2026-881: the bank settled 10% less than the ERP amount. A tax retention was withheld but never recorded; no certificate in the registry.',
  'scenario.SCN-302.label': 'Duplicate Payment',
  'scenario.SCN-302.description':
    'INV-2026-884: paid twice in the bank feed against a single ERP entry, leaving an overpayment exposure of the full invoice amount.',
  'scenario.SCN-303.label': 'Missing Bank Feed',
  'scenario.SCN-303.description':
    'INV-2026-890: recorded in the ERP and the tax registry, but absent from the bank settlement feed after 10 business days.',
  'scenario.SCN-304.label': 'Unbooked Debit',
  'scenario.SCN-304.description':
    'Direct debit DD-4419 cleared in the bank feed with no matching ERP purchase order or VAT receipt.',

  'error.RUN_IN_PROGRESS': 'A reconciliation run is in progress. Wait for it to finish.',
  'error.SCENARIO_ACTIVE': 'This scenario is already active in the batch.',
  'error.ALREADY_RESOLVED': 'This record is already resolved; audit entries cannot be changed.',
  'error.NOT_AN_OPEN_ANOMALY': 'This record is not an open anomaly.',
  'error.UNKNOWN_SCENARIO': 'Unknown scenario.',
  'error.UNKNOWN_TRANSACTION': 'Unknown transaction.',
  'error.UNKNOWN_CURRENCY': 'This currency is not supported.',
  'error.TOLERANCE_OUT_OF_RANGE': 'The amount tolerance is above the limit for this currency.',
  'error.TOLERANCE_DECIMALS': 'The amount tolerance has more decimals than this currency allows.',
  'error.TIMEOUT': 'The engine did not answer in time. Check the connection and try again.',
  'error.UNREACHABLE': 'The engine could not be reached.',
  'error.GENERIC': 'The request failed.',
} as const;
