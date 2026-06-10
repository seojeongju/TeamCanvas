import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../../lib/cn";

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = Math.floor(VISIBLE_ROWS / 2);

interface WheelPickerProps<T extends string | number> {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatItem?: (item: T) => string;
  ariaLabel: string;
  className?: string;
  /** 중앙 값을 키보드로 직접 입력 */
  editable?: boolean;
  maxInputLength?: number;
  parseInput?: (text: string) => T | null;
  commitInput?: (text: string, current: T) => T;
}

function nearestItemIndex<T extends string | number>(items: readonly T[], value: T): number {
  const exact = items.indexOf(value);
  if (exact >= 0) return exact;

  if (typeof value === "number" && items.every((item) => typeof item === "number")) {
    return items.reduce((bestIdx, item, idx) => {
      const current = items[bestIdx] as number;
      const candidate = item as number;
      return Math.abs(candidate - value) < Math.abs(current - value) ? idx : bestIdx;
    }, 0);
  }

  return 0;
}

export function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  formatItem = (item) => String(item),
  ariaLabel,
  className,
  editable = false,
  maxInputLength = 2,
  parseInput,
  commitInput,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollEndTimer = useRef<number | null>(null);
  const isUserScroll = useRef(false);
  const suppressClick = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const selectedIndex = nearestItemIndex(items, value);

  const scrollToIndex = useCallback((index: number, smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (isUserScroll.current || editing) return;
    scrollToIndex(selectedIndex);
  }, [selectedIndex, scrollToIndex, editing]);

  const itemAt = (index: number): T => items[Math.max(0, Math.min(items.length - 1, index))] as T;

  const selectIndex = useCallback(
    (index: number, smooth = true) => {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      const next = items[clamped] as T;
      isUserScroll.current = true;
      scrollToIndex(clamped, smooth);
      if (next !== value) onChange(next);
      window.setTimeout(() => {
        isUserScroll.current = false;
      }, smooth ? 280 : 0);
    },
    [items, onChange, scrollToIndex, value],
  );

  const moveBy = (delta: number) => {
    selectIndex(selectedIndex + delta, true);
  };

  const startEditing = () => {
    if (!editable) return;
    setEditing(true);
    setDraft(formatItem(value));
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const handleScroll = () => {
    if (editing) return;
    isUserScroll.current = true;
    suppressClick.current = true;
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      scrollToIndex(clamped, true);
      const next = itemAt(clamped);
      if (next !== value) onChange(next);
      isUserScroll.current = false;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 120);
    }, 80);
  };

  const commitDraft = () => {
    const text = draft.trim();
    if (!text) {
      setDraft(formatItem(value));
      return;
    }
    if (commitInput) {
      onChange(commitInput(text, value));
      return;
    }
    const parsed = parseInput?.(text);
    if (parsed != null) onChange(parsed);
  };

  const handleInputChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, maxInputLength);
    setDraft(digits);
    const parsed = parseInput?.(digits);
    if (parsed != null) onChange(parsed);
  };

  const handleContainerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveBy(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      moveBy(1);
    } else if (editable && /^\d$/.test(e.key)) {
      e.preventDefault();
      startEditing();
      setDraft(e.key);
      const parsed = parseInput?.(e.key);
      if (parsed != null) onChange(parsed);
    }
  };

  return (
    <div
      className={cn("relative h-[200px] flex-1 overflow-hidden", className)}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg bg-navy-900/5"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-white to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-white to-transparent"
        aria-hidden
      />

      {editable && (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          aria-label={`${ariaLabel} 직접 입력`}
          value={editing ? draft : formatItem(value)}
          onFocus={(e) => {
            setEditing(true);
            setDraft(formatItem(value));
            e.target.select();
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={() => {
            commitDraft();
            setEditing(false);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
              inputRef.current?.blur();
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setEditing(false);
              moveBy(-1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setEditing(false);
              moveBy(1);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(formatItem(value));
              inputRef.current?.blur();
            }
          }}
          className={cn(
            "absolute left-1/2 top-1/2 z-20 h-10 w-full max-w-[52px] -translate-x-1/2 -translate-y-1/2",
            "bg-transparent text-center text-lg font-semibold text-navy-900 outline-none",
            "rounded-lg ring-0 focus:bg-white/90 focus:ring-2 focus:ring-primary-400/30",
            editing ? "pointer-events-auto cursor-text" : "pointer-events-none opacity-0",
          )}
        />
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full touch-pan-y overflow-y-auto scroll-smooth [-ms-overflow-style:none] [overscroll-behavior:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ height: PADDING_ROWS * ITEM_HEIGHT }} aria-hidden />
        {items.map((item, index) => {
          const distance = Math.abs(index - selectedIndex);
          const isCenter = distance === 0;
          return (
            <div
              key={`${item}-${index}`}
              role="option"
              aria-selected={isCenter}
              onClick={() => {
                if (editing || suppressClick.current) return;
                if (editable && isCenter) {
                  startEditing();
                  return;
                }
                selectIndex(index, true);
              }}
              className={cn(
                "flex h-10 w-full items-center justify-center transition-all duration-150 select-none",
                "touch-manipulation active:bg-navy-900/5",
                editable && isCenter ? "cursor-text" : "cursor-pointer",
                isCenter && editable && editing
                  ? "text-transparent"
                  : distance === 0
                    ? "text-lg font-semibold text-navy-900"
                    : distance === 1
                      ? "text-sm text-navy-500 hover:text-navy-700"
                      : "text-xs text-navy-300 hover:text-navy-500",
              )}
              style={{ scrollSnapAlign: "center", touchAction: "pan-y" }}
            >
              {formatItem(item)}
            </div>
          );
        })}
        <div style={{ height: PADDING_ROWS * ITEM_HEIGHT }} aria-hidden />
      </div>
    </div>
  );
}
