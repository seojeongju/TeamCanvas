/** 활동 이력 액션 한글 라벨 · 요약 파싱 */

export const PROJECT_ACTIVITY_ACTION_LABELS: Record<string, string> = {
  created: "프로젝트 생성",
  updated: "프로젝트 수정",
  milestone_added: "마일스톤 추가",
  milestone_updated: "마일스톤 수정",
  milestone_done: "마일스톤 완료",
  milestone_removed: "마일스톤 삭제",
  member_added: "멤버 추가",
  member_removed: "멤버 제거",
  ownership_transferred: "소유권 이전",
};

export const TASK_ACTIVITY_ACTION_LABELS: Record<string, string> = {
  created: "업무 생성",
  updated: "업무 수정",
  status_changed: "상태 변경",
  comment: "댓글",
  assigned: "담당자 배정",
};

export type ActivityDetailRow = {
  label: string;
  value: string;
  before?: string;
  after?: string;
};

export function activityActionLabel(action: string, kind?: "project" | "task" | "audit"): string {
  if (kind === "task") {
    return TASK_ACTIVITY_ACTION_LABELS[action] ?? action;
  }
  return PROJECT_ACTIVITY_ACTION_LABELS[action] ?? action;
}

/** "이름: A → B" / "프로젝트 생성 · 제목" 형태를 상세 행으로 파싱 */
export function parseActivitySummaryDetails(summary: string): ActivityDetailRow[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];

  const changeMatch = trimmed.match(/^(.+?):\s*(.+?)\s*→\s*(.+)$/);
  if (changeMatch) {
    return [
      {
        label: changeMatch[1].trim(),
        value: `${changeMatch[2].trim()} → ${changeMatch[3].trim()}`,
        before: changeMatch[2].trim(),
        after: changeMatch[3].trim(),
      },
    ];
  }

  if (trimmed.includes(" · ")) {
    const [head, ...rest] = trimmed.split(" · ");
    const tail = rest.join(" · ").trim();
    if (tail) {
      return [
        { label: "유형", value: head.trim() },
        { label: "내용", value: tail },
      ];
    }
  }

  return [{ label: "내용", value: trimmed }];
}

export function formatActivityDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
