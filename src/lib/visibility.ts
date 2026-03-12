export type VisibilityState = 'hidden' | 'visible';

export interface VisibilityEvent {
  state: VisibilityState;
  hiddenDurationMs: number;
}

type VisibilitySubscriber = (event: VisibilityEvent) => void;

const subscribers = new Set<VisibilitySubscriber>();
let hiddenAt: number | null = null;
let listening = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const DEBOUNCE_MS = 300; // coalesce rapid visibility changes

function notify(event: VisibilityEvent) {
  subscribers.forEach((subscriber) => {
    try {
      subscriber(event);
    } catch (error) {
      console.error('[visibility] subscriber error:', error);
    }
  });
}

function handleVisibilityChange() {
  if (typeof document === 'undefined') return;

  if (document.visibilityState === 'hidden') {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    hiddenAt = Date.now();
    console.log('[Visibility] tab hidden');
    notify({ state: 'hidden', hiddenDurationMs: 0 });
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = null;
    console.log(`[Visibility] tab visible — was hidden for ${Math.round(elapsed / 1000)}s (subscribers: ${subscribers.size})`);
    notify({ state: 'visible', hiddenDurationMs: elapsed });
  }, DEBOUNCE_MS);
}

function startListening() {
  if (listening || typeof document === 'undefined') return;

  listening = true;
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function stopListening() {
  if (!listening || typeof document === 'undefined') return;

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  listening = false;
  hiddenAt = null;
}

export function subscribeVisibilityChange(subscriber: VisibilitySubscriber): () => void {
  subscribers.add(subscriber);
  startListening();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      stopListening();
    }
  };
}
