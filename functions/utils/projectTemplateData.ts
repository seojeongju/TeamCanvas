export type TemplateMilestone = { title: string; offsetDays?: number };

export type TemplateTask = {
  title: string;
  description?: string;
  status?: "todo" | "doing" | "done";
  offsetDays?: number;
};

export type TemplateMemberSlot = {
  label: string;
  role: "manager" | "member" | "viewer";
};

export type ResolvedProjectTemplatePayload = {
  id: string;
  name: string;
  description: string;
  milestones: TemplateMilestone[];
  tasks: TemplateTask[];
  memberSlots: TemplateMemberSlot[];
  source: "builtin" | "org";
};

const MEMBER_ROLES = new Set(["manager", "member", "viewer"]);
const TASK_STATUSES = new Set(["todo", "doing", "done"]);

export function parseTemplateMilestones(json: string): TemplateMilestone[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is { title: string; offsetDays?: number } => typeof m === "object" && m !== null && "title" in m)
      .map((m) => ({
        title: String(m.title).trim(),
        offsetDays: typeof m.offsetDays === "number" ? m.offsetDays : undefined,
      }))
      .filter((m) => m.title.length > 0);
  } catch {
    return [];
  }
}

export function parseTemplateTasks(json: string): TemplateTask[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null && "title" in t)
      .map((t) => {
        const status = typeof t.status === "string" && TASK_STATUSES.has(t.status) ? t.status : "todo";
        return {
          title: String(t.title).trim(),
          description: typeof t.description === "string" ? t.description.trim() || undefined : undefined,
          status: status as TemplateTask["status"],
          offsetDays: typeof t.offsetDays === "number" ? t.offsetDays : undefined,
        };
      })
      .filter((t) => t.title.length > 0);
  } catch {
    return [];
  }
}

export function parseTemplateMemberSlots(json: string): TemplateMemberSlot[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null && "label" in s)
      .map((s) => {
        const role =
          typeof s.role === "string" && MEMBER_ROLES.has(s.role)
            ? (s.role as TemplateMemberSlot["role"])
            : "member";
        return { label: String(s.label).trim(), role };
      })
      .filter((s) => s.label.length > 0);
  } catch {
    return [];
  }
}

export function serializeTemplateTasks(tasks: TemplateTask[]): string {
  return JSON.stringify(
    tasks
      .filter((t) => t.title?.trim())
      .map((t) => ({
        title: t.title.trim(),
        description: t.description?.trim() || undefined,
        status: t.status && TASK_STATUSES.has(t.status) ? t.status : "todo",
        offsetDays: t.offsetDays,
      })),
  );
}

export function serializeTemplateMemberSlots(slots: TemplateMemberSlot[]): string {
  return JSON.stringify(
    slots
      .filter((s) => s.label?.trim())
      .map((s) => ({
        label: s.label.trim(),
        role: MEMBER_ROLES.has(s.role) ? s.role : "member",
      })),
  );
}

export function dueAtFromOffset(startAt: number | null, offsetDays?: number): number | null {
  if (startAt == null || offsetDays == null) return null;
  return startAt + offsetDays * 86400000;
}
