import { useEffect, useState, type ReactNode } from "react";

/**
 * Shows `children` only once a wait has lasted `delay` ms: an answer that
 * comes sooner never flashes a loading line (as the map's status waits).
 */
export function Delayed({
  delay = 400,
  children,
}: {
  delay?: number;
  children: ReactNode;
}) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return late ? children : null;
}
