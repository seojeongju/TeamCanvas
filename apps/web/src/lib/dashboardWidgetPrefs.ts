const STORAGE_KEY = "tc-dashboard-widgets";

export type DashboardWidgetId =
  | "projects"
  | "today_events"
  | "week_milestones"
  | "my_tasks"
  | "insights"
  | "activity";

export type DashboardWidgetPrefs = {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
};

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  projects: "프로젝트",
  today_events: "오늘 일정",
  week_milestones: "이번 주 마일스톤",
  my_tasks: "내 업무",
  insights: "팀 인사이트",
  activity: "최근 활동",
};

/** 상태 필터와 연동되는 위젯 — 홈에서 필터 바로 아래에 고정 노출 */
export const DASHBOARD_FILTER_LINKED_WIDGETS: DashboardWidgetId[] = ["my_tasks", "projects"];

export const DEFAULT_DASHBOARD_WIDGET_ORDER: DashboardWidgetId[] = [
  "my_tasks",
  "projects",
  "today_events",
  "week_milestones",
  "insights",
  "activity",
];

const ALL_WIDGET_IDS = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_WIDGET_ORDER);

function normalizeOrder(order: unknown): DashboardWidgetId[] {
  if (!Array.isArray(order)) return [...DEFAULT_DASHBOARD_WIDGET_ORDER];
  const seen = new Set<DashboardWidgetId>();
  const normalized: DashboardWidgetId[] = [];
  for (const id of order) {
    if (typeof id !== "string" || !ALL_WIDGET_IDS.has(id as DashboardWidgetId)) continue;
    const widgetId = id as DashboardWidgetId;
    if (seen.has(widgetId)) continue;
    seen.add(widgetId);
    normalized.push(widgetId);
  }
  for (const id of DEFAULT_DASHBOARD_WIDGET_ORDER) {
    if (!seen.has(id)) normalized.push(id);
  }
  return normalized;
}

function normalizeHidden(hidden: unknown): DashboardWidgetId[] {
  if (!Array.isArray(hidden)) return [];
  return hidden.filter(
    (id): id is DashboardWidgetId =>
      typeof id === "string" && ALL_WIDGET_IDS.has(id as DashboardWidgetId),
  );
}

export function getDashboardWidgetPrefs(): DashboardWidgetPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { order: [...DEFAULT_DASHBOARD_WIDGET_ORDER], hidden: [] };
    }
    const parsed = JSON.parse(raw) as Partial<DashboardWidgetPrefs>;
    return {
      order: normalizeOrder(parsed.order),
      hidden: normalizeHidden(parsed.hidden),
    };
  } catch {
    return { order: [...DEFAULT_DASHBOARD_WIDGET_ORDER], hidden: [] };
  }
}

export function saveDashboardWidgetPrefs(prefs: DashboardWidgetPrefs): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      order: normalizeOrder(prefs.order),
      hidden: normalizeHidden(prefs.hidden),
    }),
  );
}

export function getVisibleDashboardWidgets(prefs: DashboardWidgetPrefs): DashboardWidgetId[] {
  const hidden = new Set(prefs.hidden);
  const visible = prefs.order.filter((id) => !hidden.has(id));
  // 내 업무·프로젝트는 상태 필터 직하에 두어 필터 클릭 결과가 바로 보이게 한다.
  const pinned = DASHBOARD_FILTER_LINKED_WIDGETS.filter((id) => visible.includes(id));
  const rest = visible.filter((id) => !DASHBOARD_FILTER_LINKED_WIDGETS.includes(id));
  return [...pinned, ...rest];
}

export function toggleDashboardWidgetHidden(
  prefs: DashboardWidgetPrefs,
  id: DashboardWidgetId,
): DashboardWidgetPrefs {
  const hidden = new Set(prefs.hidden);
  if (hidden.has(id)) hidden.delete(id);
  else hidden.add(id);
  return { ...prefs, hidden: [...hidden] };
}

export function moveDashboardWidget(
  prefs: DashboardWidgetPrefs,
  id: DashboardWidgetId,
  direction: "up" | "down",
): DashboardWidgetPrefs {
  const order = [...prefs.order];
  const index = order.indexOf(id);
  if (index < 0) return prefs;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= order.length) return prefs;
  [order[index], order[target]] = [order[target], order[index]];
  return { ...prefs, order };
}

export function resetDashboardWidgetPrefs(): DashboardWidgetPrefs {
  const prefs = { order: [...DEFAULT_DASHBOARD_WIDGET_ORDER], hidden: [] };
  saveDashboardWidgetPrefs(prefs);
  return prefs;
}
