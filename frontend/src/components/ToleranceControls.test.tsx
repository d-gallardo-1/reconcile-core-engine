import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18nWrapper } from '../test/withI18n';
import type { CurrencyInfo, ToleranceConfig, TolerancePreview } from '../types/reconciliation';
import { ToleranceControls } from './ToleranceControls';

const GBP: CurrencyInfo = { code: 'GBP', minor_units: 2, max_amount_tolerance: 50, amount_tolerance_step: 0.5 };
const JPY: CurrencyInfo = { code: 'JPY', minor_units: 0, max_amount_tolerance: 10000, amount_tolerance_step: 100 };
const APPLIED: ToleranceConfig = { amount_tolerance: 15, date_window_days: 2 };
const PREVIEW_DELAY_MS = 250;

const previewOf = (overrides: Partial<TolerancePreview> = {}): TolerancePreview => ({
  tolerance: APPLIED,
  exact_count: 9,
  tolerance_count: 3,
  anomaly_count: 3,
  resolved_count: 0,
  match_rate_pct: 80,
  newly_matched: [],
  newly_unmatched: [],
  ...overrides,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup(); // without test globals the library does not unmount by itself
  vi.useRealTimers();
  window.localStorage.clear();
});

function setup(options: { currency?: CurrencyInfo; accepted?: boolean; preview?: TolerancePreview } = {}) {
  const currency = options.currency ?? GBP;
  const onApply = vi.fn(() => Promise.resolve(options.accepted ?? true));
  const onPreview = vi.fn(() => Promise.resolve(options.preview ?? previewOf()));
  const view = (tolerance: ToleranceConfig, money: CurrencyInfo, revision: string) => (
    <ToleranceControls
      tolerance={tolerance}
      currency={money}
      disabled={false}
      revision={revision}
      onPreview={onPreview}
      onApply={onApply}
    />
  );
  const utils = render(view(APPLIED, currency, '1'), { wrapper: i18nWrapper('en', currency.code) });
  const amount = screen.getByLabelText('Amount tolerance, exact value') as HTMLInputElement;
  return {
    onApply,
    onPreview,
    amount,
    type: (value: string) => fireEvent.change(amount, { target: { value } }),
    wait: (ms = PREVIEW_DELAY_MS) => act(() => vi.advanceTimersByTimeAsync(ms)),
    click: (name: string) => act(async () => fireEvent.click(screen.getByRole('button', { name }))),
    rerender: (tolerance: ToleranceConfig, revision: string, money = currency) =>
      utils.rerender(view(tolerance, money, revision)),
  };
}

describe('ToleranceControls', () => {
  it('shows no preview and no buttons until a rule is edited', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Apply Rules' })).toBeNull();
    expect(screen.queryByText('Not applied yet')).toBeNull();
  });

  it('previews an edit after a pause and applies nothing by itself', async () => {
    const { onApply, onPreview, type, wait } = setup({
      preview: previewOf({ newly_unmatched: ['TX-9010', 'TX-9011'], match_rate_pct: 66.7 }),
    });
    type('5');
    type('0');
    expect(screen.getByText('Calculating the effect…')).toBeTruthy();
    expect(onPreview).not.toHaveBeenCalled();

    await wait();

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenCalledWith(0, 2);
    expect(screen.getByText('2 records would become anomalies: TX-9010, TX-9011')).toBeTruthy();
    expect(screen.getByText('Match rate would be 66.7%')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('uses the singular and names the records that would start matching', async () => {
    const { type, wait } = setup({ preview: previewOf({ newly_matched: ['TX-9013'] }) });
    type('50');
    await wait();
    expect(screen.getByText('1 record would become matched: TX-9013')).toBeTruthy();
  });

  it('says so when the edit would change nothing', async () => {
    const { type, wait } = setup();
    type('20');
    await wait();
    expect(screen.getByText('No record would change classification.')).toBeTruthy();
  });

  it('applies the draft only when the user asks, then waits for the server value', async () => {
    const { onApply, amount, type, wait, click, rerender } = setup();
    type('20');
    await wait();
    await click('Apply Rules');

    expect(onApply).toHaveBeenCalledWith(20, 2);
    rerender({ amount_tolerance: 20, date_window_days: 2 }, '2');
    expect(amount.value).toBe('20');
    expect(screen.queryByRole('button', { name: 'Apply Rules' })).toBeNull();
  });

  it('cannot be applied while the effect is still being calculated', () => {
    const { type } = setup();
    type('20');
    expect((screen.getByRole('button', { name: 'Apply Rules' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('goes back to the applied rules on discard', async () => {
    const { onApply, amount, type, wait, click } = setup();
    type('40');
    await wait();
    await click('Discard');
    expect(amount.value).toBe('15');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByText('Not applied yet')).toBeNull();
  });

  it('treats editing back to the applied value as no draft', async () => {
    const { onPreview, type, wait } = setup();
    type('20');
    type('15');
    await wait();
    expect(onPreview).not.toHaveBeenCalled();
    expect(screen.queryByText('Not applied yet')).toBeNull();
  });

  it('keeps the draft when applying is refused', async () => {
    const { amount, type, wait, click } = setup({ accepted: false });
    type('20');
    await wait();
    await click('Apply Rules');
    expect(amount.value).toBe('20');
    expect(screen.getByRole('button', { name: 'Apply Rules' })).toBeTruthy();
  });

  it('previews the draft again when the batch changes underneath it', async () => {
    const { onPreview, type, wait, rerender } = setup();
    type('20');
    await wait();
    rerender(APPLIED, '2'); // another tab injected a scenario
    await wait();
    expect(onPreview).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer that arrives after a newer edit', async () => {
    const { onPreview, type, wait } = setup();
    let answerFirst: (value: TolerancePreview) => void = () => undefined;
    onPreview.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
    type('20');
    await wait();
    type('30'); // a newer question; its answer is "no change"
    await wait();
    await act(async () => answerFirst(previewOf({ newly_matched: ['STALE'] })));
    expect(screen.queryByText(/STALE/)).toBeNull();
    expect(screen.getByText('No record would change classification.')).toBeTruthy();
  });

  it('never previews a fraction of a yen and drops a draft on currency change', async () => {
    const { onPreview, amount, type, wait, rerender } = setup({ currency: JPY });
    type('1500.55');
    await wait();
    expect(onPreview).toHaveBeenLastCalledWith(1501, 2);

    type('40');
    rerender(APPLIED, '2', GBP);
    await wait();
    expect(amount.value).toBe('15');
    expect(onPreview).toHaveBeenCalledTimes(1); // the yen draft was not asked about in GBP
  });
});
