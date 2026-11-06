export type AspirantStatus = "Declared intent" | "Prospective";
export type EvidenceState = "Partial evidence" | "Not yet assessed";
export type PillarLevel = "Strong detail" | "Some detail" | "Limited detail" | "Not disclosed" | "Under review";

export type ManifestoSource = {
  title: string;
  publisher: string;
  date: string;
  url: string;
  kind: "Candidate or party" | "Independent reporting";
};

export type CandidateStatement = { pledges: string; costing: string; delivery: string; trackRecord: string };

export type Aspirant = {
  statement?: CandidateStatement | null;
  submittedByTeam?: boolean;
  slug: string;
  office: string;
  region: string | null;
  name: string;
  affiliation: string;
  status: AspirantStatus;
  statusNote: string;
  evidenceState: EvidenceState;
  overview: string;
  priorities: string[];
  pillars: {
    label: string;
    level: PillarLevel;
    note: string;
  }[];
  gaps: string[];
  sources: ManifestoSource[];
};

export type StaticAspirant = Omit<Aspirant, "office" | "region">;

export const PILLAR_LABELS = ["Promise clarity", "Costing", "Feasibility", "Track record evidence", "Gaps and disclosure"] as const;
export const PILLAR_LEVELS: PillarLevel[] = ["Strong detail", "Some detail", "Limited detail", "Not disclosed", "Under review"];

export const REVIEWED_AT = "7 October 2026";

export const METHODOLOGY = [
  "Promise clarity: measurable targets, timelines and named delivery mechanisms.",
  "Costing: published estimates, funding sources and fiscal assumptions.",
  "Feasibility: legal pathway, responsible institutions and delivery sequence.",
  "Track record: independently verifiable delivery in a comparable role; lack of prior office is not penalised.",
  "Gaps: important questions the available platform has not yet answered.",
];

const sharedPillars = (overrides: Partial<Record<string, { level: PillarLevel; note: string }>> = {}) =>
  ([
    ["Promise clarity", "Limited detail", "Themes are public, but measurable targets and timelines remain limited."],
    ["Costing", "Not disclosed", "No detailed costing or funding plan was found in the reviewed material."],
    ["Feasibility", "Not disclosed", "No sequenced legal and institutional delivery plan was found."],
    ["Track record evidence", "Under review", "Relevant public record requires claim-by-claim verification against independent records."],
    ["Gaps and disclosure", "Some detail", "The missing evidence is identified rather than inferred."],
  ] satisfies Array<[string, PillarLevel, string]>).map(([label, level, note]) => ({ label, level, note, ...(overrides[label] ?? {}) }));

export const ASPIRANTS: Aspirant[] = ([
  {
    slug: "rigathi-gachagua",
    name: "Rigathi Gachagua",
    affiliation: "Democracy for the Citizens Party",
    status: "Declared intent",
    statusNote: "Presented as DCP’s 2027 flagbearer; ballot eligibility remains legally contested following his 2024 impeachment.",
    evidenceState: "Partial evidence",
    overview: "His public platform is framed as “Skiza Wakenya” — listening to citizens — with accountability, anti-corruption and youth inclusion themes. A consolidated, costed manifesto was not found in the reviewed sources.",
    priorities: ["Public accountability", "Anti-corruption", "Youth inclusion", "Citizen consultation"],
    pillars: sharedPillars(),
    gaps: ["A complete manifesto with measurable targets", "Cost and funding assumptions", "Legal and institutional delivery sequence", "A final determination on ballot eligibility"],
    sources: [
      { title: "Gachagua unveils party to take on Ruto come 2027", publisher: "The EastAfrican", date: "15 May 2025", url: "https://www.theeastafrican.co.ke/tea/news/east-africa/gachagua-unveils-party-to-take-on-ruto-come-2027-5044748", kind: "Independent reporting" },
      { title: "Rigathi Gachagua 2027 candidacy sparks intrigue", publisher: "Nation", date: "2025", url: "https://nation.africa/kenya/news/politics/rigathi-gachagua-2027-candidacy-sparks-intrigue-reshaping-battle-to-unseat-president-ruto-5195800", kind: "Independent reporting" },
    ],
  },
  {
    slug: "martha-karua",
    name: "Martha Karua",
    affiliation: "People’s Liberation Party",
    status: "Declared intent",
    statusNote: "Publicly reaffirmed that she is seeking the presidency while participating in opposition talks.",
    evidenceState: "Partial evidence",
    overview: "The available platform centres on constitutionalism, rule of law and resistance to concentration of political power. No standalone, costed 2027 manifesto was found in the reviewed material.",
    priorities: ["Rule of law", "Constitutionalism", "Democratic institutions", "Accountable government"],
    pillars: sharedPillars(),
    gaps: ["Sector-by-sector commitments", "Measurable delivery dates", "Fiscal and funding plan", "Position within any joint opposition platform"],
    sources: [
      { title: "Karua: Nothing short of the presidency for me", publisher: "Nation", date: "31 July 2026", url: "https://nation.africa/kenya/news/politics/karua-nothing-short-of-the-presidency-for-me-5543082", kind: "Independent reporting" },
    ],
  },
  {
    slug: "david-maraga",
    name: "David Maraga",
    affiliation: "United Green Movement",
    status: "Declared intent",
    statusNote: "Declared his intention and was unveiled as UGM’s presidential flagbearer.",
    evidenceState: "Partial evidence",
    overview: "Maraga and UGM have published a comparatively broad platform around constitutionalism, anti-corruption, policing, youth employment, economic reform, environmental sustainability and social justice. Detailed targets, costing and sequencing are still incomplete in the reviewed evidence.",
    priorities: ["Rule of law", "Anti-corruption", "Police accountability", "Youth employment", "Environmental sustainability"],
    pillars: sharedPillars({
      "Promise clarity": { level: "Some detail", note: "The platform names several policy areas and intended outcomes, but most lack measurable targets and deadlines." },
      "Feasibility": { level: "Limited detail", note: "Institutional reform themes are visible; a full implementation sequence is not yet documented." },
    }),
    gaps: ["Costed flagship commitments", "Quantified employment and growth targets", "Implementation milestones", "Independent fiscal testing"],
    sources: [
      { title: "David Maraga unveiled as UGM presidential flag bearer", publisher: "United Green Movement", date: "2 October 2025", url: "https://www.ugmparty.co.ke/hon-david-maraga-unveiled-as-ugm-party-presidential-flag-bearer/", kind: "Candidate or party" },
      { title: "David Maraga: I will restore the rule of law", publisher: "Nation", date: "18 June 2025", url: "https://nation.africa/kenya/news/politics/david-maraga-i-will-restore-the-rule-of-law-if-elected-president-5086926", kind: "Independent reporting" },
    ],
  },
  {
    slug: "fred-matiangi",
    name: "Fred Matiang’i",
    affiliation: "Jubilee Party",
    status: "Declared intent",
    statusNote: "Confirmed his bid and was subsequently endorsed by Jubilee’s national leadership.",
    evidenceState: "Partial evidence",
    overview: "His early message stresses restoring hope, national unity and opportunities for young people. The reviewed sources do not contain a consolidated 2027 manifesto with measurable promises or costing.",
    priorities: ["National unity", "Youth opportunity", "Public-service delivery", "Economic confidence"],
    pillars: sharedPillars(),
    gaps: ["Published manifesto", "Specific economic and social targets", "Funding plan", "Independent assessment of delivery claims from prior office"],
    sources: [
      { title: "Matiang’i confirms Jubilee as party of choice for 2027 bid", publisher: "Capital FM", date: "3 October 2025", url: "https://capitalfm.africa/matiangi-confirms-jubilee-as-party-of-choice-for-2027-state-house-bid/", kind: "Independent reporting" },
      { title: "Jubilee Party endorses Fred Matiang’i", publisher: "Citizen Digital", date: "30 October 2025", url: "https://www.citizen.digital/news/jubilee-party-endorses-fred-matiangi-for-2027-presidential-race-n372195", kind: "Independent reporting" },
    ],
  },
  {
    slug: "miguna-miguna",
    name: "Miguna Miguna",
    affiliation: "Independent / not confirmed",
    status: "Declared intent",
    statusNote: "Announced a bid in a television interview; reported citizenship questions make eventual eligibility uncertain.",
    evidenceState: "Partial evidence",
    overview: "The declaration used socialist, people-centred and anti-establishment language. No detailed written platform, costing or implementation programme was found in the reviewed evidence.",
    priorities: ["People-centred government", "Economic redistribution", "Institutional change", "Anti-establishment reform"],
    pillars: sharedPillars(),
    gaps: ["Written policy programme", "Measurable commitments", "Cost and funding model", "Resolution of reported eligibility questions"],
    sources: [
      { title: "Miguna announces 2027 presidential bid", publisher: "The Star", date: "8 January 2026", url: "https://www.the-star.co.ke/news/2026-01-08-miguna-announces-2027-presidential-bid", kind: "Independent reporting" },
    ],
  },
  {
    slug: "kalonzo-musyoka",
    name: "Kalonzo Musyoka",
    affiliation: "Wiper Patriotic Front",
    status: "Declared intent",
    statusNote: "Declared his intention to contest under a “Komboa Kenya” theme.",
    evidenceState: "Partial evidence",
    overview: "The public pitch emphasises experience, transparency and fighting corruption. A detailed, costed manifesto was not identified in the reviewed sources.",
    priorities: ["Anti-corruption", "Transparency", "Institutional experience", "Economic recovery"],
    pillars: sharedPillars(),
    gaps: ["Published manifesto", "Measurable economic targets", "Costed programme", "Whether opposition talks produce a joint platform"],
    sources: [
      { title: "Kalonzo declares 2027 presidential bid", publisher: "Radio Generation", date: "10 August 2026", url: "https://radiogeneration.co.ke/politics/106076/kalonzo-declares-2027-presidential-bid-cites-four-decades-of-public-service", kind: "Independent reporting" },
    ],
  },
  {
    slug: "justin-muturi",
    name: "Justin Muturi",
    affiliation: "Opposition talks",
    status: "Prospective",
    statusNote: "Named by opposition figures among potential contenders; no self-declaration was found in the reviewed evidence.",
    evidenceState: "Not yet assessed",
    overview: "There is not enough verified policy material to analyse a presidential manifesto. Listing him reflects credible reporting about the emerging field, not a confirmed candidacy.",
    priorities: [],
    pillars: sharedPillars({
      "Promise clarity": { level: "Under review", note: "No presidential policy document or sufficiently detailed commitments were found." },
      "Gaps and disclosure": { level: "Under review", note: "Assessment begins when a declaration or substantive platform is published." },
    }),
    gaps: ["A direct declaration of intent", "A presidential policy platform", "Measurable commitments", "Costing and delivery evidence"],
    sources: [
      { title: "Wamalwa confirms bid and discusses opposition hopefuls", publisher: "Top News", date: "22 June 2026", url: "https://topnews.ke/wamalwa-confirms-2027-presidential-bid-courts-odm-rebels-for-opposition-alliance/", kind: "Independent reporting" },
    ],
  },
  {
    slug: "macharia-njeru",
    name: "Macharia Njeru",
    affiliation: "Mwongozo Mpya Party",
    status: "Declared intent",
    statusNote: "Declared on 5 October 2026 on a governance-reform and economic-recovery platform.",
    evidenceState: "Partial evidence",
    overview: "His launch addressed fiscal pressure, youth informality and public-service shortfalls with more figures than most new declarations. The underlying methodology, full costing and delivery sequence still require publication and independent checking.",
    priorities: ["Economic recovery", "Governance reform", "Youth employment", "Public services", "Fiscal discipline"],
    pillars: sharedPillars({
      "Promise clarity": { level: "Some detail", note: "The launch identified concrete problem areas and cited fiscal and labour-market figures, but full targets remain limited." },
      "Costing": { level: "Limited detail", note: "Fiscal constraints were quantified; programme-by-programme costs and funding sources were not found." },
    }),
    gaps: ["Full manifesto document", "Traceable calculations behind cited figures", "Programme costs and funding sources", "Phased implementation plan"],
    sources: [
      { title: "Macharia Njeru launches 2027 presidential bid", publisher: "Nairobi Wire", date: "5 October 2026", url: "https://nairobiwire.com/2026/10/macharia-njeru-presidential-bid-2027-election.html", kind: "Independent reporting" },
    ],
  },
  {
    slug: "william-ruto",
    name: "William Ruto",
    affiliation: "United Democratic Alliance",
    status: "Declared intent",
    statusNote: "The incumbent has publicly framed 2027 as a re-election contest; UDA and ODM announced work toward a joint manifesto.",
    evidenceState: "Partial evidence",
    overview: "Reported joint-platform themes include socio-economic stability, youth empowerment and debt management. Because the announced joint manifesto was not yet published at review time, this page does not treat the 2022 platform as the final 2027 offer.",
    priorities: ["Socio-economic stability", "Youth empowerment", "Debt management", "Coalition programme"],
    pillars: sharedPillars({
      "Track record evidence": { level: "Under review", note: "The incumbent record can be assessed, but each 2027 claim must first be defined and checked against official and independent evidence." },
    }),
    gaps: ["Published 2027 joint manifesto", "Costed commitments", "How coalition priorities will be reconciled", "Claim-by-claim assessment of the incumbent record"],
    sources: [
      { title: "Ruto, ODM and UDA parties will develop joint 2027 manifesto", publisher: "People Daily", date: "2026", url: "https://peopledaily.digital/inside-politics/ruto-odm-and-uda-parties-will-develop-a-joint-2027-manifesto", kind: "Independent reporting" },
      { title: "Ruto, Oburu agree on coalition framework team", publisher: "The Standard", date: "2026", url: "https://www.standardmedia.co.ke/national/article/2001555011/ruto-oburu-agree-on-team-to-negotiate-coalition-agreement-and-power-sharing-framework", kind: "Independent reporting" },
    ],
  },
  {
    slug: "eugene-wamalwa",
    name: "Eugene Wamalwa",
    affiliation: "DAP–Kenya",
    status: "Declared intent",
    statusNote: "Declared and later reconfirmed his bid, while also signalling willingness to support another opposition candidate.",
    evidenceState: "Partial evidence",
    overview: "The visible strategy stresses opposition unity and a 2002-style coalition more than a distinct, detailed personal manifesto. His final candidacy and platform therefore remain fluid.",
    priorities: ["Opposition unity", "Coalition government", "Political transition"],
    pillars: sharedPillars(),
    gaps: ["Distinct written manifesto", "Economic and social policy commitments", "Cost and delivery detail", "Final position after coalition negotiations"],
    sources: [
      { title: "Eugene Wamalwa announces seat he will vie for", publisher: "Nairobi Leo", date: "27 January 2025", url: "https://nairobileo.co.ke/news/article/19004/eugene-wamalwa-announces-seat-he-will-vie-for-in-2027", kind: "Independent reporting" },
      { title: "Wamalwa discusses fate of opposition hopefuls", publisher: "People Daily", date: "2026", url: "https://peopledaily.digital/inside-politics/we-will-agree-eugene-wamalwa-reveals-the-fate-of-opposition-presidential-hopefuls", kind: "Independent reporting" },
    ],
  },
  {
    slug: "jimi-wanjigi",
    name: "Jimi Wanjigi",
    affiliation: "Safina Party",
    status: "Declared intent",
    statusNote: "Took over Safina’s leadership as a vehicle for a 2027 presidential bid.",
    evidenceState: "Partial evidence",
    overview: "The “FIST” agenda is among the field’s more specific early platforms: reject debt described as odious, replace SHA/SHIF, sharply reduce VAT, extend free education through TVET and shrink government. Specificity is stronger than the published costing and legal pathway, so the evidence remains partial.",
    priorities: ["Public debt", "Lower VAT", "Health-financing reform", "Free education through TVET", "Smaller government"],
    pillars: sharedPillars({
      "Promise clarity": { level: "Strong detail", note: "Several commitments include identifiable policy actions and a proposed VAT range." },
      "Costing": { level: "Limited detail", note: "The reviewed reporting identifies fiscal measures but not a complete, independently tested costing." },
      "Feasibility": { level: "Limited detail", note: "Major tax, debt and health-financing changes would require legal and fiscal pathways not fully set out in the reviewed material." },
    }),
    gaps: ["Full fiscal model for lower VAT and expanded education", "Legal treatment of debt classified as odious", "Transition plan for health financing", "Independent costing"],
    sources: [
      { title: "Wanjigi vows to reject ‘odious’ debt, scrap SHA and cut VAT", publisher: "Citizen Digital", date: "2026", url: "https://citizen.digital/article/wanjigi-vows-to-reject-odious-debt-scrap-sha-and-vat-if-elected-president-in-2027-n383853", kind: "Independent reporting" },
      { title: "Jimi Wanjigi takes over leadership of Safina Party", publisher: "Nation", date: "19 September 2025", url: "https://nation.africa/kenya/news/politics/jimi-wanjigi-takes-over-leadership-safina-party-5199394", kind: "Independent reporting" },
    ],
  },
  {
    slug: "edwin-sifuna",
    name: "Edwin Sifuna",
    affiliation: "The Equitable Party / emerging vehicle",
    status: "Declared intent",
    statusNote: "Reportedly launched a political vehicle for a 2027 presidential contest on 4 October 2026.",
    evidenceState: "Not yet assessed",
    overview: "The launch establishes reported intent, but no sufficiently detailed presidential manifesto or equivalent policy document was found by the review date. No score is assigned.",
    priorities: [],
    pillars: sharedPillars({
      "Promise clarity": { level: "Under review", note: "No substantive presidential policy document was found by the cutoff date." },
      "Gaps and disclosure": { level: "Under review", note: "Assessment will begin when detailed commitments are published." },
    }),
    gaps: ["A published presidential platform", "Measurable policy commitments", "Costing and funding", "Delivery pathway"],
    sources: [
      { title: "Why Sifuna picked TEP for his 2027 presidential contest", publisher: "Nation", date: "4 October 2026", url: "https://nation.africa/kenya/news/politics/why-sifuna-picked-tep-for-his-2027-presidential-contest-5619614", kind: "Independent reporting" },
    ],
  },
] satisfies StaticAspirant[]).map((a): Aspirant => ({ ...a, office: "President", region: null })).sort((a, b) => a.name.localeCompare(b.name));

export const POLICY_ISSUES = [...new Set(ASPIRANTS.flatMap((candidate) => candidate.priorities))].sort();

export function getAspirant(slug: string) {
  return ASPIRANTS.find((candidate) => candidate.slug === slug);
}