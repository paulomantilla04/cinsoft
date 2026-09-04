"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Diálogos abiertos a la vez. Al encadenar dos (abrir "mover" desde la ficha)
 * se solapan un instante: el saliente sigue montado mientras anima. Sin este
 * contador, el entrante capturaba `hidden` como valor previo y al cerrarse lo
 * restauraba, dejando la página sin scroll.
 */
let openDialogs = 0;

const ACCENT_BORDER = {
  primary: "border-primary",
  secondary: "border-secondary",
  tertiary: "border-tertiary",
} as const;

/**
 * Shell de diálogo compartido: overlay, animación de entrada y salida, cierre
 * con Escape o pulsando fuera, foco atrapado dentro y devuelto al salir.
 *
 * El movimiento es corto y seco como el resto de la app (~180ms, `scale 0.96`).
 * Va montado dentro de un `<AnimatePresence>` del padre, que es quien controla
 * el desmontaje y permite que la animación de salida llegue a verse.
 */
export function Modal({
  accent = "primary",
  children,
  labelledBy,
  onClose,
}: {
  accent?: keyof typeof ACCENT_BORDER;
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // Atrapa el tabulador: sin esto se puede tabular a la tabla de detrás,
      // que para un lector de pantalla queda fuera del diálogo.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables === undefined || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    openDialogs += 1;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openDialogs -= 1;
      if (openDialogs === 0) document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-margin-mobile"
      exit={reduced ? undefined : { opacity: 0 }}
      initial={reduced ? false : { opacity: 0 }}
      onClick={onClose}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`w-full max-w-[560px] bg-surface-container-low border-4 shadow-[8px_8px_0px_#000000] focus:outline-none ${ACCENT_BORDER[accent]}`}
        exit={reduced ? undefined : { opacity: 0, scale: 0.97, y: -6 }}
        initial={reduced ? false : { opacity: 0, scale: 0.96, y: -8 }}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Barra superior tipo terminal, común a los tres diálogos. */
export function ModalHeader({
  accent = "primary",
  id,
  onClose,
  title,
}: {
  accent?: keyof typeof ACCENT_BORDER;
  id: string;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className={`bg-surface-container-high border-b-4 px-space-md py-space-xs flex flex-wrap items-center justify-between gap-x-space-sm gap-y-space-2xs ${ACCENT_BORDER[accent]}`}
    >
      <span
        className="font-code-badge text-code-badge text-on-surface-variant font-bold uppercase truncate"
        id={id}
      >
        {title}
      </span>
      <button
        className="font-code-badge text-code-badge text-secondary border border-secondary px-2 py-0.5 hover:bg-secondary-container hover:text-on-secondary-container shrink-0"
        onClick={onClose}
        type="button"
      >
        [ESC]
      </button>
    </div>
  );
}
