export function formatReminderLead(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return `${days}일 전`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `${hours}시간 전`;
  }
  return `${minutes}분 전`;
}

export function getReminderStatus(remindAt: number, now = Date.now()): "upcoming" | "due" | "overdue" {
  if (remindAt > now) return "upcoming";
  if (now - remindAt < 5 * 60 * 1000) return "due";
  return "overdue";
}

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getReminderQueryRange(now = Date.now()) {
  return {
    from: now - REMINDER_WINDOW_MS,
    to: now + REMINDER_WINDOW_MS,
  };
}
