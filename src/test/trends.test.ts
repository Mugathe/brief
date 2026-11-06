import { describe, expect, it } from "vitest";
import { bucketStarts, fillMonths, fillSeries, growthOf } from "@/lib/trends";

const NOW = new Date("2026-10-09T10:00:00Z"); // a Friday

describe("bucketStarts", () => {
  it("gives one bucket per day for a week, ending today", () => {
    const b = bucketStarts(7, NOW);
    expect(b).toHaveLength(7);
    expect(b[0]).toBe("2026-10-03");
    expect(b.at(-1)).toBe("2026-10-09");
  });
  it("starts weekly buckets on a Monday", () => {
    const b = bucketStarts(90, NOW);
    expect(b.every((d) => new Date(d + "T00:00:00Z").getUTCDay() === 1)).toBe(true);
    expect(b.at(-1)).toBe("2026-10-05");
  });
  it("uses first-of-month buckets for a year", () => {
    const b = bucketStarts(365, NOW);
    expect(b.every((d) => d.endsWith("-01"))).toBe(true);
    expect(b[0]).toBe("2025-10-01");
    expect(b.at(-1)).toBe("2026-10-01");
    expect(b).toHaveLength(13);
  });
});

describe("fillSeries / fillMonths", () => {
  it("zero-fills days with no stories", () => {
    const s = fillSeries([{ bucket: "2026-10-08", stories: 5 }], 3, NOW);
    expect(s).toEqual([{ bucket: "2026-10-07", stories: 0 }, { bucket: "2026-10-08", stories: 5 }, { bucket: "2026-10-09", stories: 0 }]);
  });
  it("fills the gaps between months", () => {
    const m = fillMonths([{ month: "2023-11-01", stories: 4, sources: 2 }, { month: "2024-02-01", stories: 1, sources: 1 }]);
    expect(m.map((x) => x.month.slice(0, 7))).toEqual(["2023-11", "2023-12", "2024-01", "2024-02"]);
    expect(m[1]!.stories).toBe(0);
  });
  it("handles empty input", () => expect(fillMonths([])).toEqual([]));
});

describe("growthOf", () => {
  it("does not explode when there was no earlier coverage", () => expect(growthOf(6, 0)).toBe(3));
  it("measures change against the earlier period", () => expect(growthOf(30, 10)).toBe(2));
  it("goes negative when coverage drops", () => expect(growthOf(5, 10)).toBeLessThan(0));
});
