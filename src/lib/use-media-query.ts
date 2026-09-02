import { useEffect, useState } from "react";

/**
 * Acompanha uma media query em JavaScript.
 *
 * Quase toda diferença entre celular e desktop se resolve com classes do
 * Tailwind. Isto é para os casos em que as duas versões não podem coexistir no
 * DOM — o Kanban é um: renderizar colunas escondidas por CSS duplicaria as
 * áreas de soltura do drag-and-drop, que se identificam pelo status.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Abaixo de `md` (768px) — o mesmo corte usado nas classes do Tailwind. */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
