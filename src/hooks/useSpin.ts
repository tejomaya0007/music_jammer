import { useEffect, type RefObject } from 'react';

/** 33 and a third rpm, in degrees per second. */
export const SPIN_DEG_PER_SEC = 200;
const TAU_UP = 0.8 / 3; // reaches ~95% of speed in about 0.8 s
const TAU_DOWN = 1.6 / 3; // coasts to a stop over about 1.6 s

/**
 * Rotates the element by writing `--spin` (degrees) straight to its style, so React never re-renders.
 * Speed eases up on play and coasts down on pause (inertia). Reduced motion: the disc stays still.
 */
export function useSpin(isPlaying: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--spin', '0deg');
      return;
    }
    let angle = 0;
    let velocity = 0;
    let last = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = isPlaying ? SPIN_DEG_PER_SEC : 0;
      const tau = target > velocity ? TAU_UP : TAU_DOWN;
      velocity += (target - velocity) * (1 - Math.exp(-dt / tau));
      angle = (angle + velocity * dt) % 360;
      el.style.setProperty('--spin', `${angle.toFixed(2)}deg`);
      if (isPlaying || Math.abs(velocity) > 0.5) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isPlaying, ref]);
}
