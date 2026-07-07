import type { CalendarEvent, Project, Task } from "./types";

export const COLLABORATION_DELETE_MESSAGE =
  "다른 사람과 연결된 항목은 관리자만 삭제할 수 있습니다.";

export function isOrgAdminRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function eventHasCollaborationLinks(
  event: Pick<CalendarEvent, "creatorId" | "description">,
  attendeeUserIds: string[],
  linkedTasks: { assigneeId?: string | null }[] = [],
): boolean {
  const creatorId = event.creatorId;
  if (!creatorId) return false;

  if (attendeeUserIds.some((id) => id !== creatorId)) return true;

  if (linkedTasks.some((t) => t.assigneeId && t.assigneeId !== creatorId)) return true;

  if (event.description?.startsWith("프로젝트:")) return true;

  return false;
}

export function taskHasCollaborationLinks(
  task: Pick<Task, "creatorId" | "assigneeId" | "eventId">,
  context?: {
    eventAttendeeUserIds?: string[];
    eventCreatorId?: string | null;
    linkedEventIsMilestone?: boolean;
  },
): boolean {
  const creatorId = task.creatorId;
  if (!creatorId) return false;

  if (task.assigneeId && task.assigneeId !== creatorId) return true;

  if (task.eventId) {
    if (context?.eventCreatorId && context.eventCreatorId !== creatorId) return true;
    if (context?.eventAttendeeUserIds?.some((id) => id !== creatorId)) return true;
    if (context?.linkedEventIsMilestone) return true;
    return false;
  }

  return false;
}

export function projectHasCollaborationLinks(
  project: Pick<Project, "ownerId">,
  memberUserIds: string[],
  tasks: { assigneeId?: string | null; creatorId?: string }[] = [],
): boolean {
  const ownerId = project.ownerId;
  if (memberUserIds.some((id) => id !== ownerId)) return true;

  if (
    tasks.some(
      (t) =>
        (t.assigneeId && t.assigneeId !== ownerId) ||
        (t.creatorId && t.creatorId !== ownerId),
    )
  ) {
    return true;
  }

  return false;
}

export function canDeleteEntity(opts: {
  isOrgAdmin: boolean;
  hasAdminDeletePermission: boolean;
  isCreator: boolean;
  hasCollaborationLinks: boolean;
}): boolean {
  if (opts.isOrgAdmin || opts.hasAdminDeletePermission) return true;
  if (!opts.isCreator) return false;
  return !opts.hasCollaborationLinks;
}
