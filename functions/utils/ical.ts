type IcalEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: number;
  endAt: number;
  allDay: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatIcalUtc(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function formatIcalDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escapeIcal(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcalCalendar(events: IcalEvent[], calendarName = "TeamCanvas"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TeamCanvas//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
  ];

  const stamp = formatIcalUtc(Date.now());

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@teamcanvas`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcalDate(e.startAt)}`);
      const endDate = new Date(e.endAt);
      endDate.setDate(endDate.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${formatIcalDate(endDate.getTime())}`);
    } else {
      lines.push(`DTSTART:${formatIcalUtc(e.startAt)}`);
      lines.push(`DTEND:${formatIcalUtc(e.endAt)}`);
    }
    lines.push(`SUMMARY:${escapeIcal(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcal(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcal(e.location)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
