import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../lib/api';
import { batchState, record } from '../test/fixtures';
import { i18nWrapper } from '../test/withI18n';
import type { Resolution } from '../types/reconciliation';
import { AuditTrailView } from './AuditTrailView';
import { ConfirmDialog } from './ConfirmDialog';
import { MobileSort } from './MobileSort';
import { TemplateVerifier } from './TemplateVerifier';
import { ThreeWayMatchTable } from './ThreeWayMatchTable';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const wrapper = () => ({ wrapper: i18nWrapper('en') });
const decision = (resolved_at: string): Resolution => ({
  action: 'APPROVE_VARIANCE',
  resolution_note: 'Checked with the supplier.',
  resolved_at,
  anomaly_type: 'AMOUNT_VARIANCE',
  variance: -180,
});
const screenWidth = (wide: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: wide, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe('TemplateVerifier', () => {
  async function verifyAFile() {
    vi.spyOn(api, 'verifyTemplate').mockResolvedValue({ valid: true, row_count: 3, errors: [] });
    render(<TemplateVerifier state={batchState()} maxUploadBytes={2_000_000} />, wrapper());
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'march.xlsx')] } });
    });
  }

  it('shows no verdict while a file is still being verified', async () => {
    let answer: (value: { valid: boolean; row_count: number; errors: string[] }) => void = () => undefined;
    vi.spyOn(api, 'verifyTemplate').mockReturnValue(new Promise((resolve) => (answer = resolve)));
    render(<TemplateVerifier state={batchState()} maxUploadBytes={2_000_000} />, wrapper());
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'march.xlsx')] } });
    });

    expect(screen.queryByText(/not valid/)).toBeNull();
    expect(screen.getByText('Verifying…')).toBeTruthy();

    await act(async () => answer({ valid: true, row_count: 3, errors: [] }));
    expect(screen.getByText(/valid, 3 records/)).toBeTruthy();
  });

  it('offers to load a workbook only after it verified as valid', async () => {
    await verifyAFile();
    expect(screen.getByText(/valid, 3 records/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load as Active Batch' })).toBeTruthy();
    expect(screen.getByText(/Do not upload confidential data/)).toBeTruthy();
  });

  it('keeps a valid workbook valid when loading it is refused', async () => {
    await verifyAFile();
    vi.spyOn(api, 'uploadBatch').mockRejectedValue(new ApiError('RUN_IN_PROGRESS', 'busy'));

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Load as Active Batch' })));

    // The refusal is about the engine, not the file: it can be loaded again.
    expect(screen.getByText(/valid, 3 records/)).toBeTruthy();
    expect(screen.queryByText(/not valid/)).toBeNull();
    expect(screen.getByText(/A reconciliation run is in progress/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load as Active Batch' })).toBeTruthy();
  });

  it('confirms a successful load and stops offering it', async () => {
    await verifyAFile();
    vi.spyOn(api, 'uploadBatch').mockResolvedValue(batchState());
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Load as Active Batch' })));
    expect(screen.getByText(/Loaded as the active batch/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load as Active Batch' })).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  it('leaves the focus where the user put it when the page re-renders', () => {
    const view = (onCancel: () => void) => (
      <ConfirmDialog title="t" lines={['l']} confirmLabel="Go" cancelLabel="Stop" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    const { rerender } = render(view(() => undefined));
    const confirm = screen.getByRole('button', { name: 'Go' });
    confirm.focus();

    rerender(view(() => undefined)); // a live update gives the dialog a new handler

    expect(document.activeElement).toBe(confirm);
  });

  it('still cancels through the handler of the latest render', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const view = (onCancel: () => void) => (
      <ConfirmDialog title="t" lines={['l']} confirmLabel="Go" cancelLabel="Stop" onConfirm={vi.fn()} onCancel={onCancel} />
    );
    const { rerender } = render(view(first));
    rerender(view(latest));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});

describe('MobileSort', () => {
  it('names a column order it does not offer instead of claiming the batch order', () => {
    render(<MobileSort sort={{ key: 'erp_amount', direction: 'desc' }} onChange={vi.fn()} />, wrapper());
    const select = screen.getByLabelText('Sort') as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe('Column order');
  });

  it('applies the chosen order', () => {
    const onChange = vi.fn();
    render(<MobileSort sort={null} onChange={onChange} />, wrapper());
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'variance' } });
    expect(onChange).toHaveBeenCalledWith({ key: 'variance', direction: 'desc' });
  });
});

describe('AuditTrailView', () => {
  it('lists decisions newest first and hands their order to the drawer', () => {
    const state = batchState({
      records: [
        record({ tx_id: 'OLD', status: 'RESOLVED', resolution: decision('2026-11-18T09:00:00Z') }),
        record({ tx_id: 'OPEN', status: 'ANOMALY' }),
        record({ tx_id: 'NEW', status: 'RESOLVED', resolution: decision('2026-11-18T11:00:00Z') }),
      ],
    });
    const onShownChange = vi.fn();
    const onOpen = vi.fn();
    render(<AuditTrailView state={state} onOpen={onOpen} onShownChange={onShownChange} />, wrapper());

    expect(screen.getByText(/2 decisions/)).toBeTruthy();
    expect(screen.getByText(/not who took it/)).toBeTruthy();
    expect(onShownChange).toHaveBeenLastCalledWith(['NEW', 'OLD']);
    fireEvent.click(screen.getByRole('button', { name: 'Open details for NEW' }));
    expect(onOpen).toHaveBeenCalledWith('NEW');
  });

  it('says so when no decision has been recorded', () => {
    render(<AuditTrailView state={batchState()} onOpen={vi.fn()} onShownChange={vi.fn()} />, wrapper());
    expect(screen.getByText('No decision has been recorded in this batch yet.')).toBeTruthy();
  });
});

describe('ThreeWayMatchTable layout', () => {
  const table = () =>
    render(<ThreeWayMatchTable state={batchState()} liveRun={null} onOpen={vi.fn()} onShownChange={vi.fn()} />, wrapper());

  it('mounts the table alone on a wide screen', () => {
    screenWidth(true);
    table();
    expect(document.querySelector('table')).not.toBeNull();
    // One control per record: nothing is rendered twice and hidden.
    expect(screen.getAllByRole('button', { name: 'Open details for TX-1' })).toHaveLength(1);
    expect(screen.queryByLabelText('Sort')).toBeNull();
  });

  it('mounts the cards and the sort menu alone on a narrow screen', () => {
    screenWidth(false);
    table();
    expect(document.querySelector('table')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Open details for TX-1' })).toHaveLength(1);
    expect(screen.getByLabelText('Sort')).toBeTruthy();
  });
});
