/** Workers AI 응답에서 일정 제안 JSON 파싱 */

export type AiSuggestJson = {
  title?: string;
  pickIndex?: number;
  reason?: string;
};

export function extractAiResponseText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (typeof r.response === "string") return r.response;
    if (typeof r.result === "string") return r.result;
    if (r.result && typeof r.result === "object") {
      const inner = r.result as Record<string, unknown>;
      if (typeof inner.response === "string") return inner.response;
    }
  }
  return "";
}

export function parseAiSuggestJson(text: string): AiSuggestJson | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as AiSuggestJson;
    if (parsed.pickIndex != null && !Number.isFinite(parsed.pickIndex)) return null;
    return parsed;
  } catch {
    return null;
  }
}
