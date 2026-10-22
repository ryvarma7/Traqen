"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Gap between the trigger and the floating panel. */
const GAP = 8;

/** Tallest the panel is allowed to grow to before it scrolls. */
const MAX_HEIGHT = 224;

/** The panel never shrinks below this, even in a tight viewport. */
const MIN_HEIGHT = 120;

/** Where the panel sits relative to the trigger. */
type Placement = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  dropUp: boolean;
};

/**
 * Works out where the panel goes.
 *
 * The panel is positioned against the viewport, not the trigger's parent, so
 * it is never clipped by a scrolling sheet or a card with `overflow-hidden`.
 * It drops up when there is no room below the trigger, and it stays on screen
 * when the trigger sits near the right edge.
 */
function computePlacement(trigger: HTMLElement): Placement {
  const rect = trigger.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const spaceBelow = viewportHeight - rect.bottom - GAP;
  const spaceAbove = rect.top - GAP;
  const dropUp =
    spaceBelow < Math.min(MAX_HEIGHT, MIN_HEIGHT) && spaceAbove > spaceBelow;

  // Keep the panel on screen: it may not run off the right edge, and it may
  // not run off the left one either.
  const maxLeft = Math.max(GAP, viewportWidth - rect.width - GAP);
  const left = Math.min(Math.max(GAP, rect.left), maxLeft);

  if (dropUp) {
    return {
      bottom: viewportHeight - rect.top + GAP,
      left,
      width: rect.width,
      maxHeight: Math.max(MIN_HEIGHT, spaceAbove),
      dropUp,
    };
  }

  return {
    top: rect.bottom + GAP,
    left,
    width: rect.width,
    maxHeight: Math.max(MIN_HEIGHT, spaceBelow),
    dropUp,
  };
}

// Every select-typed event handler (onCopy, onInput, onToggle, …) would clash
// with the underlying <button>, so strip all `on*` props up front and only
// re-add the ones we actually wire up.
type SelectEventKeys = Extract<
  keyof React.SelectHTMLAttributes<HTMLSelectElement>,
  `on${string}`
>;

type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  SelectEventKeys | "children" | "value" | "size" | "multiple"
> & {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  children?: React.ReactNode;
};

/** Black-themed listbox replacement for the native select: the OS-drawn
 *  popup can't carry the app theme, so options render in a glass panel.
 *  Drop-in for <select> — takes <option> children and works both controlled
 *  and with react-hook-form register() (value lives in a hidden input). */
const Select = React.forwardRef<HTMLInputElement, SelectProps>(function Select(
  { id, name, value, onChange, onBlur, disabled, className, children, ...props },
  ref
) {
  const options = React.useMemo(() => parseOptions(children), [children]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [display, setDisplay] = React.useState(value ?? "");
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const popupRef = React.useRef<HTMLDivElement>(null);
  const hiddenRef = React.useRef<HTMLInputElement | null>(null);
  const listboxId = React.useId();

  const setHiddenRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      hiddenRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    },
    [ref]
  );

  // Uncontrolled (register): pick up the value RHF pushes into the hidden input.
  React.useLayoutEffect(() => {
    if (value === undefined && hiddenRef.current) setDisplay(hiddenRef.current.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (value !== undefined) setDisplay(value);
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The panel lives in a portal, so it is not inside the root — it has to
      // be checked separately or every click on an option would close it.
      if (rootRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the panel pinned to the trigger: it follows on scroll (the sheet
  // body scrolls under it) and on resize.
  React.useEffect(() => {
    if (!open) return;
    const update = () => {
      const trigger = buttonRef.current;
      if (trigger) setPlacement(computePlacement(trigger));
    };
    update();
    // Capture, so a scroll inside any container is caught, not just the page.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    popupRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const selected = options.find((o) => o.value === display);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} ref={setHiddenRef} defaultValue={value ?? ""} />

      <motion.button
        whileTap={{ scale: 0.97 }}
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? optionId(listboxId, active) : undefined}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className={cn(
          "glass-input relative flex h-11 w-full items-center rounded-field px-3 pr-9 text-left text-sm text-foreground focus:outline-none disabled:opacity-50 md:h-10",
          className
        )}
        {...props}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? ""}
        </span>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </motion.button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && placement && (
              <motion.div
                key="select-panel"
                initial={{ opacity: 0, y: placement.dropUp ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: placement.dropUp ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                ref={popupRef}
                id={listboxId}
                role="listbox"
                aria-labelledby={id}
                style={{
                  top: placement.top,
                  bottom: placement.bottom,
                  left: placement.left,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                }}
                className="glass-modal fixed z-[70] overflow-y-auto overscroll-contain rounded-field p-1"
              >
                {options.map((option, i) => {
                  const isSelected = option.value === display;
                  return (
                    <button
                      key={`${option.value}-${i}`}
                      id={optionId(listboxId, i)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => select(option.value)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm",
                        i === active ? "bg-white/10 text-foreground" : "text-muted-foreground",
                        isSelected && "text-foreground"
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-foreground" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );

  function event() {
    return {
      target: hiddenRef.current,
      currentTarget: hiddenRef.current,
    } as unknown as React.ChangeEvent<HTMLSelectElement>;
  }

  function blurEvent() {
    return {
      target: hiddenRef.current,
      currentTarget: hiddenRef.current,
      relatedTarget: null,
    } as unknown as React.FocusEvent<HTMLSelectElement>;
  }

  function toggle() {
    if (disabled) return;
    if (open) {
      close();
      return;
    }
    setActive(Math.max(0, options.findIndex((o) => o.value === display)));
    setOpen(true);
  }

  function select(next: string) {
    if (hiddenRef.current) hiddenRef.current.value = next;
    setDisplay(next);
    setOpen(false);
    onChange?.(event());
    onBlur?.(blurEvent());
    buttonRef.current?.focus();
  }

  function close(focusTrigger = false) {
    setOpen(false);
    onBlur?.(blurEvent());
    if (focusTrigger) buttonRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled || !open) {
      if (!disabled && e.key === "ArrowDown") {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[active];
      if (option) select(option.value);
    } else if (e.key === "Tab") {
      close();
    }
  }
});
Select.displayName = "Select";

function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

function parseOptions(children: React.ReactNode): Option[] {
  const options: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: React.ReactNode };
    options.push({
      value: props.value == null ? "" : String(props.value),
      label: toText(props.children),
    });
  });
  return options;
}

function toText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  return "";
}

export { Select };
