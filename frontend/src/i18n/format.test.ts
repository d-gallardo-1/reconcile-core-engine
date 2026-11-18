import { describe, expect, it } from 'vitest';
import { createFormatters, EM_DASH, formatDate, formatDateTime } from './format';

// Intl separates groups and symbols with non-breaking and narrow spaces;
// normalise them so the expectations stay readable.
const plain = (text: string) => text.replace(/[  ]/g, ' ');

describe('createFormatters', () => {
  it('uses the decimals of the currency: two for GBP, none for JPY and CLP', () => {
    expect(createFormatters('en-GB', 'GBP').money(1234.5)).toBe('£1,234.50');
    expect(createFormatters('en-GB', 'JPY').money(2480000)).toBe('JP¥2,480,000');
    expect(plain(createFormatters('es', 'CLP').money(162264000))).toBe('162.264.000 CLP');
  });

  it('follows the number conventions of the language', () => {
    expect(plain(createFormatters('es', 'EUR').money(162264))).toBe('162.264,00 €');
    expect(plain(createFormatters('pt-BR', 'BRL').money(811320))).toBe('R$ 811.320,00');
    expect(createFormatters('ja-JP', 'JPY').money(3000)).toBe('￥3,000');
  });

  it('shows an explicit sign on variances, except for zero', () => {
    const fmt = createFormatters('en-GB', 'GBP');
    expect(fmt.signedMoney(-15)).toBe('-£15.00');
    expect(fmt.signedMoney(3450)).toBe('+£3,450.00');
    expect(fmt.signedMoney(0)).toBe('£0.00');
    expect(fmt.signedInteger(2)).toBe('+2');
    expect(fmt.signedInteger(-9)).toBe('-9');
  });

  it('renders a missing amount as a dash', () => {
    const fmt = createFormatters('en-GB', 'GBP');
    expect(fmt.money(null)).toBe(EM_DASH);
    expect(fmt.money(undefined)).toBe(EM_DASH);
    expect(fmt.money(0)).toBe('£0.00');
  });

  it('formats percentages from a 0-100 value', () => {
    const fmt = createFormatters('en-GB', 'GBP');
    expect(fmt.percent(80, 1)).toBe('80.0%');
    expect(fmt.percent(54.2)).toBe('54%');
  });

  it('names currencies in the active language', () => {
    expect(createFormatters('en-GB', 'GBP').currencyName('JPY')).toBe('Japanese Yen');
    expect(createFormatters('es', 'GBP').currencyName('GBP')).toBe('libra esterlina');
  });

  it('does not throw for a currency code Intl rejects', () => {
    // A malformed code from the backend must not take the whole UI down.
    const fmt = createFormatters('en-GB', 'not-a-code');
    expect(() => fmt.money(10)).not.toThrow();
    expect(fmt.money(10)).toContain('10');
    expect(fmt.currencyName('not-a-code')).toBe('not-a-code');
  });
});

describe('dates', () => {
  it('keeps ISO dates as they are and shows a dash for a missing one', () => {
    expect(formatDate('2026-11-02')).toBe('2026-11-02');
    expect(formatDate(null)).toBe(EM_DASH);
  });

  it('shows timestamps in UTC whatever the offset they arrive with', () => {
    expect(formatDateTime('2026-11-18T14:21:47.123456Z')).toBe('2026-11-18 14:21:47 UTC');
    expect(formatDateTime('2026-11-18T11:21:47-03:00')).toBe('2026-11-18 14:21:47 UTC');
    expect(formatDateTime('not a date')).toBe(EM_DASH);
  });
});
