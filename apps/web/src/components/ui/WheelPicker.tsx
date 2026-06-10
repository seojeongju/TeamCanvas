import { useCallback, useEffect, useRef } from "react";
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
}

export function WheelPicker<T extends string | number>({
  items,
  value,
  onChange,
  formatItem = (item) => String(item),
  ariaLabel,
  className,
}: WheelPickerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<number | null>(null);
  const isUserScroll = useRef(false);

  const selectedIndex = Math.max(0, items.indexOf(value));

  const scrollToIndex = useCallback((index: number, smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (isUserScroll.current) return;
    scrollToIndex(selectedIndex);
  }, [selectedIndex, scrollToIndex]);

  const handleScroll = () => {
    isUserScroll.current = true;
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      scrollToIndex(clamped, true);
      if (items[clamped] !== value) onChange(items[clamped]);
      isUserScroll.current = false;
    }, 80);
  };

  return (
    <div
      className={cn("relative h-[200px] flex-1 overflow-hidden", className)}
      role="listbox"
      aria-label={ariaLabel}
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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: PADDING_ROWS * ITEM_HEIGHT }} aria-hidden />
        {items.map((item, index) => {
          const distance = Math.abs(index - selectedIndex);
          return (
            <div
              key={`${item}-${index}`}
              role="option"
              aria-selected={item === value}
              className={cn(
                "flex h-10 items-center justify-center transition-all duration-150",
                distance === 0
                  ? "text-lg font-semibold text-navy-900"
                  : distance === 1
                    ? "text-sm text-navy-400"
                    : "text-xs text-navy-300",
              )}
              style={{ scrollSnapAlign: "center" }}
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
