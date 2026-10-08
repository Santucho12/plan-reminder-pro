import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Radix UI usa ResizeObserver, que jsdom no trae
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? ResizeObserverStub;

// Las animaciones no aportan a los tests y demoran el desmontaje: se renderizan como elementos planos
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const animationProps = new Set([
    "initial", "animate", "exit", "transition", "variants", "layout", "layoutId", "whileHover", "whileTap",
  ]);
  const cache = new Map<string, unknown>();
  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      if (!cache.has(tag)) {
        cache.set(tag, React.forwardRef((props: Record<string, unknown>, ref) => {
          const clean: Record<string, unknown> = {};
          for (const key in props) if (!animationProps.has(key)) clean[key] = props[key];
          return React.createElement(tag, { ...clean, ref });
        }));
      }
      return cache.get(tag);
    },
  });
  const AnimatePresence = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return { motion, AnimatePresence };
});

// jsdom no implementa el scroll de la ventana
window.scrollTo = (() => {}) as typeof window.scrollTo;
