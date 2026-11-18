import type { I18n } from '../i18n/I18nProvider';
import type { ReconciledRecord } from '../types/reconciliation';

/**
 * The verdict explanation in the active language. The backend sends a code and
 * raw numbers; amounts are formatted here in the batch currency. An unknown
 * code (a newer backend) falls back to the English sentence it sent.
 */
export function explain(i18n: I18n, record: ReconciledRecord): string {
  const { fmt, tCode } = i18n;
  const shown: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(record.explanation_params)) {
    if (typeof value !== 'number') shown[name] = value;
    else if (name === 'delta') shown[name] = fmt.signedMoney(value);
    else if (name === 'tolerance') shown[name] = fmt.money(value);
    else if (name === 'shift') shown[name] = fmt.signedInteger(value);
    else shown[name] = fmt.integer(value);
  }
  return tCode('explanation', record.explanation_code, record.explanation, shown);
}
