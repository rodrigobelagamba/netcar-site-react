import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/** Renderiza fora do motion/overflow do layout — fixed fica na viewport de verdade. */
export function FloatingPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
