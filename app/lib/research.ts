import { addLeads, getLeads } from "./lead-storage";
import prisma from "./prisma";
import {
  ResearchJob,
  ResearchLead,
  ResearchRequest,
} from "../types/research";

const TAVILY_API_URL = "https://api.tavily.com";

/* =========================================================
   UCT RESEARCH ENGINE
   Version: UCT Prospect Intelligence V10 FINAL POWER

   Goal:
   - Find real end-user industrial prospects.
   - Keep the user's prompt simple (e.g. "Find potential customers in India").
   - Never turn an article/listing title into a company name.
   - Verify identity, business type and contact details from the same official domain.
========================================================= */

const MAX_SEARCH_RESULTS = 10;
const MAX_SEARCH_QUERIES = 24;
const MAX_WEBSITES_PER_QUERY = 10;
const MAX_DIRECTORY_SOURCES = 1;
const MAX_DIRECTORY_CANDIDATES = 4;
const REQUEST_TIMEOUT_MS = 15000;
const TAVILY_RETRIES = 2;

export type ResearchEventType =
  | "info" | "search" | "check" | "success"
  | "skipped" | "rejected" | "error" | "complete"
  | "researched";

export interface ResearchEvent {
  type: ResearchEventType;
  message: string;
  timestamp: string;
  website?: string;
}

export interface ResearchRunOptions {
  limit?: number;
  onEvent?: (event: ResearchEvent) => void;
  knownLeadKeys?: LeadKeySets;
  newLeadCount?: { value: number };

  // Websites already researched in the browser cache.
  excludedWebsites?: Set<string>;

  // Shared set for websites encountered during this research run.
  // This prevents the same domain from being processed twice across stages.
  runSeenWebsites?: Set<string>;

  // Sent to the browser so it can permanently remember every website
  // that has already entered the research/verification pipeline.
  onWebsiteResearched?: (website: string) => void;
}

interface LeadKeySets {
  websites: Set<string>;
  phones: Set<string>;
  emails: Set<string>;
}

function createLeadKeySets(leads: ResearchLead[]): LeadKeySets {
  const keys: LeadKeySets = {
    websites: new Set<string>(),
    phones: new Set<string>(),
    emails: new Set<string>(),
  };

  for (const lead of leads) {
    const website = normalizeDomainKey(lead.website);
    const phone = lead.phone.replace(/\D/g, "");
    const email = lead.email.trim().toLowerCase();

    if (website) keys.websites.add(website);
    if (phone) keys.phones.add(phone);
    if (email) keys.emails.add(email);
  }

  return keys;
}

function isKnownLead(lead: SectorLead, keys: LeadKeySets): boolean {
  const website = normalizeDomainKey(lead.website);
  const phone = lead.phone.replace(/\D/g, "");
  const email = lead.email.trim().toLowerCase();

  return Boolean(
    (website && keys.websites.has(website)) ||
    (phone && keys.phones.has(phone)) ||
    (email && keys.emails.has(email))
  );
}
function normalizeWebsiteSet(
  websites?: Iterable<string>
): Set<string> {
  return new Set(
    Array.from(websites ?? [])
      .map((website) => normalizeDomainKey(website))
      .filter(Boolean)
  );
}

function isExcludedWebsite(
  website: string,
  excludedWebsites?: Set<string>
): boolean {
  if (!excludedWebsites?.size) return false;

  const normalized = normalizeDomainKey(website);

  if (!normalized) return false;

  // Accept both normalized domains and raw URLs from the API.
  if (excludedWebsites.has(normalized)) return true;

  for (const excluded of excludedWebsites) {
    if (normalizeDomainKey(excluded) === normalized) {
      return true;
    }
  }

  return false;
}

async function markWebsiteResearched(
  website: string,
  options: ResearchRunOptions
): Promise<boolean> {
  const normalized = normalizeDomainKey(website);

  if (!normalized) return false;

  const runSeenWebsites =
    options.runSeenWebsites ??
    new Set<string>();

  options.runSeenWebsites = runSeenWebsites;

  // Prevent duplicate work inside the same research run.
  if (runSeenWebsites.has(normalized)) {
    return false;
  }

  // PostgreSQL is the permanent source of truth. The domain is inserted
  // BEFORE any expensive verification/extraction starts.
  // Therefore rejected, failed and successful websites are all remembered.
  try {
    await prisma.researchDomain.create({
      data: {
        domain: normalized,
      },
    });
  } catch (error: any) {
    // Prisma P2002 means another run already registered this domain.
    if (error?.code === "P2002") {
      runSeenWebsites.add(normalized);
      return false;
    }

    throw error;
  }

  runSeenWebsites.add(normalized);

  // Keep the browser cache callback for the fast local optimization.
  options.onWebsiteResearched?.(normalized);

  emitResearchEvent(
    options.onEvent,
    "researched",
    `Website permanently marked as researched: ${normalized}`,
    normalized
  );

  return true;
}

function registerLeadKeys(lead: SectorLead, keys: LeadKeySets): void {
  const website = normalizeDomainKey(lead.website);
  const phone = lead.phone.replace(/\D/g, "");
  const email = lead.email.trim().toLowerCase();

  if (website) keys.websites.add(website);
  if (phone) keys.phones.add(phone);
  if (email) keys.emails.add(email);
}

function emitResearchEvent(
  onEvent: ResearchRunOptions["onEvent"],
  type: ResearchEventType,
  message: string,
  website?: string
): void {
  onEvent?.({
    type,
    message,
    timestamp: new Date().toISOString(),
    ...(website ? { website } : {}),
  });
}

function emitDuplicateNotice(
  onEvent: ResearchRunOptions["onEvent"],
  message: string,
  website?: string
): void {
  emitResearchEvent(
    onEvent,
    "info",
    `DUPLICATE → ${message}`,
    website
  );
}

/* =========================================================
   1. SOURCES THAT MUST NEVER BECOME FINAL LEADS
========================================================= */

const DIRECTORY_DOMAINS = [
  "indiamart.", "tradeindia.", "justdial.", "clutch.co", "ambitionbox.",
  "naukri.", "glassdoor.", "dnb.com", "companydatabase.", "kompass.",
  "exportersindia.", "go4worldbusiness.", "yellowpages.", "yelp.",
  "crunchbase.", "zoominfo.", "apollo.io", "apollo.", "owler.",
  "themanifest.", "goodfirms.", "thomasnet.", "manta.com", "bizapedia.",
  "opencorporates.", "datanyze.", "lusha.", "seamless.ai", "lead411.",
];

const SOCIAL_DOMAINS = [
  "facebook.com", "instagram.com", "linkedin.com", "youtube.com",
  "twitter.com", "x.com", "pinterest.com", "tiktok.com",
];

const PUBLISHER_DOMAINS = [
  // ─────────────────────────────────────────────
  // News & Business Publications
  // ─────────────────────────────────────────────
  "economictimes.",
  "timesofindia.",
  "business-standard.com",
  "financialexpress.com",
  "moneycontrol.com",
  "forbes.com",
  "reuters.com",
  "bloomberg.com",
  "businesswire.com",
  "globenewswire.com",
  "prnewswire.com",
  "yourstory.com",

  // ─────────────────────────────────────────────
  // Oil & Gas / Energy Industry Publications
  // ─────────────────────────────────────────────
  "ogj.com",
  "oilprice.com",
  "oilgasjournal.com",
  "offshore-technology.com",
  "offshore-mag.com",
  "worldoil.com",
  "rigzone.com",
  "ogjnews.com",
  "petroleum-economist.com",
  "energyintel.com",
  "energyvoice.com",
  "energyconnects.com",
  "energyglobal.com",
  "energy-storage.news",
  "renewableenergyworld.com",
  "pv-magazine.com",
  "pv-tech.org",
  "solarserver.com",
  "solarquarter.com",
  "mercomindia.com",

  // ─────────────────────────────────────────────
  // Industrial / Automation / Manufacturing Media
  // ─────────────────────────────────────────────
  "industryweek.com",
  "automation.com",
  "controlglobal.com",
  "controleng.com",
  "plantengineering.com",
  "plantservices.com",
  "processingmagazine.com",
  "chemicalprocessing.com",
  "powermag.com",
  "power-eng.com",
  "utilitydive.com",
  "manufacturing.net",
  "manufacturingtomorrow.com",
  "designnews.com",
  "engineering.com",
  "electronicsmedia.info",

  // ─────────────────────────────────────────────
  // Technology / Electronics Publications
  // ─────────────────────────────────────────────
  "techcrunch.com",
  "zdnet.com",
  "theregister.com",
  "venturebeat.com",
  "electronicsweekly.com",
  "eetimes.com",
  "electronicdesign.com",
  "embedded.com",

  // ─────────────────────────────────────────────
  // Textile / Industry Publications
  // ─────────────────────────────────────────────
  "textileworld.com",
  "indiantextilejournal.com",

  // ─────────────────────────────────────────────
  // Market Research / Intelligence / Reports
  // ─────────────────────────────────────────────
  "market.us",
  "marketsandmarkets.com",
  "mordorintelligence.com",
  "grandviewresearch.com",
  "fortunebusinessinsights.com",
  "precedenceresearch.com",
  "alliedmarketresearch.com",
  "researchandmarkets.com",
  "imarcgroup.com",
  "globaldata.com",
  "technavio.com",
  "factsandfactors.com",
  "databridgemarketresearch.com",

  // ─────────────────────────────────────────────
  // Directories / Information / Third-party Sources
  // ─────────────────────────────────────────────
  "indiafilings.com",
  "ibef.org",
  "wikipedia.org",
  "crunchbase.com",
  "zoominfo.com",
  "dnb.com",
  "apollo.io",
  "thecompanycheck.com",
  "tofler.in",
  "zaubacorp.com",
  "tracxn.com",

  // ─────────────────────────────────────────────
  // Publishing Platforms / Blogs
  // ─────────────────────────────────────────────
  "medium.com",
  "wordpress.com",
  "blogspot.com",
  "substack.com",
  "tumblr.com",

  // ─────────────────────────────────────────────
  // Press Release / PR / Syndication
  // ─────────────────────────────────────────────
  "prweb.com",
  "pr.com",
  "einpresswire.com",
  "accesswire.com",
  "24-7pressrelease.com",
  "newswire.com",

  // ─────────────────────────────────────────────
  // Generic Media / News Patterns
  // ─────────────────────────────────────────────
  "news.",
  "media.",
  "magazine.",
  "journal.",
  "press.",
];
const ARTICLE_PATHS = [
  "/article/", "/articles/", "/blog/", "/blogs/", "/news/", "/post/",
  "/posts/", "/story/", "/stories/", "/category/", "/tag/", "/author/",
  "/press-release/", "/press/", "/insights/", "/resources/",
];

const CONTENT_SUBDOMAIN_LABELS = new Set([
  "blog", "blogs", "news", "press", "media", "magazine",
  "article", "articles", "story", "stories", "journal",
  "insights", "resources", "updates", "community",
  "careers", "career", "jobs", "job",
]);

function isContentSubdomain(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return true;

  const labels = hostname.split(".");
  if (labels.length < 3) return false;

  return CONTENT_SUBDOMAIN_LABELS.has(labels[0].toLowerCase());
}

function getRootDomain(url: string): string {
  const hostname = getHostname(url);
  if (!hostname) return "";

  const labels = hostname.split(".");
  if (labels.length <= 2) return hostname;

  const twoPartSuffixes = new Set([
    "co.in", "com.au", "co.uk", "co.nz", "co.za",
    "com.sg", "com.my", "com.br", "co.jp",
  ]);

  const suffix = labels.slice(-2).join(".");
  return twoPartSuffixes.has(suffix)
    ? labels.slice(-3).join(".")
    : labels.slice(-2).join(".");
}

function getRootOrigin(url: string): string {
  const rootDomain = getRootDomain(url);
  if (!rootDomain) return "";

  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${rootDomain}`;
  } catch {
    return "";
  }
}


const TAVILY_EXCLUDE_DOMAINS = [
  "indiamart.com",
  "tradeindia.com",
  "justdial.com",
  "exportersindia.com",
  "go4worldbusiness.com",
  "yellowpages.in",
  "yelp.com",
  "clutch.co",
  "goodfirms.co",
  "kompass.com",
  "dnb.com",
  "zoominfo.com",
  "apollo.io",
  "crunchbase.com",
  "owler.com",
  "manta.com",
  "bizapedia.com",
  "opencorporates.com",
  "seamless.ai",
  "lead411.com",
  "lusha.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "wikipedia.org",
  "medium.com",
  "yourstory.com",
  "economictimes.indiatimes.com",
  "timesofindia.indiatimes.com",
  "business-standard.com",
  "financialexpress.com",
  "moneycontrol.com",
  "reuters.com",
  "forbes.com",
  "ibef.org",
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "scribd.com",
  "salezshark.com",
  "value.today",
];

const PROVIDER_BUSINESS_SIGNALS = [
  "industrial iot solutions provider",
  "industrial iot solution provider",
  "iiot solutions provider",
  "iot solutions provider",
  "iot platform provider",
  "iot service provider",
  "lorawan solution provider",
  "lorawan solutions provider",
  "industrial automation solutions provider",
  "automation solutions provider",
  "scada solutions provider",
  "scada system integrator",
  "industrial connectivity provider",
  "industrial monitoring solutions",
  "remote monitoring solutions provider",
  "asset tracking solutions provider",
  "predictive maintenance solutions provider",
  "sensor solutions provider",
  "industrial wireless solutions",
  "iot hardware manufacturer",
  "iot device manufacturer",
  "industrial gateway manufacturer",
  "industrial sensor manufacturer",
  "telemetry solutions provider",
  "system integrator",
  "technology solutions provider",
  "software solutions provider",
];

/* =========================================================
   2. REAL CUSTOMER INDUSTRIES
========================================================= */

const CUSTOMER_SEGMENTS: Record<string, string[]> = {
  manufacturing: [
    "manufacturing", "manufacturer", "factory", "factories", "production plant",
    "production facility", "industrial plant", "assembly plant", "production line",
    "automotive", "auto components", "textile", "garment", "pharmaceutical",
    "pharma", "food processing", "beverage", "packaging", "plastic", "rubber",
    "chemical", "steel", "cement", "glass", "paper", "electronics", "electrical",
    "battery", "paint", "fmcg", "consumer goods", "semiconductor", "metal fabrication",
  ],
  industrialAssets: [
    "industrial facility", "industrial site", "industrial operations", "machinery",
    "machines", "equipment", "industrial equipment", "process equipment", "production equipment",
    "plant operations", "maintenance", "maintenance department", "asset management",
    "plant maintenance", "factory operations",
  ],
  logistics: [
    "logistics", "warehouse", "warehousing", "distribution center", "distribution centre",
    "supply chain", "3pl", "cold storage", "fulfillment center", "fulfilment centre",
    "fleet", "transportation", "transport fleet", "trucking", "freight",
  ],
  energy: [
    "energy", "power plant", "power generation", "solar plant", "solar farm", "solar",
    "renewable energy", "utility", "utilities", "electric utility", "power utility",
    "substation", "smart metering", "energy infrastructure",
  ],
  oilGasMining: [
    "oil and gas", "oil & gas", "petroleum", "refinery", "refineries", "pipeline",
    "mining", "mine", "mines", "mineral processing", "quarry", "drilling",
  ],
  agriculture: [
    "agriculture", "smart agriculture", "smart farming", "greenhouse", "greenhouses",
    "hydroponics", "irrigation", "agritech", "precision agriculture", "farm operations",
  ],
  healthcare: [
    "hospital", "healthcare facility", "healthcare facilities", "medical device",
    "medical devices", "medical equipment", "hospital equipment", "medical technology",
    "healthcare equipment", "diagnostic equipment", "laboratory equipment",
  ],
  transportation: [
    "transportation", "fleet", "vehicle fleet", "fleet operations", "telematics",
    "public transport", "bus operator", "rail operator", "railway", "shipping",
    "port", "terminal", "mobility operations",
  ],
  infrastructure: [
    "smart building", "building automation", "facility management", "facility operations",
    "smart infrastructure", "commercial building", "industrial building", "campus",
    "water treatment", "wastewater", "water utility", "infrastructure operator",
  ],
  engineeringEquipment: [
    "engineering", "engineering works", "engineering plant", "equipment manufacturing",
    "machinery manufacturing", "machine builder", "machine building", "industrial machinery",
    "process machinery", "industrial equipment manufacturing", "equipment production",
    "heavy engineering", "industrial equipment", "industrial machinery", "process industry",
  ],
  energyStorageMobility: [
    "battery", "battery energy storage", "bess", "energy storage", "ev charging",
    "electric vehicle", "ev infrastructure", "charging station", "charging infrastructure",
    "green hydrogen", "hydrogen", "bioenergy", "biomass energy", "waste to energy",
  ],
  infrastructureUtilities: [
    "smart city", "smart cities", "smart lighting", "street lighting", "building automation",
    "building management", "water treatment", "wastewater", "water utility",
    "water infrastructure", "utility infrastructure", "district cooling", "district heating",
  ],
  technologyAndIntegration: [
    "industrial iot", "iiot", "iot", "automation", "industrial automation",
    "embedded systems", "embedded technology", "electronics", "telecom",
    "telecommunications", "system integrator", "systems integrator", "oem", "odm",
    "original equipment manufacturer", "original design manufacturer",
  ],
};




const UCT_USE_CASE_SIGNALS = [
  "iot", "industrial iot", "iiot", "sensor", "sensors", "lorawan", "wireless monitoring",
  "remote monitoring", "machine monitoring", "equipment monitoring", "condition monitoring",
  "predictive maintenance", "asset tracking", "asset monitoring", "telemetry", "modbus",
  "rs485", "scada", "plc", "industrial connectivity", "wireless connectivity",
  "data acquisition", "remote data", "industry 4.0", "smart factory", "smart manufacturing",
  "smart warehouse", "fleet tracking", "temperature monitoring", "energy monitoring",
  "environmental monitoring", "machine data", "equipment data", "real time monitoring",
  "smart metering", "energy management", "power monitoring", "water monitoring",
  "cold chain monitoring", "cold storage monitoring", "gps tracking", "vehicle tracking",
  "condition-based monitoring", "industrial wireless", "edge computing", "gateway",
  "embedded systems", "automation", "instrumentation", "digital transformation",
];

const NON_CUSTOMER_ORGANIZATION_SIGNALS = [
  "government agency",
  "government department",
  "ministry",
  "government authority",
  "development agency",
  "renewable energy development agency",
  "research institute",
  "research organization",
  "industry association",
  "trade association",
  "chamber of commerce",
  "non-profit organization",
  "nonprofit organization",
  "foundation",
];

const HARD_REJECT_ORGANIZATION_SIGNALS = [
  "government agency", "government department", "government authority",
  "renewable energy development agency", "development authority",
  "development agency", "government organization", "government organisation",
  "public authority", "research institute", "research organization",
  "research organisation", "industry association", "trade association",
  "chamber of commerce", "non-profit organization", "nonprofit organization",
  "non-profit organisation", "nonprofit organisation",
];

const COMPETITOR_PRIMARY_SIGNALS = [
  "industrial iot solutions provider", "industrial iot solution provider",
  "iiot solutions provider", "iot solutions provider", "iot platform provider",
  "lorawan solution provider", "lorawan solutions provider",
  "industrial automation solutions provider", "automation solutions provider",
  "scada solutions provider", "scada system integrator",
  "industrial connectivity provider", "remote monitoring solutions provider",
  "asset tracking solutions provider", "predictive maintenance solutions provider",
  "sensor solutions provider", "industrial gateway manufacturer",
  "industrial sensor manufacturer", "iot hardware manufacturer",
  "iot device manufacturer",
];

const PARTNER_BUSINESS_SIGNALS = [
  "system integrator", "systems integrator", "industrial system integrator",
  "automation integrator", "technology integrator", "engineering integrator",
  "oem", "odm", "original equipment manufacturer", "original design manufacturer",
  "industrial distributor", "equipment distributor", "technology distributor",
  "channel partner", "distribution partner", "value added distributor",
  "industrial supplier", "equipment supplier", "industrial solutions company",
  "epc contractor", "epc company", "engineering procurement construction",
];

const NEGATIVE_BUSINESS_SIGNALS = [
  "digital marketing agency", "marketing agency", "seo agency", "advertising agency",
  "web design agency", "software development agency", "law firm", "accounting firm",
  "recruitment agency", "staffing agency", "real estate agency", "property dealer",
  "travel agency", "restaurant", "hotel", "news portal", "magazine", "publisher",
  "blog", "job portal", "job listing", "business directory", "lead generation agency",
  "data provider", "company database", "market research company", "market research firm",
  "business intelligence company", "research consultancy", "management consulting",
  "consulting firm", "advisory firm", "digital transformation consultant",
];

const GENERIC_NAME_PHRASES = [
  "manufacturing jobs", "manufacturing company", "manufacturing companies", "manufacturers in",
  "manufacturers list", "company list", "company database", "company directory", "business directory",
  "business database", "verified companies", "contract manufacturing", "contract manufacturer",
  "manufacturing services", "machinery manufacturers", "machinery company", "machinery companies",
  "industrial companies", "industrial company", "industrial manufacturers", "engineering companies",
  "engineering company", "equipment manufacturers", "equipment company", "top companies",
  "best companies", "leading companies", "companies in", "jobs in", "job opportunities",
  "get in touch", "contact us", "about us", "home page", "homepage", "group captive solar",
];

const ARTICLE_TITLE_WORDS = [
  "awarded", "award", "launches", "launched", "announces", "announced", "partners", "partnered",
  "story of", "entrepreneurial growth", "joins", "appointed", "appoints", "acquires", "acquired",
  "expands", "expansion", "reports", "initiative", "program", "programme", "why ", "how ",
  "statistics", "market size", "forecast", "insights", "analysis", "trends",
];

/* =========================================================
   3. VALIDATION / JOB
========================================================= */

export function validateResearchRequest(request: ResearchRequest): string | null {
  if (!request.prompt?.trim()) return "Research prompt is required.";
  if (request.prompt.trim().length < 10) return "Research prompt is too short.";
  return null;
}

export function createResearchJob(request: ResearchRequest): ResearchJob {
  return {
    id: `research_${Date.now()}`,
    prompt: request.prompt.trim(),
    status: "QUEUED",
    leadsFound: 0,
    createdAt: new Date().toISOString(),
  };
}

/* =========================================================
   4. TEXT / URL UTILITIES
========================================================= */

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[|:;,.-]+/, "").replace(/[|]+$/, "").trim();
}

function normalizeName(value: string): string {
  return cleanText(value).toLowerCase().replace(/[|,.:;'"`()]/g, " ").replace(/\s+/g, " ").trim();
}

function getNameTokens(value: string): string[] {
  const ignored = new Set([
    "the", "and", "of", "for", "with", "from", "private", "limited", "pvt", "ltd", "llp",
    "inc", "incorporated", "company", "co", "corporation", "corp", "industries", "industry",
    "enterprise", "enterprises", "technologies", "technology", "solutions", "services", "group",
    "international", "global", "india", "india", "llc",
  ]);

  return normalizeName(value).split(" ")
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3 && !ignored.has(token));
}

function getHostname(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}

function getOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch { return ""; }
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/, "");
  } catch { return url; }
}

function normalizeDomainKey(url: string): string {
  try {
    const hostname = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .trim();

    return hostname;
  } catch {
    return normalizeUrl(url)
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();
  }
}

function buildDynamicSearchExclusions(
  knownLeadKeys?: LeadKeySets,
  excludedWebsites?: Set<string>
): string[] {
  const dynamic = [
    ...Array.from(excludedWebsites ?? []),
    ...Array.from(knownLeadKeys?.websites ?? []),
  ]
    .map((value) => normalizeDomainKey(value))
    .filter(Boolean);

  return [
    ...new Set([
      ...TAVILY_EXCLUDE_DOMAINS,
      ...dynamic,
    ]),
  ].slice(0, 150);
}

function isDirectoryDomain(url: string): boolean {
  const hostname = getHostname(url);
  if (!hostname) return true;
  return DIRECTORY_DOMAINS.some((domain) => hostname.includes(domain));
}

function isSocialDomain(url: string): boolean {
  const hostname = getHostname(url);
  return SOCIAL_DOMAINS.some((domain) => hostname.includes(domain));
}

function isPublisherDomain(url: string): boolean {
  const hostname = getHostname(url);
  return PUBLISHER_DOMAINS.some((domain) => hostname.includes(domain));
}

function isArticleUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return ARTICLE_PATHS.some((path) => lower.includes(path));
}

function isPotentialOfficialWebsite(url: string): boolean {
  if (
    !url ||
    isDirectoryDomain(url) ||
    isSocialDomain(url) ||
    isPublisherDomain(url) ||
    isArticleUrl(url) ||
    isContentSubdomain(url)
  ) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/* =========================================================
   5. TAVILY WITH BOUNDED TIMEOUT + RETRIES
========================================================= */

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tavilyRequest(path: string, body: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is missing in .env.local");

  let lastError: unknown;

  for (let attempt = 0; attempt <= TAVILY_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(`${TAVILY_API_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Tavily ${path} failed (${response.status}): ${errorText}`);
        // Do not waste retries on normal 4xx API validation/auth/quota responses.
        if (response.status >= 400 && response.status < 500) throw error;
        lastError = error;
      } else {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < TAVILY_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Tavily request failed: ${String(lastError)}`);
}

async function tavilySearch(
  query: string,
  maxResults = MAX_SEARCH_RESULTS,
  options: {
    country?: string;
    excludeDomains?: string[];
  } = {}
): Promise<any> {
  return tavilyRequest("/search", {
    query,
    search_depth: "basic",
    topic: "general",
    max_results: Math.min(maxResults, 20),
    ...(options.country ? { country: options.country } : {}),
    ...(options.excludeDomains?.length
      ? { exclude_domains: options.excludeDomains.slice(0, 150) }
      : {}),
  });
}

async function tavilyExtract(urls: string[], query: string): Promise<any> {
  const cleanUrls = [...new Set(urls.filter(Boolean).map(normalizeUrl))].slice(0, 20);
  if (!cleanUrls.length) return null;
  return tavilyRequest("/extract", {
    urls: cleanUrls,
    query,
    extract_depth: "basic",
    format: "text",
  });
}

/* =========================================================
   6. CONTACT EXTRACTION
========================================================= */

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&commat;|&#64;|&#x40;/gi, "@")
    .replace(/&period;|&#46;|&#x2e;/gi, ".")
    .replace(/&colon;|&#58;|&#x3a;/gi, ":")
    .replace(/&lpar;|&#40;|&#x28;/gi, "(")
    .replace(/&rpar;|&#41;|&#x29;/gi, ")")
    .replace(/&lsqb;|&#91;|&#x5b;/gi, "[")
    .replace(/&rsqb;|&#93;|&#x5d;/gi, "]")
    .replace(/&lbrace;|&#123;|&#x7b;/gi, "{")
    .replace(/&rbrace;|&#125;|&#x7d;/gi, "}");
}

function normalizeObfuscatedEmailText(value: string): string {
  let normalized = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ");

  // Common anti-spam formats:
  // info (at) company (dot) com
  // info [at] company [dot] com
  // info {at} company {dot} com
  // info at company dot com
  normalized = normalized
    .replace(/\s*(?:\(\s*at\s*\)|\[\s*at\s*\]|\{\s*at\s*\})\s*/gi, "@")
    .replace(/\s+(?:\bat\b)\s+/gi, "@")
    .replace(/\s*(?:\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\})\s*/gi, ".")
    .replace(/\s+(?:\bdot\b)\s+/gi, ".");

  return normalized;
}

function isValidBusinessEmail(email: string, website: string): boolean {
  const normalized = email
    .trim()
    .toLowerCase()
    .replace(/^mailto:/i, "")
    .replace(/[<>"'();,\s]+$/g, "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;

  const hostname = getHostname(website).replace(/^www\./, "");
  const domain = normalized.split("@")[1] ?? "";

  const invalidDomains = new Set([
    "example.com", "example.org", "example.net", "domain.com", "test.com",
  ]);

  if (!domain || invalidDomains.has(domain) || !domain.includes(".")) return false;

  // Reject obvious asset/image/document emails accidentally produced by parsing.
  if (/\.(png|jpg|jpeg|gif|svg|webp|pdf)$/i.test(normalized)) return false;

  // A valid email may be on a related corporate domain, so same-domain is
  // preferred later rather than mandatory here.
  void hostname;

  return true;
}

function decodeUnCryptMailto(value: string, shift: number): string {
  let decoded = "";

  for (const character of value) {
    let code = character.charCodeAt(0);
    if (code >= 8364) code = 128;
    decoded += String.fromCharCode(code - shift);
  }

  return decoded;
}

function extractEmailsFromObfuscatedLinks(text: string, website: string): string[] {
  const source = decodeHtmlEntities(text);
  const candidates: string[] = [];

  // Standard mailto links.
  for (const match of source.matchAll(/(?:href\s*=\s*["']?|["'])(mailto:[^"' >]+)/gi)) {
    const value = decodeURIComponent(match[1] || "").replace(/^mailto:/i, "");
    if (isValidBusinessEmail(value, website)) candidates.push(value);
  }

  // TYPO3 / similar anti-spam links:
  // javascript:linkTo_UnCryptMailto('...',-21)
  for (const match of source.matchAll(
    /linkTo_UnCryptMailto\s*\(\s*['"]([^'"]+)['"]\s*,?\s*(-?\d+)?\s*\)/gi
  )) {
    const encrypted = decodeURIComponent(match[1] || "");
    const shift = Number(match[2] ?? 0);

    if (Number.isFinite(shift)) {
      const decoded = decodeUnCryptMailto(encrypted, shift)
        .replace(/^mailto:/i, "")
        .trim();

      if (isValidBusinessEmail(decoded, website)) {
        candidates.push(decoded);
      }
    }

    // Some implementations omit the shift argument and use a fixed Caesar
    // offset. Try a small bounded range, but only keep values that become a
    // syntactically valid email.
    for (let candidateShift = -30; candidateShift <= 30; candidateShift++) {
      const decoded = decodeUnCryptMailto(encrypted, candidateShift)
        .replace(/^mailto:/i, "")
        .trim();

      if (isValidBusinessEmail(decoded, website)) {
        candidates.push(decoded);
      }
    }
  }

  return candidates;
}

function extractEmail(text: string, website: string): string {
  const normalizedText = normalizeObfuscatedEmailText(text);

  const rawMatches = normalizedText.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:co\.in|com|in|org|net|biz|io|co|ai|tech|info|edu|de|eu|uk)(?![A-Z0-9])/gi
  ) ?? [];

  const obfuscatedMatches = extractEmailsFromObfuscatedLinks(text, website);

  const allMatches = [
    ...rawMatches,
    ...obfuscatedMatches,
  ];

  const hostname = getHostname(website).replace(/^www\./, "");

  const emails = [...new Set(
    allMatches
      .map((email) =>
        email
          .toLowerCase()
          .trim()
          .replace(/^mailto:/i, "")
          .replace(/[<>"'();,\s]+$/g, "")
      )
      .filter((email) => isValidBusinessEmail(email, website))
  )];

  const sameDomain = emails.filter((email) =>
    email.endsWith(`@${hostname}`)
  );

  const pool = sameDomain.length ? sameDomain : emails;

  const preferredPrefixes = [
    "sales@", "info@", "contact@", "business@", "support@",
    "enquiry@", "enquiries@", "hello@", "admin@", "office@",
    "marketing@", "commercial@", "service@", "customer@",
  ];

  return (
    pool.find((email) =>
      preferredPrefixes.some((prefix) => email.startsWith(prefix))
    ) ||
    pool[0] ||
    ""
  );
}

function extractPhone(text: string): string {
  const source = decodeHtmlEntities(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/<br\s*\/?>/gi, " ");

  const candidates =
    source.match(
      /(?:\+|00)\d{1,3}[\s().-]*(?:\d[\s().-]*){8,14}|\(\d{2,5}\)[\s.-]*\d[\d\s().-]{6,13}|\b\d[\d\s().-]{8,14}\d\b/g
    ) ?? [];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const digits = trimmed.replace(/\D/g, "");

    // Reject numbers that are clearly too short/long.
    if (digits.length < 9 || digits.length > 15) continue;

    // Avoid dates, years and obvious non-phone numeric strings.
    if (/^(19|20)\d{2}$/.test(digits)) continue;
    if (/^0{6,}$/.test(digits)) continue;

    // Prefer international numbers when available.
    if (
      (/^\+/.test(trimmed) || /^00/.test(trimmed)) &&
      digits.length >= 10 &&
      digits.length <= 15
    ) {
      return trimmed;
    }

    // India mobile / landline fallback.
    if (
      digits.length === 10 &&
      /^[6-9]/.test(digits)
    ) {
      return trimmed;
    }

    if (
      digits.length === 11 &&
      /^0[1-9]/.test(digits)
    ) {
      return trimmed;
    }

    // Worldwide national-format phone fallback.
    if (digits.length >= 9 && digits.length <= 12) {
      return trimmed;
    }
  }

  return "";
}

function extractLocation(text: string): string {
  const lines = text.split("\n").map(cleanText).filter(Boolean);
  const strongPatterns = [
    /^address\s*:/i, /^office address\s*:/i, /^registered office\s*:/i,
    /^corporate office\s*:/i, /^head office\s*:/i, /^factory address\s*:/i,
    /^manufacturing address\s*:/i, /^location\s*:/i, /^headquarters\s*:/i, /^hq\s*:/i,
  ];

  for (const line of lines) {
    if (line.length <= 500 && strongPatterns.some((pattern) => pattern.test(line))) {
      return line.replace(/^(address|office address|registered office|corporate office|head office|factory address|manufacturing address|location|headquarters|hq)\s*:\s*/i, "");
    }
  }

  for (const line of lines) {
    if (line.length < 25 || line.length > 350) continue;
    const hasPostalCode = /\b\d{4,7}\b/.test(line);
    const hasAddressWord = /\b(street|road|rd\.|avenue|ave\.|industrial area|industrial estate|estate|park|boulevard|blvd|highway|building|block|floor|district|province|state|country|sector)\b/i.test(line);
    const looksLikeProjectDescription =
      /\b(is constructing|is developing|estimated to be|commissioned|supplies .* to industries|project|megawatt|mwp)\b/i.test(line);

    if (hasPostalCode && hasAddressWord && !looksLikeProjectDescription) return line;
  }

  return "";
}

/* =========================================================
   7. COMPANY IDENTITY
========================================================= */

function looksLikeCompanyName(value: string): boolean {
  const name = cleanText(value);
  if (!name || name.length < 3 || name.length > 120) return false;
  const normalized = normalizeName(name);

  if (GENERIC_NAME_PHRASES.some((phrase) => normalized.includes(normalizeName(phrase)))) return false;
  if (ARTICLE_TITLE_WORDS.some((word) => normalized.includes(normalizeName(word)))) return false;
  if (/^(find|explore|learn|discover|leading|best|top|how|why|what|group captive|statistics|market size)/i.test(name)) return false;
  if (normalized.split(" ").length > 9) return false;
  if (/^(logo|home|contact|about|products|solutions|services|welcome)$/i.test(normalized)) return false;
  return true;
}

function domainBrand(website: string): string {
  try {
    const host = new URL(website).hostname.replace(/^www\./i, "");
    const label = host.split(".")[0].replace(/[-_]+/g, " ").trim();
    return label.replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return "";
  }
}

function extractCompanyName(text: string, website: string): string {
  const lines = text.split("\n").map(cleanText).filter(Boolean);

  const explicitPatterns = [
    /^company name\s*[:\-]\s*/i,
    /^legal name\s*[:\-]\s*/i,
    /^registered name\s*[:\-]\s*/i,
    /^organisation\s*[:\-]\s*/i,
    /^organization\s*[:\-]\s*/i,
  ];

  for (const line of lines.slice(0, 160)) {
    for (const pattern of explicitPatterns) {
      const value = cleanText(line.replace(pattern, ""));
      if (looksLikeCompanyName(value)) return value;
    }
  }

  const legalPatterns = [
    /\bprivate limited\b/i, /\bpvt\.?\s*ltd\.?\b/i, /\blimited\b/i, /\bllp\b/i,
    /\binc\.?\b/i, /\bcorporation\b/i, /\bcorp\.?\b/i, /\bllc\b/i,
  ];

  // Legal identity beats page title. This is the main protection against article-title leakage.
  for (const line of lines.slice(0, 180)) {
    if (line.length <= 120 && looksLikeCompanyName(line) && legalPatterns.some((p) => p.test(line))) return line;
  }

  // Look for common footer/copyright identity.
  for (const line of lines.slice(-80)) {
    const copyright = line.match(/(?:©|copyright).*?\b((?:[A-Z][A-Za-z0-9&.'-]*\s+){1,8}(?:Ltd|Limited|LLP|Inc|Corporation|Corp|LLC))\b/i);
    if (copyright?.[1] && looksLikeCompanyName(copyright[1])) return copyright[1];
  }

  // A brand-like heading is acceptable only if it looks like an identity, not an article.
  const brandSignals = [
    "industries", "engineering", "machinery", "manufacturing", "technologies", "technology",
    "automation", "equipment", "systems", "controls", "motors", "industrial", "electronics",
    "energy", "power", "logistics", "renewables", "pharma", "textiles",
  ];

  for (const line of lines.slice(0, 80)) {
    if (line.length >= 3 && line.length <= 90 && looksLikeCompanyName(line) && brandSignals.some((word) => line.toLowerCase().includes(word))) {
      return line;
    }
  }

  // Safe fallback: domain brand, never a search/article title.
  return domainBrand(website);
}

/* =========================================================
   8. CUSTOMER / PROVIDER CLASSIFICATION
========================================================= */

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, keyword) => count + (lower.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function calculateCustomerScore(text: string): number {
  let score = 0;

  for (const keywords of Object.values(CUSTOMER_SEGMENTS)) {
    const matches = countKeywordMatches(text, keywords);
    if (matches >= 1) score += 2;
    if (matches >= 3) score += 2;
  }

  const useCaseMatches = countKeywordMatches(text, UCT_USE_CASE_SIGNALS);
  score += Math.min(useCaseMatches * 2, 12);

  return score;
}

function calculateProviderScore(text: string): number {
  return countKeywordMatches(text, PROVIDER_BUSINESS_SIGNALS);
}

function calculateNegativeScore(text: string): number {
  return countKeywordMatches(text, NEGATIVE_BUSINESS_SIGNALS);
}

function isLikelyPublisherOrResearchSite(
  website: string,
  text: string
): boolean {
  // Known publisher/research domains are always rejected.
  if (isPublisherDomain(website)) return true;

  const lower = text.toLowerCase();

  // Strong signals that the website itself is a publisher/content platform.
  const strongPublisherSignals = [
    "news portal",
    "news website",
    "news magazine",
    "industry news",
    "industry journal",
    "trade journal",
    "online magazine",
    "digital magazine",
    "editorial",
    "publisher",
    "publishing company",
    "media company",
    "media outlet",
    "press release",
    "press releases",
    "latest news",
    "breaking news",
    "news and analysis",
    "industry news and analysis",
    "articles and news",
    "journalism",
    "newsroom",
    "editorial team",
    "advertise with us",
    "write for us",
    "submit an article",
    "guest post",
    "sponsored article",
    "sponsored content",
  ];

  // Research / market-intelligence signals.
  const researchSignals = [
    "market research",
    "market research report",
    "research report",
    "industry report",
    "market report",
    "market analysis",
    "market intelligence",
    "industry analysis",
    "market size",
    "market forecast",
    "market forecast report",
    "industry forecast",
    "forecast period",
    "market trends",
    "research methodology",
    "research institute",
    "research organization",
    "custom research",
    "syndicated research",
    "competitive landscape",
  ];

  // Directory / third-party database signals.
  const directorySignals = [
    "business directory",
    "company directory",
    "company database",
    "business listings",
    "business listing",
    "find companies",
    "company profiles",
    "company profile",
    "supplier directory",
    "manufacturer directory",
    "industry directory",
    "verified suppliers",
    "lead database",
    "lead generation",
  ];

  // SEO / content / backlink signals.
  const contentMarketingSignals = [
    "backlink",
    "seo services",
    "guest blogging",
    "guest posting",
    "submit your article",
    "submit an article",
    "write an article",
    "content marketing",
    "sponsored posts",
    "link building",
  ];

  const countMatches = (signals: string[]): number =>
    signals.filter((signal) => lower.includes(signal)).length;

  const strongPublisherMatches =
    countMatches(strongPublisherSignals);

  const researchMatches =
    countMatches(researchSignals);

  const directoryMatches =
    countMatches(directorySignals);

  const contentMarketingMatches =
    countMatches(contentMarketingSignals);

  /*
   * A single industry keyword such as "refinery", "solar",
   * "factory", etc. must NEVER override publisher detection.
   *
   * Example:
   * OGJ article contains "refinery"
   * but OGJ is still a journal/publisher.
   */

  if (strongPublisherMatches >= 1) {
    return true;
  }

  if (researchMatches >= 2) {
    return true;
  }

  if (directoryMatches >= 1) {
    return true;
  }

  if (contentMarketingMatches >= 1) {
    return true;
  }

  /*
   * Multiple weaker signals together are enough to identify
   * a content/research website.
   */
  const totalContentSignals =
    strongPublisherMatches +
    researchMatches +
    directoryMatches +
    contentMarketingMatches;

  if (totalContentSignals >= 2) {
    return true;
  }

  return false;
}

function hasNonCustomerOrganizationType(text: string): boolean {
  const lower = text.toLowerCase();
  return NON_CUSTOMER_ORGANIZATION_SIGNALS.some((signal) => lower.includes(signal));
}

function hasHardRejectOrganizationType(text: string): boolean {
  const lower = text.toLowerCase();
  return HARD_REJECT_ORGANIZATION_SIGNALS.some((signal) => lower.includes(signal));
}

function hasCompetitorPrimaryBusiness(text: string): boolean {
  const lower = text.toLowerCase();
  const matches = COMPETITOR_PRIMARY_SIGNALS.filter((signal) => lower.includes(signal)).length;
  return matches >= 1;
}

function calculatePartnerScore(text: string): number {
  return countKeywordMatches(text, PARTNER_BUSINESS_SIGNALS);
}

function hasPotentialPartnerBusiness(text: string): boolean {
  return calculatePartnerScore(text) >= 1;
}

function hasExplicitIndustrialEndUserIdentity(text: string): boolean {
  const lower = text.toLowerCase();
  const signals = [
    "manufacturer", "manufacturing plant", "manufacturing facility",
    "production plant", "production facility", "factory", "factories",
    "warehouse operator", "warehousing services", "3pl", "logistics services",
    "fleet operator", "transport operator", "power plant operator",
    "solar plant operator", "solar farm operator", "refinery operator",
    "mine operator", "quarry operator", "hospital", "healthcare facility",
    "farm operator", "greenhouse operator", "facility management",
    "water treatment operator", "wastewater treatment operator",
  ];
  return signals.some((signal) => lower.includes(signal));
}

function hasStrongPhysicalOperations(text: string): boolean {
  const lower = text.toLowerCase();
  const signals = [
    "factory", "manufacturing plant", "production plant", "production facility",
    "warehouse", "distribution center", "distribution centre", "fleet",
    "power plant", "solar plant", "refinery", "mine", "quarry", "hospital",
    "manufacturing facility", "industrial facility", "processing plant",
  ];
  return signals.filter((signal) => lower.includes(signal)).length >= 1;
}

function isPotentialCustomerText(text: string): boolean {
  const value = text.toLowerCase();

  return Object.values(CUSTOMER_SEGMENTS)
    .flat()
    .some((signal) => value.includes(signal));
}

function isPotentialUCTCustomer(text: string): boolean {
  const customerScore = calculateCustomerScore(text);
  const providerScore = calculateProviderScore(text);
  const negativeScore = calculateNegativeScore(text);

  const strongPhysicalOperations = hasStrongPhysicalOperations(text);
  const explicitEndUser = hasExplicitIndustrialEndUserIdentity(text);

  /*
   * HARD REJECT
   *
   * Only organization types that are clearly not commercial prospects
   * should be rejected here.
   */
  if (hasHardRejectOrganizationType(text)) return false;

  /*
   * INFORMATION / RESEARCH / ASSOCIATION
   *
   * These are rejected unless the organization itself clearly operates
   * a physical facility.
   */
  if (
    hasNonCustomerOrganizationType(text) &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return false;
  }

  /*
   * COMPETITOR / TECHNOLOGY PROVIDER
   *
   * A company can contain provider/technology language and still be
   * a genuine UCT prospect if it operates factories, plants, warehouses,
   * fleets, utilities, solar assets, etc.
   */
  if (
    hasCompetitorPrimaryBusiness(text) &&
    !strongPhysicalOperations &&
    !explicitEndUser &&
    !hasPotentialPartnerBusiness(text)
  ) {
    return false;
  }

  /*
   * PROVIDER SCORE
   *
   * Provider language alone must never reject a real physical operator.
   */
  if (
    providerScore >= 2 &&
    customerScore < 14 &&
    !strongPhysicalOperations &&
    !explicitEndUser &&
    !hasPotentialPartnerBusiness(text)
  ) {
    return false;
  }

  /*
   * NEGATIVE SIGNALS
   *
   * Negative signals can reject generic/non-customer pages, but physical
   * operators get priority.
   */
  if (
    negativeScore >= 2 &&
    customerScore < 12 &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return false;
  }

  /*
   * Minimum customer evidence.
   *
   * A clear factory/plant/warehouse/fleet/operator is already strong
   * customer evidence, even if the website uses different terminology.
   */
  if (
    customerScore < 8 &&
    !strongPhysicalOperations &&
    !explicitEndUser &&
    !hasPotentialPartnerBusiness(text)
  ) {
    return false;
  }

  return (
    strongPhysicalOperations ||
    explicitEndUser ||
    customerScore >= 8 ||
    hasPotentialPartnerBusiness(text)
  );
}

function getCustomerRejectionReason(text: string): string {
  const customerScore = calculateCustomerScore(text);
  const providerScore = calculateProviderScore(text);
  const negativeScore = calculateNegativeScore(text);

  const strongPhysicalOperations = hasStrongPhysicalOperations(text);
  const explicitEndUser = hasExplicitIndustrialEndUserIdentity(text);

  if (hasHardRejectOrganizationType(text)) {
    return "hard-reject organization type";
  }

  if (
    hasNonCustomerOrganizationType(text) &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return "information/research/association organization without physical operation";
  }

  if (
    hasCompetitorPrimaryBusiness(text) &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return "technology provider/competitor without clear end-user operation";
  }

  if (
    providerScore >= 2 &&
    customerScore < 14 &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return "provider-heavy website without strong physical operation";
  }

  if (
    negativeScore >= 2 &&
    customerScore < 12 &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return "negative customer signals";
  }

  if (
    customerScore < 8 &&
    !strongPhysicalOperations &&
    !explicitEndUser
  ) {
    return "insufficient customer evidence";
  }

  return "does not meet UCT customer qualification criteria";
}

function emitLeadRejected(
  onEvent: ResearchRunOptions["onEvent"],
  website: string,
  reason: string
): void {
  emitResearchEvent(
    onEvent,
    "rejected",
    `Lead rejected: ${reason} → ${website}`
  );
}


async function saveVerifiedLeadImmediately(
  lead: SectorLead,
  onEvent: ResearchRunOptions["onEvent"],
  websiteForMessage: string
): Promise<boolean> {
  try {
    const saveResult = await addLeads([
      lead as unknown as ResearchLead,
    ]);

    const saved = Number(saveResult?.saved || 0);
    const duplicates = Number(saveResult?.duplicates || 0);

    if (saved > 0) {
      return true;
    }

    if (duplicates > 0) {
      emitDuplicateNotice(
        onEvent,
        `Lead already exists: ${websiteForMessage}`,
        websiteForMessage
      );
    }

    emitResearchEvent(
      onEvent,
      "skipped",
      `Lead was not saved${duplicates > 0 ? " (duplicate)" : ""}: ${websiteForMessage}`
    );

    return false;
  } catch (error) {
    console.error(`Immediate lead save failed for ${websiteForMessage}:`, error);

    emitResearchEvent(
      onEvent,
      "error",
      `Database save failed: ${websiteForMessage}`
    );

    return false;
  }
}

/* =========================================================
   9. LOCATION PARSING
========================================================= */

function extractRequestedLocation(prompt: string): string {
  const match = prompt.match(/\b(?:in|from|near|around|based in|located in)\s+([A-Za-z][A-Za-z\s,-]{2,60}?)(?:\.|$)/i);
  if (!match?.[1]) return "";

  return match[1]
    .replace(/\b(potential customers|customers|companies|businesses|official website|website)\b/gi, "")
    .replace(/[,.]+$/, "")
    .trim();
}

function locationMatchesPrompt(text: string, prompt: string): boolean {
  const requested = extractRequestedLocation(prompt);
  if (!requested) return true;

  const lowerText = text.toLowerCase();
  const tokens = requested.toLowerCase().split(/[\s,-]+/).filter((token) => token.length >= 3);
  if (!tokens.length) return true;

  // Require at least one strong location token. Search query itself already narrows the geography.
  return tokens.some((token) => lowerText.includes(token));
}


function isPlausibleBusinessLocation(location: string): boolean {
  if (!location) return true;

  const value = location.toLowerCase();

  // Reject obvious project/news/notice descriptions accidentally extracted as locations.
  if (/\b(is constructing|is developing|estimated to be|commissioned|notice inviting|sale of|supplies .* to industries|project|megawatt|mwp)\b/i.test(value)) {
    return false;
  }

  return location.length >= 5 && location.length <= 500;
}

/* =========================================================
   10. OFFICIAL WEBSITE / IDENTITY VERIFICATION
========================================================= */

function calculateIdentityScore(candidateName: string, website: string, websiteText: string): number {
  const tokens = getNameTokens(candidateName);
  if (!tokens.length) return 0;

  const text = websiteText.toLowerCase();
  const domainTokens = getNameTokens(getHostname(website).replace(/^www\./, "").split(".")[0].replace(/[-_]+/g, " "));
  let score = 0;

  for (const token of tokens) {
    if (text.includes(token)) score += 2;
    if (domainTokens.includes(token)) score += 5;
  }
  return score;
}

function websiteIdentityMatches(candidateName: string, website: string, websiteText: string): boolean {
  if (!looksLikeCompanyName(candidateName)) return false;
  const tokens = getNameTokens(candidateName);
  if (!tokens.length) return false;

  const score = calculateIdentityScore(candidateName, website, websiteText);
  return tokens.length >= 2 ? score >= 4 : score >= 6;
}

function getCompanyPages(website: string): string[] {
  const origin = getOrigin(website);
  if (!origin) return [];
  return [
    origin,
    `${origin}/contact`, `${origin}/contact-us`, `${origin}/about`, `${origin}/about-us`,
    `${origin}/company`, `${origin}/products`, `${origin}/solutions`,
  ];
}

async function verifyOfficialWebsite(
  candidateName: string,
  website: string,
  prompt: string
): Promise<boolean> {
  if (
    !isPotentialOfficialWebsite(website) ||
    !looksLikeCompanyName(candidateName)
  ) {
    return false;
  }

  try {
    const extracted = await tavilyExtract(
      getCompanyPages(website).slice(0, 5),
      `Verify whether this URL is the PRIMARY OFFICIAL WEBSITE of the actual company "${candidateName}".

CRITICAL WEBSITE AUTHENTICITY RULE:

The website itself must belong to the actual operating company being researched.

First classify the website.

REJECT COMPLETELY if the website is primarily:
- a news website
- industry news
- a magazine
- an industry journal
- a media outlet
- a publisher
- a blog
- an article/content website
- an editorial website
- a press-release website
- an information portal
- an industry information portal
- a market research or market intelligence website
- a research/report publisher
- a business directory
- a company directory
- a business listing website
- a lead-generation website
- a company database
- a backlink or SEO website
- a job portal
- a career portal
- a social-media website
- a third-party company profile
- any other third-party content website

IMPORTANT:

A website that publishes information ABOUT an industry is NOT itself an operating company in that industry.

For example:
- An oil & gas journal publishing an article about a refinery → REJECT the journal.
- An energy news website publishing information about a solar company → REJECT the news website.
- An industry magazine publishing information about a factory → REJECT the magazine.
- A directory listing an oil refinery → REJECT the directory.
- An article mentioning a refinery company → REJECT the article website.

NEVER extract the company mentioned inside an article and treat the publisher as the company.

The website owner itself must be the actual company being researched.

Do not qualify a website merely because it contains keywords such as:
oil, petroleum, refinery, solar, energy, manufacturing, factory, IoT, industrial, automation, or technology.

Keywords alone are NOT evidence that the website owner operates in that industry.

Verify:
1. The actual company/brand name.
2. What the company itself does.
3. Its actual industry/business activity.
4. Its physical operations, facilities, plants, assets or projects where applicable.
5. Its business location.
6. Its business contact information.
7. Whether the supplied domain is genuinely the company's primary official domain.

For the requested research topic, verify that the COMPANY ITSELF is relevant.

For oil refinery research:
The company itself must own, operate, develop or have a clearly verified petroleum/oil refining operation.

For solar energy research:
The company itself must own, operate, develop, install, maintain or manage a clearly verified solar energy operation or solar infrastructure.

Do not qualify a company merely because it:
- mentions the industry,
- publishes information about the industry,
- has an industry-related customer,
- sells unrelated products,
- appears in an industry article,
- or is mentioned by another company.

If the website is a publisher, news organization, magazine, journal, blog, directory, media outlet or third-party information source, RETURN NULL.

If the company identity or website authenticity is uncertain, RETURN NULL.

NEVER convert uncertainty into a lead.

Return information only when the supplied URL is the actual primary official website of the relevant company.`
    );

    const text = Array.isArray(extracted?.results)
      ? extracted.results
          .map((item: any) => item?.raw_content || "")
          .join("\n")
      : "";

    if (!text.trim()) return false;

    if (!websiteIdentityMatches(candidateName, website, text)) {
      return false;
    }

    if (!locationMatchesPrompt(text, prompt)) {
      return false;
    }

    return isPotentialUCTCustomer(text);
  } catch {
    return false;
  }
}



async function findOfficialWebsite(
  candidateName: string,
  prompt: string,
  knownLeadKeys?: LeadKeySets,
  excludedWebsites?: Set<string>
): Promise<string> {
  if (!looksLikeCompanyName(candidateName)) return "";

  const requestedLocation = extractRequestedLocation(prompt);
  const queries = [
    `"${candidateName}" official website`,
    `"${candidateName}" official company`,
    `"${candidateName}" contact`,
  ];

  if (requestedLocation) {
    queries.unshift(
      `"${candidateName}" ${requestedLocation} official website`
    );
  }

  for (const query of queries) {
    try {
      const data = await tavilySearch(query, 5, {
        excludeDomains: buildDynamicSearchExclusions(
          knownLeadKeys,
          excludedWebsites
        ),
      });

      const results = Array.isArray(data?.results) ? data.results : [];

      const candidates = results
        .filter((result: any) => result?.url)
        .map((result: any) => {
          const rawUrl = String(result.url);
          const title = String(result.title || "");
          const content = String(result.content || "");
          const combined = `${title} ${content}`;

          return {
            url: getOrigin(rawUrl),
            title,
            content,
            combined,
            score: Number(result.score || 0),
          };
        })
        .filter(
          (candidate: any) =>
            candidate.url &&
            isPotentialOfficialWebsite(candidate.url) &&
            !isLikelyPublisherOrResearchSite(
              candidate.url,
              candidate.combined
            )
        )
        .map((candidate: any) => {
          const tokens = getNameTokens(candidateName);
          let score = candidate.score;

          for (const token of tokens) {
            if (candidate.combined.toLowerCase().includes(token)) {
              score += 2;
            }

            if (getHostname(candidate.url).includes(token)) {
              score += 5;
            }
          }

          if (
            requestedLocation &&
            candidate.combined
              .toLowerCase()
              .includes(requestedLocation.toLowerCase())
          ) {
            score += 1.5;
          }

          return { ...candidate, score };
        })
        .sort((a: any, b: any) => b.score - a.score);

      for (const candidate of candidates.slice(0, 3)) {
        const candidateDomain = normalizeDomainKey(candidate.url);

        if (isExcludedWebsite(candidate.url, excludedWebsites)) {
          continue;
        }

        if (
          candidateDomain &&
          knownLeadKeys?.websites.has(candidateDomain)
        ) {
          continue;
        }

        if (
          await verifyOfficialWebsite(
            candidateName,
            candidate.url,
            prompt
          )
        ) {
          return candidate.url;
        }
      }
    } catch (error) {
      console.error(
        `Official website search failed for ${candidateName}:`,
        error
      );
    }
  }

  return "";
}

/* =========================================================
   11. VERIFIED COMPANY EXTRACTION
========================================================= */
function classifySector(text: string): string {
  const value = text.toLowerCase();

  const rules: Array<{ sector: string; primary: string[]; secondary: string[]; penalty?: string[] }> = [
    { sector: "Warehouse / Logistics / 3PL", primary: [
      "logistics company", "logistics services", "3pl", "warehousing services", "warehouse operator",
      "distribution center", "distribution centre", "supply chain company", "freight forwarding", "contract logistics",
      "logistics provider", "third party logistics", "third-party logistics",
    ], secondary: ["warehouse", "warehousing", "logistics", "fulfillment", "fulfilment", "cold storage"], penalty: ["automotive manufacturer", "auto component manufacturer"] },
    { sector: "Fleet / Transportation", primary: [
      "transportation company", "transport company", "fleet operator", "trucking company", "bus operator",
      "rail operator", "shipping company", "port operator", "terminal operator", "transport operator",
      "fleet management company", "fleet services",
    ], secondary: ["fleet", "trucking", "transportation", "shipping", "mobility"], penalty: ["automotive manufacturer", "auto component manufacturer"] },
    { sector: "Solar / Renewable Energy", primary: [
      "solar power company", "solar energy company", "solar developer", "solar power developer", "solar plant operator",
      "solar farm operator", "renewable energy company", "renewable energy developer", "renewable power company",
      "solar epc company", "solar power producer",
    ], secondary: ["solar", "solar plant", "solar farm", "renewable energy", "wind power"] },
    { sector: "Oil & Gas / Refinery", primary: [
      "oil and gas company", "oil & gas company", "oil company", "gas company", "refinery operator", "petroleum company",
      "pipeline operator", "oil refinery", "gas refinery",
    ], secondary: ["oil and gas", "oil & gas", "petroleum", "refinery", "pipeline", "drilling"] },
    { sector: "Mining / Mineral Processing", primary: ["mining company", "mining operator", "mine operator", "mineral processing company", "quarry operator"], secondary: ["mining", "mine", "mineral processing", "quarry"] },
    { sector: "Greenhouse / Hydroponics", primary: ["greenhouse operator", "greenhouse farming", "hydroponic farm", "hydroponics farm"], secondary: ["greenhouse", "hydroponics"] },
    { sector: "Agriculture / Smart Farming", primary: ["agriculture company", "agricultural company", "smart farming company", "agritech company", "farm operator", "precision agriculture"], secondary: ["agriculture", "smart farming", "agritech", "farm operations", "irrigation"] },
    { sector: "Healthcare Facility", primary: ["hospital", "healthcare facility", "medical center", "medical centre", "clinic", "healthcare provider"], secondary: ["hospital", "healthcare", "patient care", "clinical"] },
    { sector: "Medical Equipment Operations", primary: ["medical equipment manufacturer", "medical device manufacturer", "diagnostic equipment manufacturer", "laboratory equipment manufacturer"], secondary: ["medical equipment", "medical device", "diagnostic equipment", "laboratory equipment"] },
    { sector: "Automotive Manufacturing", primary: [
      "automotive manufacturer", "automobile manufacturer", "auto component manufacturer", "automotive components manufacturer",
      "vehicle manufacturer", "vehicle manufacturing", "automotive parts manufacturer", "auto parts manufacturer",
      "automotive components", "auto components", "automotive parts",
    ], secondary: ["automotive", "automobile", "auto component", "auto components", "auto parts", "vehicle manufacturing"], penalty: ["logistics company", "3pl", "fleet operator", "transportation company"] },
    { sector: "Pharmaceutical Manufacturing", primary: ["pharmaceutical manufacturer", "pharmaceutical manufacturing", "pharma manufacturer", "pharma manufacturing", "drug manufacturer", "drug manufacturing"], secondary: ["pharmaceutical", "pharma", "drug manufacturing"] },
    { sector: "Textile Manufacturing", primary: ["textile manufacturer", "textile manufacturing", "textile mill", "spinning mill", "weaving mill", "knitting mill", "garment manufacturer", "garment manufacturing"], secondary: ["textile", "spinning", "weaving", "knitting", "garment", "fabric"] },
    { sector: "Food & Beverage Manufacturing", primary: ["food manufacturer", "food manufacturing", "food processing company", "beverage manufacturer", "beverage manufacturing", "dairy processing company"], secondary: ["food processing", "beverage", "dairy"] },
    { sector: "Packaging Manufacturing", primary: ["packaging manufacturer", "packaging manufacturing", "packaging plant", "corrugated box manufacturer", "carton manufacturer"], secondary: ["packaging", "corrugated", "carton"] },
    { sector: "Plastic & Rubber Manufacturing", primary: ["plastic manufacturer", "plastic manufacturing", "rubber manufacturer", "rubber manufacturing", "polymer manufacturer", "polymer manufacturing"], secondary: ["plastic", "rubber", "polymer"] },
    { sector: "Chemical Manufacturing", primary: ["chemical manufacturer", "chemical manufacturing", "chemical plant", "specialty chemicals manufacturer"], secondary: ["chemical", "chemicals"] },
    { sector: "Steel & Metal Manufacturing", primary: ["steel manufacturer", "steel manufacturing", "steel plant", "metal manufacturer", "metal manufacturing", "metal fabrication company", "iron and steel manufacturer"], secondary: ["steel", "metal fabrication", "iron and steel"] },
    { sector: "Cement & Building Materials", primary: ["cement manufacturer", "cement manufacturing", "cement plant", "concrete manufacturer", "building materials manufacturer"], secondary: ["cement", "concrete", "building materials"] },
    { sector: "Glass Manufacturing", primary: ["glass manufacturer", "glass manufacturing", "glass plant"], secondary: ["glass manufacturing", "glass"] },
    { sector: "Paper Manufacturing", primary: ["paper manufacturer", "paper manufacturing", "paper mill"], secondary: ["paper mill", "paper manufacturing"] },
    { sector: "Electronics Manufacturing", primary: ["electronics manufacturer", "electronics manufacturing", "electronic manufacturer", "pcb manufacturer", "pcb manufacturing", "semiconductor manufacturer", "semiconductor manufacturing"], secondary: ["electronics", "pcb", "semiconductor"] },
    { sector: "Electrical Manufacturing", primary: ["electrical equipment manufacturer", "electrical equipment manufacturing", "electrical manufacturer", "electrical manufacturing"], secondary: ["electrical equipment", "electrical manufacturing"] },
    { sector: "Battery Manufacturing", primary: ["battery manufacturer", "battery manufacturing", "battery plant", "energy storage manufacturer", "energy storage manufacturing"], secondary: ["battery", "energy storage"] },
    { sector: "Building / Facility Management", primary: ["facility management company", "facility management services", "building management company", "building automation company"], secondary: ["facility management", "facility operations", "building automation", "building management"] },
    { sector: "Smart Infrastructure", primary: ["smart infrastructure operator", "water utility", "water treatment operator", "wastewater treatment operator", "infrastructure operator"], secondary: ["smart infrastructure", "water treatment", "wastewater", "infrastructure operator"] },
    { sector: "Energy / Utilities", primary: ["power utility", "electric utility", "utility company", "power generation company", "power plant operator", "energy utility"], secondary: ["power plant", "power generation", "utility", "energy infrastructure"] },
    { sector: "Machinery & Equipment", primary: ["machinery manufacturer", "machinery manufacturing", "machine builder", "machine building", "equipment manufacturer", "equipment manufacturing", "industrial equipment manufacturer"], secondary: ["machinery", "industrial machinery", "equipment manufacturing"] },
    { sector: "Industrial Engineering", primary: ["industrial engineering company", "industrial engineering", "engineering works", "engineering plant"], secondary: ["engineering", "industrial engineering"] },
  ];

  const scored = rules.map((rule, index) => {
    const primaryMatches = rule.primary.filter((keyword) => value.includes(keyword)).length;
    const secondaryMatches = rule.secondary.filter((keyword) => value.includes(keyword)).length;
    const penaltyMatches = rule.penalty?.filter((keyword) => value.includes(keyword)).length ?? 0;

    // Primary identity dominates. Secondary keywords are deliberately weak so
    // incidental mentions such as "automotive customers" do not change sector.
    let score = primaryMatches * 20 + Math.min(secondaryMatches, 4) * 2 - penaltyMatches * 8;

    // Explicit industry phrases get an extra tie-break advantage.
    if (rule.sector === "Automotive Manufacturing" && /automotive components|auto components|automotive parts|auto parts/.test(value)) score += 8;
    if (rule.sector === "Warehouse / Logistics / 3PL" && /logistics services|3pl|warehouse operator|contract logistics/.test(value)) score += 8;
    if (rule.sector === "Fleet / Transportation" && /fleet operator|transport operator|fleet management company/.test(value)) score += 8;

    return { sector: rule.sector, score, primaryMatches, secondaryMatches, index };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return scored[0]?.sector || "Industrial / Manufacturing";
}

type SectorLead = Omit<ResearchLead, "companyName"> & { sector: string };

async function fetchPageHtml(url: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; UCT-ResearchBot/1.0; +https://www.uniconvergetech.in/)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
      REQUEST_TIMEOUT_MS
    );

    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return "";
    }

    return await response.text();
  } catch {
    return "";
  }
}

async function fetchOfficialContactHtml(website: string): Promise<string> {
  const origin = getOrigin(website);
  if (!origin) return "";

  const pages = [
    ...getCompanyPages(website),
    `${origin}/contact`,
    `${origin}/contact-us`,
    `${origin}/contactus`,
    `${origin}/about`,
    `${origin}/about-us`,
    `${origin}/company`,
    `${origin}/support`,
    `${origin}/sales`,
    `${origin}/locations`,
    `${origin}/branches`,
    `${origin}/offices`,
  ];

  const uniquePages = [...new Set(pages)].slice(0, 12);

  const htmlResults = await Promise.all(
    uniquePages.map((page) => fetchPageHtml(page))
  );

  return htmlResults.filter(Boolean).join("\n");
}

async function extractVerifiedCompany(
  website: string,
  prompt: string,
  expectedName?: string,
  onEvent?: ResearchRunOptions["onEvent"]
): Promise<SectorLead | null> {
  if (!isPotentialOfficialWebsite(website)) return null;

  try {
    const data = await tavilyExtract(
      getCompanyPages(website),
      `
EXTRACT ONLY VERIFIED FACTS FROM THE ACTUAL COMPANY'S PRIMARY OFFICIAL WEBSITE.

CRITICAL WEBSITE AUTHENTICITY RULE:
The supplied URL must belong to the actual operating company.

REJECT COMPLETELY if it is:
- news, media, magazine or industry journal
- publisher or editorial website
- blog or article/content website
- press-release or information portal
- market research/intelligence website
- research/report publisher
- business/company directory
- lead-generation or company database
- backlink/SEO website
- job/career portal
- social-media website
- third-party company profile

A website publishing information ABOUT an oil refinery, solar plant, factory or another company is NOT that company.

NEVER turn an article title, customer name, partner name, author name or publisher name into the company identity.

The website owner itself must be the relevant business.

INDUSTRY AUTHENTICITY:
Do not qualify a company only because keywords such as oil, refinery, solar, energy, manufacturing, factory, industrial, IoT or automation appear.

For oil/refinery research, verify that the company itself owns, operates, develops or manages an actual petroleum/oil refining operation.

For solar research, verify that the company itself owns, operates, develops, installs, maintains or manages genuine solar energy infrastructure or solar power operations.

If the company identity or business activity is uncertain, return no company data.

CONTACT REQUIREMENT — BOTH ARE MANDATORY:
You MUST actively search the official website's contact, about, locations, office, support and footer information for BOTH:
1. a real business email address
2. a real business phone number

Do not stop after finding only one.

Use only contact details belonging to the company that owns this official domain.

Do NOT use:
- journalist/author emails
- article author contact details
- partner/customer contacts
- directory contacts
- third-party contacts
- unrelated phone numbers

If an email is missing from the homepage, check official contact/about/location pages.
If a phone number is missing from the homepage, check official contact/about/location/footer pages.
If either email OR phone cannot be verified from the company's own official website, return no company data.

EXTRACT:
- actual company/brand name
- actual business activity
- industry
- physical plants/factories/refineries/solar facilities/warehouses/fleets where applicable
- business address/location
- business phone number
- business email address

NEVER convert uncertainty into a lead.
      `
    );

    const results = Array.isArray(data?.results) ? data.results : [];
    const websiteText = results
      .map((result: any) => result?.raw_content || "")
      .filter(Boolean)
      .join("\n");

    if (!websiteText.trim()) {
      emitLeadRejected(
        onEvent,
        website,
        "official website returned no usable content"
      );
      return null;
    }

    if (isLikelyPublisherOrResearchSite(website, websiteText)) {
      emitLeadRejected(
        onEvent,
        website,
        "publisher/research/information site"
      );
      return null;
    }

    if (!isPotentialUCTCustomer(websiteText)) {
      emitLeadRejected(
        onEvent,
        website,
        getCustomerRejectionReason(websiteText)
      );
      return null;
    }

    if (!locationMatchesPrompt(websiteText, prompt)) {
      emitLeadRejected(
        onEvent,
        website,
        "location does not match requested location"
      );
      return null;
    }

    if (
      expectedName &&
      !websiteIdentityMatches(
        expectedName,
        website,
        websiteText
      )
    ) {
      emitLeadRejected(
        onEvent,
        website,
        "official company identity could not be verified"
      );
      return null;
    }

    // First pass: Tavily extracted official pages.
    let email = extractEmail(websiteText, website);
    let phone = extractPhone(websiteText);

    // Second pass: fetch official HTML because Tavily can remove
    // mailto/javascript attributes and formatted phone numbers.
    if (!email || !phone) {
      const contactHtml = await fetchOfficialContactHtml(website);

      if (contactHtml) {
        if (!email) {
          email = extractEmail(contactHtml, website);
        }

        if (!phone) {
          phone = extractPhone(contactHtml);
        }
      }
    }

    // Third pass: explicitly extract the official contact pages again
    // through Tavily when one of the two mandatory contacts is still missing.
    if (!email || !phone) {
      const contactPages = [
        ...getCompanyPages(website),
        `${getOrigin(website)}/contact`,
        `${getOrigin(website)}/contact-us`,
        `${getOrigin(website)}/about`,
        `${getOrigin(website)}/locations`,
      ];

      const contactData = await tavilyExtract(
        [...new Set(contactPages)].slice(0, 12),
        `Find ONLY the official company's own contact information.

Return factual contact information belonging to the company that owns this website.

Find BOTH:
- business email address
- business phone number

Search the homepage, contact page, about page, office/location page and footer.

Do not use author, journalist, partner, customer, directory or third-party contact details.

If either contact cannot be verified from this official domain, do not invent it.`
      );

      const contactResults = Array.isArray(contactData?.results)
        ? contactData.results
        : [];

      const contactText = contactResults
        .map((result: any) => result?.raw_content || "")
        .filter(Boolean)
        .join("\n");

      if (contactText) {
        if (!email) {
          email = extractEmail(contactText, website);
        }

        if (!phone) {
          phone = extractPhone(contactText);
        }
      }
    }

    const location = extractLocation(websiteText);
    // Website + Email OR Website + Phone = valid lead.
// Website without either contact method = reject.
if (!website || (!email && !phone)) {
  emitLeadRejected(
    onEvent,
    website,
    "website required and either business email or phone must be found"
  );
  return null;
}

    if (location && !isPlausibleBusinessLocation(location)) {
      emitLeadRejected(
        onEvent,
        website,
        "invalid business location"
      );
      return null;
    }

    // Website + Email OR Website + Phone = valid lead.
    // We actively search for both, but only one verified contact is required.
    if (!website || (!email && !phone)) {
      emitLeadRejected(
        onEvent,
        website,
        "website required and either business email or phone must be found"
      );
      return null;
    }

    if (email && !isValidBusinessEmail(email, website)) {
      emitLeadRejected(
        onEvent,
        website,
        "invalid business email"
      );
      return null;
    }

    if (phone && phone.replace(/\D/g, "").length < 9) {
      emitLeadRejected(
        onEvent,
        website,
        "invalid business phone"
      );
      return null;
    }

    return {
      sector: classifySector(websiteText),
      website: normalizeUrl(website),
      location,
      phone,
      email,
      googleBusinessProfile: "",
    };
  } catch (error) {
    console.error(
      `Verified company extraction failed for ${website}:`,
      error
    );
    return null;
  }
}
function leadCompleteness(lead: SectorLead): number {
  let score = 0;

  if (lead.website) score += 4;
  if (lead.email) score += 3;
  if (lead.phone) score += 2;
  if (lead.sector) score += 1;

  return score;
}

function deduplicateLeads(leads: SectorLead[]): SectorLead[] {
  const byWebsite = new Map<string, SectorLead>();

  for (const lead of leads) {
    const key = normalizeDomainKey(lead.website);
    if (!key) continue;

    const existing = byWebsite.get(key);
    if (!existing || leadCompleteness(lead) > leadCompleteness(existing)) {
      byWebsite.set(key, lead);
    }
  }

  return [...byWebsite.values()];
}

/* =========================================================
   17. FINAL QUALITY GATE
========================================================= */

function finalQualityGate(lead: SectorLead): boolean {
  if (
    !lead.sector ||
    !lead.website ||
    !isPotentialOfficialWebsite(lead.website)
  ) {
    return false;
  }

  // At least one verified business contact is required.
  if (!lead.email && !lead.phone) {
    return false;
  }

  if (lead.location && !isPlausibleBusinessLocation(lead.location)) {
    return false;
  }

  if (lead.email && !isValidBusinessEmail(lead.email, lead.website)) {
    return false;
  }

  if (lead.phone) {
    const phoneDigits = lead.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      return false;
    }
  }

  return true;
}

/* =========================================================
   14. DIRECT DISCOVERY
========================================================= */

/* =========================================================
   12. SEARCH QUERY GENERATION

   Important: do NOT send the entire natural-language prompt as every query.
   Convert "Find potential customers in India" into targeted discovery queries.
========================================================= */

const DISCOVERY_QUERY_GROUPS = [
  ["manufacturing companies", "factories", "industrial plants", "heavy engineering"],
  ["automotive manufacturers", "auto component manufacturers", "machinery manufacturers"],
  ["chemical manufacturers", "petrochemical companies", "oil and gas companies", "refineries"],
  ["steel manufacturers", "cement manufacturers", "plastic manufacturers", "process industries"],
  ["solar companies", "solar power plants", "renewable energy companies", "power generation"],
  ["utilities", "energy management", "battery energy storage", "BESS", "EV charging"],
  ["green hydrogen", "bioenergy", "waste to energy", "energy infrastructure"],
  ["smart city", "building automation", "smart lighting", "water treatment", "wastewater"],
  ["warehouses", "logistics companies", "3PL companies", "cold chain", "distribution centers"],
  ["fleet operators", "transportation companies", "shipping", "ports", "asset tracking"],
  ["IoT companies", "IIoT companies", "industrial automation", "embedded systems"],
  ["electronics companies", "telecom companies", "system integrators", "OEM ODM"],
  ["agriculture companies", "smart agriculture", "irrigation", "greenhouse", "AgriTech"],
  ["hospitals", "healthcare facilities", "medical infrastructure", "medical equipment"],
];

function buildSearchQueries(prompt: string): string[] {
  const location = extractRequestedLocation(prompt);
  const normalized = prompt.toLowerCase();
  const isIndia = /\bindia\b/.test(normalized) || location.toLowerCase() === "india";
  const suffix = location ? ` in ${location}` : "";

  const queries: string[] = [];

  const add = (query: string) => {
    const clean = query.replace(/\s+/g, " ").trim();
    if (clean && !queries.includes(clean)) queries.push(clean);
  };

  const pools = [
    "manufacturing companies factories industrial plants heavy engineering",
    "automotive manufacturers auto component manufacturers machinery equipment manufacturers",
    "process industries chemical petrochemical oil gas refinery companies",
    "steel cement plastic rubber paper glass packaging electronics manufacturers",
    "solar power plants renewable energy companies power generation utilities",
    "energy management battery BESS EV charging green hydrogen bioenergy",
    "smart city building automation smart lighting water treatment wastewater infrastructure",
    "warehouses logistics 3PL distribution centers supply chain cold chain",
    "fleet transportation shipping ports asset tracking operators",
    "IoT IIoT industrial automation embedded systems electronics telecom companies",
    "system integrators OEM ODM industrial technology engineering companies",
    "agriculture smart agriculture irrigation greenhouse AgriTech farm operators",
    "hospitals healthcare facilities medical infrastructure medical equipment",
    "industrial equipment machinery engineering companies process equipment",
  ];

  for (const pool of pools) {
    add(`${pool}${suffix} official website`);
  }

  // Specific high-value sectors that should never depend on a generic
  // "energy" or "manufacturing" query to be discovered.
  const highValue = [
    `oil gas refinery petrochemical pipeline companies${suffix} official website`,
    `solar renewable energy power generation utilities companies${suffix} official website`,
    `battery BESS energy storage EV charging companies${suffix} official website`,
    `green hydrogen bioenergy waste to energy companies${suffix} official website`,
    `water wastewater smart lighting smart city companies${suffix} official website`,
  ];
  highValue.forEach(add);

  if (isIndia) {
    [
      "manufacturing companies factories India official website",
      "oil gas refinery petrochemical companies India official website",
      "solar renewable power utilities India official website",
      "industrial automation IoT system integrators India official website",
      "logistics warehouse 3PL fleet companies India official website",
      "agriculture greenhouse irrigation companies India official website",
      "hospitals healthcare infrastructure India official website",
    ].forEach(add);
  }

  const knownTerms = [
    "automotive", "textile", "pharma", "pharmaceutical", "food", "packaging",
    "plastic", "electronics", "chemical", "steel", "cement", "logistics",
    "warehouse", "solar", "renewable", "energy", "oil", "gas", "refinery",
    "petrochemical", "mining", "agriculture", "greenhouse", "healthcare",
    "transportation", "engineering", "machinery", "manufacturing", "hydrogen",
    "battery", "bess", "ev", "telecom", "iot", "iiot", "automation", "oem", "odm",
  ];

  const requestedTerms = knownTerms.filter((term) => normalized.includes(term)).slice(0, 5);

  if (requestedTerms.length) {
    const focused = isIndia
      ? `${requestedTerms.join(" ")} companies India official website`
      : `${requestedTerms.join(" ")} companies${suffix} official website`;
    queries.unshift(focused);
  }

  return [...new Set(queries)].slice(0, Math.max(MAX_SEARCH_QUERIES, 24));
}

/* =========================================================
   14. DIRECT DISCOVERY
========================================================= */

async function directDiscovery(
  prompt: string,
  options: ResearchRunOptions = {}
): Promise<SectorLead[]> {
  const limit = Math.max(
    1,
    Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER)
  );

  const leads: SectorLead[] = [];
  const queries = buildSearchQueries(prompt);
  const knownLeadKeys =
    options.knownLeadKeys ?? createLeadKeySets([]);
  const counter =
    options.newLeadCount ?? { value: 0 };

  const excludedWebsites =
    options.excludedWebsites;

  const seenWebsites =
    options.runSeenWebsites ??
    new Set<string>();

  options.runSeenWebsites = seenWebsites;

  const requestedLocation =
    extractRequestedLocation(prompt).toLowerCase();

  const isIndiaRequest =
    requestedLocation === "india" ||
    /\bindia\b/i.test(prompt);

  for (const query of queries) {
    if (counter.value >= limit) break;

    emitResearchEvent(
      options.onEvent,
      "search",
      `Searching Tavily: ${query}`
    );

    try {
      const data = await tavilySearch(
        query,
        MAX_SEARCH_RESULTS,
        {
          excludeDomains:
            buildDynamicSearchExclusions(
              knownLeadKeys,
              excludedWebsites
            ),
        }
      );

      const results = Array.isArray(data?.results)
        ? data.results
        : [];

      const ranked = results
        .map((result: any) => {
          const url = String(result?.url || "");
          const title = String(result?.title || "");
          const content = String(result?.content || "");
          const baseScore = Number(result?.score || 0);
          const combined =
            `${title} ${content} ${url}`.toLowerCase();

          let relevance = baseScore;

          if (
            isIndiaRequest &&
            /\.in(?:\/|$)/i.test(url)
          ) {
            relevance += 0.20;
          }

          if (
            isIndiaRequest &&
            /\b(india|indian|maharashtra|gujarat|tamil nadu|karnataka|telangana|haryana|uttar pradesh|delhi|noida|gurugram|pune|ahmedabad|chennai|bengaluru|hyderabad)\b/i.test(
              combined
            )
          ) {
            relevance += 0.20;
          }

          if (isPotentialCustomerText(combined)) {
            relevance += 0.15;
          }

          if (
            isDirectoryDomain(url) ||
            isPublisherDomain(url) ||
            isSocialDomain(url)
          ) {
            relevance -= 1;
          }

          return { url, relevance };
        })
        .filter(
          (item: any) =>
            item.url &&
            isPotentialOfficialWebsite(item.url)
        )
        .filter(
          (item: any) =>
            item.relevance >= 0.45
        )
        .sort(
          (a: any, b: any) =>
            b.relevance - a.relevance
        );
const websites: string[] = Array.from(
  new Set<string>(
    ranked
      .map((item: any) =>
        getOrigin(String(item.url || ""))
      )
      .filter(
  (url: unknown): url is string => typeof url === "string" && Boolean(url)
)
  )
).slice(0, MAX_WEBSITES_PER_QUERY);


      for (const website of websites) {
        if (counter.value >= limit) break;

        const normalizedWebsite =
          normalizeDomainKey(website);

        if (!normalizedWebsite) continue;

        if (
          isExcludedWebsite(
            website,
            excludedWebsites
          )
        ) {
          emitDuplicateNotice(
            options.onEvent,
            `Browser/DB cache already contains: ${website}`,
            website
          );

          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Browser cache skipped before verification: ${website}`,
            website
          );

          continue;
        }

        if (
          knownLeadKeys.websites.has(
            normalizedWebsite
          )
        ) {
          emitDuplicateNotice(
            options.onEvent,
            `Lead already exists: ${website}`,
            website
          );

          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Duplicate lead skipped before verification: ${website}`,
            website
          );

          await markWebsiteResearched(
            website,
            options
          );

          continue;
        }

        if (
          !(await markWebsiteResearched(
            website,
            options
          ))
        ) {
          emitDuplicateNotice(
            options.onEvent,
            `Already encountered in this research run: ${website}`,
            website
          );

          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Already encountered in this research run: ${website}`,
            website
          );

          continue;
        }

        emitResearchEvent(
          options.onEvent,
          "check",
          `Verifying official website: ${website}`,
          website
        );

        const lead =
          await extractVerifiedCompany(
            website,
            prompt,
            undefined,
            options.onEvent
          );

        if (!lead) continue;

        if (
          isKnownLead(
            lead,
            knownLeadKeys
          )
        ) {
          emitDuplicateNotice(
            options.onEvent,
            `Lead already exists: ${website}`,
            website
          );

          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Duplicate lead skipped: ${website}`,
            website
          );

          continue;
        }

        const savedImmediately =
          await saveVerifiedLeadImmediately(
            lead,
            options.onEvent,
            website
          );

        if (!savedImmediately) continue;

        leads.push(lead);
        registerLeadKeys(
          lead,
          knownLeadKeys
        );

        counter.value += 1;

        emitResearchEvent(
          options.onEvent,
          "success",
          `Found ${counter.value} new lead${counter.value === 1 ? "" : "s"}: ${website}`,
          website
        );
      }
    } catch (error) {
      console.error(
        `Direct discovery failed for "${query}":`,
        error
      );

      emitResearchEvent(
        options.onEvent,
        "error",
        `Search failed: ${query}`
      );
    }
  }

  return leads;
}

/* =========================================================
   18. MAIN ENGINE
========================================================= */

export async function runResearch(
  job: ResearchJob,
  options: ResearchRunOptions = {}
): Promise<SectorLead[]> {
  const limit = Math.max(1, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));

  // Normalize the optional browser cache once at the engine boundary.
  // It remains only a fast optimization; PostgreSQL is the source of truth.
  options.excludedWebsites = normalizeWebsiteSet(
    options.excludedWebsites
  );

  // Shared across all discovery stages for this single research run.
  options.runSeenWebsites =
    options.runSeenWebsites ??
    new Set<string>();

  emitResearchEvent(options.onEvent, "info", "Research started");
  emitResearchEvent(options.onEvent, "info", `Research limit: ${limit}`);
  emitResearchEvent(options.onEvent, "info", "==============================================");

  console.log("==============================================");
  console.log("UCT PROSPECT INTELLIGENCE V10 FINAL POWER");
  console.log("Research prompt:", job.prompt);
  console.log("Research limit:", limit);
  console.log("==============================================");

  /*
   * Load existing PostgreSQL leads before discovery.
   * Existing rows are only read; nothing is updated or overwritten.
   * This allows the research limit to mean:
   * MAXIMUM NEW + UNIQUE + VERIFIED leads saved.
   */
  const existingLeads = await getLeads();
  const knownLeadKeys = createLeadKeySets(existingLeads);
  const newLeadCount = { value: 0 };

  /*
   * Backfill existing Lead websites into ResearchDomain.
   * This prevents old successful leads from being researched again after
   * introducing the permanent research-domain table.
   */
  const existingLeadDomains = existingLeads
    .map((lead) => normalizeDomainKey(lead.website))
    .filter(Boolean);

  if (existingLeadDomains.length) {
    await prisma.researchDomain.createMany({
      data: [...new Set(existingLeadDomains)].map((domain) => ({ domain })),
      skipDuplicates: true,
    });
  }

  // Load the permanent researched-domain set once for this run.
  // Search results may still contain these domains, but they are excluded
  // before expensive verification/extraction.
  const researchedDomains = await prisma.researchDomain.findMany({
    select: { domain: true },
  });

  const researchedWebsiteSet = new Set(
    researchedDomains
      .map((item) => normalizeDomainKey(item.domain))
      .filter(Boolean)
  );

  // Merge PostgreSQL memory into the fast browser cache set used by the
  // existing discovery filters. DB remains authoritative.
  options.excludedWebsites = new Set([
    ...(options.excludedWebsites ?? []),
    ...researchedWebsiteSet,
  ]);

  emitResearchEvent(
    options.onEvent,
    "info",
    `Permanent researched domains: ${researchedWebsiteSet.size}`
  );

  emitResearchEvent(
    options.onEvent,
    "info",
    `Fast cache domains: ${options.excludedWebsites.size}`
  );

  let leads: SectorLead[] = [];

  emitResearchEvent(
    options.onEvent,
    "info",
    "[V10] Stage 1 → Direct company discovery"
  );
  console.log("[V10] Stage 1 → Direct company discovery");

  const directLeads = await directDiscovery(job.prompt, {
    limit,
    onEvent: options.onEvent,
    knownLeadKeys,
    newLeadCount,
    excludedWebsites: options.excludedWebsites,
    runSeenWebsites: options.runSeenWebsites,
    onWebsiteResearched: options.onWebsiteResearched,
  });

  console.log("[V10] Direct verified:", directLeads.length);
  emitResearchEvent(
    options.onEvent,
    "info",
    `[V10] Direct verified: ${directLeads.length}`
  );

  leads.push(...directLeads);

  if (newLeadCount.value < limit) {
    /*
     * Do not fall back to broad directories such as ZoomInfo/IndiaMART.
     * They frequently return non-India listings, databases or third-party
     * records. Direct official-domain discovery is the safer second pass.
     */
    emitResearchEvent(
      options.onEvent,
      "info",
      "[V10] Stage 2 → Additional official-domain discovery"
    );
    console.log("[V10] Stage 2 → Additional official-domain discovery");

    const requestedLocation = extractRequestedLocation(job.prompt);
    const locationSuffix = requestedLocation ? ` in ${requestedLocation}` : "";

    const extraQueries = [
      `industrial companies factory plant${locationSuffix} contact official website`,
      `manufacturing plant operator factory${locationSuffix} contact official website`,
      `warehouse logistics operator facility${locationSuffix} contact official website`,
      `solar renewable power operator plant${locationSuffix} contact official website`,
      `industrial engineering machinery equipment${locationSuffix} contact official website`,
      `food pharma chemical manufacturing plant${locationSuffix} contact official website`,
    ];

    for (const query of extraQueries) {
      if (newLeadCount.value >= limit) break;

      emitResearchEvent(options.onEvent, "search", `Searching Tavily: ${query}`);

      try {
        const data = await tavilySearch(query, MAX_SEARCH_RESULTS, {
          excludeDomains: buildDynamicSearchExclusions(
            knownLeadKeys,
            options.excludedWebsites
          ),
        });

        const results = Array.isArray(data?.results) ? data.results : [];

        for (const result of results) {
          if (newLeadCount.value >= limit) break;

          const website = getOrigin(String(result?.url || ""));
          if (!website || !isPotentialOfficialWebsite(website)) continue;

          const normalizedWebsite = normalizeDomainKey(website);

          if (isExcludedWebsite(website, options.excludedWebsites)) {
            emitDuplicateNotice(
              options.onEvent,
              `Browser cache already contains: ${website}`,
              website
            );
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Browser cache skipped before verification: ${website}`
            );
            continue;
          }

          if (knownLeadKeys.websites.has(normalizedWebsite)) {
            emitDuplicateNotice(
              options.onEvent,
              `Lead already exists: ${website}`,
              website
            );
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Duplicate lead skipped: ${website}`
            );

            await markWebsiteResearched(
              website,
              options
            );
            continue;
          }

          if (!(await markWebsiteResearched(website, options))) {
            emitDuplicateNotice(
              options.onEvent,
              `Already encountered in this research run: ${website}`,
              website
            );
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Already encountered in this research run: ${website}`
            );
            continue;
          }

          emitResearchEvent(
            options.onEvent,
            "check",
            `Verifying official website: ${website}`
          );

          const lead = await extractVerifiedCompany(website, job.prompt, undefined, options.onEvent);

          if (!lead) {
            continue;
          }

          if (isKnownLead(lead, knownLeadKeys)) {
            emitDuplicateNotice(
              options.onEvent,
              `Lead already exists: ${website}`,
              website
            );
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Duplicate lead skipped: ${website}`
            );
            continue;
          }

          const savedImmediately = await saveVerifiedLeadImmediately(
            lead,
            options.onEvent,
            website
          );

          if (!savedImmediately) {
            continue;
          }

          leads.push(lead);
          registerLeadKeys(lead, knownLeadKeys);
          newLeadCount.value += 1;

          emitResearchEvent(
            options.onEvent,
            "success",
            `Found ${newLeadCount.value} new lead${newLeadCount.value === 1 ? "" : "s"}: ${website}`
          );
        }
      } catch (error) {
        console.error(`Fallback discovery failed for "${query}":`, error);
        emitResearchEvent(
          options.onEvent,
          "error",
          `Search failed: ${query}`
        );
      }
    }

    // If the requested number of VALID leads has still not been reached,
    // run a second bounded discovery wave with different sector wording.
    // This makes "10" mean 10 qualified leads rather than 10 raw results.
    if (newLeadCount.value < limit) {
      emitResearchEvent(
        options.onEvent,
        "info",
        `[V10] Target not reached (${newLeadCount.value}/${limit}) → expanding discovery`
      );

      const expandedQueries = [
        `industrial companies plants factories${locationSuffix} official company`,
        `oil gas refinery petrochemical energy companies${locationSuffix} official company`,
        `solar renewable power utilities energy companies${locationSuffix} official company`,
        `manufacturing engineering machinery equipment companies${locationSuffix} official company`,
        `warehouse logistics cold chain fleet companies${locationSuffix} official company`,
        `IoT IIoT automation telecom OEM ODM system integrators${locationSuffix} official company`,
        `agriculture irrigation greenhouse AgriTech companies${locationSuffix} official company`,
        `hospitals healthcare medical infrastructure companies${locationSuffix} official company`,
        `water wastewater smart city building automation companies${locationSuffix} official company`,
        `battery BESS EV charging hydrogen bioenergy companies${locationSuffix} official company`,
      ];

      for (const query of expandedQueries) {
        if (newLeadCount.value >= limit) break;

        emitResearchEvent(options.onEvent, "search", `Expanded search: ${query}`);

        try {
          const data = await tavilySearch(query, MAX_SEARCH_RESULTS, {
            excludeDomains: buildDynamicSearchExclusions(
              knownLeadKeys,
              options.excludedWebsites
            ),
          });

          const results = Array.isArray(data?.results) ? data.results : [];

          for (const result of results) {
            if (newLeadCount.value >= limit) break;

            const website = getOrigin(String(result?.url || ""));
            if (!website || !isPotentialOfficialWebsite(website)) continue;

            const normalizedWebsite = normalizeDomainKey(website);

            if (isExcludedWebsite(website, options.excludedWebsites)) {
              emitDuplicateNotice(
                options.onEvent,
                `Browser cache already contains: ${website}`,
                website
              );
              emitResearchEvent(
                options.onEvent,
                "skipped",
                `Browser cache skipped before verification: ${website}`
              );
              continue;
            }

            if (knownLeadKeys.websites.has(normalizedWebsite)) {
              emitDuplicateNotice(
                options.onEvent,
                `Lead already exists: ${website}`,
                website
              );
              emitResearchEvent(
                options.onEvent,
                "skipped",
                `Duplicate lead skipped: ${website}`
              );
              await markWebsiteResearched(website, options);
              continue;
            }

            if (!(await markWebsiteResearched(website, options))) {
              emitDuplicateNotice(
                options.onEvent,
                `Already encountered in this research run: ${website}`,
                website
              );
              emitResearchEvent(
                options.onEvent,
                "skipped",
                `Already encountered in this research run: ${website}`
              );
              continue;
            }

            emitResearchEvent(
              options.onEvent,
              "check",
              `Verifying official website: ${website}`
            );

            const lead = await extractVerifiedCompany(
              website,
              job.prompt,
              undefined,
              options.onEvent
            );

            if (!lead) continue;

            if (isKnownLead(lead, knownLeadKeys)) {
              emitDuplicateNotice(
                options.onEvent,
                `Lead already exists: ${website}`,
                website
              );
              emitResearchEvent(
                options.onEvent,
                "skipped",
                `Duplicate lead skipped: ${website}`
              );
              continue;
            }

            const savedImmediately = await saveVerifiedLeadImmediately(
              lead,
              options.onEvent,
              website
            );

            if (!savedImmediately) continue;

            leads.push(lead);
            registerLeadKeys(lead, knownLeadKeys);
            newLeadCount.value += 1;

            emitResearchEvent(
              options.onEvent,
              "success",
              `Found ${newLeadCount.value} new lead${newLeadCount.value === 1 ? "" : "s"}: ${website}`
            );
          }
        } catch (error) {
          console.error(`Expanded discovery failed for "${query}":`, error);
          emitResearchEvent(
            options.onEvent,
            "error",
            `Expanded search failed: ${query}`
          );
        }
      }
    }
  }

  emitResearchEvent(
    options.onEvent,
    "info",
    "[V10] Stage 3 → Deduplication"
  );
  console.log("[V10] Stage 3 → Deduplication");

  leads = deduplicateLeads(leads);

  emitResearchEvent(
    options.onEvent,
    "info",
    "[V10] Stage 4 → Final quality gate"
  );
  console.log("[V10] Stage 4 → Final quality gate");

  const finalLeads = leads
    .filter(finalQualityGate)
    .slice(0, limit);

  /*
   * Stage 5 is intentionally NOT a bulk database save.
   *
   * Every accepted lead was already persisted immediately after official
   * verification. This prevents data loss if the research run stops,
   * times out, crashes or reaches an API error after some leads were found.
   */
  job.leadsFound = finalLeads.length;

  emitResearchEvent(
    options.onEvent,
    "success",
    `${finalLeads.length} valid lead${finalLeads.length === 1 ? "" : "s"} saved to PostgreSQL during discovery`
  );

  emitResearchEvent(
    options.onEvent,
    "info",
    "=============================================="
  );

  console.log("==============================================");
  console.log("UCT PROSPECT INTELLIGENCE V10 FINAL POWER COMPLETE");
  console.log("Verified before final gate:", leads.length);
  console.log("FINAL LEADS:", finalLeads.length);
  console.log("NEW LEADS SAVED:", newLeadCount.value);
  console.log(
    "WEBSITES REMEMBERED:",
    options.runSeenWebsites?.size ?? 0
  );
  console.log("=============================================");

  emitResearchEvent(
    options.onEvent,
    "info",
    "UCT PROSPECT INTELLIGENCE V10 FINAL POWER COMPLETE"
  );
  emitResearchEvent(
    options.onEvent,
    "info",
    `Verified before final gate: ${leads.length}`
  );
  emitResearchEvent(
    options.onEvent,
    "success",
    `FINAL LEADS: ${newLeadCount.value}`
  );
  emitResearchEvent(
    options.onEvent,
    "info",
    "=============================================="
  );

  emitResearchEvent(
    options.onEvent,
    "complete",
    `Research completed · ${newLeadCount.value} new leads saved`
  );

  /*
   * Return only the leads that were intended for this research run.
   * Existing database rows remain untouched.
   */
  return finalLeads;
}