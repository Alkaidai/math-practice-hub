import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

function findScrollContainer(): HTMLElement | null {
  const main = document.querySelector('main');
  if (main && main.scrollHeight > main.clientHeight) return main as HTMLElement;
  let el = main?.parentElement ?? null;
  while (el) {
    if (el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const container = findScrollContainer();
      if (!container) return;
      const handler = () => setVisible(container.scrollTop > 120);
      container.addEventListener('scroll', handler, { passive: true });
      handler();
      return () => container.removeEventListener('scroll', handler);
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => findScrollContainer()?.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-all animate-in fade-in"
      aria-label="Voltar ao topo"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
