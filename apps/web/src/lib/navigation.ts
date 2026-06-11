const HOME = "/";

type BackRule = {
  match: (pathname: string) => boolean;
  to: string;
  label: string;
};

const BACK_RULES: BackRule[] = [
  {
    match: (p) => /^\/settings\/teams\/[^/]+$/.test(p),
    to: "/settings/teams",
    label: "팀 관리",
  },
  {
    match: (p) => p === "/settings/departments" || p === "/settings/holidays",
    to: "/settings/org",
    label: "조직 설정",
  },
  {
    match: (p) => p === "/settings/project-templates",
    to: "/projects",
    label: "프로젝트",
  },
  {
    match: (p) => p.startsWith("/settings"),
    to: "/more",
    label: "더보기",
  },
  {
    match: (p) => /^\/admin\/organizations\/[^/]+$/.test(p),
    to: "/admin/organizations",
    label: "조직 관리",
  },
  {
    match: (p) => p.startsWith("/admin/") && p !== "/admin",
    to: "/admin",
    label: "대시보드",
  },
  {
    match: (p) => p === "/admin",
    to: HOME,
    label: "앱으로",
  },
  {
    match: (p) => p !== HOME,
    to: HOME,
    label: "홈",
  },
];

export function getBackNavigation(pathname: string): {
  show: boolean;
  to: string;
  label: string;
} {
  if (pathname === HOME) {
    return { show: false, to: HOME, label: "홈" };
  }

  const rule = BACK_RULES.find((r) => r.match(pathname));
  return rule
    ? { show: true, to: rule.to, label: rule.label }
    : { show: true, to: HOME, label: "홈" };
}
