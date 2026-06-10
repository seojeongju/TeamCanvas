import { describe, expect, it } from "vitest";
import {
  enumerateDateKeysInAllDayRange,
  isMultiDayAllDayRange,
  pruneExcludedDates,
} from "./eventExcludedDates";

describe("eventExcludedDates", () => {
  it("enumerates inclusive date range", () => {
    const keys = enumerateDateKeysInAllDayRange("2026-06-10", "2026-06-12");
    expect(keys).toEqual(["2026-06-10", "2026-06-11", "2026-06-12"]);
  });

  it("detects multi-day range", () => {
    expect(isMultiDayAllDayRange("2026-06-10", "2026-06-11")).toBe(true);
    expect(isMultiDayAllDayRange("2026-06-10", "2026-06-10")).toBe(false);
  });

  it("prunes excluded outside range and boundary dates", () => {
    const pruned = pruneExcludedDates(
      ["2026-06-09", "2026-06-11", "2026-06-12"],
      "2026-06-10",
      "2026-06-12",
    );
    expect(pruned).toEqual(["2026-06-11"]);
  });
});
