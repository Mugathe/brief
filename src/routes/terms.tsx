import { createFileRoute } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: `Terms of use — ${LEGAL.brand}` }, { name: "description", content: `The terms that apply when you use ${LEGAL.brand}.` }] }),
  component: Terms,
});

const B = LEGAL.brand;
const sections: LegalSection[] = [
  { h: "About these terms", p: [
    `${B} (the “Site”) is operated by ${LEGAL.owner} of ${LEGAL.address} (“we”, “us”). By using the Site you agree to these terms. If you do not agree, please do not use it.`,
    `Read them together with our Privacy Policy and our Editorial, AI and Corrections Policy, which form part of these terms.`] },
  { h: "What the Site does", p: [
    `${B} brings together headlines from Kenyan news outlets and channels and links you to the original publisher. We show headlines and short summaries to help you find stories. The articles belong to their publishers, and we do not control other websites.`,
    `The Site also offers analysis built on those headlines (Trending and Trails), neutral profiles of people seeking elective office (Manifesto Watch), and AI-assisted research. A link to a third-party site is not an endorsement of it or of what it says.`] },
  { h: "Information only, and accuracy", p: [
    `Everything on the Site is general information. It is not legal, financial, medical, electoral or other professional advice. For election information such as registration, dates and results, always check the Independent Electoral and Boundaries Commission (IEBC) and other official sources.`,
    `We work to be accurate and to correct mistakes quickly, but news changes and we rely on information from others. We cannot promise that the Site is complete, current or free of errors.`] },
  { h: "AI-assisted content", p: [
    `We use artificial intelligence in some features, for example to summarise headlines into a daily brief and to research the history behind a topic. AI can make mistakes, miss context or misread a source.`,
    `AI-compiled items are labelled, link to the page they came from, and may not yet have been reviewed by our editors. Please read the original source before relying on any of them, and tell us if something is wrong. Details are in our Editorial, AI and Corrections Policy.`] },
  { h: "Manifesto Watch and candidate profiles", p: [
    `Profiles describe what aspirants have said publicly and how much supporting detail is available. Ratings measure the completeness, costing and documentation of public commitments. They are not an endorsement, a prediction, a ranking of fitness for office, or advice on how to vote. “Not disclosed” means we looked in the listed sources and did not find it; it may exist elsewhere.`,
    `Statements supplied by an aspirant’s own team are labelled and are not independently verified unless an independent source is listed. Appearing on the Site, or paying for advertising, does not change a rating. A person named on the Site may ask for a correction or reply (see “Corrections, complaints and takedown”).`] },
  { h: "Submissions from aspirants and their teams", p: [`If you submit a profile, you confirm that:`],
    ul: [
      "you are the aspirant or are authorised to submit for them;",
      "the information is accurate and the sources you link are genuine;",
      "nothing you submit is defamatory, unlawful, misleading or infringes anyone’s rights; and",
      "you will not submit personal information about other people without a lawful reason."],
    after: [
      `You give us a non-exclusive, free licence to publish, label, edit for length, accuracy and neutrality, and remove what you submit. We may decline or remove a submission at our discretion, and we do not guarantee publication. Your contact details are used only to verify and communicate with you, and are not published.`,
      `If a submission is false or abusive we may remove it, block the sender, and report it to the authorities where the law requires or allows.`] },
  { h: "Acceptable use", p: [`You agree not to:`],
    ul: [
      "break the law or help anyone else do so;",
      "scrape, copy or republish the Site in bulk, or use automated means to load it at a rate that could harm it (search engines that follow our robots.txt are welcome);",
      "bypass or test rate limits, security or access controls, or try to reach staff areas or other people’s accounts;",
      "misuse features that cost us money, for example by sending automated or repeated AI research requests;",
      "introduce malware, impersonate others, harass people, or submit false or misleading information."],
    after: [`We may block access, remove content or suspend features to protect the Site and its users.`] },
  { h: "Intellectual property", p: [
    `The Site’s design, software, compilations and our own original text belong to us or our licensors. Headlines, summaries, images, names and logos from other publishers belong to them and are shown to help readers find and read the original reporting.`,
    `You may link to the Site and share our pages. Please do not reproduce our compilations commercially without our written permission. If you own content shown on the Site and want it removed or corrected, tell us using the details below and we will act promptly.`] },
  { h: "Advertising and sponsors", p: [
    `Advertising and sponsored content is labelled. Sponsors and advertisers have no influence over what we publish, how we rate, or which stories appear. Third-party advertising services, such as Google AdSense where enabled, may use cookies or similar technology under their own policies. We are not responsible for advertisers’ products or claims.`] },
  { h: "Corrections, complaints and takedown", p: [
    `If you think something on the Site is wrong, unfair, unlawful or infringes your rights (including defamation, privacy or copyright), write to ${LEGAL.email} and tell us: the page address, what is wrong and why, and any evidence. Tell us if you are a person named on the Site and want to reply.`,
    `We aim to acknowledge reports within two working days and to deal with them promptly. Depending on the case we will correct the item, add your reply, label it, or remove it. We may need to verify who you are.`] },
  { h: "Privacy", p: [`How we handle personal data is explained in our Privacy Policy.`] },
  { h: "Disclaimers", p: [
    `To the fullest extent the law allows, the Site is provided “as is” and “as available”, without promises that it will be uninterrupted, secure or error-free, or that any content is accurate, complete or suitable for your purposes.`] },
  { h: "Limit of our responsibility", p: [
    `To the extent permitted by the laws of Kenya, we are not liable for indirect or consequential loss, loss of profit or data, or any loss arising from your reliance on content or on third-party sites. Nothing in these terms limits liability that cannot lawfully be limited or excluded, or any rights you have that cannot be waived.`] },
  { h: "Your responsibility for what you submit", p: [
    `You are responsible for what you submit and will compensate us for losses, claims and costs (including reasonable legal fees) arising from your breach of these terms or from your submission infringing the rights of others.`] },
  { h: "Suspension and ending", p: [
    `We may suspend or end your access to any part of the Site at any time, including if you break these terms. Sections that by their nature should continue (for example intellectual property, your responsibility for submissions, and limits of liability) continue afterwards.`] },
  { h: "Changes", p: [
    `We may update these terms. The date at the top shows when they last changed, and we will highlight significant changes on the Site. By continuing to use the Site after a change you accept the updated terms.`] },
  { h: "Governing law and disputes", p: [
    `These terms are governed by the laws of Kenya. If we have a disagreement, we will first try to settle it in good faith by discussion and, if that fails, by mediation, before either of us goes to court. The courts of Kenya have jurisdiction.`] },
  { h: "Contact", p: [`${LEGAL.owner}, ${LEGAL.address}. Email: ${LEGAL.email}.`] },
];

function Terms() {
  return <LegalDoc kicker="Legal" title="Terms of" accent="use" intro={`The rules for using ${B}, in plain language where we can.`} sections={sections} />;
}
