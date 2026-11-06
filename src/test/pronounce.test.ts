import { describe, expect, it } from "vitest";
import { applyDictionary, expandMoney, prepareSpeech, spellOutAcronyms } from "@/lib/pronounce";

describe("money, percentages and symbols", () => {
  it("says shillings the way a presenter would", () => {
    expect(expandMoney("The levy raises Sh1.2 billion.")).toBe("The levy raises 1.2 billion shillings.");
    expect(expandMoney("KSh 500,000 was stolen")).toBe("500,000 shillings was stolen");
    expect(expandMoney("KES 3 million and Ksh50")).toBe("3 million shillings and 50 shillings");
    expect(expandMoney("a budget of Sh4.2trn")).toBe("a budget of 4.2 trillion shillings");
  });
  it("handles dollars and percentages", () => {
    expect(expandMoney("a $2.5 billion loan, up 5.5% on last year")).toBe("a 2.5 billion US dollars loan, up 5.5 percent on last year");
    expect(expandMoney("US$ 300 million")).toBe("300 million US dollars");
  });
  it("does not touch ordinary words", () => {
    expect(expandMoney("Shell reported a profit and she shouted 5 times")).toBe("Shell reported a profit and she shouted 5 times");
  });
  it("replaces ampersands and vs", () => expect(expandMoney("Gor Mahia & AFC Leopards vs Tusker")).toBe("Gor Mahia and AFC Leopards versus Tusker"));
});

describe("acronyms", () => {
  it("spells listed initialisms and their plurals", () => {
    expect(spellOutAcronyms("The IEBC and the KDF met MPs and MCAs.")).toBe("The I E B C and the K D F met M Ps and M C As.");
  });
  it("leaves ordinary words alone", () => {
    expect(spellOutAcronyms("Who knows? Sha la la. Mps")).toBe("Who knows? Sha la la. Mps");
    expect(spellOutAcronyms("KENYA RAISES TAXES")).toBe("KENYA RAISES TAXES");
  });
});

describe("dictionary", () => {
  it("fixes ng' names, keeps the possessive, ignores case", () => {
    expect(applyDictionary("Governor Kang'ethe of Murang'a said MURANG'A's roads are poor", { "kang'ethe": "Kangethe", "murang'a": "Muranga" })).toBe("Governor Kangethe of Muranga said Muranga's roads are poor");
  });
  it("matches whole words only", () => expect(applyDictionary("Ruto and Rutoland", { ruto: "ROO-toh" })).toBe("ROO-toh and Rutoland"));
  it("handles curly apostrophes", () => expect(applyDictionary("Murang’a county", { "murang'a": "Muranga" })).toBe("Muranga county"));
  it("lets the team's entries override the built-in ones", () => {
    expect(prepareSpeech("Murang'a", { "murang'a": "Mu-RAH-nga" })).toBe("Mu-RAH-nga");
  });
  it("runs the whole pipeline", () => {
    expect(prepareSpeech("IEBC chair in Murang'a says Sh2.5 billion & 8% more for MPs")).toBe("I E B C chair in Muranga says 2.5 billion shillings and 8 percent more for M Ps");
  });
  it("copes with an empty dictionary entry and odd input", () => {
    expect(applyDictionary("hello", { "": "x", a: "b" })).toBe("hello");
    expect(prepareSpeech("")).toBe("");
  });
});
