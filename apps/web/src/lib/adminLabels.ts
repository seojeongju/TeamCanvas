import type { PlanFeature } from "./types";

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "소유자",
  admin: "관리자",
  member: "멤버",
  guest: "게스트",
};

export const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  invited: "초대됨",
};

export const ORG_STATUS_LABELS: Record<string, string> = {
  active: "활성",
  suspended: "정지",
  deactivated: "비활성",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "정상",
  trialing: "체험중",
  past_due: "결제 지연",
  canceled: "해지",
  suspended: "중지",
};

export const PLATFORM_ROLE_LABELS: Record<string, string> = {
  super_admin: "슈퍼 관리자",
  support: "지원",
  billing: "결제",
};

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  calendar: "캘린더",
  tasks: "업무",
  teams: "팀 관리",
  file_storage: "파일 저장",
  web_push: "웹 푸시",
  audit_logs: "감사 로그",
  api_access: "API",
  custom_branding: "커스텀 브랜딩",
};

export const ADMIN_TIMEZONES = [
  { value: "Asia/Seoul", label: "한국 (서울)" },
  { value: "Asia/Tokyo", label: "일본 (도쿄)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "미국 동부" },
  { value: "America/Los_Angeles", label: "미국 서부" },
  { value: "Europe/London", label: "영국 (런던)" },
] as const;

export function formatStorage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)}GB`;
  return `${mb}MB`;
}

export function formatWon(won: number): string {
  if (won === 0) return "무료";
  return `₩${won.toLocaleString("ko-KR")}`;
}
