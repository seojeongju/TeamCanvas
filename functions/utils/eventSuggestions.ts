import type { BusyBlock } from "./freeBusy";
import { enhanceSlotsWithoutAi } from "../shared/eventSuggestionRules";

export type SuggestedSlot = {
  startAt: number;
  endAt: number;
  score: number;
  reason: string;
  suggestedTitle?: string;
};

const WORK_START = 9;
const WORK_END = 18;
const SLOT_MS = 30 * 60 * 1000;

function mergeBusy(blocks: BusyBlock[]): { start: number; end: number }[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.startAt - b.startAt);
  const merged: { start: number; end: number }[] = [];
  let cur = { start: sorted[0].startAt, end: sorted[0].endAt };
  for (let i = 1; i < sorted.length; i++) {
    const b = sorted[i];
    if (b.startAt <= cur.end) {
      cur.end = Math.max(cur.end, b.endAt);
    } else {
      merged.push(cur);
      cur = { start: b.startAt, end: b.endAt };
    }
  }
  merged.push(cur);
  return merged;
}

function isSlotFree(
  occupied: { start: number; end: number }[],
  start: number,
  end: number,
): boolean {
  return !occupied.some((o) => start < o.end && end > o.start);
}

function scoreSlot(start: number, now: number): number {
  const hoursUntil = (start - now) / 3600000;
  if (hoursUntil < 2) return 10;
  if (hoursUntil < 24) return 50;
  if (hoursUntil < 72) return 80;
  return 60;
}

export function findFreeSlots(
  allBusy: BusyBlock[],
  from: number,
  to: number,
  durationMinutes: number,
  now: number,
): SuggestedSlot[] {
  const durationMs = durationMinutes * 60 * 1000;
  const occupied = mergeBusy(allBusy);
  const suggestions: SuggestedSlot[] = [];

  const cursor = new Date(Math.max(from, now));
  cursor.setMinutes(0, 0, 0);
  if (cursor.getTime() < now) cursor.setHours(cursor.getHours() + 1);

  const endLimit = to;

  while (cursor.getTime() < endLimit && suggestions.length < 12) {
    const hour = cursor.getHours();
    const day = cursor.getDay();

    if (day === 0 || day === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START, 0, 0, 0);
      continue;
    }

    if (hour < WORK_START) {
      cursor.setHours(WORK_START, 0, 0, 0);
      continue;
    }

    if (hour >= WORK_END || cursor.getHours() * 60 + cursor.getMinutes() + durationMinutes > WORK_END * 60) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START, 0, 0, 0);
      continue;
    }

    const startAt = cursor.getTime();
    const endAt = startAt + durationMs;

    if (startAt >= now && isSlotFree(occupied, startAt, endAt)) {
      const score = scoreSlot(startAt, now);
      suggestions.push({
        startAt,
        endAt,
        score,
        reason:
          score >= 80
            ? "여유 있는 시간대"
            : score >= 50
              ? "가까운 업무 시간"
              : "곧 시작 가능",
      });
    }

    cursor.setTime(cursor.getTime() + SLOT_MS);
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

export async function enhanceWithAi(
  ai: AiBinding | undefined,
  prompt: string,
  slots: SuggestedSlot[],
): Promise<{ slots: SuggestedSlot[]; aiUsed: boolean; suggestedTitle?: string }> {
  const ruleEnhanced = enhanceSlotsWithoutAi(prompt, slots);

  if (!ai || slots.length === 0) {
    return {
      slots: ruleEnhanced.slots,
      aiUsed: false,
      suggestedTitle: ruleEnhanced.suggestedTitle ?? (prompt.trim() || undefined),
    };
  }

  try {
    const slotList = ruleEnhanced.slots
      .map(
        (s, i) =>
          `${i + 1}. ${new Date(s.startAt).toLocaleString("ko-KR")} ~ ${new Date(s.endAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
      )
      .join("\n");

    const result = (await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You help schedule meetings. Reply ONLY with valid JSON: {\"title\":\"string\",\"pickIndex\":1,\"reason\":\"한국어 한 문장\"}. pickIndex is 1-based slot number.",
        },
        {
          role: "user",
          content: `요청: ${prompt}\n후보 시간:\n${slotList}`,
        },
      ],
      max_tokens: 200,
    })) as { response?: string };

    const text = typeof result === "object" && result && "response" in result ? result.response : "";
    const jsonMatch = text?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { slots: ruleEnhanced.slots, aiUsed: false, suggestedTitle: ruleEnhanced.suggestedTitle };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      pickIndex?: number;
      reason?: string;
    };
    const idx = Math.max(0, Math.min(ruleEnhanced.slots.length - 1, (parsed.pickIndex ?? 1) - 1));
    const ranked = [...ruleEnhanced.slots];
    const [picked] = ranked.splice(idx, 1);
    picked.reason = parsed.reason ?? picked.reason;
    picked.suggestedTitle = parsed.title;

    return {
      slots: [picked, ...ranked],
      aiUsed: true,
      suggestedTitle: parsed.title,
    };
  } catch {
    return { slots: ruleEnhanced.slots, aiUsed: false, suggestedTitle: ruleEnhanced.suggestedTitle };
  }
}
