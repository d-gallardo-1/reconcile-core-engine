export const EM_DASH = '—';

export interface Formatters {
  money: (value: number | null | undefined) => string;
  /** With an explicit sign, so a shortfall and an excess read differently. */
  signedMoney: (value: number) => string;
  percent: (value: number, digits?: number) => string;
  integer: (value: number) => string;
  signedInteger: (value: number) => string;
  /** Name of a currency in the active language, for example "Japanese yen". */
  currencyName: (code: string) => string;
}

/** ISO code for "no currency": used when the batch reports a code Intl rejects. */
const NO_CURRENCY = 'XXX';

function usable(currencyCode: string): string {
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: currencyCode });
    return currencyCode;
  } catch {
    return NO_CURRENCY;
  }
}

/**
 * Number and currency formatting for one language and one batch currency.
 * Intl takes the decimals from the currency itself (none for JPY or CLP).
 */
export function createFormatters(intlLocale: string, currencyCode: string): Formatters {
  const currency = { style: 'currency', currency: usable(currencyCode) } as const;
  const money = new Intl.NumberFormat(intlLocale, currency);
  const signed = new Intl.NumberFormat(intlLocale, { ...currency, signDisplay: 'exceptZero' });
  const integer = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 });
  const signedInteger = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  });
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intlLocale], { type: 'currency' });
  } catch {
    /* older browser: fall back to the code */
  }

  return {
    money: (value) => (value === null || value === undefined ? EM_DASH : money.format(value)),
    signedMoney: (value) => signed.format(value),
    percent: (value, digits = 0) =>
      new Intl.NumberFormat(intlLocale, {
        style: 'percent',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value / 100),
    integer: (value) => integer.format(value),
    signedInteger: (value) => signedInteger.format(value),
    currencyName: (code) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code; // not a well-formed currency code
      }
    },
  };
}

/** Dates stay in ISO form in every language: unambiguous in an audit context. */
export function formatDate(iso: string | null): string {
  return iso ?? EM_DASH;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}
