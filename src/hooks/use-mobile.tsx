import * as React from "react";

/** Debajo de este ancho se usa el diseño de celular (barra arriba y navegación abajo): incluye tablets en vertical. */
const MOBILE_BREAKPOINT = 1024;

export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  // Se resuelve en el primer render para que en el teléfono no parpadee la versión de escritorio
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}
