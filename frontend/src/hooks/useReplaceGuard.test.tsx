import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchState, record } from '../test/fixtures';
import { i18nWrapper } from '../test/withI18n';
import type { BatchState } from '../types/reconciliation';
import { useReplaceGuard } from './useReplaceGuard';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const decided = record({
  tx_id: 'A',
  status: 'RESOLVED',
  resolution: {
    action: 'REJECT',
    resolution_note: 'n',
    resolved_at: '2026-11-18T10:00:00Z',
    anomaly_type: 'AMOUNT_VARIANCE',
    variance: -1,
  },
});

function Harness({ state, action }: { state: BatchState; action: () => void }) {
  const { guard, dialog } = useReplaceGuard(state);
  return (
    <>
      <button type="button" onClick={() => guard(action)}>
        reset
      </button>
      {dialog}
    </>
  );
}

function setup(state: BatchState) {
  const action = vi.fn();
  render(<Harness state={state} action={action} />, { wrapper: i18nWrapper('en') });
  fireEvent.click(screen.getByRole('button', { name: 'reset' }));
  return action;
}

describe('useReplaceGuard', () => {
  it('runs the action at once when nothing would be lost', () => {
    const action = setup(batchState());
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks first and says exactly what would be discarded', () => {
    const state = batchState({
      records: [decided],
      source: { kind: 'UPLOADED', label: 'march.xlsx', loaded_at: '2026-11-18T10:00:00Z' },
    });
    const action = setup(state);

    expect(action).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Replace the current batch?');
    expect(dialog.textContent).toContain('The uploaded batch march.xlsx will be replaced.');
    expect(dialog.textContent).toContain('1 audit decision will be discarded.');
    expect(dialog.textContent).toContain('This cannot be undone.');
  });

  it('puts the focus on Cancel so a stray Enter does not confirm', () => {
    setup(batchState({ records: [decided] }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('does nothing when the user cancels, by button or with Escape', () => {
    const action = setup(batchState({ records: [decided] }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it('runs the action once when the user confirms', () => {
    const action = setup(batchState({ records: [decided] }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace Batch' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
