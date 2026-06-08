import type { EventTypeId } from "./eventTypes";

export type EventTemplateId = "standup" | "one-on-one" | "sprint-review";

export type EventTemplate = {
  id: EventTemplateId;
  label: string;
  description: string;
  eventType: EventTypeId;
  title: string;
  durationMinutes: number;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  visibility: "private" | "team" | "org";
  reminderMinutes: number[];
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: "standup",
    label: "스탠드업",
    description: "매주 30분 팀 싱크",
    eventType: "meeting",
    title: "주간 스탠드업",
    durationMinutes: 30,
    recurrence: "weekly",
    visibility: "team",
    reminderMinutes: [10],
  },
  {
    id: "one-on-one",
    label: "1:1",
    description: "개인 미팅 1시간",
    eventType: "meeting",
    title: "1:1 미팅",
    durationMinutes: 60,
    recurrence: "weekly",
    visibility: "private",
    reminderMinutes: [15, 60],
  },
  {
    id: "sprint-review",
    label: "스프린트 리뷰",
    description: "격주 회고·리뷰",
    eventType: "meeting",
    title: "스프린트 리뷰",
    durationMinutes: 90,
    recurrence: "weekly",
    visibility: "team",
    reminderMinutes: [30, 1440],
  },
];

export function getEventTemplate(id: EventTemplateId): EventTemplate {
  return EVENT_TEMPLATES.find((t) => t.id === id) ?? EVENT_TEMPLATES[0];
}
