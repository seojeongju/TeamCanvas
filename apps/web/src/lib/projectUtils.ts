import type { ProjectStatus } from "./types";

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "계획" },
  { value: "active", label: "진행 중" },
  { value: "on_hold", label: "보류" },
  { value: "done", label: "완료" },
];

export function projectStatusLabel(status: ProjectStatus | string): string {
  return PROJECT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function projectStatusTone(status: ProjectStatus | string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-700";
    case "on_hold":
      return "bg-amber-500/10 text-amber-700";
    case "done":
      return "bg-navy-500/10 text-navy-600";
    default:
      return "bg-primary-400/10 text-primary-700";
  }
}

export function formatProjectDateRange(startAt: number | null, endAt: number | null): string {
  if (!startAt && !endAt) return "기간 미정";
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };
  if (startAt && endAt) return `${fmt(startAt)} – ${fmt(endAt)}`;
  if (startAt) return `${fmt(startAt)}부터`;
  return `${fmt(endAt!)}까지`;
}
