import { afterEach, describe, expect, it } from 'vitest';
import { record } from '../test/fixtures';
import { i18nFor } from '../test/withI18n';
import { explain } from './explain';

afterEach(() => window.localStorage.clear());

describe('explain', () => {
  it('writes amounts in the batch currency and the active language', () => {
    const row = record({
      explanation_code: 'AMOUNT_OUTSIDE_TOLERANCE',
      explanation_params: { delta: -180, tolerance: 15 },
    });
    expect(explain(i18nFor('en', 'GBP'), row)).toBe(
      'Amount variance -£180.00 exceeds the £15.00 tolerance.',
    );
    const spanish = explain(i18nFor('es', 'GBP'), row).replace(/ /g, ' ');
    expect(spanish).toBe('La diferencia de importe -180,00 GBP supera la tolerancia de 15,00 GBP.');
  });

  it('shows no decimals for a currency without minor units', () => {
    const row = record({
      explanation_code: 'AMOUNT_OUTSIDE_TOLERANCE',
      explanation_params: { delta: -36000, tolerance: 3000 },
    });
    expect(explain(i18nFor('en', 'JPY'), row)).toBe(
      'Amount variance -JP¥36,000 exceeds the JP¥3,000 tolerance.',
    );
  });

  it('writes a day shift with its sign and counts as whole numbers', () => {
    const late = record({
      explanation_code: 'DATE_OUTSIDE_WINDOW',
      explanation_params: { shift: 9, window: 2 },
    });
    expect(explain(i18nFor('en'), late)).toBe(
      'Settlement shifted by +9 day(s), outside the 2-day window.',
    );
    const duplicate = record({
      explanation_code: 'DUPLICATE_SETTLEMENT',
      explanation_params: { count: 2, delta: 3450 },
    });
    expect(explain(i18nFor('en'), duplicate)).toBe(
      'Settled 2 times in the bank feed against one ERP entry (+£3,450.00 overpayment exposure).',
    );
  });

  it('falls back to the English sentence for a code it does not know', () => {
    const row = record({ explanation_code: 'NEW_CODE', explanation: 'Sentence from a newer backend.' });
    expect(explain(i18nFor('ja'), row)).toBe('Sentence from a newer backend.');
  });
});
