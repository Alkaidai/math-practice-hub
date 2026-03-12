/**
 * Global refresh lock to serialize tab-return operations.
 * Dashboard refresh takes priority; SessionTracker waits for it to finish.
 */

let lockPromise: Promise<void> | null = null;
let lockResolve: (() => void) | null = null;

export function acquireRefreshLock(): void {
  if (lockPromise) {
    console.log('[RefreshLock] already held — skipping re-acquire');
    return;
  }
  lockPromise = new Promise<void>((resolve) => {
    lockResolve = resolve;
  });
  console.log('[RefreshLock] 🔒 acquired');
}

export function releaseRefreshLock(): void {
  if (lockResolve) {
    lockResolve();
    lockResolve = null;
  }
  lockPromise = null;
  console.log('[RefreshLock] 🔓 released');
}

/**
 * Returns a promise that resolves when the lock is released (or immediately if not held).
 */
export function waitForRefreshLock(): Promise<void> {
  if (!lockPromise) return Promise.resolve();
  console.log('[RefreshLock] ⏳ waiting for lock release...');
  return lockPromise;
}

export function isRefreshLocked(): boolean {
  return lockPromise !== null;
}
