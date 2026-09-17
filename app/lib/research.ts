import { addLeads, getLeads } from "./lead-storage";
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
const MAX_SEARCH_QUERIES = 16;
const MAX_WEBSITES_PER_QUERY = 8;
const MAX_DIRECTORY_SOURCES = 1;
const MAX_DIRECTORY_CANDIDATES = 4;
const REQUEST_TIMEOUT_MS = 15000;
const TAVILY_RETRIES = 2;

export type ResearchEventType =
  | "info" | "search" | "check" | "success"
  | "skipped" | "rejected" | "error" | "complete";

export interface ResearchEvent {
  type: ResearchEventType;
  message: string;
  timestamp: string;
}

export interface ResearchRunOptions {
  limit?: number;
  onEvent?: (event: ResearchEvent) => void;
  knownLeadKeys?: LeadKeySets;
  newLeadCount?: { value: number };
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
    const website = normalizeUrl(lead.website).toLowerCase();
    const phone = lead.phone.replace(/\D/g, "");
    const email = lead.email.trim().toLowerCase();

    if (website) keys.websites.add(website);
    if (phone) keys.phones.add(phone);
    if (email) keys.emails.add(email);
  }

  return keys;
}

function isKnownLead(lead: SectorLead, keys: LeadKeySets): boolean {
  const website = normalizeUrl(lead.website).toLowerCase();
  const phone = lead.phone.replace(/\D/g, "");
  const email = lead.email.trim().toLowerCase();

  return Boolean(
    (website && keys.websites.has(website)) ||
    (phone && keys.phones.has(phone)) ||
    (email && keys.emails.has(email))
  );
}
function registerLeadKeys(lead: SectorLead, keys: LeadKeySets): void {
  const website = normalizeUrl(lead.website).toLowerCase();
  const phone = lead.phone.replace(/\D/g, "");
  const email = lead.email.trim().toLowerCase();

  if (website) keys.websites.add(website);
  if (phone) keys.phones.add(phone);
  if (email) keys.emails.add(email);
}

function emitResearchEvent(
  onEvent: ResearchRunOptions["onEvent"],
  type: ResearchEventType,
  message: string
): void {
  onEvent?.({ type, message, timestamp: new Date().toISOString() });
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
  "indiafilings.com", "electronicsmedia.info", "economictimes.",
  "timesofindia.", "business-standard.com", "financialexpress.com",
  "forbes.com", "yourstory.com", "medium.com", "wordpress.com",
  "blogspot.com", "moneycontrol.com", "businesswire.com", "globenewswire.com",
  "prnewswire.com", "reuters.com", "bloomberg.com", "wikipedia.org",
  "ibef.org", "textileworld.com", "indiantextilejournal.com",
  "market.us", "marketsandmarkets.com", "mordorintelligence.com",
];

const ARTICLE_PATHS = [
  "/article/", "/articles/", "/blog/", "/blogs/", "/news/", "/post/",
  "/posts/", "/story/", "/stories/", "/category/", "/tag/", "/author/",
  "/press-release/", "/press/", "/insights/", "/resources/",
];


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
  if (!url || isDirectoryDomain(url) || isSocialDomain(url) || isPublisherDomain(url) || isArticleUrl(url)) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch { return false; }
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

function extractEmail(text: string, website: string): string {
  const rawMatches = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(?:co\.in|com|in|org|net|biz|io|co|ai|tech|info|edu)(?![A-Z0-9])/gi
  ) ?? [];

  const hostname = getHostname(website).replace(/^www\./, "");
  const invalidDomains = new Set([
    "example.com", "example.org", "example.net", "domain.com", "test.com",
  ]);

  const emails = [...new Set(rawMatches.map((email) => email.toLowerCase().trim()))]
    .filter((email) => {
      const domain = email.split("@")[1] ?? "";
      if (!domain || invalidDomains.has(domain)) return false;
      if (!domain.includes(".")) return false;
      return true;
    });

  const sameDomain = emails.filter((email) => email.endsWith(`@${hostname}`));
  const pool = sameDomain.length ? sameDomain : emails;

  const preferredPrefixes = [
    "sales@", "info@", "contact@", "business@", "support@",
    "enquiry@", "enquiries@", "hello@", "admin@",
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
  const matches = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{6,12}/g) ?? [];

  for (const match of matches) {
    const trimmed = match.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10 && /^[6-9]/.test(digits)) return trimmed;
    if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return trimmed;
    if (/^\+/.test(trimmed) && digits.length >= 10 && digits.length <= 15) return trimmed;
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

function isLikelyPublisherOrResearchSite(website: string, text: string): boolean {
  if (isPublisherDomain(website)) return true;

  const lower = text.toLowerCase();
  const publisherSignals = [
    "market research", "research report", "industry report", "business research",
    "news portal", "news magazine", "journal", "editorial", "publisher",
    "statistics", "market size", "forecast", "research institute",
  ];

  const matches = publisherSignals.filter((signal) => lower.includes(signal)).length;
  const hasIndustrialOperations = [
    "factory", "manufacturing plant", "production plant", "warehouse",
    "fleet", "power plant", "solar plant", "refinery", "mine",
  ].some((signal) => lower.includes(signal));

  return matches >= 2 && !hasIndustrialOperations;
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

function isPotentialUCTCustomer(text: string): boolean {
  const customerScore = calculateCustomerScore(text);
  const providerScore = calculateProviderScore(text);
  const negativeScore = calculateNegativeScore(text);

  // V10: these organization types are never treated as end-user prospects.
  // This prevents agencies such as renewable-energy development bodies from
  // passing simply because the page contains strong solar/energy keywords.
  if (hasHardRejectOrganizationType(text)) return false;

  // Associations/research organizations are rejected unless the text clearly
  // describes the organization itself operating a physical facility.
  if (hasNonCustomerOrganizationType(text) && !hasStrongPhysicalOperations(text)) return false;

  // V10: a technology provider/competitor is not a customer merely because it
  // also mentions factories, sensors, automation or industrial customers.
  if (hasCompetitorPrimaryBusiness(text) && !hasExplicitIndustrialEndUserIdentity(text)) return false;

  if (providerScore >= 2 && customerScore < 14) return false;
  if (negativeScore >= 2 && customerScore < 12) return false;

  // Require both meaningful customer evidence and at least one explicit
  // end-user/physical-operations signal. This removes research pages and
  // generic industrial-content sites that happen to contain keywords.
  if (customerScore < 8) return false;
  return hasExplicitIndustrialEndUserIdentity(text) || hasStrongPhysicalOperations(text);
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

async function verifyOfficialWebsite(candidateName: string, website: string, prompt: string): Promise<boolean> {
  if (!isPotentialOfficialWebsite(website) || !looksLikeCompanyName(candidateName)) return false;

  try {
    const extracted = await tavilyExtract(
      getCompanyPages(website).slice(0, 5),
      `Verify that this is the official website of "${candidateName}". Identify the actual company/brand name, what the company does, its industry, physical operations, location and contact details. Ignore articles, third-party companies, advertisements and unrelated page titles.`
    );

    const text = Array.isArray(extracted?.results)
      ? extracted.results.map((item: any) => item?.raw_content || "").join("\n")
      : "";

    if (!text.trim()) return false;
    if (!websiteIdentityMatches(candidateName, website, text)) return false;
    if (!locationMatchesPrompt(text, prompt)) return false;
    return isPotentialUCTCustomer(text);
  } catch {
    return false;
  }
}

async function findOfficialWebsite(candidateName: string, prompt: string): Promise<string> {
  if (!looksLikeCompanyName(candidateName)) return "";
  const requestedLocation = extractRequestedLocation(prompt);
  const queries = [
    `"${candidateName}" official website`,
    `"${candidateName}" official company`,
    `"${candidateName}" contact`,
  ];

  if (requestedLocation) queries.unshift(`"${candidateName}" ${requestedLocation} official website`);

  for (const query of queries) {
    try {
      const data = await tavilySearch(query, 5);
      const results = Array.isArray(data?.results) ? data.results : [];
      const candidates = results
        .filter((result: any) => result?.url && isPotentialOfficialWebsite(result.url))
        .map((result: any) => ({
          url: getOrigin(result.url),
          title: String(result.title || ""),
          content: String(result.content || ""),
        }))
        .filter((candidate: any) => candidate.url)
        .map((candidate: any) => {
          const combined = `${candidate.title} ${candidate.content}`.toLowerCase();
          const tokens = getNameTokens(candidateName);
          let score = 0;
          for (const token of tokens) {
            if (combined.includes(token)) score += 2;
            if (getHostname(candidate.url).includes(token)) score += 5;
          }
          return { ...candidate, score };
        })
        .sort((a: any, b: any) => b.score - a.score);

      for (const candidate of candidates.slice(0, 3)) {
        if (await verifyOfficialWebsite(candidateName, candidate.url, prompt)) return candidate.url;
      }
    } catch (error) {
      console.error(`Official website search failed for ${candidateName}:`, error);
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

async function extractVerifiedCompany(website: string, prompt: string, expectedName?: string): Promise<SectorLead | null> {
  if (!isPotentialOfficialWebsite(website)) return null;

  try {
    const data = await tavilyExtract(
      getCompanyPages(website),
      "Extract factual information from the company's own official website only. Identify the actual legal or brand company name, what the business does, industry, manufacturing plants, factories, warehouses, fleets, physical assets, industrial operations, equipment, machinery and relevant use cases. Also extract business address/location, plant location, phone number and business email. Ignore third-party companies, article titles, publishers, directories, advertisements and generic page headings."
    );

    const results = Array.isArray(data?.results) ? data.results : [];
    const websiteText = results.map((result: any) => result?.raw_content || "").filter(Boolean).join("\n");
    if (!websiteText.trim()) return null;

    if (isLikelyPublisherOrResearchSite(website, websiteText)) return null;

    if (!isPotentialUCTCustomer(websiteText)) return null;
    if (!locationMatchesPrompt(websiteText, prompt)) return null;

    // Company identity is used internally for verification only.
    // It is deliberately NOT returned to the research result.
    if (expectedName && !websiteIdentityMatches(expectedName, website, websiteText)) return null;

    // Reject provider-heavy sites even if a generic industrial keyword happens to appear.
    const providerScore = calculateProviderScore(websiteText);
    const customerScore = calculateCustomerScore(websiteText);
    if (providerScore >= 2 && customerScore < 14) return null;

    const email = extractEmail(websiteText, website);
    const phone = extractPhone(websiteText);
    const location = extractLocation(websiteText);

    if (location && !isPlausibleBusinessLocation(location)) return null;

    if (!email && !phone) return null;

    return {
      sector: classifySector(websiteText),
      website: normalizeUrl(website),
      location,
      phone,
      email,
      googleBusinessProfile: "",
    };
  } catch (error) {
    console.error(`Verified company extraction failed for ${website}:`, error);
    return null;
  }
}

/* =========================================================
   12. SEARCH QUERY GENERATION

   Important: do NOT send the entire natural-language prompt as every query.
   Convert "Find potential customers in India" into targeted discovery queries.
========================================================= */

const DISCOVERY_QUERY_GROUPS = [
  ["manufacturing companies", "factories", "industrial plants"],
  ["automotive manufacturers", "auto component manufacturers", "engineering manufacturers"],
  ["textile manufacturers", "pharmaceutical manufacturers", "food processing manufacturers"],
  ["chemical manufacturers", "steel manufacturers", "cement manufacturers", "plastic manufacturers"],
  ["warehouses", "logistics companies", "3PL companies", "distribution centers"],
  ["energy companies", "solar companies", "utilities", "power generation companies"],
  ["oil and gas companies", "mining companies", "mineral processing companies"],
  ["agriculture companies", "greenhouse operators", "healthcare facilities", "smart infrastructure operators"],
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

  /*
   * Use narrow end-user discovery queries instead of repeating the entire
   * natural-language prompt. Each query targets a different customer pool.
   */
  if (isIndia) {
    [
      "manufacturing companies factories industrial plants India official website",
      "automotive manufacturing auto component factories India official website",
      "textile mills garment factories textile manufacturers India official website",
      "pharmaceutical manufacturing plants pharma companies India official website",
      "food processing beverage manufacturing plants India official website",
      "chemical steel cement plastic manufacturing companies India official website",
      "electronics electrical battery manufacturing factories India official website",
      "warehouses 3PL distribution centers logistics operators India official website",
      "fleet transport trucking freight logistics operators India official website",
      "solar power plant renewable energy operators India official website",
      "power generation utilities energy infrastructure India official website",
      "oil gas refinery pipeline industrial operators India official website",
      "mining mineral processing quarry companies India official website",
      "agriculture greenhouse cold storage irrigation operators India official website",
      "hospitals healthcare facilities medical equipment operations India official website",
      "industrial facilities engineering equipment machinery companies India official website",
    ].forEach(add);

    /*
     * Add a few high-value industrial-cluster searches so the same large
     * companies are not returned on every generic query.
     */
    [
      "manufacturing companies Pune Maharashtra India factory official website",
      "manufacturing companies Ahmedabad Gujarat India factory official website",
      "manufacturing companies Chennai Tamil Nadu India factory official website",
      "manufacturing companies Bengaluru Karnataka India industrial official website",
      "manufacturing companies Hyderabad Telangana India factory official website",
      "manufacturing companies NCR Delhi Noida Gurugram India factory official website",
    ].forEach(add);
  } else {
    [
      `manufacturing factories industrial plants${suffix} official website`,
      `automotive auto components engineering manufacturers${suffix} official website`,
      `textile pharmaceutical food processing manufacturers${suffix} official website`,
      `chemical steel cement plastics manufacturers${suffix} official website`,
      `warehouses logistics 3PL distribution operators${suffix} official website`,
      `energy solar utilities power generation operators${suffix} official website`,
      `oil gas mining mineral processing operators${suffix} official website`,
      `agriculture greenhouse healthcare smart infrastructure operators${suffix} official website`,
      `industrial equipment machinery companies${suffix} official website`,
      `fleet transportation freight operators${suffix} official website`,
    ].forEach(add);
  }

  /*
   * If the prompt names a specific industry, put those queries first.
   */
  const knownTerms = [
    "automotive", "textile", "pharma", "pharmaceutical", "food", "packaging",
    "plastic", "electronics", "chemical", "steel", "cement", "logistics",
    "warehouse", "solar", "energy", "oil", "gas", "mining", "agriculture",
    "greenhouse", "healthcare", "transportation", "engineering", "machinery",
    "manufacturing",
  ];

  const requestedTerms = knownTerms.filter((term) => normalized.includes(term)).slice(0, 3);

  if (requestedTerms.length) {
    const focused = isIndia
      ? `${requestedTerms.join(" ")} companies factories India official website`
      : `${requestedTerms.join(" ")} companies factories${suffix} official website`;

    queries.unshift(focused);
  }

  return queries.slice(0, MAX_SEARCH_QUERIES);
}

/* =========================================================
   13. CANDIDATE NAME EXTRACTION FROM DISCOVERY SOURCES
========================================================= */

function extractCompanyCandidates(text: string): string[] {
  const lines = text.split("\n").map(cleanText).filter(Boolean);
  const candidates: string[] = [];

  const strongPatterns = [
    /\bprivate limited\b/i, /\bpvt\.?\s*ltd\.?\b/i, /\blimited\b/i, /\bllp\b/i,
    /\binc\.?\b/i, /\bcorporation\b/i, /\bcorp\.?\b/i, /\bllc\b/i,
  ];

  for (const line of lines) {
    if (line.length < 4 || line.length > 110) continue;
    if (!looksLikeCompanyName(line)) continue;
    if (ARTICLE_TITLE_WORDS.some((word) => line.toLowerCase().includes(word))) continue;
    if (strongPatterns.some((pattern) => pattern.test(line))) candidates.push(line);
  }

  return [...new Set(candidates)].slice(0, MAX_DIRECTORY_CANDIDATES);
}

function isPotentialCustomerText(text: string): boolean {
  const value = text.toLowerCase();

  return Object.values(CUSTOMER_SEGMENTS)
    .flat()
    .some((signal) => value.includes(signal));
}

function isIndiaRelevantWebsite(url: string): boolean {
  const hostname = getHostname(url).replace(/^www\./, "").toLowerCase();

  if (hostname.endsWith(".in")) return true;

  /*
   * A .com company can still be a genuine India business. The URL alone
   * cannot prove geography, so allow common corporate domains through and
   * let extractVerifiedCompany() verify the India location from the site.
   */
  return ![
    "scribd.com",
    "salezshark.com",
    "value.today",
    "pwc.com",
    "usgs.gov",
    "mining.com",
  ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/* =========================================================
   14. DIRECT DISCOVERY
========================================================= */

async function directDiscovery(prompt: string, options: ResearchRunOptions = {}): Promise<SectorLead[]> {
  const limit = Math.max(1, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));
  const leads: SectorLead[] = [];
  const queries = buildSearchQueries(prompt);
  const knownLeadKeys = options.knownLeadKeys ?? createLeadKeySets([]);
  const counter = options.newLeadCount ?? { value: 0 };
  const seenWebsites = new Set<string>();

  const normalizedPrompt = prompt.toLowerCase();
  const requestedLocation = extractRequestedLocation(prompt).toLowerCase();
  const isIndia =
    requestedLocation === "india" || /\bindia\b/.test(normalizedPrompt);

  for (const query of queries) {
    if (counter.value >= limit) break;

    emitResearchEvent(
      options.onEvent,
      "search",
      `Searching Tavily: ${query}`
    );

    try {
      const data = await tavilySearch(query, MAX_SEARCH_RESULTS, {
        country: isIndia ? "india" : undefined,
        excludeDomains: TAVILY_EXCLUDE_DOMAINS,
      });

      const results = Array.isArray(data?.results) ? data.results : [];

      /*
       * Rank candidate URLs before verification. This prevents generic
       * publishers, global directories and unrelated companies from consuming
       * the expensive website-extraction step.
       */
      const ranked = results
        .map((result: any) => {
          const url = String(result?.url || "");
          const title = String(result?.title || "");
          const content = String(result?.content || "");
          const score = Number(result?.score || 0);
          const combined = `${title} ${content} ${url}`.toLowerCase();

          let relevance = score;

          if (/\.in(?:\/|$)/i.test(url)) relevance += 0.20;
          if (/\b(india|indian|maharashtra|gujarat|tamil nadu|karnataka|telangana|haryana|uttar pradesh|delhi|noida|gurugram|pune|ahmedabad|chennai|bengaluru|hyderabad)\b/i.test(combined)) {
            relevance += 0.20;
          }

          if (isPotentialCustomerText(combined)) relevance += 0.15;
          if (isDirectoryDomain(url) || isPublisherDomain(url) || isSocialDomain(url)) {
            relevance -= 1;
          }

          return { url, relevance };
        })
        .filter((item: any) => item.url && isPotentialOfficialWebsite(item.url))
        .filter((item: any) => item.relevance >= 0.45)
        .sort((a: any, b: any) => b.relevance - a.relevance);

const websites: string[] = Array.from(
  new Set<string>(
    ranked
      .map((item: any): string => getOrigin(String(item.url || "")))
      .filter((url: string): url is string => Boolean(url))
  )
).slice(0, MAX_WEBSITES_PER_QUERY);


for (const website of websites) {
  if (counter.value >= limit) break;

  const normalizedWebsite = normalizeUrl(website).toLowerCase();

  if (seenWebsites.has(normalizedWebsite)) {
    emitResearchEvent(
      options.onEvent,
      "skipped",
      `Duplicate search result skipped: ${website}`
    );
    continue;
  }

  seenWebsites.add(normalizedWebsite);

  if (isIndia && !isIndiaRelevantWebsite(website)) {
    emitResearchEvent(
      options.onEvent,
      "skipped",
      `Non-India website skipped: ${website}`
    );
    continue;
  }

  emitResearchEvent(
    options.onEvent,
    "check",
    `Verifying official website: ${website}`
  );

  const lead = await extractVerifiedCompany(website, prompt);

  if (!lead) {
    emitResearchEvent(
      options.onEvent,
      "rejected",
      `Lead rejected: ${website}`
    );
    continue;
  }

  if (isKnownLead(lead, knownLeadKeys)) {
    emitResearchEvent(
      options.onEvent,
      "skipped",
      `Duplicate lead skipped: ${website}`
    );
    continue;
  }

  leads.push(lead);
  registerLeadKeys(lead, knownLeadKeys);
  counter.value += 1;

  emitResearchEvent(
    options.onEvent,
    "success",
    `Found ${counter.value} new lead${counter.value === 1 ? "" : "s"}: ${website}`
  );
}
      

      for (const website of websites) {
        if (counter.value >= limit) break;

        const normalizedWebsite = normalizeUrl(website).toLowerCase();

        if (seenWebsites.has(normalizedWebsite)) {
          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Duplicate search result skipped: ${website}`
          );
          continue;
        }

        seenWebsites.add(normalizedWebsite);

        if (isIndia && !isIndiaRelevantWebsite(website)) {
          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Non-India website skipped: ${website}`
          );
          continue;
        }

        emitResearchEvent(
          options.onEvent,
          "check",
          `Verifying official website: ${website}`
        );

        const lead = await extractVerifiedCompany(website, prompt);

        if (!lead) {
          emitResearchEvent(
            options.onEvent,
            "rejected",
            `Lead rejected: ${website}`
          );
          continue;
        }

        if (isKnownLead(lead, knownLeadKeys)) {
          emitResearchEvent(
            options.onEvent,
            "skipped",
            `Duplicate lead skipped: ${website}`
          );
          continue;
        }

        leads.push(lead);
        registerLeadKeys(lead, knownLeadKeys);
        counter.value += 1;

        emitResearchEvent(
          options.onEvent,
          "success",
          `Found ${counter.value} new lead${counter.value === 1 ? "" : "s"}: ${website}`
        );
      }
    } catch (error) {
      console.error(`Direct discovery failed for "${query}":`, error);
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
   15. DIRECTORY-ASSISTED DISCOVERY
========================================================= */

async function directoryDiscovery(prompt: string, options: ResearchRunOptions = {}): Promise<SectorLead[]> {
  const leads: SectorLead[] = [];
  const limit = Math.max(1, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));
  const knownLeadKeys = options.knownLeadKeys ?? createLeadKeySets([]);
  const counter = options.newLeadCount ?? { value: 0 };

  try {
    const data = await tavilySearch(`${prompt} companies manufacturers`, 10);
    const results = Array.isArray(data?.results) ? data.results : [];
    const directoryResults = results.filter(
      (result: any) => result?.url && isDirectoryDomain(result.url)
    );

    for (const source of directoryResults.slice(0, MAX_DIRECTORY_SOURCES)) {
      if (counter.value >= limit) break;

      emitResearchEvent(
        options.onEvent,
        "search",
        `Checking directory source: ${source.url}`
      );

      try {
        const extracted = await tavilyExtract(
          [source.url],
          "Extract only names of real industrial businesses or end-user companies mentioned on this page. Ignore article titles, categories, directories, databases, service agencies, consultants, technology providers and generic phrases."
        );

        const text = extracted?.results?.[0]?.raw_content || "";
        if (!text.trim()) continue;

        const candidates = extractCompanyCandidates(text);

        for (const companyName of candidates) {
          if (counter.value >= limit) break;

          emitResearchEvent(
            options.onEvent,
            "check",
            `Finding official website: ${companyName}`
          );

          const officialWebsite = await findOfficialWebsite(
            companyName,
            prompt
          );

          if (!officialWebsite) {
            emitResearchEvent(
              options.onEvent,
              "rejected",
              `Official website not verified: ${companyName}`
            );
            continue;
          }

          emitResearchEvent(
            options.onEvent,
            "check",
            `Verifying official website: ${officialWebsite}`
          );

          const lead = await extractVerifiedCompany(
            officialWebsite,
            prompt,
            companyName
          );

          if (!lead) {
            emitResearchEvent(
              options.onEvent,
              "rejected",
              `Lead rejected: ${officialWebsite}`
            );
            continue;
          }

          if (isKnownLead(lead, knownLeadKeys)) {
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Duplicate lead skipped: ${officialWebsite}`
            );
            continue;
          }

          leads.push(lead);
          registerLeadKeys(lead, knownLeadKeys);
          counter.value += 1;

          emitResearchEvent(
            options.onEvent,
            "success",
            `Found ${counter.value} new lead${counter.value === 1 ? "" : "s"}: ${officialWebsite}`
          );
        }
      } catch (error) {
        console.error(`Directory processing failed for ${source.url}:`, error);
        emitResearchEvent(
          options.onEvent,
          "error",
          `Directory processing failed: ${source.url}`
        );
      }
    }
  } catch (error) {
    console.error("Directory discovery failed:", error);
    emitResearchEvent(
      options.onEvent,
      "error",
      "Directory-assisted discovery failed"
    );
  }

  return leads;
}

/* =========================================================
   16. DEDUPLICATION
========================================================= */

function leadCompleteness(lead: SectorLead): number {
  return Number(Boolean(lead.email)) + Number(Boolean(lead.phone)) + Number(Boolean(lead.location));
}

function deduplicateLeads(leads: SectorLead[]): SectorLead[] {
  const byWebsite = new Map<string, SectorLead>();

  for (const lead of leads) {
    const key = normalizeUrl(lead.website).toLowerCase();
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
  if (!lead.sector || !lead.website || !isPotentialOfficialWebsite(lead.website)) return false;
  if (!lead.email && !lead.phone) return false;
  if (lead.location && !isPlausibleBusinessLocation(lead.location)) return false;

  // Never allow a malformed email to reach the saved lead list.
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return false;

  return true;
}

/* =========================================================
   18. MAIN ENGINE
========================================================= */

export async function runResearch(
  job: ResearchJob,
  options: ResearchRunOptions = {}
): Promise<SectorLead[]> {
  const limit = Math.max(1, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));

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

    const remaining = limit - newLeadCount.value;
    const extraQueries = [
      "industrial companies India factory plant contact official website",
      "manufacturing plant operator India factory contact official website",
      "warehouse logistics operator India facility contact official website",
      "solar renewable power operator India plant contact official website",
      "industrial engineering company India machinery plant contact official website",
      "food pharma chemical manufacturing India plant contact official website",
    ];

    for (const query of extraQueries) {
      if (newLeadCount.value >= limit) break;

      emitResearchEvent(options.onEvent, "search", `Searching Tavily: ${query}`);

      try {
        const data = await tavilySearch(query, MAX_SEARCH_RESULTS, {
          country: "india",
          excludeDomains: TAVILY_EXCLUDE_DOMAINS,
        });

        const results = Array.isArray(data?.results) ? data.results : [];

        for (const result of results) {
          if (newLeadCount.value >= limit) break;

          const website = getOrigin(String(result?.url || ""));
          if (!website || !isPotentialOfficialWebsite(website)) continue;

          const normalizedWebsite = normalizeUrl(website).toLowerCase();
          if (knownLeadKeys.websites.has(normalizedWebsite)) {
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Duplicate lead skipped: ${website}`
            );
            continue;
          }

          if (leads.some((lead) => normalizeUrl(lead.website).toLowerCase() === normalizedWebsite)) {
            continue;
          }

          emitResearchEvent(
            options.onEvent,
            "check",
            `Verifying official website: ${website}`
          );

          const lead = await extractVerifiedCompany(website, job.prompt);

          if (!lead) {
            emitResearchEvent(
              options.onEvent,
              "rejected",
              `Lead rejected: ${website}`
            );
            continue;
          }

          if (isKnownLead(lead, knownLeadKeys)) {
            emitResearchEvent(
              options.onEvent,
              "skipped",
              `Duplicate lead skipped: ${website}`
            );
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

    console.log("[V10] Additional official-domain verified:", remaining - (limit - newLeadCount.value));
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

  emitResearchEvent(
    options.onEvent,
    "info",
    "[V10] Stage 5 → Saving verified leads"
  );
  console.log("[V10] Stage 5 → Saving verified leads");

  let savedCount = 0;
  let duplicateCount = 0;

  if (finalLeads.length > 0) {
    emitResearchEvent(
      options.onEvent,
      "info",
      `Saving ${finalLeads.length} new verified leads to PostgreSQL`
    );

    const saveResult = await addLeads(
      finalLeads as unknown as ResearchLead[]
    );

    savedCount = saveResult.saved;
    duplicateCount = saveResult.duplicates;

    job.leadsFound = savedCount;

    emitResearchEvent(
      options.onEvent,
      "success",
      `${savedCount} new lead${savedCount === 1 ? "" : "s"} saved to PostgreSQL`
    );

    if (duplicateCount > 0) {
      emitResearchEvent(
        options.onEvent,
        "skipped",
        `${duplicateCount} duplicate lead${duplicateCount === 1 ? "" : "s"} skipped`
      );
    }
  }

  emitResearchEvent(
    options.onEvent,
    "info",
    "=============================================="
  );

  console.log("==============================================");
  console.log("UCT PROSPECT INTELLIGENCE V10 FINAL POWER COMPLETE");
  console.log("Verified before final gate:", leads.length);
  console.log("FINAL LEADS:", finalLeads.length);
  console.log("NEW LEADS SAVED:", savedCount);
  console.log("DUPLICATES SKIPPED:", duplicateCount);
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
    `FINAL LEADS: ${savedCount}`
  );
  emitResearchEvent(
    options.onEvent,
    "info",
    "=============================================="
  );

  emitResearchEvent(
    options.onEvent,
    "complete",
    `Research completed · ${savedCount} new leads saved`
  );

  /*
   * Return only the leads that were intended for this research run.
   * Existing database rows remain untouched.
   */
  return finalLeads;
}

