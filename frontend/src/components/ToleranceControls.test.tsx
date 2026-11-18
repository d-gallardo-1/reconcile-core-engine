import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18nWrapper } from '../test/withI18n';
import type { CurrencyInfo, ToleranceConfig } from '../types/reconciliation';
import { ToleranceControls } from './ToleranceControls';

const GBP: CurrencyInfo = { code: 'GBP', minor_units: 2, max_amount_tolerance: 50, amount_tolerance_step: 0.5 };
const JPY: CurrencyInfo = { code: 'JPY', minor_units: 0, max_amount_tolerance: 10000, amount_tolerance_step: 100 };
const COMMIT_DELAY_MS = 250;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup(); // without test globals the library does not unmount by itself
  vi.useRealTimers();
  window.localStorage.clear();
});

function setup(tolerance: ToleranceConfig, currency = GBP, accepted = true) {
  const onCommit = vi.fn(() => Promise.resolve(accepted));
  const view = (value: ToleranceConfig, money = currency) => (
    <ToleranceControls tolerance={value} currency={money} disabled={false} onCommit={onCommit} />
  );
  const utils = render(view(tolerance), { wrapper: i18nWrapper('en', currency.code) });
  const amount = screen.getByLabelText('Amount tolerance, exact value') as HTMLInputElement;
  const days = screen.getByLabelText('Date window in days, exact value') as HTMLInputElement;
  const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });
  const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  return { onCommit, amount, days, type, wait, rerender: (v: ToleranceConfig, m?: CurrencyInfo) => utils.rerender(view(v, m)) };
}

describe('ToleranceControls', () => {
  it('sends a change once, after a short pause, with both values', async () => {
    const { onCommit, amount, type, wait } = setup({ amount_tolerance: 15, date_window_days: 2 });
    type(amount, '5');
    type(amount, '7');
    expect(onCommit).not.toHaveBeenCalled();

    await wait(COMMIT_DELAY_MS);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(7, 2);
  });

  it('keeps values inside the range of the currency', async () => {
    const { onCommit, amount, days, type, wait } = setup({ amount_tolerance: 15, date_window_days: 2 });
    type(amount, '999');
    await wait(COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenLastCalledWith(50, 2);

    type(days, '-4');
    await wait(COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenLastCalledWith(50, 0);
  });

  it('rounds to the decimals of the currency: pennies in GBP, none in JPY', async () => {
    const gbp = setup({ amount_tolerance: 15, date_window_days: 2 });
    gbp.type(gbp.amount, '0.606');
    await gbp.wait(COMMIT_DELAY_MS);
    expect(gbp.onCommit).toHaveBeenLastCalledWith(0.61, 2);
  });

  it('never sends a fraction of a yen', async () => {
    const jpy = setup({ amount_tolerance: 3000, date_window_days: 2 }, JPY);
    jpy.type(jpy.amount, '1500.55');
    await jpy.wait(COMMIT_DELAY_MS);
    expect(jpy.onCommit).toHaveBeenLastCalledWith(1501, 2);
  });

  it('ignores an empty field instead of sending zero', async () => {
    const { onCommit, amount, type, wait } = setup({ amount_tolerance: 15, date_window_days: 2 });
    type(amount, '');
    await wait(COMMIT_DELAY_MS);
    expect(onCommit).not.toHaveBeenCalled();
    expect(amount.value).toBe('15');
  });

  it('shows the server value again when the change is refused', async () => {
    const { amount, type, wait } = setup({ amount_tolerance: 15, date_window_days: 2 }, GBP, false);
    type(amount, '20');
    expect(amount.value).toBe('20');
    await wait(COMMIT_DELAY_MS);
    expect(amount.value).toBe('15');
  });

  it('shows a value set from another tab', () => {
    const { amount, rerender } = setup({ amount_tolerance: 15, date_window_days: 2 });
    rerender({ amount_tolerance: 30, date_window_days: 2 });
    expect(amount.value).toBe('30');
  });

  it('keeps a newer edit when the echo of an earlier one arrives', async () => {
    // Regression: the echo of the first commit used to discard the second edit.
    const { onCommit, amount, type, wait, rerender } = setup({ amount_tolerance: 15, date_window_days: 2 });
    type(amount, '20');
    await wait(COMMIT_DELAY_MS); // 20 is sent
    type(amount, '25'); // the user keeps going before the server answers
    rerender({ amount_tolerance: 20, date_window_days: 2 }); // echo of 20

    expect(amount.value).toBe('25');
    await wait(COMMIT_DELAY_MS);
    expect(onCommit).toHaveBeenLastCalledWith(25, 2);
  });

  it('drops a pending edit when the batch currency changes', async () => {
    const { onCommit, amount, type, wait, rerender } = setup({ amount_tolerance: 15, date_window_days: 2 });
    type(amount, '40');
    rerender({ amount_tolerance: 3000, date_window_days: 2 }, JPY);
    expect(amount.value).toBe('3000');
    await wait(COMMIT_DELAY_MS);
    // 40 was a GBP amount; it must not be sent as yen.
    expect(onCommit).not.toHaveBeenCalled();
  });
});
