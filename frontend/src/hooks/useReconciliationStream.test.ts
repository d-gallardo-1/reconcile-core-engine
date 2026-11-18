import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from '../test/fakeEventSource';
import { batchState, progress, runState } from '../test/fixtures';
import { useReconciliationStream } from './useReconciliationStream';

const RETRY_MS = 3000;
const STALE_MS = 8000;

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = () => renderHook(() => useReconciliationStream());
const emit = (type: string, data: unknown) => act(() => FakeEventSource.latest.emit(type, data));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useReconciliationStream', () => {
  it('connects to the stream and exposes the snapshot', () => {
    const { result } = mount();
    expect(FakeEventSource.latest.url).toBe('/api/v1/stream');
    expect(result.current.status).toBe('RECONNECTING');
    expect(result.current.state).toBeNull();

    emit('snapshot', batchState({ sequence: 7 }));

    expect(result.current.status).toBe('CONNECTED');
    expect(result.current.state?.sequence).toBe(7);
  });

  it('applies later state updates', () => {
    const { result } = mount();
    emit('snapshot', batchState({ sequence: 1 }));
    emit('state_update', batchState({ sequence: 2 }));
    expect(result.current.state?.sequence).toBe(2);
  });

  it('follows a live run from its first step and forgets it when it ends', () => {
    const { result } = mount();
    emit('snapshot', batchState());
    emit('state_update', batchState({ run: runState({ processed: 0 }) }));
    emit('reconciliation_progress', progress({ tx_id: 'TX-1', processed: 1 }));

    expect(result.current.liveRun?.overlay).toBe(true);
    expect(result.current.liveRun?.verdicts).toEqual({ 'TX-1': 'EXACT_MATCH' });

    emit('state_update', batchState({ run: runState({ status: 'COMPLETED', processed: 24 }) }));
    expect(result.current.liveRun).toBeNull();
  });

  it('rebuilds the connection after silence longer than the heartbeat allows', () => {
    const { result } = mount();
    emit('snapshot', batchState());
    const first = FakeEventSource.latest;

    advance(STALE_MS - 1);
    expect(result.current.status).toBe('CONNECTED');
    advance(1);
    expect(result.current.status).toBe('RECONNECTING');
    expect(first.readyState).toBe(FakeEventSource.CLOSED);

    advance(RETRY_MS);
    expect(FakeEventSource.latest).not.toBe(first);
  });

  it('stays connected while heartbeats keep arriving', () => {
    const { result } = mount();
    emit('snapshot', batchState());
    for (let beat = 0; beat < 4; beat += 1) {
      advance(5000);
      emit('heartbeat', {});
    }
    expect(result.current.status).toBe('CONNECTED');
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('retries a connection attempt that never gets an answer', () => {
    mount();
    const first = FakeEventSource.latest;
    // No open, no error, no event: a proxy holding the request.
    advance(STALE_MS + RETRY_MS);
    expect(FakeEventSource.latest).not.toBe(first);
  });

  it('retries by itself when the server answered with an HTTP error', () => {
    const { result } = mount();
    const first = FakeEventSource.latest;
    act(() => first.fail(true)); // the browser gave up
    expect(result.current.status).toBe('RECONNECTING');
    advance(RETRY_MS);
    expect(FakeEventSource.latest).not.toBe(first);
  });

  it('reports the engine as disconnected after three failures in a row', () => {
    const { result } = mount();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      act(() => FakeEventSource.latest.fail(true));
      advance(RETRY_MS);
    }
    expect(result.current.status).toBe('DISCONNECTED');
    emit('snapshot', batchState());
    expect(result.current.status).toBe('CONNECTED');
  });

  it('treats a malformed event as a stream failure, not as a live connection', () => {
    const { result } = mount();
    emit('snapshot', batchState({ sequence: 3 }));
    const first = FakeEventSource.latest;

    act(() => {
      const listener = { data: '{"truncated": ' } as MessageEvent<string>;
      // Deliver a broken payload the way the browser would.
      (first as unknown as { listeners: Map<string, ((e: MessageEvent<string>) => void)[]> }).listeners
        .get('state_update')
        ?.forEach((handle) => handle(listener));
    });

    expect(result.current.status).toBe('RECONNECTING');
    expect(result.current.state?.sequence).toBe(3); // the last good state is kept
    advance(RETRY_MS);
    expect(FakeEventSource.latest).not.toBe(first);
  });

  it('closes the connection and its timers when the component goes away', () => {
    const { unmount } = mount();
    const source = FakeEventSource.latest;
    unmount();
    expect(source.readyState).toBe(FakeEventSource.CLOSED);
    advance(STALE_MS + RETRY_MS);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
