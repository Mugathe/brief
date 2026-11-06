import { describe, expect, it } from "vitest";
import { archiveCoverage, currentPeriodStart, groupHistory, periodEnd, periodLabel } from "@/lib/trends";

// Wednesday 14 Oct 2026, 10:00 in Nairobi (07:00 UTC)
const NOW = new Date("2026-10-14T07:00:00Z");
const NBO = "Africa/Nairobi";

describe("currentPeriodStart (Kenya time)", () => {
  it("finds today, this Monday and the first of the month", () => {
    expect(currentPeriodStart("day", NOW, NBO)).toBe("2026-10-14");
    expect(currentPeriodStart("week", NOW, NBO)).toBe("2026-10-12");
    expect(currentPeriodStart("month", NOW, NBO)).toBe("2026-10-01");
  });
  it("is already tomorrow in Nairobi after 21:00 UTC", () => {
    const late = new Date("2026-10-14T22:30:00Z"); // 01:30 on the 15th in Nairobi
    expect(currentPeriodStart("day", late, NBO)).toBe("2026-10-15");
  });
  it("rolls the month over on Kenya midnight, not UTC midnight", () => {
    expect(currentPeriodStart("month", new Date("2026-10-31T21:30:00Z"), NBO)).toBe("2026-11-01");
  });
});

describe("other time zones", () => {
  const edge = new Date("2026-10-14T22:30:00Z"); // Wed 22:30 UTC
  it("puts the same moment on different days in different places", () => {
    expect(currentPeriodStart("day", edge, "UTC")).toBe("2026-10-14");
    expect(currentPeriodStart("day", edge, "Africa/Lagos")).toBe("2026-10-14"); // 23:30 in Lagos
    expect(currentPeriodStart("day", edge, "Africa/Nairobi")).toBe("2026-10-15"); // 01:30
    expect(currentPeriodStart("day", edge, "Australia/Sydney")).toBe("2026-10-15"); // 09:30, daylight saving
    expect(currentPeriodStart("day", edge, "America/New_York")).toBe("2026-10-14"); // 18:30
  });
  it("starts the week on Monday wherever you are", () => {
    expect(currentPeriodStart("week", new Date("2026-10-18T22:30:00Z"), "UTC")).toBe("2026-10-12"); // Sunday in UTC
    expect(currentPeriodStart("week", new Date("2026-10-18T22:30:00Z"), "Africa/Nairobi")).toBe("2026-10-19"); // already Monday
  });
  it("labels yesterday relative to the edition's own day", () => {
    expect(periodLabel("day", "2026-10-14", edge, "Africa/Nairobi").title).toBe("Yesterday");
    expect(periodLabel("day", "2026-10-14", edge, "UTC").title).toBe("Today so far");
  });
});

describe("periodEnd", () => {
  it("ends days, weeks and months on the right date", () => {
    expect(periodEnd("day", "2026-10-14")).toBe("2026-10-15");
    expect(periodEnd("week", "2026-10-12")).toBe("2026-10-19");
    expect(periodEnd("month", "2026-12-01")).toBe("2027-01-01");
  });
});

describe("periodLabel", () => {
  it("names today and yesterday", () => {
    expect(periodLabel("day", "2026-10-14", NOW, NBO).title).toBe("Today so far");
    expect(periodLabel("day", "2026-10-13", NOW, NBO).title).toBe("Yesterday");
    expect(periodLabel("day", "2026-10-11", NOW, NBO).title).toMatch(/Sunday 11 Oct/);
  });
  it("names this week and last week", () => {
    expect(periodLabel("week", "2026-10-12", NOW, NBO).title).toBe("This week so far");
    expect(periodLabel("week", "2026-10-05", NOW, NBO)).toMatchObject({ title: "Last week", sub: "5 Oct to 11 Oct 2026" });
    expect(periodLabel("week", "2026-09-28", NOW, NBO).title).toBe("28 Sept to 4 Oct");
  });
  it("names this month, last month and older months", () => {
    expect(periodLabel("month", "2026-10-01", NOW, NBO).title).toBe("This month so far");
    expect(periodLabel("month", "2026-09-01", NOW, NBO).title).toBe("Last month");
    expect(periodLabel("month", "2026-08-01", NOW, NBO)).toMatchObject({ title: "August", sub: "2026" });
  });
  it("treats January as the month after December", () => {
    expect(periodLabel("month", "2026-12-01", new Date("2027-01-10T08:00:00Z"), NBO).title).toBe("Last month");
  });
});

describe("groupHistory", () => {
  it("keeps empty periods and orders newest first", () => {
    const g = groupHistory([
      { period_start: "2026-10-14", term: "drought", stories: 3, sources: 2 },
      { period_start: "2026-10-14", term: "turkana", stories: 2, sources: 2 },
      { period_start: "2026-10-13", term: null, stories: null, sources: null },
    ]);
    expect(g.map((p) => p.start)).toEqual(["2026-10-14", "2026-10-13"]);
    expect(g[0]!.terms.map((t) => t.term)).toEqual(["drought", "turkana"]);
    expect(g[1]!.terms).toEqual([]);
  });
});

describe("archiveCoverage", () => {
  const since = "2026-10-05T09:12:00Z";
  it("detects periods before, during and after the start of the archive", () => {
    expect(archiveCoverage("day", "2026-10-03", since)).toBe("none");
    expect(archiveCoverage("day", "2026-10-05", since)).toBe("full");
    expect(archiveCoverage("week", "2026-10-05", since)).toBe("full");
    expect(archiveCoverage("week", "2026-09-28", since)).toBe("none");
    expect(archiveCoverage("week", "2026-10-05", "2026-10-07T09:00:00Z")).toBe("partial");
    expect(archiveCoverage("month", "2026-10-01", since)).toBe("partial");
    expect(archiveCoverage("month", "2026-09-01", since)).toBe("none");
  });
  it("treats an empty archive as having nothing", () => {
    expect(archiveCoverage("day", "2026-10-13", null)).toBe("none");
  });
});
