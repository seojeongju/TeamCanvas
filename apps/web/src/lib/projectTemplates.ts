export type ProjectTemplateMilestone = {
  title: string;
  /** 프로젝트 시작일 기준 일수 오프셋 (시작일 없으면 순서만 사용) */
  offsetDays?: number;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  milestones: ProjectTemplateMilestone[];
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    name: "빈 프로젝트",
    description: "마일스톤 없이 시작",
    milestones: [],
  },
  {
    id: "product-launch",
    name: "제품 출시",
    description: "기획 · 디자인 · 개발 · QA · 출시",
    milestones: [
      { title: "요구사항 정리", offsetDays: 0 },
      { title: "디자인", offsetDays: 14 },
      { title: "개발", offsetDays: 28 },
      { title: "QA", offsetDays: 56 },
      { title: "출시", offsetDays: 70 },
    ],
  },
  {
    id: "marketing",
    name: "마케팅 캠페인",
    description: "기획 · 제작 · 배포 · 성과 분석",
    milestones: [
      { title: "캠페인 기획", offsetDays: 0 },
      { title: "콘텐츠 제작", offsetDays: 7 },
      { title: "채널 배포", offsetDays: 21 },
      { title: "성과 분석", offsetDays: 35 },
    ],
  },
  {
    id: "internal",
    name: "내부 개선",
    description: "현황 파악 · 실행 · 검토",
    milestones: [
      { title: "현황 파악", offsetDays: 0 },
      { title: "개선 실행", offsetDays: 7 },
      { title: "결과 검토", offsetDays: 21 },
    ],
  },
];

export type ResolvedProjectTemplate = {
  id: string;
  name: string;
  description: string;
  milestones: ProjectTemplateMilestone[];
  source: "builtin" | "org";
};

export function listBuiltinTemplates(): ResolvedProjectTemplate[] {
  return PROJECT_TEMPLATES.map((t) => ({
    id: `builtin:${t.id}`,
    name: t.name,
    description: t.description,
    milestones: t.milestones,
    source: "builtin" as const,
  }));
}

export function resolveProjectTemplate(
  templateId: string,
  orgTemplates: { id: string; name: string; description: string | null; milestones: ProjectTemplateMilestone[] }[],
): ResolvedProjectTemplate | null {
  if (templateId.startsWith("org:")) {
    const id = templateId.slice(4);
    const t = orgTemplates.find((o) => o.id === id);
    if (!t) return null;
    return {
      id: templateId,
      name: t.name,
      description: t.description ?? "",
      milestones: t.milestones,
      source: "org",
    };
  }
  const builtinId = templateId.startsWith("builtin:") ? templateId.slice(8) : templateId;
  const t = PROJECT_TEMPLATES.find((b) => b.id === builtinId);
  if (!t) return null;
  return {
    id: `builtin:${t.id}`,
    name: t.name,
    description: t.description,
    milestones: t.milestones,
    source: "builtin",
  };
}

export function milestonesFromProject(
  milestones: { title: string; dueAt: number | null; sortOrder: number }[],
  projectStartAt: number | null,
): ProjectTemplateMilestone[] {
  const dayMs = 86400000;
  return [...milestones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      title: m.title,
      offsetDays:
        projectStartAt != null && m.dueAt != null
          ? Math.round((m.dueAt - projectStartAt) / dayMs)
          : undefined,
    }));
}

export function milestoneDueDatesFromTemplate(
  template: { milestones: ProjectTemplateMilestone[] },
  projectStartAt: number | null,
): (number | null)[] {
  if (!projectStartAt) {
    return template.milestones.map(() => null);
  }
  const dayMs = 86400000;
  return template.milestones.map((m) =>
    m.offsetDays != null ? projectStartAt + m.offsetDays * dayMs : null,
  );
}
