export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

export function colorClass(hex: string): string {
  const map: Record<string, string> = {
    "#4A9FE8": "bg-primary-400",
    "#8B5CF6": "bg-violet-400",
    "#10B981": "bg-emerald-400",
    "#F97316": "bg-orange-400",
  };
  return map[hex] ?? "bg-primary-400";
}
