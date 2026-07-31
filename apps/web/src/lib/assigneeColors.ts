/**
 * 담당자별 고정 연한 색 — 같은 assigneeId면 업무/프로젝트 어디서든 동일 색.
 * 상태색(할 일/진행/완료)과 겹치지 않도록 파스텔 배경 + 중간 톤 글자색만 사용.
 */

export type AssigneeColor = {
  bg: string;
  text: string;
  ring: string;
  softBg: string;
};

const UNASSIGNED: AssigneeColor = {
  bg: "bg-slate-100",
  text: "text-slate-500",
  ring: "ring-slate-200",
  softBg: "bg-slate-50",
};

/** 서로 구분되는 연한 파스텔 팔레트 (12색) */
const ASSIGNEE_PALETTE: AssigneeColor[] = [
  { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-200", softBg: "bg-sky-50" },
  { bg: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-200", softBg: "bg-teal-50" },
  { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200", softBg: "bg-emerald-50" },
  { bg: "bg-lime-100", text: "text-lime-800", ring: "ring-lime-200", softBg: "bg-lime-50" },
  { bg: "bg-amber-100", text: "text-amber-800", ring: "ring-amber-200", softBg: "bg-amber-50" },
  { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200", softBg: "bg-orange-50" },
  { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200", softBg: "bg-rose-50" },
  { bg: "bg-pink-100", text: "text-pink-700", ring: "ring-pink-200", softBg: "bg-pink-50" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", ring: "ring-fuchsia-200", softBg: "bg-fuchsia-50" },
  { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-200", softBg: "bg-violet-50" },
  { bg: "bg-indigo-100", text: "text-indigo-700", ring: "ring-indigo-200", softBg: "bg-indigo-50" },
  { bg: "bg-cyan-100", text: "text-cyan-700", ring: "ring-cyan-200", softBg: "bg-cyan-50" },
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 담당자 ID(또는 이름 폴백)로 고정 색 반환. 미배정이면 중립색. */
export function getAssigneeColor(
  assigneeId?: string | null,
  assigneeName?: string | null,
): AssigneeColor {
  const name = (assigneeName ?? "").trim();
  if (!assigneeId && (!name || name === "미배정")) return UNASSIGNED;
  const key = assigneeId?.trim() || name;
  return ASSIGNEE_PALETTE[hashKey(key) % ASSIGNEE_PALETTE.length];
}

export function assigneeAvatarClass(
  assigneeId?: string | null,
  assigneeName?: string | null,
): string {
  const c = getAssigneeColor(assigneeId, assigneeName);
  return `${c.bg} ${c.text}`;
}

export function assigneeChipClass(
  assigneeId?: string | null,
  assigneeName?: string | null,
): string {
  const c = getAssigneeColor(assigneeId, assigneeName);
  return `${c.softBg} ${c.text} ring-1 ${c.ring}`;
}
