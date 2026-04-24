// In-process cache — populated on first successful fetch
let cachedIcons: Set<string> | null = null;

const CODEPOINTS_URL =
  'https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints';

/**
 * Fetches all valid Material Icons names.
 * Cached in memory for the process lifetime.
 * Returns an empty Set if the network is unavailable.
 */
export async function fetchMaterialIconNames(): Promise<Set<string>> {
  if (cachedIcons !== null) return cachedIcons;

  try {
    const res = await fetch(CODEPOINTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const names = new Set<string>();
    for (const line of text.split('\n')) {
      const name = line.split(' ')[0].trim();
      if (name) names.add(name);
    }
    cachedIcons = names;
    return names;
  } catch (err) {
    console.warn('[materialIcons] Could not fetch icon names:', err);
    cachedIcons = new Set<string>();
    return cachedIcons;
  }
}

/** Reset the cache — for use in tests only. */
export function _resetIconCache(): void {
  cachedIcons = null;
}
