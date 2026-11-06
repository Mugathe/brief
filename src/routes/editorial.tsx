import { createFileRoute } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export const Route = createFileRoute("/editorial")({
  head: () => ({ meta: [{ title: `Editorial, AI and corrections policy — ${LEGAL.brand}` }, { name: "description", content: `How ${LEGAL.brand} sources, uses AI, handles corrections and keeps advertising separate from editorial decisions.` }] }),
  component: Editorial,
});

const sections: LegalSection[] = [
  { h: "What we are, and are not", p: [
    `${LEGAL.brand} helps readers find and follow Kenyan news. We aggregate headlines from outlets and channels we follow and link to the original publisher. We add analysis (Trending and Trails) and neutral profiles of aspirants (Manifesto Watch). We aim to follow the principles of accuracy, fairness, independence and accountability set out in Kenya’s journalism standards, including the Media Council of Kenya’s Code of Conduct.`] },
  { h: "How stories are chosen", ul: [
    "Headlines are collected automatically from the outlets and channels we follow and are never rewritten.",
    "An automatic filter removes obscene content. Editors can also hide, pin or block items and sources, for example for legal, safety or accuracy reasons, but not to favour or damage any party.",
    "Stories are ordered by recency and, in Trending, by how many stories and different outlets carry a topic."] },
  { h: "Manifesto Watch", ul: [
    "Every profile uses the same method for every office and party. Each profile lists the sources it is based on, shows whether each came from the candidate or from independent reporting, and links to them.",
    "Ratings reflect how detailed and documented public commitments are. They are not endorsements, predictions or advice on how to vote.",
    "Aspirants and their teams can submit profiles. We verify who is submitting, check the sources, and label statements supplied by the candidate’s side as not independently verified. Submitting or advertising does not buy a better rating.",
    "A person named in a profile may ask for a correction or reply at any time."] },
  { h: "Trending and Trails", ul: [
    "Trending counts words in headlines over a period and compares it with the period before. It reflects the outlets we follow, not all of Kenya’s media or public opinion.",
    "Trails list stories that match a topic over time. A trail only shows what our archive holds. Earlier moments are added by editors as milestones, each with its source.",
    "Editors can ignore words that would otherwise distort trends."] },
  { h: "How we use AI", p: [`We use AI in three places, and we label it where it appears:`],
    ul: [
      "A daily brief that summarises the day’s headlines, and an optional voice that reads it aloud.",
      "Earlier history on a topic. An AI agent searches the web, and every item it lists must link to a page it actually found. Items without such a link are discarded automatically.",
      "Nothing else. AI does not write profiles, set ratings, or decide what we publish about a person."],
    after: [
      `AI-compiled history is marked as AI-compiled. Until an editor has reviewed an item it is marked “not yet reviewed”. Editors can approve, reject or remove any item. We limit how often the research can run and we exclude social-media sources, allegations about private individuals, and material about minors.`,
      `AI makes mistakes. Always open the linked source. If an item is wrong, use “Report a problem” on it or write to us.`] },
  { h: "Advertising and independence", p: [
    `Adverts and sponsorships are labelled and kept apart from editorial decisions. Advertisers and sponsors cannot buy coverage, ratings, placement in Trending or Trails, or removal of content.`] },
  { h: "Corrections, replies and takedown", ul: [
    `Report a problem to ${LEGAL.email} with the page address, what is wrong and any evidence. We aim to acknowledge within two working days.`,
    "If we are wrong we correct it and say so on the page. If a person is named, we offer a right of reply.",
    "We remove content where the law requires, for example for a valid copyright, privacy or defamation complaint, and we may verify who is asking.",
    "Items that cannot be sourced, or that we find were wrong, are removed."] },
  { h: "Contact", p: [`${LEGAL.owner}, ${LEGAL.address}. Email: ${LEGAL.email}.`] },
];

function Editorial() {
  return <LegalDoc kicker="How we work" title="Editorial, AI and" accent="corrections" intro="How we choose stories, where AI is used, and how to ask us to fix something." sections={sections} />;
}
