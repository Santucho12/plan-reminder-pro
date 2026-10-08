import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis: Lenis | null = null;

/** Hay un contenedor con scroll propio (lista de una ventana, desplegable, tabla) entre el nodo y la página. */
function insideScrollable(node: HTMLElement): boolean {
  for (let el: HTMLElement | null = node; el && el !== document.body; el = el.parentElement) {
    if (el.closest('[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]')) return true;
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return true;
  }
  return false;
}

/**
 * Scroll suave de la página (Lenis), en la compu y en el celular. Se activa siempre, aunque el sistema
 * tenga desactivadas las animaciones (en Windows eso le avisa a la página "reducir movimiento").
 */
export function startSmoothScroll() {
  if (lenis || typeof window === 'undefined') return;

  lenis = new Lenis({
    // Más bajo = más suave y pesado (la página tarda más en alcanzar el destino)
    lerp: 0.065,
    wheelMultiplier: 0.9,
    smoothWheel: true,
    // En el celular también: el desplazamiento con el dedo sigue con la misma inercia suave
    syncTouch: true,
    syncTouchLerp: 0.052,
    touchInertiaMultiplier: 28,
    touchMultiplier: 1,
    // Las ventanas, los desplegables y las tablas con scroll propio se desplazan normalmente
    prevent: insideScrollable,
    autoRaf: true,
  });
}

/** Vuelve arriba de todo al instante (al cambiar de pantalla). */
export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
}
