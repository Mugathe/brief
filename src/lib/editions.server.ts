import { editionOf, EDITIONS, WORLD, type Edition, type Lang } from "./editions";
import { placeName } from "./i18n";

/** One place we read headlines from. `category` overrides the keyword guess (used by Google News topic feeds). */
export type Feed = { name: string; url: string; platform: string; category?: string };

const VIRAL = "Viral (TikTok & X)";

/* ---------------- Google News, for any country ---------------- */
const gnTop = (e: Edition) => `https://news.google.com/rss?hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
const gnTopic = (e: Edition, topic: string) => `https://news.google.com/rss/headlines/section/topic/${topic}?hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
const gnSearch = (e: Edition, q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${e.hl}&gl=${e.gl}&ceid=${e.ceid}`;
const yt = (channelId: string) => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
const reddit = (sub: string, limit = 30): Feed => ({ name: `r/${sub}`, url: `https://www.reddit.com/r/${sub}/hot/.rss?limit=${limit}`, platform: "Reddit" });

const TOPICS: [topic: string, category: string][] = [
  ["BUSINESS", "Business"], ["TECHNOLOGY", "Tech"], ["SPORTS", "Sports"], ["ENTERTAINMENT", "Entertainment"], ["HEALTH", "Health"], ["SCIENCE", "Science"],
];

/** Country edition: Google News top stories and sections for that country, plus its own outlets. */
function countryFeeds(e: Edition, outlets: { name: string; url: string }[], subreddit?: string): Feed[] {
  return [
    { name: `Google News ${e.name}`, url: gnTop(e), platform: "Google News" },
    ...TOPICS.filter(([t]) => t !== "SCIENCE").map(([t, category]): Feed => ({ name: `Google News ${e.name} · ${category}`, url: gnTopic(e, t), platform: "Google News", category })),
    ...outlets.map((o): Feed => ({ ...o, platform: e.outlets })),
    ...(subreddit ? [reddit(subreddit)] : []),
    // What people are sharing on TikTok and X, as the press reports it. These feed the Buzz meter, which weighs them most.
    { name: "TikTok buzz", url: gnSearch(e, `${placeName(e, e.lang)} TikTok viral when:3d`), platform: VIRAL },
    { name: "X / Twitter buzz", url: gnSearch(e, `${placeName(e, e.lang)} (X OR Twitter OR tweets) trending when:3d`), platform: VIRAL },
  ];
}

/** Kenya keeps the hand-picked list it has always had, including the TikTok and X buzz searches. */
function kenyaFeeds(e: Edition): Feed[] {
  const gn = (q: string) => gnSearch(e, q);
  return [
    { name: "Google News Kenya", url: gnTop(e), platform: "Google News" },
    { name: "Google News · Kenya trending", url: gn("Kenya when:1d"), platform: "Google News" },
    { name: "Capital FM", url: "https://www.capitalfm.co.ke/news/feed/", platform: e.outlets },
    { name: "The Standard", url: "https://www.standardmedia.co.ke/rss/headlines.php", platform: e.outlets },
    { name: "The Star", url: "https://www.the-star.co.ke/rss", platform: e.outlets },
    { name: "Kenyans.co.ke", url: "https://www.kenyans.co.ke/feeds/news", platform: e.outlets },
    { name: "Citizen Digital", url: "https://www.citizen.digital/rss", platform: e.outlets },
    { name: "Nation", url: gn("site:nation.africa Kenya"), platform: e.outlets },
    { name: "Tuko", url: gn("site:tuko.co.ke"), platform: e.outlets },
    { name: "Business Daily", url: gn("site:businessdailyafrica.com"), platform: e.outlets },
    { name: "Mpasho", url: gn("site:mpasho.co.ke"), platform: e.outlets },
    { name: "Ghafla", url: gn("site:ghafla.com Kenya"), platform: e.outlets },
    { name: "r/Kenya", url: "https://www.reddit.com/r/Kenya/hot/.rss?limit=40", platform: "Reddit" },
    { name: "r/Nairobi", url: "https://www.reddit.com/r/Nairobi/hot/.rss?limit=25", platform: "Reddit" },
    { name: "r/Kenya top today", url: "https://www.reddit.com/r/Kenya/top/.rss?t=day&limit=25", platform: "Reddit" },
    { name: "r/KenyanPolitics", url: "https://www.reddit.com/r/KenyanPolitics/hot/.rss?limit=20", platform: "Reddit" },
    { name: "r/Africa · Kenya", url: "https://www.reddit.com/r/Africa/search.rss?q=Kenya&restrict_sr=1&sort=new&t=week", platform: "Reddit" },
    { name: "YouTube · Kenya news", url: gn("site:youtube.com Kenya news"), platform: "YouTube" },
    { name: "Citizen TV", url: yt("UChBQgieUidXV1CmDxSdRm3g"), platform: "YouTube" },
    { name: "NTV Kenya", url: yt("UCqBJ47FjJcl61fmSbcadAVg"), platform: "YouTube" },
    { name: "KTN News", url: yt("UCKVsdeoHExltrWMuK0hOWmg"), platform: "YouTube" },
    { name: "TikTok buzz", url: gn("Kenya TikTok viral when:3d"), platform: VIRAL },
    { name: "TikTok trends", url: gn("Kenyan TikToker when:7d"), platform: VIRAL },
    { name: "X / Twitter buzz", url: gn("Kenyans on Twitter OR KOT OR \"Kenyans on X\" when:3d"), platform: VIRAL },
    { name: "Trending online", url: gn("Kenya \"trending\" OR \"viral\" OR \"netizens\" when:2d"), platform: VIRAL },
    { name: "Reddit · TikTok & X", url: "https://www.reddit.com/r/Kenya/search.rss?q=tiktok+OR+twitter+OR+viral&restrict_sr=1&sort=new&t=week", platform: "Reddit" },
  ];
}

function worldFeeds(e: Edition): Feed[] {
  const o = e.outlets;
  return [
    { name: "Google News World", url: gnTopic(e, "WORLD"), platform: "Google News", category: "World" },
    { name: "Google News Top stories", url: gnTop(e), platform: "Google News" },
    ...TOPICS.map(([t, category]): Feed => ({ name: `Google News World · ${category}`, url: gnTopic(e, t), platform: "Google News", category })),
    { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", platform: o },
    { name: "The Guardian", url: "https://www.theguardian.com/world/rss", platform: o },
    { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", platform: o },
    { name: "NPR", url: "https://feeds.npr.org/1004/rss.xml", platform: o },
    { name: "France 24", url: "https://www.france24.com/en/rss", platform: o },
    reddit("worldnews", 40),
    { name: "TikTok buzz", url: gnSearch(e, "TikTok viral when:2d"), platform: VIRAL },
    { name: "X / Twitter buzz", url: gnSearch(e, "(X OR Twitter) trending worldwide when:2d"), platform: VIRAL },
  ];
}

/** Each country's own outlets, added on top of Google News. A feed that is wrong or down simply returns nothing and shows up in the ingest report. */
const LOCAL: Record<string, { outlets?: { name: string; url: string }[]; subreddit?: string }> = {
  UG: { subreddit: "Uganda" },
  TZ: { subreddit: "Tanzania" },
  NG: { subreddit: "Nigeria", outlets: [
    { name: "Punch", url: "https://punchng.com/feed/" },
    { name: "Premium Times", url: "https://www.premiumtimesng.com/feed" },
    { name: "Vanguard", url: "https://www.vanguardngr.com/feed/" },
  ] },
  GH: { subreddit: "Ghana", outlets: [
    { name: "Citi Newsroom", url: "https://citinewsroom.com/feed/" },
    { name: "MyJoyOnline", url: "https://www.myjoyonline.com/feed/" },
  ] },
  ZA: { subreddit: "southafrica", outlets: [
    { name: "News24", url: "https://feeds.news24.com/articles/news24/TopStories/rss" },
    { name: "Daily Maverick", url: "https://www.dailymaverick.co.za/dmrss/" },
    { name: "BusinessTech", url: "https://businesstech.co.za/news/feed/" },
  ] },
  GB: { subreddit: "unitedkingdom", outlets: [
    { name: "BBC News UK", url: "https://feeds.bbci.co.uk/news/uk/rss.xml" },
    { name: "The Guardian UK", url: "https://www.theguardian.com/uk/rss" },
    { name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/uk.xml" },
  ] },
  US: { subreddit: "news", outlets: [
    { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
    { name: "The Guardian US", url: "https://www.theguardian.com/us-news/rss" },
  ] },
  IN: { subreddit: "india", outlets: [
    { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss" },
    { name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeedstopstories.cms" },
  ] },
  AU: { subreddit: "australia", outlets: [
    { name: "ABC News", url: "https://www.abc.net.au/news/feed/51120/rss.xml" },
    { name: "The Guardian Australia", url: "https://www.theguardian.com/australia-news/rss" },
  ] },
  CA: { subreddit: "canada", outlets: [
    { name: "CBC News", url: "https://www.cbc.ca/webfeed/rss/rss-topstories" },
  ] },
};

/** Local-language editions: Google News in that language plus the country's own outlets. Written from memory, like the others. */
const LOCAL_LANG: Record<string, { outlets?: { name: string; url: string }[]; sites?: [name: string, site: string][]; subreddit?: string }> = {
  "KE-sw": { outlets: [{ name: "BBC Swahili", url: "https://feeds.bbci.co.uk/swahili/rss.xml" }], sites: [["Taifa Leo", "taifaleo.nation.africa"], ["DW Kiswahili", "dw.com/sw"], ["VOA Swahili", "voaswahili.com"]] },
  "TZ-sw": { outlets: [{ name: "BBC Swahili", url: "https://feeds.bbci.co.uk/swahili/rss.xml" }], sites: [["Mwananchi", "mwananchi.co.tz"], ["Habari Leo", "habarileo.co.tz"], ["DW Kiswahili", "dw.com/sw"]] },
  FR: { subreddit: "france", outlets: [
    { name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml" },
    { name: "France 24", url: "https://www.france24.com/fr/rss" },
    { name: "franceinfo", url: "https://www.francetvinfo.fr/titres.rss" },
    { name: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml" },
  ] },
  SN: { outlets: [{ name: "RFI Afrique", url: "https://www.rfi.fr/fr/afrique/rss" }], sites: [["Seneweb", "seneweb.com"], ["APS", "aps.sn"]] },
  CI: { outlets: [{ name: "RFI Afrique", url: "https://www.rfi.fr/fr/afrique/rss" }], sites: [["Abidjan.net", "abidjan.net"], ["Fraternité Matin", "fratmat.info"]] },
  ES: { subreddit: "spain", outlets: [
    { name: "El País", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
    { name: "20minutos", url: "https://www.20minutos.es/rss/" },
    { name: "RTVE", url: "https://www.rtve.es/api/noticias.rss" },
  ] },
  MX: { subreddit: "mexico", outlets: [
    { name: "BBC Mundo", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
    { name: "Milenio", url: "https://www.milenio.com/rss" },
  ] },
  EG: { outlets: [{ name: "BBC Arabic", url: "https://feeds.bbci.co.uk/arabic/rss.xml" }], sites: [["الأهرام", "ahram.org.eg"], ["المصري اليوم", "almasryalyoum.com"], ["اليوم السابع", "youm7.com"], ["الشروق", "shorouknews.com"], ["الجزيرة", "aljazeera.net"]] },
  SA: { outlets: [{ name: "BBC Arabic", url: "https://feeds.bbci.co.uk/arabic/rss.xml" }], sites: [["العربية", "alarabiya.net"], ["عكاظ", "okaz.com.sa"], ["وكالة الأنباء السعودية", "spa.gov.sa"], ["الجزيرة", "aljazeera.net"]] },
  "IN-hi": { outlets: [{ name: "BBC Hindi", url: "https://feeds.bbci.co.uk/hindi/rss.xml" }], sites: [["आज तक", "aajtak.in"], ["दैनिक भास्कर", "bhaskar.com"], ["दैनिक जागरण", "jagran.com"], ["एनडीटीवी इंडिया", "ndtv.in"], ["अमर उजाला", "amarujala.com"]] },
  BR: { subreddit: "brasil", outlets: [
    { name: "g1", url: "https://g1.globo.com/rss/g1/" },
    { name: "Folha de S.Paulo", url: "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml" },
    { name: "BBC News Brasil", url: "https://feeds.bbci.co.uk/portuguese/rss.xml" },
  ] },
};

export function feedsFor(code: string): Feed[] {
  const e = editionOf(code);
  if (e.code === WORLD) return worldFeeds(e);
  if (e.code === "KE") return kenyaFeeds(e);
  const lang = LOCAL_LANG[e.code];
  if (lang) {
    const sites = (lang.sites ?? []).map(([name, site]): { name: string; url: string } => ({ name, url: gnSearch(e, `site:${site}`) }));
    return countryFeeds(e, [...(lang.outlets ?? []), ...sites], lang.subreddit);
  }
  const local = LOCAL[e.code];
  return countryFeeds(e, local?.outlets ?? [], local?.subreddit);
}

/* ---------------- Categories ---------------- */
type Rule = [category: string, pattern: RegExp];

/** Country-neutral keyword guesses. A Google News section feed already knows its category, so these only run for the rest. */
const COMMON: Rule[] = [
  ["Conflict", /\b(war|ceasefire|missiles?|troops|airstrikes?|invasion|hostages?|militants?|rebels?|frontline)\b/i],
  ["Politics", /\b(elections?|parliament|senate|senator|president|prime minister|minister|government|governor|congress|voters?|cabinet|lawmakers?|opposition|coalition|campaign|policy)\b/i],
  ["Business", /\b(economy|economic|tax|taxes|bank|markets?|stocks?|inflation|prices?|fuel|budget|investors?|trade|tariffs?|currency|company|profits?|earnings|business)\b/i],
  ["Sports", /\b(football|soccer|athletics|athletes?|marathon|rugby|cricket|tennis|basketball|olympics?|league|cup|match|coach|championship|sport)\b/i],
  ["Entertainment", /\b(music|artist|celebrity|film|movie|concert|album|influencer|tiktok|actor|actress|show|wedding|festival|awards?)\b/i],
  ["Crime & Courts", /\b(police|court|arrest(ed)?|murder|killed|suspects?|judge|charged|robbery|crime|trial|prison|sentenced)\b/i],
  ["Tech", /\b(tech|ai|app|internet|startup|digital|cyber|software|chips?|robots?|crypto|satellite)\b/i],
  ["Health", /\b(health|hospital|disease|outbreak|doctors?|cholera|mpox|medical|vaccines?|virus|cancer)\b/i],
  ["Education", /\b(school|schools|university|students|teachers|education|exams?|college)\b/i],
  ["Climate & Weather", /\b(climate|floods?|flooding|drought|wildfires?|storms?|earthquake|weather|rainfall|heatwave|cyclone|hurricane)\b/i],
];

/** Whole-word match that works with accents (a plain \\b does not treat é or ã as part of a word). */
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])(?:${list})(?![\\p{L}\\p{N}\\p{M}])`, "iu");
/** Arabic glues "and", "by", "for", "the" onto the front of a word (والحكومة), so those prefixes are allowed. */
const arWords = (list: string) => new RegExp(`(?<![\\p{L}\\p{N}\\p{M}])[وبلفك]?(?:ال)?(?:${list})(?![\\p{L}\\p{N}\\p{M}])`, "iu");

/** The same idea in each language. The category names stay English: the page translates them when it shows them. */
const BY_LANGUAGE: Partial<Record<Lang, Rule[]>> = {
  fr: [
    ["Conflict", words("guerre|cessez-le-feu|missiles?|troupes|frappes?|invasion|otages?|rebelles?")],
    ["Politics", words("élections?|parlement|sénat|président|premier ministre|ministre|gouvernement|députés?|opposition|coalition|campagne|assemblée")],
    ["Business", words("économie|impôts?|taxe|banque|bourse|inflation|prix|carburant|budget|investisseurs?|commerce|entreprise|bénéfices?|croissance|emploi")],
    ["Sports", words("football|rugby|tennis|basket|olympiques?|ligue|coupe|match|entraîneur|championnat|athlétisme")],
    ["Entertainment", words("musique|artiste|film|cinéma|concert|album|festival|acteur|actrice|série")],
    ["Crime & Courts", words("police|tribunal|arrêté|meurtre|tué|suspects?|juge|procès|prison|condamné|vol|enquête")],
    ["Tech", words("technologie|numérique|intelligence artificielle|ia|application|logiciel|cyber|startup|crypto|satellite")],
    ["Health", words("santé|hôpital|maladie|épidémie|médecins?|vaccin|virus|cancer")],
    ["Education", words("école|université|élèves|étudiants|enseignants|éducation|examen|baccalauréat")],
    ["Climate & Weather", words("climat|inondations?|sécheresse|incendies?|tempête|séisme|météo|canicule|cyclone")],
  ],
  es: [
    ["Conflict", words("guerra|alto el fuego|misiles?|tropas|ataques? aéreos?|invasión|rehenes|rebeldes")],
    ["Politics", words("elecciones|parlamento|senado|presidente|primer ministro|ministro|gobierno|congreso|diputados?|oposición|coalición|campaña")],
    ["Business", words("economía|impuestos?|banco|bolsa|inflación|precios?|combustible|presupuesto|inversores?|comercio|aranceles|empresa|beneficios|empleo")],
    ["Sports", words("fútbol|baloncesto|tenis|olímpicos?|liga|copa|partido|entrenador|campeonato|atletismo")],
    ["Entertainment", words("música|artista|película|cine|concierto|álbum|festival|actor|actriz|serie|premios?")],
    ["Crime & Courts", words("policía|tribunal|detenido|asesinato|muerto|sospechosos?|juez|juicio|cárcel|condenado|robo|investigación")],
    ["Tech", words("tecnología|digital|inteligencia artificial|aplicación|software|ciber|startup|cripto|satélite")],
    ["Health", words("salud|hospital|enfermedad|brote|médicos?|vacuna|virus|cáncer")],
    ["Education", words("escuela|universidad|estudiantes|profesores|educación|examen")],
    ["Climate & Weather", words("clima|inundaciones?|sequía|incendios?|tormenta|terremoto|tiempo|ola de calor|huracán")],
  ],
  pt: [
    ["Conflict", words("guerra|cessar-fogo|mísseis?|tropas|ataques? aéreos?|invasão|reféns|rebeldes")],
    ["Politics", words("eleições|parlamento|senado|presidente|primeiro-ministro|ministro|governo|congresso|deputados?|oposição|coalizão|campanha")],
    ["Business", words("economia|impostos?|banco|bolsa|inflação|preços?|combustível|orçamento|investidores?|comércio|tarifas|empresa|lucros?|emprego")],
    ["Sports", words("futebol|basquete|tênis|olímpicos?|liga|copa|jogo|técnico|campeonato|atletismo")],
    ["Entertainment", words("música|artista|filme|cinema|show|álbum|festival|ator|atriz|série|prêmios?")],
    ["Crime & Courts", words("polícia|tribunal|preso|assassinato|morto|suspeitos?|juiz|julgamento|prisão|condenado|roubo|investigação")],
    ["Tech", words("tecnologia|digital|inteligência artificial|aplicativo|software|ciber|startup|cripto|satélite")],
    ["Health", words("saúde|hospital|doença|surto|médicos?|vacina|vírus|câncer")],
    ["Education", words("escola|universidade|estudantes|professores|educação|prova")],
    ["Climate & Weather", words("clima|enchentes?|seca|incêndios?|tempestade|terremoto|tempo|onda de calor|furacão")],
  ],
  ar: [
    ["Conflict", arWords("حرب|هدنة|وقف إطلاق النار|صواريخ|صاروخ|قوات|غارات|غارة|اجتياح|رهائن|متمردين|ميليشيات")],
    ["Politics", arWords("انتخابات|برلمان|مجلس النواب|مجلس الشيوخ|رئيس|رئيس الوزراء|وزير|وزراء|حكومة|كونغرس|نواب|معارضة|ائتلاف|حملة|سياسة")],
    ["Business", arWords("اقتصاد|ضرائب|ضريبة|بنك|بنوك|بورصة|أسهم|تضخم|أسعار|وقود|ميزانية|مستثمرين|تجارة|رسوم|شركة|شركات|أرباح|وظائف|دولار|جنيه|ريال|نفط")],
    ["Sports", arWords("كرة القدم|دوري|كأس|مباراة|مدرب|بطولة|أولمبياد|تنس|رياضة|لاعب|الأهلي|الزمالك|منتخب")],
    ["Entertainment", arWords("موسيقى|فنان|فيلم|سينما|حفل|ألبوم|مهرجان|ممثل|ممثلة|مسلسل|جوائز|غناء")],
    ["Crime & Courts", arWords("شرطة|محكمة|القبض|اعتقال|جريمة|قتل|متهم|قاض|محاكمة|سجن|حكم|سرقة|تحقيق|نيابة")],
    ["Tech", arWords("تكنولوجيا|رقمي|ذكاء اصطناعي|تطبيق|برمجيات|إنترنت|هاتف|روبوت|عملات رقمية|قمر صناعي|سيبراني")],
    ["Health", arWords("صحة|مستشفى|مرض|وباء|طبيب|أطباء|لقاح|فيروس|سرطان|كوليرا")],
    ["Education", arWords("مدرسة|مدارس|جامعة|طلاب|معلمين|تعليم|امتحانات|ثانوية")],
    ["Climate & Weather", arWords("مناخ|فيضانات|فيضان|جفاف|حرائق|حريق|عاصفة|زلزال|طقس|أمطار|حرارة|إعصار")],
  ],
  hi: [
    ["Conflict", words("युद्ध|संघर्ष विराम|मिसाइल|सेना|हवाई हमला|हमला|बंधक|विद्रोही")],
    ["Politics", words("चुनाव|संसद|लोकसभा|राज्यसभा|राष्ट्रपति|प्रधानमंत्री|मंत्री|सरकार|विधानसभा|विपक्ष|गठबंधन|प्रचार|नीति|मुख्यमंत्री")],
    ["Business", words("अर्थव्यवस्था|बैंक|शेयर|बाजार|सेंसेक्स|निफ्टी|महंगाई|कीमत|ईंधन|बजट|निवेशक|व्यापार|शुल्क|कंपनी|मुनाफा|नौकरी|रुपया|आरबीआई")],
    ["Sports", words("क्रिकेट|फुटबॉल|हॉकी|टेनिस|ओलंपिक|आईपीएल|लीग|कप|मैच|कोच|चैंपियनशिप|खेल|खिलाड़ी")],
    ["Entertainment", words("संगीत|कलाकार|फिल्म|सिनेमा|कॉन्सर्ट|एल्बम|फेस्टिवल|अभिनेता|अभिनेत्री|सीरीज|पुरस्कार|बॉलीवुड")],
    ["Crime & Courts", words("पुलिस|अदालत|गिरफ्तार|हत्या|आरोपी|न्यायाधीश|मुकदमा|जेल|सजा|चोरी|जांच|सुप्रीम कोर्ट|हाईकोर्ट")],
    ["Tech", words("तकनीक|डिजिटल|एआई|ऐप|सॉफ्टवेयर|इंटरनेट|स्टार्टअप|क्रिप्टो|सैटेलाइट|साइबर")],
    ["Health", words("स्वास्थ्य|अस्पताल|बीमारी|महामारी|डॉक्टर|टीका|वैक्सीन|वायरस|कैंसर|हैजा")],
    ["Education", words("स्कूल|विश्वविद्यालय|छात्र|शिक्षक|शिक्षा|परीक्षा|कॉलेज|नीट|जेईई")],
    ["Climate & Weather", words("जलवायु|बाढ़|सूखा|आग|तूफान|भूकंप|मौसम|बारिश|गर्मी|चक्रवात")],
  ],
  sw: [
    ["Conflict", words("vita|usitishaji mapigano|makombora|wanajeshi|mashambulizi|uvamizi|mateka|waasi")],
    ["Politics", words("uchaguzi|bunge|seneta|rais|waziri|serikali|gavana|wabunge|upinzani|muungano|kampeni|sera")],
    ["Business", words("uchumi|kodi|benki|soko|mfumuko wa bei|bei|mafuta|bajeti|wawekezaji|biashara|kampuni|faida|ajira")],
    ["Sports", words("mpira|kandanda|riadha|marathoni|raga|kriketi|tenisi|olimpiki|ligi|kombe|mechi|kocha|ubingwa|michezo")],
    ["Entertainment", words("muziki|msanii|filamu|tamasha|albamu|mwigizaji|tuzo")],
    ["Crime & Courts", words("polisi|mahakama|kukamatwa|mauaji|mshukiwa|jaji|kesi|gereza|ujambazi|wizi|uchunguzi")],
    ["Tech", words("teknolojia|dijitali|akili bandia|programu|mtandao|satelaiti|kripto")],
    ["Health", words("afya|hospitali|ugonjwa|mlipuko|daktari|chanjo|virusi|saratani|kipindupindu")],
    ["Education", words("shule|chuo kikuu|wanafunzi|walimu|elimu|mtihani")],
    ["Climate & Weather", words("hali ya hewa|mafuriko|ukame|moto|dhoruba|tetemeko|mvua|joto")],
  ],
};

/** Local names and institutions that only make sense in one country; tried before the common rules. */
const LOCAL_RULES: Record<string, Rule[]> = {
  KE: [
    ["Politics", /\b(ruto|raila|gachagua|kalonzo|mp|senat|governor|iebc|odm|uda|finance bill)\b/i],
    ["Business", /\b(shilling|ksh|kes|kra|cbk|nse|safaricom)\b/i],
    ["Sports", /\b(harambee|kipchoge|afcon|fkf|gor mahia|afc leopards)\b/i],
    ["Crime & Courts", /\b(dci)\b/i],
    ["Tech", /\b(mpesa|m-pesa|starlink)\b/i],
    ["Health", /\b(sha|nhif)\b/i],
    ["Education", /\b(kcse|kcpe|cbc|tsc|knut)\b/i],
  ],
  NG: [["Politics", /\b(inec|apc|pdp|nass)\b/i], ["Business", /\b(naira|cbn|dangote)\b/i], ["Crime & Courts", /\b(efcc)\b/i]],
  ZA: [["Politics", /\b(anc|eff|ramaphosa)\b/i], ["Business", /\b(rand|eskom|jse)\b/i], ["Sports", /\b(springboks|proteas|bafana)\b/i]],
  GH: [["Politics", /\b(npp|ndc)\b/i], ["Business", /\b(cedi)\b/i]],
  GB: [["Politics", /\b(westminster|downing street|tory|tories|labour)\b/i], ["Business", /\b(ftse|bank of england)\b/i], ["Health", /\b(nhs)\b/i]],
  US: [["Politics", /\b(white house|supreme court|democrats?|republicans?)\b/i], ["Business", /\b(wall street|nasdaq|dow jones)\b/i], ["Sports", /\b(nfl|nba|mlb|nhl)\b/i]],
  IN: [["Politics", /\b(lok sabha|rajya sabha|bjp)\b/i], ["Business", /\b(rupee|sensex|nifty|rbi)\b/i], ["Sports", /\b(ipl|bcci)\b/i]],
  AU: [["Business", /\b(asx|rba)\b/i], ["Sports", /\b(afl|nrl)\b/i]],
  CA: [["Crime & Courts", /\b(rcmp)\b/i], ["Business", /\b(tsx|loonie)\b/i], ["Sports", /\b(nhl)\b/i]],
};

/** Tried after everything else, so a story is only "World" when nothing more specific fits. */
const TAIL_RULES: Record<string, Rule[]> = {
  KE: [["World", /\b(us|china|uk|russia|ukraine|gaza|israel|un|somalia|uganda|tanzania|ethiopia|sudan)\b/i]],
};

/** Category for one headline: the feed's own section if it has one, else the first matching rule, else "General". */
export function categorize(text: string, code: string, feedCategory?: string): string {
  if (feedCategory) return feedCategory;
  const lang = editionOf(code).lang;
  const rules = [...(LOCAL_RULES[code] ?? []), ...(lang === "en" ? COMMON : (BY_LANGUAGE[lang] ?? COMMON)), ...(TAIL_RULES[code] ?? [])];
  return rules.find(([, re]) => re.test(text))?.[0] ?? "General";
}

/** Editions in the order their feeds are refreshed. */
export const EDITION_CODES: string[] = EDITIONS.map((e) => e.code);
