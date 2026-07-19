/**
 * The six UI states, derived from a Result<T>.
 *
 *   loading | success | empty | error | blocked | permission_denied
 *
 * `empty` is distinguished from `success` because an empty list needs a
 * different screen, and `blocked` from `error` because a blocked operation is
 * waiting on something rather than broken.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Result, ServiceError } from '../services/core';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; error: ServiceError }
  | { status: 'blocked'; error: ServiceError }
  | { status: 'permission_denied'; error: ServiceError };

export type StateName = AsyncState<unknown>['status'];

const isEmpty = (v: unknown): boolean =>
  v == null ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Maps a settled Result onto a UI state. Pure — unit-testable without React. */
export function toState<T>(result: Result<T>, emptyCheck: (d: T) => boolean = isEmpty): AsyncState<T> {
  if (!result.ok) {
    switch (result.error.kind) {
      case 'permission_denied': return { status: 'permission_denied', error: result.error };
      case 'blocked':           return { status: 'blocked', error: result.error };
      default:                  return { status: 'error', error: result.error };
    }
  }
  return emptyCheck(result.data) ? { status: 'empty' } : { status: 'success', data: result.data };
}

/**
 * Runs a service call and exposes its state.
 * Ignores results from superseded calls so a slow response cannot overwrite a
 * newer one.
 */
export function useAsync<T>(
  fn: () => Promise<Result<T>>,
  deps: readonly unknown[] = [],
  emptyCheck?: (d: T) => boolean
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const callId = useRef(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const id = ++callId.current;
    let alive = true;
    setState({ status: 'loading' });

    fn()
      .then((r) => { if (alive && id === callId.current) setState(toState(r, emptyCheck)); })
      .catch((e: unknown) => {
        if (alive && id === callId.current) {
          setState({
            status: 'error',
            error: { kind: 'unknown', message: 'error.unknown',
                     detail: e instanceof Error ? e.message : String(e) },
          });
        }
      });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload };
}

/** For actions (confirm, invite, revoke) rather than reads. */
export function useAction<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<Result<T>>
): {
  state: AsyncState<T> | { status: 'idle' };
  run: (...args: Args) => Promise<Result<T>>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T> | { status: 'idle' }>({ status: 'idle' });

  const run = useCallback(
    async (...args: Args) => {
      setState({ status: 'loading' });
      const r = await fn(...args);
      setState(toState(r, () => false)); // an action result is never "empty"
      return r;
    },
    [fn]
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, run, reset };
}
