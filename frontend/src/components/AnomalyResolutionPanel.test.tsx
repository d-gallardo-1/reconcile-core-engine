import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { neighbours } from '../lib/navigation';
import { record } from '../test/fixtures';
import { i18nWrapper } from '../test/withI18n';
import { AnomalyResolutionPanel } from './AnomalyResolutionPanel';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const ORDER = ['TX-1', 'TX-2', 'TX-3'];
const anomaly = (txId: string) =>
  record({ tx_id: txId, status: 'ANOMALY', anomaly_type: 'AMOUNT_VARIANCE', variance: -180 });

function setup(current: string) {
  const onNavigate = vi.fn();
  const onClose = vi.fn();
  const view = (txId: string) => (
    <AnomalyResolutionPanel
      record={anomaly(txId)}
      neighbours={neighbours(ORDER, txId)}
      onNavigate={onNavigate}
      onClose={onClose}
    />
  );
  const utils = render(view(current), { wrapper: i18nWrapper('en') });
  return { onNavigate, onClose, show: (txId: string) => utils.rerender(view(txId)) };
}

describe('AnomalyResolutionPanel keyboard navigation', () => {
  it('moves to the next and previous record with the arrow keys', () => {
    const { onNavigate } = setup('TX-2');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onNavigate.mock.calls).toEqual([['TX-3'], ['TX-1']]);
  });

  it('shows the position and offers the same moves as buttons', () => {
    const { onNavigate } = setup('TX-2');
    expect(screen.getByText('2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous record' }));
    expect(onNavigate.mock.calls).toEqual([['TX-3'], ['TX-1']]);
  });

  it('does nothing at the ends of the list', () => {
    const first = setup('TX-1');
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(first.onNavigate).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Previous record' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    const last = setup('TX-3');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(last.onNavigate).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Next record' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('leaves the arrow keys to the audit note while it is being written', () => {
    const { onNavigate } = setup('TX-2');
    const note = screen.getByLabelText(/Audit note/);
    fireEvent.keyDown(note, { key: 'ArrowDown' });
    fireEvent.keyDown(note, { key: 'ArrowUp' });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('ignores arrows pressed with a modifier, which browsers use for their own shortcuts', () => {
    const { onNavigate } = setup('TX-2');
    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(window, { key: 'ArrowDown', ctrlKey: true });
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('closes with Escape, even from inside the note', () => {
    const { onClose } = setup('TX-2');
    fireEvent.keyDown(screen.getByLabelText(/Audit note/), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh note for each record', () => {
    const { show } = setup('TX-1');
    const note = () => screen.getByLabelText(/Audit note/) as HTMLTextAreaElement;
    fireEvent.change(note(), { target: { value: 'Evidence for TX-1 only.' } });
    expect(note().value).toBe('Evidence for TX-1 only.');

    show('TX-2');

    // A note written for one anomaly must not be submitted for another.
    expect(note().value).toBe('');
    expect(screen.getByText('TX-2')).toBeTruthy();
  });

  it('follows the neighbours of the record now shown', () => {
    const { onNavigate, show } = setup('TX-1');
    show('TX-2');
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onNavigate).toHaveBeenLastCalledWith('TX-3');
  });
});
