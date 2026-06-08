export type OrgWorkSettings = {
  workHours: { start: string; end: string };
  workDays: number[];
};

export const DEFAULT_ORG_SETTINGS: OrgWorkSettings = {
  workHours: { start: "09:00", end: "18:00" },
  workDays: [1, 2, 3, 4, 5],
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeHHmm(value: string): boolean {
  return TIME_RE.test(value);
}

export function parseOrgSettings(json: string | null | undefined): OrgWorkSettings {
  if (!json) return { ...DEFAULT_ORG_SETTINGS, workDays: [...DEFAULT_ORG_SETTINGS.workDays] };
  try {
    const raw = JSON.parse(json) as Partial<OrgWorkSettings>;
    const workHours = raw.workHours ?? DEFAULT_ORG_SETTINGS.workHours;
    const start = isValidTimeHHmm(workHours.start) ? workHours.start : DEFAULT_ORG_SETTINGS.workHours.start;
    const end = isValidTimeHHmm(workHours.end) ? workHours.end : DEFAULT_ORG_SETTINGS.workHours.end;
    const workDays = Array.isArray(raw.workDays)
      ? raw.workDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [...DEFAULT_ORG_SETTINGS.workDays];
    return {
      workHours: { start, end },
      workDays: workDays.length ? workDays : [...DEFAULT_ORG_SETTINGS.workDays],
    };
  } catch {
    return { ...DEFAULT_ORG_SETTINGS, workDays: [...DEFAULT_ORG_SETTINGS.workDays] };
  }
}

export function mergeOrgSettings(
  existingJson: string | null | undefined,
  patch: Partial<OrgWorkSettings>,
): OrgWorkSettings {
  const current = parseOrgSettings(existingJson);
  const next: OrgWorkSettings = {
    workHours: { ...current.workHours },
    workDays: [...current.workDays],
  };

  if (patch.workHours) {
    if (patch.workHours.start && isValidTimeHHmm(patch.workHours.start)) {
      next.workHours.start = patch.workHours.start;
    }
    if (patch.workHours.end && isValidTimeHHmm(patch.workHours.end)) {
      next.workHours.end = patch.workHours.end;
    }
  }
  if (patch.workDays) {
    const days = patch.workDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length) next.workDays = days;
  }

  return next;
}

export function serializeOrgSettings(settings: OrgWorkSettings): string {
  return JSON.stringify(settings);
}

/** 근무 시작 시각 파싱 (로컬 날짜 기준) */
export function parseWorkHourOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
