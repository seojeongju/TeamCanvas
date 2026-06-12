import type { ProjectStatus } from "./types";

export const PROJECT_COLORS = ["#4A9FE8", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "planning", label: "계획" },
  { value: "active", label: "진행 중" },
  { value: "on_hold", label: "보류" },
  { value: "done", label: "완료" },
  { value: "archived", label: "보관됨" },
];

export const PROJECT_BOARD_COLUMNS = PROJECT_STATUS_OPTIONS.filter((o) => o.value !== "archived").map((o) => ({
  id: o.value,
  label: o.label,
  color:
    o.value === "active"
      ? "border-emerald-400"
      : o.value === "on_hold"
        ? "border-amber-400"
        : o.value === "done"
          ? "border-navy-400"
          : "border-primary-400",
}));

export type ProjectViewMode = "list" | "board";

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
    case "archived":
      return "bg-navy-400/10 text-navy-500";
    default:
      return "bg-primary-400/10 text-primary-700";
  }
}

export const MILESTONE_STATUS_OPTIONS: { value: import("./types").MilestoneStatus; label: string }[] = [
  { value: "pending", label: "예정" },
  { value: "done", label: "완료" },
];

export const PROJECT_MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  manager: "매니저",
  member: "멤버",
  viewer: "뷰어",
};

export function canEditProjectMeta(role?: string | null): boolean {
  return role === "owner" || role === "manager";
}

export function canWriteProjectContent(role?: string | null): boolean {
  return role === "owner" || role === "manager" || role === "member";
}

export function canManageProjectMembers(role?: string | null): boolean {
  return role === "owner" || role === "manager";
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

export function formatMilestoneDue(dueAt: number | null): string {
  if (!dueAt) return "기한 없음";
  const d = new Date(dueAt);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function toDateInputValue(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInputStart(value: string): number | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).getTime();
}

export function parseDateInputEnd(value: string): number | null {
  if (!value) return null;
  return new Date(`${value}T23:59:59`).getTime();
}
