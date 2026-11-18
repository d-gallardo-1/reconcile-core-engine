import { describe, expect, it } from 'vitest';
import { record } from '../test/fixtures';
import { rankExposure } from './exposure';
import { applyView, matchesQuery, nextSort, type TableView } from './tableView';

const rows = [
  record({ tx_id: 'TX-9001', invoice_ref: 'INV-801', counterparty: 'Northgate Haulage Ltd', erp_amount: 24500, bank_amount: 24500 }),
  record({ tx_id: 'TX-9007', invoice_ref: 'INV-830', counterparty: 'Lumière Composants SARL', erp_amount: 19680, bank_amount: 19680 }),
  record({ tx_id: 'TX-9010', invoice_ref: 'INV-852', counterparty: 'Rhein-Maas Freight GmbH', erp_amount: 12400, bank_amount: 12385, variance: -15, status: 'TOLERANCE_MATCH' }),
  record({ tx_id: 'TX-9013', invoice_ref: 'INV-866', counterparty: 'Brightwater Supply', erp_amount: 9860, bank_amount: 9680, variance: -180, status: 'ANOMALY' }),
  record({ tx_id: 'TX-9302', invoice_ref: 'INV-884', counterparty: 'Quayside Marine', erp_amount: 3450, bank_amount: 3450, variance: 3450, status: 'ANOMALY' }),
  record({ tx_id: 'TX-9303', invoice_ref: 'INV-890', counterparty: 'Fellside Instrumentation', erp_amount: 6120, bank_amount: null, variance: -6120, status: 'ANOMALY' }),
  record({ tx_id: 'TX-9015', invoice_ref: 'INV-875', counterparty: 'Wold Edge Catering', variance: 0, status: 'ANOMALY' }),
  record({ tx_id: 'TX-9301', invoice_ref: 'INV-881', counterparty: 'Aldermoor Engineering', variance: -1800, status: 'RESOLVED' }),
];
const view = (overrides: Partial<TableView> = {}): TableView => ({ filter: 'ALL', query: '', sort: null, ...overrides });
const ids = (records: { tx_id: string }[]) => records.map((r) => r.tx_id);

describe('search', () => {
  it('finds a record by id, invoice or counterparty, ignoring case', () => {
    expect(ids(applyView(rows, view({ query: 'tx-9013' })))).toEqual(['TX-9013']);
    expect(ids(applyView(rows, view({ query: 'inv-884' })))).toEqual(['TX-9302']);
    expect(ids(applyView(rows, view({ query: 'FREIGHT' })))).toEqual(['TX-9010']);
  });

  it('ignores accents, so a plain keyboard finds accented names', () => {
    expect(ids(applyView(rows, view({ query: 'lumiere' })))).toEqual(['TX-9007']);
  });

  it('requires every word, in any order', () => {
    expect(matchesQuery(rows[0], 'haulage northgate')).toBe(true);
    expect(matchesQuery(rows[0], 'northgate marine')).toBe(false);
  });

  it('treats an empty or blank query as no search', () => {
    expect(applyView(rows, view({ query: '   ' }))).toHaveLength(rows.length);
  });

  it('combines with the status filter', () => {
    expect(ids(applyView(rows, view({ filter: 'ANOMALY', query: '93' })))).toEqual(['TX-9302', 'TX-9303']);
    expect(applyView(rows, view({ filter: 'EXACT_MATCH', query: 'quayside' }))).toEqual([]);
  });
});

describe('sorting', () => {
  it('keeps the batch order when no column is chosen', () => {
    expect(ids(applyView(rows, view()))).toEqual(ids(rows));
  });

  it('sorts variance by size, whatever the sign', () => {
    const sorted = applyView(rows, view({ sort: { key: 'variance', direction: 'desc' } }));
    expect(ids(sorted).slice(0, 4)).toEqual(['TX-9303', 'TX-9302', 'TX-9301', 'TX-9013']);
  });

  it('puts a missing amount last in both directions', () => {
    const descending = applyView(rows, view({ sort: { key: 'bank_amount', direction: 'desc' } }));
    const ascending = applyView(rows, view({ sort: { key: 'bank_amount', direction: 'asc' } }));
    expect(ids(descending).slice(-1)[0]).toBe('TX-9303');
    expect(ids(ascending).slice(-1)[0]).toBe('TX-9303');
    expect(ids(descending)[0]).toBe('TX-9001');
  });

  it('sorts text without regard to case or accents and ids numerically', () => {
    const byName = applyView(rows, view({ sort: { key: 'counterparty', direction: 'asc' } }));
    expect(ids(byName).slice(0, 3)).toEqual(['TX-9301', 'TX-9013', 'TX-9303']);
    const byId = applyView(rows, view({ sort: { key: 'tx_id', direction: 'desc' } }));
    expect(ids(byId)[0]).toBe('TX-9303');
  });

  it('puts what needs attention first when sorting by classification', () => {
    const sorted = applyView(rows, view({ sort: { key: 'status', direction: 'asc' } }));
    expect(sorted.map((r) => r.status).slice(0, 5)).toEqual(['ANOMALY', 'ANOMALY', 'ANOMALY', 'ANOMALY', 'RESOLVED']);
    // Equal records keep their batch order.
    expect(ids(sorted).slice(0, 4)).toEqual(['TX-9013', 'TX-9302', 'TX-9303', 'TX-9015']);
  });

  it('does not reorder the array it was given', () => {
    const before = ids(rows);
    applyView(rows, view({ sort: { key: 'variance', direction: 'desc' } }));
    expect(ids(rows)).toEqual(before);
  });

  it('cycles a header: first order, reversed, back to batch order', () => {
    const first = nextSort(null, 'variance');
    expect(first).toEqual({ key: 'variance', direction: 'desc' }); // amounts: largest first
    expect(nextSort(first, 'variance')).toEqual({ key: 'variance', direction: 'asc' });
    expect(nextSort({ key: 'variance', direction: 'asc' }, 'variance')).toBeNull();
    expect(nextSort(first, 'counterparty')).toEqual({ key: 'counterparty', direction: 'asc' });
  });
});

describe('exposure ranking', () => {
  it('ranks open anomalies by the size of their variance with their share', () => {
    const ranking = rankExposure(rows);
    expect(ids(ranking.items.map((item) => item.record))).toEqual(['TX-9303', 'TX-9302', 'TX-9013']);
    expect(ranking.total).toBe(6120 + 3450 + 180);
    expect(ranking.items[0].share).toBeCloseTo((6120 / 9750) * 100, 5);
    expect(ranking.items.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(100, 5);
  });

  it('leaves out resolved records and counts anomalies without an amount apart', () => {
    const ranking = rankExposure(rows);
    expect(ranking.items.some((item) => item.record.tx_id === 'TX-9301')).toBe(false);
    expect(ranking.restCount).toBe(1); // TX-9015: a VAT problem with no amount difference
  });

  it('limits the list and reports how many open anomalies are not shown', () => {
    const ranking = rankExposure(rows, 2);
    expect(ranking.items).toHaveLength(2);
    expect(ranking.restCount).toBe(2);
    expect(ranking.total).toBe(9750); // the total still covers every open anomaly
  });

  it('is empty when nothing is open', () => {
    expect(rankExposure([record()])).toEqual({ items: [], total: 0, restCount: 0 });
  });
});
