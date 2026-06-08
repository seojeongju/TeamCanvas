export type EventTypeId = "meeting" | "deadline" | "vacation" | "personal" | "org";

export type EventTypeConfig = {
  id: EventTypeId;
  label: string;
  color: string;
  /** 기본 소요 시간(분). 0이면 사용자 입력 유지 */
  defaultDurationMinutes: number;
  allDay?: boolean;
  placeholder: string;
};

export const EVENT_TYPES: EventTypeConfig[] = [
  {
    id: "meeting",
    label: "회의",
    color: "#4A9FE8",
    defaultDurationMinutes: 60,
    placeholder: "주간 회의, 1:1...",
  },
  {
    id: "deadline",
    label: "마감",
    color: "#F97316",
    defaultDurationMinutes: 30,
    placeholder: "제출 마감, 릴리스...",
  },
  {
    id: "vacation",
    label: "휴가",
    color: "#10B981",
    defaultDurationMinutes: 0,
    allDay: true,
    placeholder: "연차, 반차...",
  },
  {
    id: "personal",
    label: "개인",
    color: "#8B5CF6",
    defaultDurationMinutes: 60,
    placeholder: "개인 일정...",
  },
  {
    id: "org",
    label: "조직",
    color: "#EC4899",
    defaultDurationMinutes: 120,
    placeholder: "전사 행사, 워크숍...",
  },
];

export const REMINDER_OPTIONS = [
  { value: 5, label: "5분 전" },
  { value: 10, label: "10분 전" },
  { value: 15, label: "15분 전" },
  { value: 30, label: "30분 전" },
  { value: 60, label: "1시간 전" },
  { value: 1440, label: "1일 전" },
] as const;

export function getEventType(id: EventTypeId): EventTypeConfig {
  return EVENT_TYPES.find((t) => t.id === id) ?? EVENT_TYPES[0];
}

export function getEventTypeByColor(color: string): EventTypeId {
  const match = EVENT_TYPES.find((t) => t.color.toLowerCase() === color.toLowerCase());
  return match?.id ?? "meeting";
}

export function recurrenceFromRule(rule: string | null | undefined): "none" | "daily" | "weekly" | "monthly" {
  if (!rule) return "none";
  const n = rule.toUpperCase();
  if (n === "FREQ=DAILY") return "daily";
  if (n === "FREQ=WEEKLY") return "weekly";
  if (n === "FREQ=MONTHLY") return "monthly";
  return "none";
}
