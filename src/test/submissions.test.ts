import { describe, expect, it } from "vitest";
import { submissionInput } from "@/lib/submissions.functions";

const valid = {
  consent: true as const, name: "Jane Doe", office: "Governor" as const, region: "Nairobi", affiliation: "Independent",
  contact_name: "Sam Otieno", contact_role: "Campaign manager", contact_email: "sam@example.com", contact_phone: "",
  overview: "Jane is a former county planner seeking the Nairobi governorship.", priorities: ["Transport"], pledges: "", costing: "", delivery: "", track_record: "",
  sources: [{ title: "Manifesto", publisher: "Jane 2027", date: "", url: "https://example.com/manifesto.pdf" }],
};

describe("submission form validation", () => {
  it("accepts a complete submission", () => expect(submissionInput.safeParse(valid).success).toBe(true));
  it("requires at least one source", () => expect(submissionInput.safeParse({ ...valid, sources: [] }).success).toBe(false));
  it("rejects non-http source links", () => expect(submissionInput.safeParse({ ...valid, sources: [{ ...valid.sources[0], url: "javascript:alert(1)" }] }).success).toBe(false));
  it("requires the declaration", () => expect(submissionInput.safeParse({ ...valid, consent: false }).success).toBe(false));
  it("rejects unknown offices and bad emails", () => {
    expect(submissionInput.safeParse({ ...valid, office: "Chief" }).success).toBe(false);
    expect(submissionInput.safeParse({ ...valid, contact_email: "nope" }).success).toBe(false);
  });
});
