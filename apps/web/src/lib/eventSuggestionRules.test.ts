import { describe, expect, it } from "vitest";
import {
  enhanceSlotsWithoutAi,
  inferTitleFromPrompt,
  rankSlotsByPrompt,
} from "../../../../functions/shared/eventSuggestionRules";

describe("eventSuggestionRules", () => {
  it("infers title from Korean prompts", () => {
    expect(inferTitleFromPrompt("다음 주 팀 회의 잡아줘")).toBe("팀 회의");
    expect(inferTitleFromPrompt("1:1 미팅")).toBe("1:1 미팅");
    expect(inferTitleFromPrompt("")).toBeUndefined();
  });

  it("ranks morning slots higher when requested", () => {
    const morning = {
      startAt: new Date("2026-06-12T10:00:00").getTime(),
      endAt: new Date("2026-06-12T11:00:00").getTime(),
      score: 50,
      reason: "base",
    };
    const afternoon = {
      startAt: new Date("2026-06-12T15:00:00").getTime(),
      endAt: new Date("2026-06-12T16:00:00").getTime(),
      score: 50,
      reason: "base",
    };
    const ranked = rankSlotsByPrompt("오전 회의", [afternoon, morning]);
    expect(ranked[0].startAt).toBe(morning.startAt);
  });

  it("enhances slots with suggested title", () => {
    const slots = [
      {
        startAt: Date.now() + 86400000,
        endAt: Date.now() + 86400000 + 3600000,
        score: 60,
        reason: "가까운 업무 시간",
      },
    ];
    const { slots: out, suggestedTitle } = enhanceSlotsWithoutAi("스프린트 리뷰 잡아줘", slots);
    expect(suggestedTitle).toBe("스프린트 리뷰");
    expect(out[0]?.suggestedTitle).toBe("스프린트 리뷰");
  });
});
