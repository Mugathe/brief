# Setup guide

**Updating?** Unzip the new version, but **keep your own `.env` file**. Updates no longer include one, so nothing can overwrite your database settings. After changing `.env`, stop `npm run dev` (Ctrl+C) and start it again; settings are only read at start-up.

Run `npm run doctor` any time. It checks your settings and database and tells you exactly what is still missing.

## 1. Database
**Your own Supabase project (recommended, independent of Lovable)**
1. supabase.com -> create a project -> **SQL Editor -> New query**.
2. Open `supabase-fresh-setup.sql`, copy everything, paste it in, press **Run**. It should say Success.
3. **Project Settings -> API**: copy the Project URL, the `anon` key and the `service_role` key into `.env` (copy `.env.example` first).
   The `service_role` key is a server secret: never share it or put it in front-end code.

**Staying on Lovable Cloud for now:** paste `LOVABLE-PROMPT.txt` into the Lovable chat and approve the migration.
`supabase-setup.sql` is the same SQL for an existing database. Both are safe to run twice.

After running, `npm run doctor` should show every table and function as ok.

## 2. Google sign-in
Uses Supabase's own Google provider, so it works on localhost (port 8080) and your own domain.
1. **console.cloud.google.com**: create a project. **APIs & Services -> OAuth consent screen**: External, add app name and your email, then **Publish app** (otherwise only listed test users can sign in).
2. **Credentials -> Create credentials -> OAuth client ID -> Web application**
   - Authorized JavaScript origins: `http://localhost:8080` and your live address
   - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
3. Copy the **Client ID** and **Client secret**.
4. **Supabase -> Authentication -> Sign In / Providers -> Google**: switch on, paste **both** values, save.
5. **Supabase -> Authentication -> URL Configuration**: Site URL = your live address; Redirect URLs = `http://localhost:8080/**` and `https://your-domain/**`.

What the common messages mean (the sign-in page now explains them too):
- **"missing OAuth secret"**: Google is on but the Client secret was not saved (step 4).
- **"provider is not enabled"**: step 4 not done on the project in your `.env`.
- **"Unable to exchange external code"**: the Client ID or secret is wrong or has a stray space.
- **Google's own "redirect_uri_mismatch"**: the redirect URI in step 2 does not match exactly.
Lovable Cloud projects often have Google set up only through Lovable's own sign-in, which fails with "missing OAuth secret" when called directly. Use your own Google credentials as above, or your own Supabase project.

## 3. Two-factor sign-in and the team
- Every staff member sets up an authenticator app (Google Authenticator, Microsoft Authenticator, Authy) the first time they open `/admin`, then enters a 6-digit code at sign-in.
- In Supabase make sure **Authentication -> Multi-Factor** has TOTP enabled (it normally is).
- Add a **second device** under **My security** as a backup. There are no recovery codes.
- **Admins cannot be removed from the app by anyone.** Granting a role needs a two-factor-verified session and is logged and alerted. Admin sessions sign out after 30 minutes idle.
- Setting up for the first time and cannot enrol? Temporarily add `VITE_REQUIRE_MFA=false` to `.env`, enrol, then remove the line.
- Lost every authenticator? In the Supabase SQL editor (owner access):
  `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'you@example.com');`
- To deliberately remove an admin, also in the SQL editor:
  `delete from public.user_roles where role = 'admin' and user_id = (select id from auth.users where email = 'them@example.com');`

## 4. Security alerts (email, SMS, Telegram)
Set any of these in `.env` (server only), restart, then **Admin -> Security -> Send a test alert**.
- **Email (Resend):** create an account at resend.com, make an API key. Set `RESEND_API_KEY`, `ALERT_EMAILS` (comma separated). Until you verify your own domain, Resend delivers only to the address you registered with.
- **SMS (Africa's Talking):** create an account, then an app. Set `AT_USERNAME`, `AT_API_KEY`, `ALERT_SMS` (numbers with country code, e.g. +2547...). Keep `AT_ENV=sandbox` while testing (messages appear only in their simulator); use `live` with your live username and key for real SMS.
- **Telegram (free):** talk to @BotFather to create a bot and get `TELEGRAM_BOT_TOKEN`. Message your bot (or add it to a group), open `https://api.telegram.org/botTOKEN/getUpdates` to find the chat id, and set `TELEGRAM_CHAT_ID`.

Who gets what: **warnings** (5+ failed sign-ins in 15 minutes, a role granted, a new authenticator added) go to email and Telegram. **Critical** alerts (a new admin, an authenticator removed, 15+ failed sign-ins) also go by SMS. Repeat alerts are held back for 10 to 30 minutes.
Failed-sign-in counting is per server instance, and two-factor changes are reported by the browser, so treat alerts as an early warning, not a complete audit. The Security tab keeps the full log.

## 5. History for Trending and Trails
Trails can only show what the archive holds, so there are two jobs: **keep saving from now on**, and **fill in the past**.

### 5a. Keep saving headlines (even when nobody visits)
The site saves headlines whenever it refreshes its news while someone is visiting. To save every 20 minutes regardless:
1. Make a key. In a terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Add it to `.env` as `INGEST_KEY="the-long-text"`, then stop and restart `npm run dev`.
3. Test it (with the site running): `npm run ingest`. It should print how many headlines were fetched and saved.
4. Schedule it:
   - **While you run the site on your own PC**, a free cron service cannot reach `localhost`, because that address only exists on your computer. Use Windows Task Scheduler instead (works only while the PC is on and the site is running). In a terminal, with your real folder path:
     `schtasks /Create /SC MINUTE /MO 20 /TN "KenyaPulse ingest" /TR "cmd /c cd /d C:\path\to\Brief-updated && npm run ingest" /F`
   - **Once the site is live on a public address**, use a free scheduler. The project includes `.github/workflows/ingest.yml`: push the project to GitHub, add two repository secrets (`SITE_URL` such as https://your-site.example, and `INGEST_KEY`), and it runs every 20 minutes. Or give cron-job.org the address `https://your-site/api/public/ingest` with the header `Authorization: Bearer YOUR_INGEST_KEY`.

### 5b. Fill in the past years
News feeds only hold recent items, so older years need a one-off backfill. It asks Google News for each month in turn (splitting busy months so nothing is cut off at Google's 100-result limit) and saves the headlines and links, nothing more.
1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (`npm run doctor` checks them).
2. Look first, saving nothing: `npm run backfill -- --trails --from 2015-01 --dry-run`
3. Then for real: `npm run backfill -- --trails --from 2015-01`  (every published trail), or `npm run backfill -- --query "drought OR famine" --from 2016-01` for one topic.
4. Useful options: `--to 2024-12-31`, `--sites nation.africa,the-star.co.ke` (only those outlets), `--delay 5000` (slower, gentler).
- It is safe to stop (Ctrl+C) and run again: finished months are skipped.
- A trail covering ten years takes roughly 10 to 20 minutes. Use `--delay 3000` or higher so Google does not block you; if it refuses, wait an hour and re-run.
- **Be realistic.** Google News is an unofficial source: coverage gets thinner for older years, and Google can change or limit it. Treat the result as a good start. For the key moments of past years (for example the 1997 and 2023 El Niño floods), also add **editor milestones** and **AI research** (each with a source link), which fill gaps and give you stories that are verified and dated.

### 5b+. Editions: the world and each country
Brief now has **editions**: a World edition plus one per country (Kenya, Uganda, Tanzania, Nigeria, Ghana, South Africa, United Kingdom, United States, India, Australia, Canada). Visitors switch with the picker at the top of each page; the choice lives in the address (`?e=NG`), so links share the right edition. Each edition has its own live feed, trending, trending history and bulletin ("The World in a Nutshell", "Nigeria in a Nutshell"...). Trails and the archive search are shared across all editions on purpose, so you can follow a story wherever it was reported.
- **After updating**, run `supabase-setup.sql` once more (safe to repeat). It tags every archived headline with its edition (everything saved so far becomes Kenya) and adds the per-edition trending functions. On Lovable Cloud, paste `LOVABLE-PROMPT.txt` again.
- **Open on a country instead of the world** by setting `VITE_DEFAULT_EDITION=KE` (any code from the list) in your environment.
- **The scheduler refreshes every edition.** Keep calling `/api/public/ingest` every 15-30 minutes (step 5a). Its reply now lists each edition with `emptyFeeds`: any source that returned nothing, either because it is down or because its address is wrong. Add `?verbose=1` to see every feed's count. **Please read this after the first run**: the country outlets (Punch, News24, The Hindu...) were written from memory and could not be tested from where this was built. A wrong address does no harm; it just shows up as empty, and you can fix or delete it in `src/lib/editions.server.ts`.
- **Add a country**: add one line to `EDITIONS` in `src/lib/editions.ts` (for example `country("ET", "Ethiopia", "Ethiopian", "Africa/Addis_Ababa")`). Google News sections for that country are used automatically. Optionally add its own outlets under `LOCAL` in `src/lib/editions.server.ts`, and insert its country-name words (for example `ethiopia`, `ethiopian`, `addis`) into the `edition_stopwords` table so they don't dominate its trending list.
- **Not yet global** (planned next): editions are English-language only; the bulletin voices are still the Kenyan English voices; Manifesto Watch and the KOT Buzz meter remain Kenya-only (they show only in the Kenya edition, and Manifesto Watch is labelled as Kenya in the menu); the AI trail researcher still writes about Kenya.

### 5b++. Regions: region-first loading, regional admins, regional ads
- **Region first, then the world.** A visitor with no `?e=` in the address sees their own country's edition if Brief has one, with an "Around the world" section of top world stories under it; otherwise they see the world. The order is: the address (`?e=NG`), then their last choice (kept for a year in a cookie when they use the picker), then their country, then the world. **Country detection needs a header from your host**: Cloudflare sends `CF-IPCountry` automatically (recommended: put the site behind Cloudflare), Vercel and CloudFront send their own. On a plain server with none of these, visitors simply start on the world and can pick a region.
- **Regional administration.** The Admin page now has a "Working on" bar: the whole site, or one region. Ads, content rules (hide, pin, blocked words and sources), the banner and the social board follow it. In **Team**, give each editor or moderator the regions they look after (or "All regions"). A regional editor can change only things that belong to their regions: they cannot touch site-wide settings (theme, AdSense account), ads marked "Everywhere", or other regions, and the database enforces this, not just the page. Anyone who was an editor or moderator before this update keeps "All regions" until you narrow them. A person with a role but no regions can sign in and change nothing.
- **Regional ads.** Every ad has a "Show in" setting: everywhere, or chosen regions. Sponsor banners and AdSense slots are both filtered this way. Banners can also be set per region (they replace the site-wide banner there).
- **How AdSense relevance works.** AdSense decides which advertisers fill an AdSense slot, using the page and the reader's location and interests; you cannot pick them. What you control is (1) regional content (each edition is its own set of pages), (2) a separate AdSense ad unit, with its own custom channel in AdSense, for each region, set to "Show in" that region, so you can see and tune each region's earnings, and (3) direct sponsors, targeted by region with sponsor banners.
- **Before showing AdSense to readers in the UK or the EU/EEA**: Google requires a Google-certified consent banner (a CMP) for those visitors. The cookie notice in this app only covers anonymous analytics and is not that. Add a certified CMP (AdSense's own "Privacy & messaging" tool is free) before serving ads there, and have your privacy policy reviewed for the regions you serve.
- **Trails now show full story cards** (category, outlet, summary, share buttons), like the home page. After updating, run `supabase-setup.sql` once more (safe to repeat); on Lovable Cloud paste `LOVABLE-PROMPT.txt` again.

### 5b+++. Languages, voices, and the YouTube and X lists
- **Seven languages.** The reader-facing pages (home, Trending, Trails, the Brief, the Buzz meter, history, footer, the analytics notice) are available in English, Kiswahili, Français, Español, Português, العربية (Arabic, laid out right to left) and हिन्दी (Hindi). A visitor's language follows the edition they are reading (France is in French) unless they pick one with the language selector next to the edition picker; that choice is remembered for a year. The admin screens, the legal pages and Manifesto Watch stay in English. **The translations were written without a native review: please have a native speaker of each language read them** (all the text is in `src/lib/i18n.ts`, one line per message; the compiler refuses to build if a language is missing a message).
- **New editions:** France, Spain, Mexico, Brazil, Senegal, Côte d'Ivoire, and Kiswahili editions for Kenya (`KE-sw`) and Tanzania (`TZ-sw`). Each edition has its own news sources, language-specific category rules, and its own "everyday words" list so that "le", "de", "na" or "que" never top the trending list. As with the other editions, the outlet addresses were written from memory: read the scheduler's `emptyFeeds` report after the first run.
- **The bulletin is written in the reader's language**, whatever language the stories were in (the AI writer translates; the fixed phrases such as the greeting, "headline one", and the sign-off are built in). If no AI writer is available, the fallback bulletin uses the outlets' own summaries, which stay in their original language.
- **Voices.** The bulletin is read by a voice for the language and country. With Azure Speech (recommended) the defaults are: Kenyan, Tanzanian, Nigerian, South African, British, American, Indian, Australian and Canadian English; Kiswahili from Kenya or Tanzania; French; Spanish from Spain or Mexico; Brazilian Portuguese. Uganda and Ghana use the nearest English accent (Kenyan and Nigerian). The two presenters keep their names, Amani (woman) and Baraka (man). To change any voice, set `AZURE_VOICE_<LANG>_<COUNTRY>_<AMANI|BARAKA>`, for example `AZURE_VOICE_SW_KE_AMANI`; the older `AZURE_VOICE_AMANI` and `AZURE_VOICE_BARAKA` still control the Kenyan English voices. **ElevenLabs** uses the same voice for every language and its quality in Kiswahili varies, so use Azure if you read bulletins in Kiswahili. Without either, readers hear their device's own voice for that language if it has one. Check that your Azure Speech region offers the voices you want (Speech Studio lists them).
- **YouTube list on Trending (optional).** Create a free key: Google Cloud console, enable "YouTube Data API v3", create an API key, and put it in `YOUTUBE_API_KEY`. The Trending page then shows the most-watched videos in each country. Results are kept for 30 minutes per country, well inside the free daily allowance.
- **X list on Trending (optional, paid by X).** Set `X_BEARER_TOKEN` to a token that has access to the trends endpoint (check X's developer site for the current plan and price). Each country's list is reused for `X_TRENDS_TTL_MINUTES` (default 60) so the cost stays bounded: at most one request per country per hour, and only when someone opens that country's Trending page. If X answers "not allowed" or "no credit", Brief stops asking for six hours and logs one line (never the token). The location IDs were written from memory; a wrong one is logged as "unknown location" and skipped.
- **TikTok** has no official public trending list for most countries, so it stays on the editors' social board.
- **Not yet:** Chinese and Japanese (their words are not separated by spaces, so Brief cannot count topics in them), Urdu, Persian and more African languages. Adding one means a column in `i18n.ts`, an edition, a voice, category words, and a stop-word list. In Arabic, the same word with and without "ال" (the) is counted as two words in Trending, a known limit.

### 5b++++. Going live, ad consent, Arabic and Hindi, and the formerly Kenya-only parts
- **Running on your own server.** `deploy/DEPLOY.md` is a step-by-step guide (Ubuntu VPS, Node, pm2, Caddy, Cloudflare). In short: `npm install`, `npm run build:node`, `npm start`. Plain `npm install` fails on this project without the `.npmrc` that is now included. `npm start` also refreshes every edition every 20 minutes (`INGEST_EVERY_MINUTES`) and `/api/public/health` is there for uptime monitors. `npm run doctor` checks your `.env`. The normal `npm run build` still builds for Cloudflare.
- **Ad consent and analytics for readers in the EU, EEA, UK and Switzerland.** Visit counting is now **opt-in** for readers there, and for readers whose country cannot be determined (the country comes from Cloudflare's or your host's country header, another reason to put Cloudflare in front). Nothing is counted, and no anonymous ID is created, until they press Accept; elsewhere it counts until they decline, as before. The notice has equally prominent Accept and Decline buttons in all seven languages, and every page has a **Privacy choices** link in the footer to change the choice. **For AdSense:** in AdSense open *Privacy & messaging*, create the *European regulations* message (and the US states message if you serve the US) and publish it; Brief already loads Google's consent script whenever AdSense is switched on, so the message appears only where it is required. I could not test this against Google from where it was built, so after publishing the message, open the site from an EU address (or with a VPN) and confirm it appears. The privacy policy was updated for readers outside Kenya (GDPR and UK GDPR, advertising choices, international transfers, the two preference cookies). **Please have it reviewed by a lawyer before launching.** If you serve readers in the EU you may also need to appoint an EU representative (GDPR Article 27); that is a legal question, not a setting.
- **Arabic and Hindi.** New editions: Egypt and Saudi Arabia (Arabic), India in Hindi (`IN-hi`). Arabic pages switch to right-to-left automatically; Hindi uses its own script, fonts come from the reader's device. Voices: Egyptian and Saudi Arabic, and Hindi (Azure `ar-EG`, `ar-SA`, `hi-IN`). As with the others, **have native speakers review the translations**, and read the scheduler's `emptyFeeds` report after the first run. Run `supabase-setup.sql` again for the word lists. If Hindi topics look broken in Trending, your Supabase database's text-search locale may split Hindi words; tell me what you see.
- **The Kenya-only parts are now global.** (1) The **Buzz meter** is available for every edition ("KOT Buzz" stays Kenya's name). Each country now has TikTok and X "buzz" searches feeding it. It finds topics by capital letters, so Arabic and Hindi editions show hashtags only. (2) The **AI trail researcher** researches per country: its search is located in the edition's country and its history is kept per country, so a Nigerian reader's "floods" is about Nigeria. Kenya's earlier research is untouched. The scheduled endpoint `/api/public/research-trending` now takes turns between countries (add `&edition=NG` for just one). (3) **Curated trails** belong to a region (Admin, History and trails): "Every edition" or one country, the Trails page shows an edition its own and the every-edition ones, and regional editors manage their own region's trails. The original flood trail is tagged Kenya. (4) **Manifesto Watch** stays what it is, a Kenya-only election module: it shows on the Kenya edition and is labelled Kenya in the menu. Doing the same for another country's elections would be a new module (offices, parties, manifestos), not a setting.

### 5c. "What trended" day by day, week by week, month by month
The Trails page now lists the top topics for each past period: yesterday, every day of the last week, then weeks and months going back, with a "Show earlier" button. Days run on the edition's own time zone (Monday to Sunday for weeks). Tap any word to trace it as a trail.
- It is built from the same archive as Trending, so it can only go back as far as the archive holds. Steps 5a and 5b above are what fill it in.
- **After updating**, run `supabase-setup.sql` once more in the Supabase SQL editor (safe to repeat). It adds the `trending_history` function; until then the section shows "History isn't ready yet". On Lovable Cloud, paste `LOVABLE-PROMPT.txt` again.
- Editing the ignored words (Admin -> History and trails) changes past days too, because every day is worked out from the archive each time (results are kept for 10 minutes).

## 6. AI research for trails, and the legal pages
**AI research (optional).** On a trail page, a visitor can press "Research earlier history with AI" when a topic has little history. An agent searches the web and lists what it finds, each item linked to a page it really found. Items whose link did not come from the search are discarded automatically, and every item is labelled until an editor approves it.
- Needs `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` on the server. **Web search must be switched on for your Anthropic organisation** (Claude Console, organisation settings). It costs a few cents per topic (about $10 per 1,000 searches plus tokens), so visitors are limited to 3 requests an hour and the site to 25 runs a day (`TRAIL_AGENT_DAILY_LIMIT`).
- Review work in **Admin -> History and trails -> AI research**: approve or reject items, run a topic yourself, and choose whether unreviewed items show.
- To research rising topics automatically once a day, have your cron service call `https://your-site/api/public/research-trending?limit=2` with `Authorization: Bearer YOUR_INGEST_KEY`.
- The research runs in the background of the web server, so use a host that keeps running between requests (a normal Node server). On function-style hosts that stop work after the response, a run may be cut short and is marked failed after 10 minutes.

**Legal pages.** `/terms`, `/privacy` and `/editorial` are linked from every page. Fill in `VITE_LEGAL_NAME`, `VITE_LEGAL_ADDRESS` and `VITE_CONTACT_EMAIL` in `.env` (until then they show [bracketed] placeholders). **These are a well-organised starting draft, not legal advice: have a Kenyan advocate review them before launch.** Check that every promise is one you keep (response times, retention periods). Retention is enforced automatically: the ingest endpoint runs `purge_old_records()` daily (visit records 24 months, security log 24 months, declined submissions 12 months, approved submitters' contact details 12 months after review). Also ask your advocate whether you must register with the Office of the Data Protection Commissioner.

## 6b. Trending beyond the news
- **Searched on Google in Kenya** is automatic. It reads Google's public "Trending now" feed for Kenya (about ten searches, refreshed every 30 minutes). It is an unofficial feed, so it could change or disappear; if it does, that box simply hides.
- **On social media** is a board your editors fill in (Admin -> History and trails -> Social media trends board). TikTok and Instagram offer no public trending feed for Kenya, and scraping them breaks their rules, so people note what they see on each platform's own trending page. Items expire by themselves (1 to 14 days).
- **X (Twitter)** has an official trends endpoint, but it needs a paid developer plan. If you take one, ask me to add it; it would fill the board automatically.

## 7. The news bulletin (Kenya in a Nutshell): voice, accent and pronunciation
Related stories from different outlets are grouped, so each headline gets its detail from several reports. It is read like a radio programme: an opening theme, the headlines, then each story after a short musical breaker, and a sign-off. The breakers are made in the browser, so there are no sound files.

**Voices, best to simplest**
1. **Microsoft Azure Speech (recommended for a Kenyan accent).** It has real Kenyan-English voices: **Asilia** (woman) and **Chilemba** (man). It also has free monthly usage that covers a daily bulletin comfortably (check Azure's current pricing page).
   - In the Azure portal create a **Speech** resource, then open **Keys and Endpoint**.
   - Put `AZURE_SPEECH_KEY` (Key 1) and `AZURE_SPEECH_REGION` (for example `southafricanorth`) in `.env`, and restart. Nothing else to change.
   - For Swahili you can switch voices later, for example `AZURE_VOICE_AMANI=sw-KE-ZuriNeural`.
2. **ElevenLabs.** In its **Voice Library** search for Kenyan English voices, add two to your voices, copy each **Voice ID**, and set `ELEVENLABS_VOICE_AMANI` and `ELEVENLABS_VOICE_BARAKA`. Without these, standard American and British voices are used.
3. **No account at all.** The Play button uses the listener's own device voice. **Microsoft Edge on Windows** includes Kenyan-English voices (Asilia and Chilemba), and the player picks them automatically.

**Pronunciation.** Open **Admin -> Voice**. You can type any sentence, see exactly what the voice is told to say, hear it, and add a respelling for any name it gets wrong (for example Gachagua as Ga-CHA-gwa). Respellings change only what is read aloud, never the page, and apply to the next bulletin straight away. Built-in rules already say money naturally ("Sh1.2 billion" becomes "1.2 billion shillings"), spell initialisms letter by letter (IEBC, KDF, KRA, MPs), and smooth names with an apostrophe (Murang'a, Wetang'ula). I cannot hear the voices myself, so tune names by ear here.

**Safety and cost.** Spoken lines are signed by the server, so only text the bulletin generated can be spoken with your credits, and recordings are cached for two hours, so each line is paid for once.
Without an AI key the bulletin is built from the outlets' own summaries (labelled). With `ANTHROPIC_API_KEY` an AI editor writes the radio scripts, using only the supplied text.

## 8. Sign-up emails
Supabase's built-in sender is for testing and has a very low hourly limit. For real use set your own sender under **Authentication -> Emails -> SMTP settings** (Resend, Brevo, a Gmail app password). Signing in with Google needs no email. The first account created becomes the site admin.

## 9. Reading the analytics, and sponsor banners
- **A device is one visitor.** Opening five pages makes one visitor overall, and that device is counted once on each page it opened. Its extra page loads show separately as "views". A device coming back later is a new "visit". Referrers and busiest hours count visits, not page loads, so a long browsing session doesn't inflate them.
- **Your own browsing is left out.** The first time you sign in to the admin area on a device, that device stops being counted. To test tracking, switch counting back on with the switch at the top of Admin -> Analytics. Rapid duplicate loads of the same page (within 3 seconds) are ignored.
- **Sponsor banners rotate** like a carousel when several are set for the same spot (Admin -> Ads). Set the speed in the Ads tab. It pauses on hover, when the page is hidden, and with the pause button, and it does not auto-rotate for visitors who ask their device to reduce motion. Each banner is counted as seen once per page view, only when it was really on screen. Banners with the same priority are shuffled so each gets the front spot in turn; higher priority always comes first. **Google AdSense units never rotate** (Google's rules), so they sit still below the banners.

## 10. Other
- `VITE_SITE_URL`: your public address, used in WhatsApp share links.
- After pulling an update run `npm install`, then restart `npm run dev`.

## 11. Studio: pictures and reels on the home page

1. Run `supabase-setup.sql` again in the Supabase SQL editor (the new parts are sections 0012 and 0013: the `studio-media` storage bucket, and the `studio_posts` and `studio_runs` tables). It is safe to run more than once.
2. **By hand:** in the admin, open **Studio**, press **Make today's top stories now** and keep the tab open while it records. Everything lands in **Review and publish**; press **Publish** on what you want live.
3. **Automatically:** see section 12.

On the home page, published items appear as round "status" circles above the news. A story stays bright for 24 hours, then moves to the end of the row greyed out, and disappears after 7 days. Tapping a circle opens a full-screen viewer (picture first, then the reel). Every post links to its story in Read the Brief.

## 12. Studio: the automatic service

A GitHub job runs every 30 minutes, makes a picture and a 9-second reel with news music for each new top story, uploads them, and publishes them. It reuses the two GitHub secrets from section 10 (`SITE_URL`, `INGEST_KEY`), so there is nothing new to add there.

1. Push the project to GitHub so `.github/workflows/studio.yml` is in the repository. In GitHub open Actions and allow workflows if asked.
2. In the admin open **Studio -> Automatic service**, choose your editions, tick **Service is on**, and press Save. Until you do, the job starts and stops straight away.
3. To start a run at once: GitHub -> Actions -> "Studio reels" -> Run workflow.
4. **Voice-over:** in the same panel pick Amani or Baraka and each reel gets the headline read over the music (it uses the voice service you already set up for the audio bulletin, in the edition's language). If the voice fails for one story the reel is still made, with music only.
5. Progress: the same panel shows what is being made now and everything made before. When a batch finishes you also get an alert on the channels from section 4 (Telegram, email).
6. To stop publishing blindly, untick **Publish straight away**: everything then waits in **Review and publish**. A published story can be taken down any time with **Unpublish**.

The renderer is in `scripts/studio` (Node, ffmpeg, no browser), so it does not run on Cloudflare itself; only GitHub renders.

## 13. Studio: posting to Facebook and YouTube

Both are optional and off until you add the keys below as **secrets on the server (Cloudflare)**, then tick the matching box in Studio -> Automatic service. Posting happens from the server, so nothing goes in GitHub. Meta and Google change these screens often; if a step has moved, search for the name in bold.

**What gets posted.** Automatically: each new *reel*, to the Facebook Page (as a Reel) and to YouTube (as a Short). Pictures are posted by hand with the buttons in Review and publish. Everything is posted once: a reel already on Facebook shows "posted" and cannot be sent twice by accident.

### Facebook Page
1. At developers.facebook.com create an **app** (type "Business") and add yourself as its admin. While the app stays in development mode and you are its admin, you can post to a Page you manage without Meta's app review.
2. In the **Graph API Explorer** choose your app, get a **user access token** with the permissions `pages_manage_posts`, `pages_read_engagement` and `publish_video`, and extend it to a long-lived token.
3. Call `GET /me/accounts` with that token. It lists your Pages, each with an `id` and an `access_token`. A Page token made from a long-lived user token does not expire.
4. Add secrets: `FACEBOOK_PAGE_ID` (the Page's `id`) and `FACEBOOK_PAGE_TOKEN` (that Page's `access_token`). Optional: `FACEBOOK_GRAPH_VERSION` (default `v26.0`).
5. Facebook allows about 30 API-published Reels per Page per 24 hours, and the video must be at least 540 x 960. Ours is 1080 x 1920.

### YouTube (Shorts)
1. In Google Cloud Console make a project, enable **YouTube Data API v3**, and set up the **OAuth consent screen**. Set its status to **In production**: while it says "Testing", Google expires the sign-in after 7 days and the service stops.
2. Create an **OAuth client ID** of type "Web application" with the redirect address `https://developers.google.com/oauthplayground`.
3. In the OAuth Playground, tick "Use your own OAuth credentials", enter the client ID and secret, authorize the scope `https://www.googleapis.com/auth/youtube.upload` as the channel's owner, and press "Exchange authorization code for tokens". Copy the **refresh token**.
4. Add secrets: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.
5. **Important:** Google keeps videos uploaded through an API project that has not passed its audit **private**, whatever the upload asks for. Until you apply for and pass the audit (search "YouTube API Services compliance audit"), reels will arrive on the channel as private and you would publish them by hand. Uploads also use a daily quota, so a busy day can hit the limit.

Add a secret on Cloudflare with `npx wrangler secret put NAME`, or in the dashboard under Settings -> Variables and Secrets (choose "Secret").
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/mugathe/YOUR-REPO-NAME.git
git push -u origin main