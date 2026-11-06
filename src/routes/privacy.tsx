import { createFileRoute } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { LegalDoc, type LegalSection } from "@/components/LegalDoc";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: `Privacy policy — ${LEGAL.brand}` }, { name: "description", content: `How ${LEGAL.brand} collects, uses and protects personal data.` }] }),
  component: Privacy,
});

const B = LEGAL.brand;
const sections: LegalSection[] = [
  { h: "Who we are", p: [
    `${LEGAL.owner} of ${LEGAL.address} runs ${B} and decides how personal data on the Site is used (the “data controller”). We handle personal data in line with Kenya’s Data Protection Act, 2019, and, for readers in the European Economic Area, the United Kingdom and Switzerland, with the GDPR and UK GDPR as they apply to us. Contact us at ${LEGAL.email} with any privacy question.`] },
  { h: "What we collect", p: [`Readers (no account needed):`],
    ul: [
      "A random, anonymous visitor ID stored in your browser, and a session ID that lasts until you close the tab.",
      "The pages you view and when, the website that sent you, your device type (phone, computer or automated), and your approximate country where our network provider supplies it.",
      "Actions such as clicking a story, sharing, playing the brief, and seeing or clicking an advert.",
      "Topics you search for in Trails, and the trails you follow (those are kept only on your own device).",
      "The edition (country) and language you choose with the pickers, so the Site opens the way you left it.",
      "We do not ask readers for a name or email, and we do not store your IP address in our visit records. Our hosting and network providers keep technical logs that may include it."],
    after: [
      `Aspirants and their teams who submit a profile: the names, roles, email and phone number of the person submitting, and the content submitted.`,
      `Staff: email address, sign-in and two-factor details, and a log of actions taken in the admin area.`,
      `Anyone who writes to us: what you send us.`] },
  { h: "Why we use it, and our lawful basis", ul: [
    "To run the Site and show the stories, edition and language you choose (our legitimate interest in running a news service, and your choice when you use the pickers).",
    "To count visits and measure what readers find useful: with your consent where the law requires it (in the European Economic Area, the United Kingdom, Switzerland and where we cannot tell where you are, we count nothing until you accept), and otherwise as our legitimate interest, which you can decline at any time.",
    "To keep the Site and staff accounts secure and to detect abuse (legitimate interest and legal obligation).",
    "To review submissions and communicate with submitters (steps you ask us to take, and your consent).",
    "To show and measure advertising, which pays for the Site: with your consent where the law requires it, through the consent message described under “Advertising choices”, and otherwise as our legitimate interest.",
    "To meet our legal duties and respond to lawful requests."] },
  { h: "Cookies and similar storage", p: [
    `Mostly we use your browser’s local and session storage rather than cookies, for your anonymous ID (kp_vid), a session ID (kp_sid), your choice about analytics (kp_consent) and the trails you follow. When you first visit you can accept or decline analytics; the choice is equally easy either way. If you decline, we stop counting your visits and delete your anonymous ID. You can change your mind at any time with “Privacy choices” at the bottom of every page, and you can clear your browser storage whenever you like.`,
    `Two small cookies, brief_edition and brief_lang, last one year. They are set only when you use the edition or language picker, and they only remember that choice. They are not used for tracking.`] },
  { h: "Advertising choices", p: [
    `If advertising from Google (AdSense) is switched on, Google and its partners may use cookies and similar identifiers to show and measure ads, and may personalise them. In the European Economic Area, the United Kingdom and Switzerland, and wherever else the law requires it, Google’s consent message (a certified consent management platform) asks for your choice before personalised ads are shown. You can reopen it at any time with “Privacy choices” at the bottom of the page.`,
    `You can also manage ad personalisation at adssettings.google.com, and read how Google uses data from sites that use its services at policies.google.com/technologies/partner-sites. Ads, including those from sponsors, are labelled, and sponsors have no say over what we publish.`] },
  { h: "Who we share data with", p: [
    `We do not sell personal data. We use trusted providers to run the Site, and they handle data only on our instructions:`],
    ul: [
      "Database and sign-in hosting (Supabase), our web hosting provider, and Cloudflare, which delivers and protects the Site and therefore sees visitors’ network addresses.",
      "Google, if advertising is switched on.",
      "An AI provider (Anthropic) that receives the topic you ask us to research, and public headlines for the daily brief. Please do not type personal information into the topic box.",
      "A voice provider (Microsoft Azure Speech or ElevenLabs), if enabled, which receives the text of the public daily brief.",
      "Email, SMS and messaging services used to alert our staff to security events. These receive no reader data.",
      "Courts, regulators or the police, where the law requires."] },
  { h: "International transfers", p: [
    `${B} is run from Kenya, and our providers store or process data in other countries, including in the European Union, the United Kingdom and the United States. Where personal data of people in the European Economic Area, the United Kingdom or Switzerland is sent outside those areas, or where Kenyan law restricts a transfer, we rely on the safeguards the law allows, such as standard contractual clauses and the providers’ own certifications, so that the data stays protected.`] },
  { h: "How long we keep data", ul: [
    "Detailed visit and activity records: deleted after 24 months.",
    "Security and audit logs: deleted after 24 months.",
    "Submissions that are declined: deleted after 12 months. For approved submissions, the submitter’s contact details are removed 12 months after review. The published profile stays until it is corrected or removed.",
    "Headlines we have collected (public information) are kept to support Trending and Trails.",
    "Messages to us: for as long as needed to deal with them, then deleted."] },
  { h: "Your rights", p: [
    `Under Kenya’s Data Protection Act, and under the GDPR and UK GDPR where they apply to you, you may ask to access your personal data, correct it, delete it, object to or restrict how we use it, withdraw consent at any time, and receive it in a portable form. To make a request, write to ${LEGAL.email}. We will respond within the time the law requires. We do not make decisions about you by automated means that have legal or similarly significant effects.`,
    `Because reader analytics use a random ID rather than your name, we cannot tell which records are yours unless you give us your ID. If you decline analytics, we hold nothing further about your visits.`] },
  { h: "Children", p: [
    `The Site is a general news service and is not directed at children. We do not knowingly collect personal data from children. If you think a child has given us personal data, tell us and we will delete it.`] },
  { h: "Security", p: [
    `We protect data with encrypted connections, access controls, two-factor sign-in for staff, activity logs and limiting who can see what. No system is completely secure. If a breach affects your personal data we will tell you and the regulator as the law requires.`] },
  { h: "Complaints", p: [
    `Please contact us first at ${LEGAL.email} so we can put things right. You also have the right to complain to the Office of the Data Protection Commissioner of Kenya (odpc.go.ke) or, if you are in Europe or the United Kingdom, to the data protection authority of the country where you live or work (in the United Kingdom, the Information Commissioner’s Office, ico.org.uk).`] },
  { h: "Changes to this policy", p: [`We will update this page when our practices change and show the date at the top. Significant changes will be highlighted on the Site.`] },
];

function Privacy() {
  return <LegalDoc kicker="Legal" title="Privacy" accent="policy" intro="What we collect, why, who sees it, and the choices you have." sections={sections} />;
}
