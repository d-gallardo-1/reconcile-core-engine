import { describe, expect, it } from 'vitest';
import { record } from '../test/fixtures';
import { isTyping, navigationOrder, neighbours } from './navigation';
import { pruneSelection, summarize, toggle, toggleAll } from './selection';

const fee = record({ tx_id: 'TX-10', status: 'ANOMALY', anomaly_type: 'AMOUNT_VARIANCE', variance: -15 });
const rounding = record({ tx_id: 'TX-12', status: 'ANOMALY', anomaly_type: 'AMOUNT_VARIANCE', variance: -0.6 });
const vat = record({ tx_id: 'TX-15', status: 'ANOMALY', anomaly_type: 'VAT_MISMATCH', variance: 0 });
const matched = record({ tx_id: 'TX-01' });
const resolved = record({ tx_id: 'TX-30', status: 'RESOLVED', anomaly_type: 'AMOUNT_VARIANCE', variance: -5 });
const rows = [matched, fee, rounding, vat, resolved];

describe('selection', () => {
  it('adds and removes one record', () => {
    const one = toggle(new Set(), 'TX-10');
    expect([...one]).toEqual(['TX-10']);
    expect([...toggle(one, 'TX-10')]).toEqual([]);
  });

  it('selects every open anomaly shown, and clears them on a second use', () => {
    const all = toggleAll(new Set(), rows);
    // Matched and resolved rows cannot be selected.
    expect([...all].sort()).toEqual(['TX-10', 'TX-12', 'TX-15']);
    expect([...toggleAll(all, rows)]).toEqual([]);
  });

  it('completes a partial selection instead of clearing it', () => {
    expect([...toggleAll(new Set(['TX-10']), rows)].sort()).toEqual(['TX-10', 'TX-12', 'TX-15']);
  });

  it('keeps selected rows that the current filter hides', () => {
    const next = toggleAll(new Set(['TX-15']), [fee, rounding]);
    expect([...next].sort()).toEqual(['TX-10', 'TX-12', 'TX-15']);
  });

  it('drops records that stopped being open anomalies', () => {
    const selected = new Set(['TX-10', 'TX-12']);
    const afterResolve = [matched, { ...fee, status: 'RESOLVED' as const }, rounding];
    expect([...pruneSelection(selected, afterResolve)]).toEqual(['TX-12']);
    expect([...pruneSelection(selected, [matched])]).toEqual([]);
  });

  it('returns the same set when nothing was dropped', () => {
    const selected = new Set(['TX-10']);
    expect(pruneSelection(selected, rows)).toBe(selected);
  });

  it('summarises one cause: records in batch order and an exact total', () => {
    const summary = summarize(new Set(['TX-12', 'TX-10']), rows);
    expect(summary.records.map((r) => r.tx_id)).toEqual(['TX-10', 'TX-12']);
    expect(summary.causes).toEqual(['AMOUNT_VARIANCE']);
    expect(summary.mixed).toBe(false);
    expect(summary.total).toBe(-15.6); // not -15.600000000000001
  });

  it('flags a selection that mixes causes', () => {
    const summary = summarize(new Set(['TX-10', 'TX-15']), rows);
    expect(summary.mixed).toBe(true);
    expect(summary.causes).toEqual(['AMOUNT_VARIANCE', 'VAT_MISMATCH']);
  });

  it('ignores ids that are not open anomalies', () => {
    const summary = summarize(new Set(['TX-01', 'TX-30', 'TX-10']), rows);
    expect(summary.records.map((r) => r.tx_id)).toEqual(['TX-10']);
  });
});

describe('navigation', () => {
  const order = ['A', 'B', 'C'];

  it('gives the records around the current one and its position', () => {
    expect(neighbours(order, 'B')).toEqual({ previous: 'A', next: 'C', position: 2, total: 3 });
  });

  it('stops at both ends instead of wrapping', () => {
    expect(neighbours(order, 'A').previous).toBeNull();
    expect(neighbours(order, 'C').next).toBeNull();
  });

  it('offers no move when the record is not in the list', () => {
    expect(neighbours(order, 'Z')).toEqual({ previous: null, next: null, position: 0, total: 3 });
    expect(neighbours(order, null).position).toBe(0);
  });

  it('steps through the rows shown, or the whole batch when the record is hidden', () => {
    const all = ['A', 'B', 'C', 'D'];
    expect(navigationOrder(['C', 'A'], all, 'A')).toEqual(['C', 'A']); // filtered and sorted
    expect(navigationOrder(['C', 'A'], all, 'D')).toEqual(all); // opened from elsewhere
  });

  it('knows when a key press belongs to a field being typed in', () => {
    expect(isTyping(document.createElement('textarea'))).toBe(true);
    expect(isTyping(document.createElement('select'))).toBe(true);
    const text = document.createElement('input');
    expect(isTyping(text)).toBe(true);
    const box = document.createElement('input');
    box.type = 'checkbox';
    expect(isTyping(box)).toBe(false);
    expect(isTyping(document.createElement('button'))).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});
