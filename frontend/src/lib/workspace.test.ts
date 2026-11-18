import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchState, record } from '../test/fixtures';
import type { Resolution } from '../types/reconciliation';
import { api, ApiError } from './api';
import { workAtRisk } from './atRisk';
import { auditEntries, countByAction } from './auditTrail';

const resolution = (overrides: Partial<Resolution> = {}): Resolution => ({
  action: 'APPROVE_VARIANCE',
  resolution_note: 'Checked.',
  resolved_at: '2026-11-18T10:00:00Z',
  anomaly_type: 'AMOUNT_VARIANCE',
  variance: -15,
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe('workAtRisk', () => {
  it('finds nothing to lose in an untouched synthetic batch', () => {
    expect(workAtRisk(batchState())).toEqual({
      resolutions: 0,
      scenarios: 0,
      uploadedLabel: null,
      any: false,
    });
  });

  it('does not count a tolerance change as work to protect', () => {
    const state = batchState({ tolerance: { amount_tolerance: 0, date_window_days: 0 } });
    expect(workAtRisk(state).any).toBe(false);
  });

  it('counts recorded decisions and injected scenarios', () => {
    const state = batchState({
      records: [
        record({ tx_id: 'A', status: 'RESOLVED', resolution: resolution() }),
        record({ tx_id: 'B', status: 'RESOLVED', resolution: resolution() }),
        record({ tx_id: 'C' }),
      ],
      scenarios: [
        { code: 'SCN-301', anomaly_type: 'WITHHOLDING_GAP', label: 'x', description: 'x', tx_id: 'T', active: true },
        { code: 'SCN-302', anomaly_type: 'DUPLICATE_SETTLEMENT', label: 'x', description: 'x', tx_id: 'U', active: false },
      ],
    });
    expect(workAtRisk(state)).toMatchObject({ resolutions: 2, scenarios: 1, any: true });
  });

  it('treats an uploaded batch as work, even with no decision yet', () => {
    const state = batchState({ source: { kind: 'UPLOADED', label: 'march.xlsx', loaded_at: '2026-11-18T10:00:00Z' } });
    expect(workAtRisk(state)).toMatchObject({ uploadedLabel: 'march.xlsx', any: true });
  });
});

describe('audit trail', () => {
  const records = [
    record({ tx_id: 'OLD', resolution: resolution({ resolved_at: '2026-11-18T09:00:00Z' }) }),
    record({ tx_id: 'OPEN', status: 'ANOMALY' }),
    record({ tx_id: 'NEW', resolution: resolution({ resolved_at: '2026-11-18T11:00:00Z', action: 'REJECT' }) }),
    record({ tx_id: 'BULK-1', resolution: resolution({ resolved_at: '2026-11-18T10:00:00Z' }) }),
    record({ tx_id: 'BULK-2', resolution: resolution({ resolved_at: '2026-11-18T10:00:00Z' }) }),
  ];

  it('lists only records with a decision, newest first', () => {
    expect(auditEntries(records).map((entry) => entry.record.tx_id)).toEqual([
      'NEW',
      'BULK-1',
      'BULK-2',
      'OLD',
    ]);
  });

  it('keeps the batch order for decisions taken at the same moment', () => {
    const ids = auditEntries(records).map((entry) => entry.record.tx_id);
    expect(ids.indexOf('BULK-1')).toBeLessThan(ids.indexOf('BULK-2'));
  });

  it('counts decisions by kind and leaves out kinds that were not used', () => {
    expect(countByAction(auditEntries(records))).toEqual([
      { action: 'APPROVE_VARIANCE', count: 3 },
      { action: 'REJECT', count: 1 },
    ]);
    expect(countByAction([])).toEqual([]);
  });
});

describe('batch upload request', () => {
  it('sends the file as the body and its name as an encoded label header', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['x'], 'libro año.xlsx');

    await api.uploadBatch(file);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/batches/upload'); // the name is not in the URL
    expect((init.headers as Record<string, string>)['X-Batch-Label']).toBe('libro%20a%C3%B1o.xlsx');
    expect(init.body).toBe(file);
  });

  it('keeps the list of workbook problems of a refused upload', async () => {
    const body = { detail: 'The workbook cannot be loaded.', code: 'INVALID_WORKBOOK', errors: ['Row 2: bad', 'Row 3: bad'] };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 422 }))));
    const failure = await api.uploadBatch(new File(['x'], 'a.xlsx')).catch((cause: ApiError) => cause);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('INVALID_WORKBOOK');
    expect((failure as ApiError).details).toEqual(['Row 2: bad', 'Row 3: bad']);
  });
});
