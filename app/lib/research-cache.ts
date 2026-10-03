// lib/research-cache.ts

const CACHE_KEY = "uct_research_seen_websites";
const CACHE_VERSION = "v1";

interface ResearchCache {
  version: string;
  websites: string[];
}

function normalizeWebsite(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Get all websites already seen in previous research runs.
 */
export function getResearchCache(): string[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(CACHE_KEY);

    if (!raw) return [];

    const parsed: ResearchCache = JSON.parse(raw);

    if (
      parsed.version !== CACHE_VERSION ||
      !Array.isArray(parsed.websites)
    ) {
      return [];
    }

    return parsed.websites
      .map(normalizeWebsite)
      .filter(Boolean);
  } catch (error) {
    console.error(
      "Failed to read research cache:",
      error
    );

    return [];
  }
}

/**
 * Check whether a website was already researched.
 */
export function hasResearchCache(
  website: string
): boolean {
  const normalized = normalizeWebsite(website);

  if (!normalized) return false;

  return getResearchCache().includes(normalized);
}

/**
 * Add one website to the research cache.
 */
export function addResearchCache(
  website: string
): void {
  if (!isBrowser()) return;

  const normalized = normalizeWebsite(website);

  if (!normalized) return;

  try {
    const existing = getResearchCache();

    if (existing.includes(normalized)) {
      return;
    }

    const updated: ResearchCache = {
      version: CACHE_VERSION,
      websites: [
        ...existing,
        normalized,
      ],
    };

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      "Failed to save research cache:",
      error
    );
  }
}

/**
 * Add multiple websites to the research cache.
 */
export function addResearchCacheBulk(
  websites: string[]
): void {
  if (!isBrowser()) return;

  try {
    const existing = getResearchCache();

    const normalizedNew = websites
      .map(normalizeWebsite)
      .filter(Boolean);

    const merged = [
      ...existing,
      ...normalizedNew,
    ];

    const unique = [
      ...new Set(merged),
    ];

    const updated: ResearchCache = {
      version: CACHE_VERSION,
      websites: unique,
    };

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error(
      "Failed to save research cache:",
      error
    );
  }
}

/**
 * Remove one website from cache.
 */
export function removeResearchCache(
  website: string
): void {
  if (!isBrowser()) return;

  const normalized = normalizeWebsite(website);

  if (!normalized) return;

  try {
    const updated = getResearchCache().filter(
      (item) => item !== normalized
    );

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: CACHE_VERSION,
        websites: updated,
      })
    );
  } catch (error) {
    console.error(
      "Failed to remove research cache:",
      error
    );
  }
}

/**
 * Clear complete research cache.
 */
export function clearResearchCache(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error(
      "Failed to clear research cache:",
      error
    );
  }
}

/**
 * Get cache statistics.
 */
export function getResearchCacheStats(): {
  total: number;
} {
  return {
    total: getResearchCache().length,
  };
}