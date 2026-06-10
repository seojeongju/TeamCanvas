/** AI 미연결 시 규칙 기반 일정 제안 보강 */

export type SlotLike = {
  startAt: number;
  endAt: number;
  score: number;
  reason: string;
  suggestedTitle?: string;
};

const TITLE_STOPWORDS = new Set([
  "잡아줘",
  "잡아",
  "해줘",
  "해주세요",
  "일정",
  "미팅",
  "회의",
  "다음",
  "주",
  "내일",
  "오늘",
  "팀",
  "시간",
  "제안",
]);

/** 프롬프트에서 일정 제목 추론 */
export function inferTitleFromPrompt(prompt: string): string | undefined {
  const raw = prompt.trim();
  if (!raw) return undefined;

  let title = raw
    .replace(/[.!?]+$/g, "")
    .replace(/\s*(잡아줘|잡아|해줘|해주세요|일정으로|일정)\s*$/i, "")
    .trim();

  if (!/^\d+:\d+/.test(title)) {
    const colon = title.match(/[:：]\s*(.+)$/);
    if (colon?.[1] && colon[1].length >= 2) title = colon[1].trim();
  }

  title = title.replace(/^(다음\s*주|내일|오늘|이번\s*주)\s+/i, "").trim();

  if (!title || title.length < 2) return undefined;
  if (TITLE_STOPWORDS.has(title)) return undefined;
  return title.slice(0, 80);
}

function hourPreference(prompt: string): "morning" | "afternoon" | "any" {
  const p = prompt.toLowerCase();
  if (/오전|아침|morning/.test(p)) return "morning";
  if (/오후|저녁|afternoon|evening/.test(p)) return "afternoon";
  return "any";
}

function wantsNextWeek(prompt: string): boolean {
  return /다음\s*주|next week/i.test(prompt);
}

/** 프롬프트 선호(오전/오후/다음 주)에 따라 슬롯 점수 조정 */
export function rankSlotsByPrompt<T extends SlotLike>(prompt: string, slots: T[]): T[] {
  if (!slots.length) return slots;

  const pref = hourPreference(prompt);
  const nextWeek = wantsNextWeek(prompt);
  const now = Date.now();

  const scored = slots.map((slot) => {
    let bonus = 0;
    const hour = new Date(slot.startAt).getHours();
    const daysAhead = (slot.startAt - now) / 86400000;

    if (pref === "morning" && hour >= 9 && hour < 12) bonus += 15;
    if (pref === "afternoon" && hour >= 13 && hour < 18) bonus += 15;
    if (nextWeek && daysAhead >= 5 && daysAhead <= 12) bonus += 12;
    if (/1:1|일대일|one.?on.?one/i.test(prompt) && hour >= 10 && hour <= 16) bonus += 8;

    return { slot, score: slot.score + bonus };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map(({ slot, score }) => ({ ...slot, score }));
}

export function enhanceSlotsWithoutAi<T extends SlotLike>(
  prompt: string,
  slots: T[],
): { slots: T[]; suggestedTitle?: string } {
  const suggestedTitle = inferTitleFromPrompt(prompt);
  const ranked = rankSlotsByPrompt(prompt, slots).map((s, i) => ({
    ...s,
    suggestedTitle: s.suggestedTitle ?? (i === 0 ? suggestedTitle : undefined),
    reason:
      i === 0 && suggestedTitle
        ? `「${suggestedTitle}」에 맞는 시간`
        : s.reason,
  }));
  return { slots: ranked, suggestedTitle };
}
