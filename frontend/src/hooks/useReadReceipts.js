import { useEffect, useRef } from 'react';

/**
 * Attach an IntersectionObserver to a message element. Fires
 * `onEnterViewport` exactly once when the element becomes at least
 * 50% visible. Used by MessageBubble to mark others' messages as read
 * when the user scrolls them into view.
 */
export function useReadReceipts({ shouldObserve, onEnterViewport }) {
  const ref = useRef(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onEnterViewport);

  // Keep the callback ref current without re-running the observer effect.
  useEffect(() => {
    callbackRef.current = onEnterViewport;
  }, [onEnterViewport]);

  useEffect(() => {
    if (!shouldObserve) return;
    const el = ref.current;
    if (!el || firedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            callbackRef.current?.();
            observer.disconnect();
            return;
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldObserve]);

  return ref;
}
