import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES } from './locales';

const english = DEFAULT_LOCALE.messages as Record<string, string>;
const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
const translations = LOCALES.filter((locale) => locale.code !== DEFAULT_LOCALE.code);

describe('dictionaries', () => {
  it('ships English plus four translations', () => {
    expect(LOCALES.map((locale) => locale.code)).toEqual(['en', 'es', 'pt', 'zh', 'ja']);
  });

  it.each(translations)('$code has exactly the English keys', ({ messages }) => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(translations)('$code keeps every placeholder of the English text', ({ messages }) => {
    const translated = messages as Record<string, string>;
    const different = Object.keys(english).filter(
      (key) => placeholders(translated[key]).join() !== placeholders(english[key]).join(),
    );
    // A renamed or dropped placeholder would show raw braces or lose a number.
    expect(different).toEqual([]);
  });

  it.each(LOCALES)('$code has no empty message', ({ messages }) => {
    const empty = Object.entries(messages).filter(([, text]) => text.trim() === '');
    expect(empty).toEqual([]);
  });

  it.each(translations)('$code is actually translated', ({ messages }) => {
    const translated = messages as Record<string, string>;
    const same = Object.keys(english).filter((key) => translated[key] === english[key]);
    // A few labels are legitimately identical (identifiers, loanwords).
    expect(same.length).toBeLessThan(5);
  });

  it('has a singular and a plural form for every counted message', () => {
    const keys = Object.keys(english);
    const singular = keys.filter((key) => key.endsWith('_one')).map((key) => key.slice(0, -4));
    const plural = keys.filter((key) => key.endsWith('_other')).map((key) => key.slice(0, -6));
    expect(singular.sort()).toEqual(plural.sort());
    expect(singular.length).toBeGreaterThan(0);
  });

  it('covers every code the backend can send', () => {
    // Mirrors backend/app/explanations.py, errors and enums. A code added there
    // without a message here would silently fall back to English.
    const required = [
      ...['EXACT', 'TOLERANCE_AMOUNT', 'TOLERANCE_DATE', 'TOLERANCE_AMOUNT_AND_DATE'],
      ...['UNBOOKED_BANK_DEBIT', 'ORPHAN_ERP_ACCRUAL', 'DUPLICATE_SETTLEMENT', 'WITHHOLDING_GAP'],
      ...['MISSING_TAX_RECORD', 'VAT_MISMATCH', 'VAT_RATE_MISSING', 'AMOUNT_OUTSIDE_TOLERANCE'],
      ...['DATE_MISSING', 'DATE_OUTSIDE_WINDOW'],
    ].map((code) => `explanation.${code}`);
    const errors = [
      ...['RUN_IN_PROGRESS', 'SCENARIO_ACTIVE', 'ALREADY_RESOLVED', 'NOT_AN_OPEN_ANOMALY'],
      ...['UNKNOWN_SCENARIO', 'UNKNOWN_TRANSACTION', 'UNKNOWN_CURRENCY'],
      ...['TOLERANCE_OUT_OF_RANGE', 'TOLERANCE_DECIMALS'],
    ].map((code) => `error.${code}`);
    const anomalies = [
      ...['AMOUNT_VARIANCE', 'SETTLEMENT_DATE_SHIFT', 'VAT_MISMATCH', 'MISSING_TAX_RECORD'],
      ...['WITHHOLDING_GAP', 'DUPLICATE_SETTLEMENT', 'ORPHAN_ERP_ACCRUAL', 'UNBOOKED_BANK_DEBIT'],
      'INCOMPLETE_SOURCE_DATA',
    ].map((code) => `anomaly.${code}`);
    const missing = [...required, ...errors, ...anomalies].filter((key) => !(key in english));
    expect(missing).toEqual([]);
  });
});
