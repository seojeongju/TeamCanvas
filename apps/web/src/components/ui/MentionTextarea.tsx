import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/cn";

type Member = { id: string; name: string };

export function MentionTextarea({
  value,
  onChange,
  members,
  placeholder,
  className,
  rows = 2,
  onPaste,
}: {
  value: string;
  onChange: (value: string) => void;
  members: Member[];
  placeholder?: string;
  className?: string;
  rows?: number;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = members.filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.id.startsWith(query);
  });

  useEffect(() => {
    setActiveIdx(0);
  }, [query, open]);

  const detectMention = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at === -1) {
      setOpen(false);
      return;
    }
    const between = before.slice(at + 1);
    if (/\s/.test(between)) {
      setOpen(false);
      return;
    }
    setMentionStart(at);
    setQuery(between);
    setOpen(true);
  };

  const insertMention = (member: Member) => {
    const el = ref.current;
    if (!el || mentionStart < 0) return;
    const before = value.slice(0, mentionStart);
    const after = value.slice(el.selectionStart);
    const insert = `@${member.name} `;
    const next = `${before}${insert}${after}`;
    onChange(next);
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detectMention(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % filtered.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            insertMention(filtered[activeIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onPaste={onPaste}
        className={cn(
          "w-full resize-none rounded-xl border border-sky-200/80 bg-white/80 px-3 py-2 text-sm text-navy-800 outline-none focus:border-primary-400",
          className,
        )}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 max-h-40 w-full overflow-y-auto rounded-xl border border-sky-200/80 bg-white py-1 shadow-soft">
          {filtered.slice(0, 8).map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  i === activeIdx ? "bg-primary-400/10 text-primary-700" : "text-navy-800 hover:bg-sky-50",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
              >
                <span className="font-medium">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
