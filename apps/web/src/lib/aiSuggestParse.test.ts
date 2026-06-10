import { describe, expect, it } from "vitest";
import {
  extractAiResponseText,
  parseAiSuggestJson,
} from "../../../../functions/shared/aiSuggestParse";

describe("aiSuggestParse", () => {
  it("extracts response text from Workers AI shapes", () => {
    expect(extractAiResponseText({ response: '{"title":"회의"}' })).toBe('{"title":"회의"}');
    expect(extractAiResponseText({ result: { response: "ok" } })).toBe("ok");
  });

  it("parses suggestion JSON", () => {
    const parsed = parseAiSuggestJson('{"title":"팀 회의","pickIndex":2,"reason":"오후가 여유 있습니다"}');
    expect(parsed?.title).toBe("팀 회의");
    expect(parsed?.pickIndex).toBe(2);
    expect(parsed?.reason).toContain("오후");
  });

  it("returns null for invalid JSON", () => {
    expect(parseAiSuggestJson("not json")).toBeNull();
  });
});
