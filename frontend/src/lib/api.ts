import type {
  BatchState,
  LedgerSchema,
  ResolutionAction,
  RunState,
  TolerancePreview,
  VerifyResult,
} from '../types/reconciliation';

// Same-origin API: Nginx (Docker) or the Vite dev server proxies /api to the backend.
export const API_BASE = '/api/v1';

// A request that gets no answer is abandoned, so the controls do not stay locked.
const REQUEST_TIMEOUT_MS = 15000;

/** An API failure. `code` is stable and translated by the UI; `message` is English. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Individual problems behind the error, for example one per workbook row. */
    readonly details?: string[],
  ) {
    super(message);
  }
}

async function failure(response: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await response.json()) as { detail?: unknown; code?: unknown; errors?: unknown };
    const detail = typeof body.detail === 'string' ? body.detail : fallback;
    const details = Array.isArray(body.errors) ? body.errors.map(String) : undefined;
    return new ApiError(typeof body.code === 'string' ? body.code : 'GENERIC', detail, details);
  } catch {
    return new ApiError('GENERIC', fallback);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw timedOut
      ? new ApiError('TIMEOUT', 'The engine did not answer in time.')
      : new ApiError('UNREACHABLE', 'The engine could not be reached.');
  }
  if (!response.ok) {
    const fallback = `${init?.method ?? 'GET'} ${path} failed with HTTP ${response.status}`;
    throw await failure(response, fallback);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const api = {
  run: () => post<RunState>('/reconcile/run'),
  setCurrency: (currency: string) => post<BatchState>('/batches/currency', { currency }),
  setTolerance: (amountTolerance: number, dateWindowDays: number) =>
    post<BatchState>('/reconcile/tolerance', {
      amount_tolerance: amountTolerance,
      date_window_days: dateWindowDays,
    }),
  /** Read-only: what these rules would change. Nothing is applied. */
  previewTolerance: (amountTolerance: number, dateWindowDays: number) =>
    post<TolerancePreview>('/reconcile/tolerance/preview', {
      amount_tolerance: amountTolerance,
      date_window_days: dateWindowDays,
    }),
  reset: () => post<BatchState>('/reconcile/reset'),
  inject: (scenarioCode: string) =>
    post<BatchState>(`/reconcile/inject/${encodeURIComponent(scenarioCode)}`),
  resolve: (txId: string, action: ResolutionAction, resolutionNote: string) =>
    post<BatchState>(`/anomalies/${encodeURIComponent(txId)}/resolve`, {
      action,
      resolution_note: resolutionNote,
    }),
  /** One decision and one note for several open anomalies of the same cause. */
  resolveMany: (txIds: string[], action: ResolutionAction, resolutionNote: string) =>
    post<BatchState>('/anomalies/resolve-batch', {
      tx_ids: txIds,
      action,
      resolution_note: resolutionNote,
    }),
  ledgerSchema: () => request<LedgerSchema>('/schema/ledger'),
  /** Sends the workbook as the raw request body. The active batch is not changed. */
  verifyTemplate: (file: File) =>
    request<VerifyResult>('/template/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  /**
   * Replaces the active batch with the workbook. The file name travels in a
   * header, not in the URL, and only as a display label.
   */
  uploadBatch: (file: File) =>
    request<BatchState>('/batches/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Batch-Label': encodeURIComponent(file.name),
      },
      body: file,
    }),
  exportExcelUrl: `${API_BASE}/export/excel`,
  exportTemplateUrl: `${API_BASE}/export/template`,
};
