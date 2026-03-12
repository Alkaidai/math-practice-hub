export type VisibilityState = 'hidden' | 'visible';

export interface VisibilityEvent {
  state: VisibilityState;
  hiddenDurationMs: number;
}

type VisibilitySubscriber = (event: VisibilityEvent) => void;

const subscribers = new Set<VisibilitySubscriber>();
let hiddenAt: number | null = null;
let listening = false;

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
    hiddenAt = Date.now();
    notify({ state: 'hidden', hiddenDurationMs: 0 });
    return;
  }

  const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;
  hiddenAt = null;
  notify({ state: 'visible', hiddenDurationMs: elapsed });
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
