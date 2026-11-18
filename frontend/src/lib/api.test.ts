import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18nFor } from '../test/withI18n';
import { api, ApiError } from './api';
import { errorText } from './errorText';

function respond(status: number, body: unknown, json = true) {
  const response = new Response(json ? JSON.stringify(body) : String(body), { status });
  return vi.fn(() => Promise.resolve(response));
}

async function failureOf(call: () => Promise<unknown>): Promise<ApiError> {
  try {
    await call();
  } catch (cause) {
    return cause as ApiError;
  }
  throw new Error('the call was expected to fail');
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('api requests', () => {
  it('posts the tolerance with the field names the backend expects', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);

    await api.setTolerance(12.5, 3);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/reconcile/tolerance');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ amount_tolerance: 12.5, date_window_days: 3 });
  });

  it('escapes identifiers placed in the path', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);
    await api.resolve('TX/9 1', 'REJECT', 'note');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      '/api/v1/anomalies/TX%2F9%201/resolve',
    );
  });

  it('keeps the code and the detail of a backend error', async () => {
    vi.stubGlobal('fetch', respond(409, { detail: 'A run is in progress.', code: 'RUN_IN_PROGRESS' }));
    const failure = await failureOf(api.reset);
    expect(failure).toBeInstanceOf(ApiError);
    expect([failure.code, failure.message]).toEqual(['RUN_IN_PROGRESS', 'A run is in progress.']);
  });

  it('marks an error without a code as generic and keeps what detail there is', async () => {
    vi.stubGlobal('fetch', respond(422, { detail: 'Body is not valid.' }));
    const noCode = await failureOf(api.reset);
    expect([noCode.code, noCode.message]).toEqual(['GENERIC', 'Body is not valid.']);

    // An HTML page from a proxy: no JSON at all.
    vi.stubGlobal('fetch', respond(502, '<html>Bad Gateway</html>', false));
    const html = await failureOf(api.reset);
    expect(html.code).toBe('GENERIC');
    expect(html.message).toBe('POST /reconcile/reset failed with HTTP 502');
  });

  it('tells a timeout apart from an unreachable engine', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('late', 'TimeoutError'))));
    expect((await failureOf(api.run)).code).toBe('TIMEOUT');

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    expect((await failureOf(api.run)).code).toBe('UNREACHABLE');
  });
});

describe('errorText', () => {
  it('translates a known code', () => {
    const text = errorText(i18nFor('es'), new ApiError('RUN_IN_PROGRESS', 'English detail'));
    expect(text).toBe('Hay una ejecución de conciliación en curso. Espere a que termine.');
  });

  it('keeps the detail of a failure that has no code', () => {
    // A generic sentence alone would hide the only clue about the cause.
    const text = errorText(i18nFor('en'), new ApiError('GENERIC', 'POST /x failed with HTTP 502'));
    expect(text).toBe('The request failed. (POST /x failed with HTTP 502)');
    expect(errorText(i18nFor('en'), new ApiError('GENERIC', ''))).toBe('The request failed.');
  });

  it('shows the English detail for a code this version does not know', () => {
    const text = errorText(i18nFor('es'), new ApiError('CODE_FROM_NEWER_BACKEND', 'Something new.'));
    expect(text).toBe('Something new.');
  });
});
