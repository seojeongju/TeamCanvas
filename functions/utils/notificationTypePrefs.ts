export const NOTIFICATION_TYPE_CATEGORIES = {
  tasks: ["task_assigned", "task_due_soon", "task_comment", "task_status", "task_overdue"],
  events: ["event_attendee", "event_reminder", "event_comment"],
  projects: [
    "project_comment",
    "project_status",
    "project_member_added",
    "milestone_done",
    "milestone_due",
  ],
  mentions: ["task_mention", "event_mention", "project_mention"],
} as const;

export type NotificationTypeCategory = keyof typeof NOTIFICATION_TYPE_CATEGORIES;

export const DEFAULT_NOTIFICATION_TYPE_PREFS: Record<NotificationTypeCategory, boolean> = {
  tasks: true,
  events: true,
  projects: true,
  mentions: true,
};

export function parseTypePrefsJson(
  json: string | null | undefined,
): Record<NotificationTypeCategory, boolean> {
  const defaults = { ...DEFAULT_NOTIFICATION_TYPE_PREFS };
  if (!json) return defaults;
  try {
    const parsed = JSON.parse(json) as Partial<Record<NotificationTypeCategory, boolean>>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function categoryForNotificationType(type: string): NotificationTypeCategory | null {
  for (const [cat, types] of Object.entries(NOTIFICATION_TYPE_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) {
      return cat as NotificationTypeCategory;
    }
  }
  return null;
}

export function isNotificationTypeEnabled(
  type: string,
  prefs: Record<NotificationTypeCategory, boolean>,
): boolean {
  const cat = categoryForNotificationType(type);
  if (!cat) return true;
  return prefs[cat] !== false;
}
