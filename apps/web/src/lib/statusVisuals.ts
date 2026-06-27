import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  FolderKanban,
  Info,
  ListTodo,
  MessageSquare,
  Pencil,
  UserPlus,
} from "lucide-react";
import type { ProjectStatus, TaskStatus } from "./types";
import { cn } from "./cn";

/** 업무·마일스톤·프로젝트 공통 진행 톤 */
export type WorkTone = "pending" | "active" | "done" | "overdue" | "neutral";

/** 활동 이력 항목 톤 */
export type ActivityTone = "done" | "active" | "pending" | "info" | "alert";

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "할 일",
  doing: "진행 중",
  done: "완료",
};

const ACTIVITY_TONE_LABEL: Record<ActivityTone, string> = {
  done: "완료",
  active: "진행",
  pending: "예정",
  info: "변경",
  alert: "주의",
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABEL[status];
}

export function taskWorkTone(task: { status: TaskStatus; isOverdue?: boolean }): WorkTone {
  if (task.status === "done") return "done";
  if (task.isOverdue) return "overdue";
  if (task.status === "doing") return "active";
  if (task.status === "todo") return "pending";
  return "neutral";
}

export function projectWorkTone(status: ProjectStatus | string): WorkTone {
  if (status === "done" || status === "archived") return "done";
  if (status === "active") return "active";
  if (status === "on_hold") return "overdue";
  if (status === "planning") return "pending";
  return "neutral";
}

export function milestoneWorkTone(status: "pending" | "done" | string): WorkTone {
  return status === "done" ? "done" : "pending";
}

export function workToneAccentClass(tone: WorkTone): string {
  switch (tone) {
    case "done":
      return "bg-emerald-400";
    case "active":
      return "bg-primary-400";
    case "pending":
      return "bg-sky-400";
    case "overdue":
      return "bg-red-400";
    default:
      return "bg-navy-300";
  }
}

export function workToneBadgeClass(tone: WorkTone): string {
  switch (tone) {
    case "done":
      return "bg-emerald-500/10 text-emerald-700";
    case "active":
      return "bg-primary-400/15 text-primary-700";
    case "pending":
      return "bg-sky-500/10 text-sky-700";
    case "overdue":
      return "bg-red-500/10 text-red-700";
    default:
      return "bg-navy-500/10 text-navy-600";
  }
}

export function workToneCardClass(tone: WorkTone): string {
  switch (tone) {
    case "done":
      return "opacity-75";
    case "overdue":
      return "ring-1 ring-red-200/60";
    default:
      return "";
  }
}

export function workToneTitleClass(tone: WorkTone): string {
  return tone === "done" ? "text-navy-500 line-through" : "text-navy-900";
}

export function resolveActivityTone(action: string, summary: string): ActivityTone {
  const a = action.toLowerCase();
  const s = summary;

  if (
    a.includes("done") ||
    a === "milestone_done" ||
    a === "checklist_done" ||
    ((/완료/.test(s) || /→\s*완료/.test(s) || /상태:\s*완료/.test(s)) && !/미완료/.test(s))
  ) {
    return "done";
  }

  if (/지연|마감 지연|overdue/i.test(s)) return "alert";

  if (
    a === "created" ||
    a.includes("milestone_added") ||
    a.includes("member_added") ||
    a === "checklist_add" ||
    /진행 중/.test(s) ||
    /→\s*진행/.test(s)
  ) {
    return "active";
  }

  if (/할 일|→\s*할 일|예정/.test(s) || a === "milestone_added") return "pending";

  return "info";
}

export function activityToneLabel(tone: ActivityTone): string {
  return ACTIVITY_TONE_LABEL[tone];
}

export function activityToneIcon(action: string, kind?: string): LucideIcon {
  const a = action.toLowerCase();
  if (a.includes("comment")) return MessageSquare;
  if (a.includes("member")) return UserPlus;
  if (a.includes("milestone")) return CalendarDays;
  if (a === "created" || a.includes("updated") || a === "labels") return Pencil;
  if (kind === "project") return FolderKanban;
  if (kind === "task") return ListTodo;
  return Info;
}

export function activityToneIconClass(tone: ActivityTone): string {
  switch (tone) {
    case "done":
      return "bg-emerald-500/12 text-emerald-600";
    case "active":
      return "bg-primary-400/15 text-primary-600";
    case "pending":
      return "bg-sky-500/10 text-sky-600";
    case "alert":
      return "bg-red-500/10 text-red-600";
    default:
      return "bg-violet-500/10 text-violet-600";
  }
}

export function activityToneAccentClass(tone: ActivityTone): string {
  switch (tone) {
    case "done":
      return "bg-emerald-400";
    case "active":
      return "bg-primary-400";
    case "pending":
      return "bg-sky-400";
    case "alert":
      return "bg-red-400";
    default:
      return "bg-violet-400";
  }
}

export function activityToneBadgeClass(tone: ActivityTone): string {
  switch (tone) {
    case "done":
      return "bg-emerald-500/10 text-emerald-700";
    case "active":
      return "bg-primary-400/15 text-primary-700";
    case "pending":
      return "bg-sky-500/10 text-sky-700";
    case "alert":
      return "bg-red-500/10 text-red-700";
    default:
      return "bg-violet-500/10 text-violet-700";
  }
}

export function activityToneSummaryClass(tone: ActivityTone): string {
  return cn("text-sm", tone === "done" ? "text-navy-500" : "text-navy-700");
}

export function activityToneMarkerIcon(tone: ActivityTone): LucideIcon {
  switch (tone) {
    case "done":
      return CheckCircle2;
    case "active":
      return CircleDot;
    case "pending":
      return Circle;
    case "alert":
      return AlertCircle;
    default:
      return Info;
  }
}
