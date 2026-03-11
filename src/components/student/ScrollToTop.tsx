import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Try multiple strategies to find the scroll container
    const findContainer = (): HTMLElement | null => {
      const main = document.querySelector('main');
      if (main && main.scrollHeight > main.clientHeight + 10) return main;
      // Check parent of main
      if (main?.parentElement && main.parentElement.scrollHeight > main.parentElement.clientHeight + 10) return main.parentElement;
      // Fallback to document.documentElement
      return document.documentElement;
    };

    let container: HTMLElement | null = null;
    let handler: (() => void) | null = null;

    const setup = () => {
      container = findContainer();
      containerRef.current = container;
      if (!container) return;

      handler = () => {
        const scrollTop = container === document.documentElement
          ? (window.scrollY || document.documentElement.scrollTop)
          : container!.scrollTop;
        setVisible(scrollTop > 120);
      };

      if (container === document.documentElement) {
        window.addEventListener('scroll', handler, { passive: true });
      } else {
        container.addEventListener('scroll', handler, { passive: true });
      }
      handler();
    };

    // Delay to let layout settle
    const timeout = setTimeout(setup, 200);

    return () => {
      clearTimeout(timeout);
      if (handler) {
        if (container === document.documentElement) {
          window.removeEventListener('scroll', handler);
        } else if (container) {
          container.removeEventListener('scroll', handler);
        }
      }
    };
  }, []);

  if (!visible) return null;

  const scrollToTop = () => {
    const container = containerRef.current;
    if (container === document.documentElement) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      container?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:scale-110 transition-all animate-in fade-in"
      aria-label="Voltar ao topo"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
