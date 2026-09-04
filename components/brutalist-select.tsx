"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Acento del chevron y del panel, para que combine con el contenedor. */
const ACCENTS = {
  primary: {
    chevron: "bg-primary text-on-primary",
    panel: "border-primary",
    active: "bg-primary text-on-primary",
  },
  tertiary: {
    chevron: "bg-tertiary text-on-tertiary",
    panel: "border-tertiary",
    active: "bg-tertiary text-on-tertiary",
  },
} as const;

/** Coincide con `max-h-64` del panel. */
const PANEL_MAX_HEIGHT = 256;

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * Selector propio con el lenguaje brutalista del diseño, en lugar del `<select>`
 * nativo: el desplegable del sistema no se puede estilar (bordes de 3px, sombra
 * dura, radio 0) y en cada plataforma se ve distinto.
 *
 * Sigue el patrón combobox de ARIA: el foco no sale del botón y la opción
 * activa se anuncia con `aria-activedescendant`, que es más robusto que mover
 * el foco por la lista.
 */
export function BrutalistSelect({
  accent = "primary",
  disabled = false,
  hasError = false,
  id,
  labelledBy,
  onBlur,
  onChange,
  options,
  placeholder,
  value,
}: {
  accent?: keyof typeof ACCENTS;
  disabled?: boolean;
  hasError?: boolean;
  id: string;
  labelledBy?: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  value: string;
}) {
  const tone = ACCENTS[accent];
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Abre hacia arriba cuando abajo no cabe. En un móvil el selector suele
  // quedar en la mitad inferior y el panel salía fuera de la pantalla: el
  // dedo entonces desplazaba la página, no la lista.
  const [dropUp, setDropUp] = useState(false);

  const selected = options.find((option) => option.value === value);
  const selectable = (index: number) =>
    index >= 0 && index < options.length && options[index].disabled !== true;

  // Cierra al pulsar fuera. `pointerdown` y no `click` para que cierre antes de
  // que el navegador procese la selección de otro control.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onBlur, open]);

  // Mantiene visible la opción activa al navegar con el teclado.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const openList = () => {
    if (disabled) return;
    const current = options.findIndex((option) => option.value === value);
    const fallback = options.findIndex((option) => option.disabled !== true);
    setActiveIndex(current >= 0 ? current : fallback);

    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect !== undefined) {
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      // PANEL_MAX_HEIGHT + el margen de separación.
      setDropUp(below < PANEL_MAX_HEIGHT + 8 && above > below);
    }

    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    onBlur?.();
  };

  const commit = (index: number) => {
    if (!selectable(index)) return;
    onChange(options[index].value);
    setOpen(false);
    onBlur?.();
  };

  /** Salta a la siguiente opción seleccionable en la dirección dada. */
  const step = (from: number, direction: 1 | -1) => {
    let next = from;
    for (let i = 0; i < options.length; i += 1) {
      next += direction;
      if (next < 0) next = options.length - 1;
      if (next >= options.length) next = 0;
      if (selectable(next)) return next;
    }
    return from;
  };

  // Buscar escribiendo, como en un <select> nativo.
  const typed = useRef("");
  const typedTimer = useRef<number | undefined>(undefined);
  const typeahead = (character: string) => {
    window.clearTimeout(typedTimer.current);
    typed.current += character.toLowerCase();
    typedTimer.current = window.setTimeout(() => {
      typed.current = "";
    }, 600);
    const match = options.findIndex(
      (option) =>
        option.disabled !== true &&
        option.label.toLowerCase().startsWith(typed.current),
    );
    if (match >= 0) {
      setActiveIndex(match);
      if (!open) setOpen(true);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        setActiveIndex((index) => step(index, event.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End": {
        if (!open) return;
        event.preventDefault();
        const from = event.key === "Home" ? -1 : options.length;
        setActiveIndex(step(from, event.key === "Home" ? 1 : -1));
        return;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        commit(activeIndex);
        return;
      }
      case "Escape": {
        if (!open) return;
        event.preventDefault();
        close();
        return;
      }
      case "Tab": {
        if (open) setOpen(false);
        return;
      }
      default: {
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
          typeahead(event.key);
        }
      }
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
        className={`w-full bg-surface font-body-md border-[3px] pl-4 pr-16 py-3 text-left focus:border-secondary-container focus:outline-none cursor-pointer transition-none shadow-[3px_3px_0px_#000000] disabled:opacity-60 disabled:cursor-not-allowed ${
          hasError ? "border-secondary" : "border-on-surface-variant/40"
        } ${selected === undefined ? "text-outline" : "text-on-surface"}`}
        disabled={disabled}
        id={id}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        ref={buttonRef}
        role="combobox"
        type="button"
      >
        <span className="block truncate">
          {selected?.label ?? placeholder}
        </span>
      </button>

      {/* El chevron con fondo primary del diseño; gira al abrir. */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 border-l-[3px] border-surface ${tone.chevron}`}
      >
        <span
          className={`material-symbols-outlined text-[20px] font-bold transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.ul
            animate={{ opacity: 1, y: 0 }}
            className={`absolute z-30 left-0 w-full max-h-64 overflow-y-auto overscroll-contain touch-pan-y bg-surface-container-low border-[3px] shadow-[6px_6px_0px_#000000] ${
              dropUp ? "bottom-full mb-1" : "top-full mt-1"
            } ${tone.panel}`}
            exit={reduced ? undefined : { opacity: 0, y: dropUp ? 4 : -4 }}
            id={listId}
            initial={reduced ? false : { opacity: 0, y: dropUp ? 4 : -4 }}
            ref={listRef}
            role="listbox"
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  aria-disabled={option.disabled === true}
                  aria-selected={isSelected}
                  className={`px-4 py-3 font-body-md text-body-md border-b-2 border-surface-container-high last:border-b-0 flex items-center justify-between gap-2 ${
                    option.disabled === true
                      ? "text-outline cursor-not-allowed"
                      : isActive
                        ? `${tone.active} cursor-pointer`
                        : "text-on-surface cursor-pointer"
                  }`}
                  data-index={index}
                  id={`${listId}-${index}`}
                  key={option.value}
                  // Seleccionar va en `click`, no en `pointerdown`: con
                  // pointerdown hacía falta `preventDefault` y eso cancela el
                  // gesto de arrastre del navegador, así que en el móvil la
                  // lista no se podía deslizar y se elegía la opción que
                  // quedara bajo el dedo. Con `click` el navegador ya
                  // distingue: si hubo arrastre, no lo dispara.
                  // No hace falta adelantarse al cierre por pointerdown del
                  // documento: la lista está dentro de `containerRef`.
                  onClick={() => commit(index)}
                  // `mouseenter` y no `pointerenter`: en táctil el segundo se
                  // dispara al apoyar el dedo y movería el resaltado al
                  // desplazar.
                  onMouseEnter={() => {
                    if (option.disabled !== true) setActiveIndex(index);
                  }}
                  role="option"
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <span className="material-symbols-outlined text-[18px] shrink-0">
                      check
                    </span>
                  ) : null}
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
