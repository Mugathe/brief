# Kenya 2027 Manifesto Analysis

## Goal
Add a dedicated election section that helps readers assess presidential aspirants quickly and fairly, starting with Kenya’s 2027 race.

## What readers will get
- A **Manifesto Watch** page linked from the main news header.
- Separate labels for **declared** and **prospective** aspirants, with the evidence and date supporting each label.
- A candidate overview showing published priorities, evidence strength, and when the profile was last reviewed.
- An expandable evidence scorecard covering:
  - Promises and policy specificity
  - Costing and funding
  - Delivery feasibility
  - Relevant track record
  - Gaps and unanswered questions
- Direct links to manifestos, official statements, credible reporting, and public records.
- Filters for candidate status and policy issue, plus a side-by-side comparison table.
- WhatsApp sharing using the existing Kenya Pulse signature and election hashtags.

## Editorial safeguards
- Never treat speculation as a declaration or invent a manifesto where none exists.
- Show **“Not yet scoreable”** instead of a numerical score when evidence is too thin.
- Score the available platform evidence, not a candidate’s personality, popularity, or political alignment.
- Explain the scoring method and show component scores so the result is auditable.
- Date every assessment and distinguish candidate/party documents from independent evidence.
- Keep wording factual, neutral, and explicit about uncertainty.

## Technical approach
- Add a server-side manifesto research module that retrieves recent candidate/platform evidence from the existing aggregated feed and selected authoritative public sources.
- Use the existing AI gateway server-side to synthesize structured scorecards, with strict source-index citation and JSON validation; cache results to control cost and load time.
- Seed a reviewed initial Kenya 2027 candidate registry from current research, while allowing evidence-driven updates without silently changing declaration status.
- Add a new route for the list/comparison view and a candidate detail view for full evidence.
- Keep all source links and freshness metadata in the returned data so every substantive claim is traceable in the interface.
- Add route-specific page titles and sharing metadata, then verify desktop and mobile reading and comparison flows.
