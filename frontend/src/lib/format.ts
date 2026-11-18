const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const signedGbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  signDisplay: 'exceptZero',
});

export const EM_DASH = '—';

export function formatGbp(value: number | null | undefined): string {
  return value === null || value === undefined ? EM_DASH : gbp.format(value);
}

/** Variance with an explicit sign, so a shortfall and an excess read differently. */
export function formatVariance(value: number): string {
  return signedGbp.format(value);
}

export function formatDate(iso: string | null): string {
  return iso ?? EM_DASH;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

export function formatDayShift(days: number | null): string {
  if (days === null) return EM_DASH;
  if (days === 0) return 'same day';
  return `${days > 0 ? '+' : ''}${days} day${Math.abs(days) === 1 ? '' : 's'}`;
}

/** "WITHHOLDING_GAP" -> "Withholding gap". */
export function humanize(code: string): string {
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
