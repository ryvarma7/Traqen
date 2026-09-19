"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

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
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const hiddenRef = React.useRef<HTMLInputElement | null>(null);

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
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            ref={listRef}
            role="listbox"
            className="glass-modal absolute z-50 mt-1.5 max-h-56 w-full overflow-y-auto rounded-field p-1"
          >
            {options.map((option, i) => {
              const isSelected = option.value === display;
              return (
                <button
                  key={`${option.value}-${i}`}
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
      </AnimatePresence>
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
