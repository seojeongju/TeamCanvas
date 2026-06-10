/** 알림·푸시에서 사용하는 앱 내 딥링크 경로 */

export function taskDetailLink(taskId: string): string {
  return `/tasks?task=${encodeURIComponent(taskId)}`;
}

export function eventDetailLink(eventId: string): string {
  return `/calendar?event=${encodeURIComponent(eventId)}`;
}

/** 알림 객체에서 이동 경로를 해석 (link 없을 때 type 기반 보조) */
export function resolveNotificationLink(notif: {
  link?: string | null;
  type?: string;
}): string | null {
  if (notif.link) return notif.link;
  return null;
}

export function isEventNotificationType(type?: string): boolean {
  return !!type && type.startsWith("event_");
}
