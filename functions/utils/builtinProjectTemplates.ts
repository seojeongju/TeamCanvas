import type { ResolvedProjectTemplatePayload } from "./projectTemplateData";

const BUILTIN: ResolvedProjectTemplatePayload[] = [
  {
    id: "builtin:blank",
    name: "빈 프로젝트",
    description: "마일스톤 없이 시작",
    milestones: [],
    tasks: [],
    memberSlots: [],
    source: "builtin",
  },
  {
    id: "builtin:product-launch",
    name: "제품 출시",
    description: "기획 · 디자인 · 개발 · QA · 출시",
    milestones: [
      { title: "요구사항 정리", offsetDays: 0 },
      { title: "디자인", offsetDays: 14 },
      { title: "개발", offsetDays: 28 },
      { title: "QA", offsetDays: 56 },
      { title: "출시", offsetDays: 70 },
    ],
    tasks: [
      { title: "요구사항 문서 작성", offsetDays: 3 },
      { title: "와이어프레임 검토", offsetDays: 10 },
      { title: "MVP 개발 착수", offsetDays: 21 },
      { title: "QA 체크리스트 실행", offsetDays: 58 },
    ],
    memberSlots: [
      { label: "PM", role: "manager" },
      { label: "디자이너", role: "member" },
      { label: "개발", role: "member" },
    ],
    source: "builtin",
  },
  {
    id: "builtin:marketing",
    name: "마케팅 캠페인",
    description: "기획 · 제작 · 배포 · 성과 분석",
    milestones: [
      { title: "캠페인 기획", offsetDays: 0 },
      { title: "콘텐츠 제작", offsetDays: 7 },
      { title: "채널 배포", offsetDays: 21 },
      { title: "성과 분석", offsetDays: 35 },
    ],
    tasks: [
      { title: "타깃·메시지 정의", offsetDays: 2 },
      { title: "크리에이티브 제작", offsetDays: 12 },
      { title: "채널별 배포 일정 확정", offsetDays: 18 },
    ],
    memberSlots: [
      { label: "캠페인 리드", role: "manager" },
      { label: "콘텐츠", role: "member" },
    ],
    source: "builtin",
  },
  {
    id: "builtin:internal",
    name: "내부 개선",
    description: "현황 파악 · 실행 · 검토",
    milestones: [
      { title: "현황 파악", offsetDays: 0 },
      { title: "개선 실행", offsetDays: 7 },
      { title: "결과 검토", offsetDays: 21 },
    ],
    tasks: [
      { title: "현황 조사·정리", offsetDays: 2 },
      { title: "개선안 실행", offsetDays: 9 },
    ],
    memberSlots: [{ label: "담당자", role: "member" }],
    source: "builtin",
  },
];

export function resolveBuiltinTemplate(templateId: string): ResolvedProjectTemplatePayload | null {
  const normalized = templateId.startsWith("builtin:") ? templateId : `builtin:${templateId}`;
  return BUILTIN.find((t) => t.id === normalized) ?? null;
}

export function listBuiltinTemplates(): ResolvedProjectTemplatePayload[] {
  return BUILTIN;
}
