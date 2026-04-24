// HTTP client for the hanab.live public API.
//
// Endpoints used:
//   GET /api/v1/seed/{fullSeed}?size=100&page=N&col[0]=0
//     — all games played with this seed, paginated oldest-first
//   GET /api/v1/variants-full
//     — map from variant id to { name, suits, stackSize, maxScore }

const BASE = process.env.HANAB_LIVE_BASE_URL ?? 'https://hanab.live';
const SEED_TIMEOUT_MS = 15_000;
const VARIANTS_TIMEOUT_MS = 10_000;
const SEED_PAGE_SIZE = 100;

export interface HLiveGame {
  id: number;
  seed: string;
  variant_id: number;
  players: Array<{ user_id: number; name: string }>;
  score: number;
  turns: number;
  datetime_started: string;
  datetime_finished: string;
  loss: boolean;
  end_condition: number;
  tags: string[];
}

export interface HLiveVariant {
  id: number;
  name: string;
  suits: number;
  maxScore: number;
}

export interface HLiveClient {
  getGamesBySeed(seed: string): Promise<HLiveGame[]>;
  getVariant(variantId: number): Promise<HLiveVariant | null>;
  getAllVariants(): Promise<HLiveVariant[]>;
}

// ---------------------------------------------------------------------------
// Low-level fetch helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Raw API types
// ---------------------------------------------------------------------------

interface RawSeedRow {
  id?: number;
  score?: number;
  num_players?: number;
  users?: string;
  seed?: string;
  datetime?: string;
  datetime_started?: string;
  datetime_finished?: string;
  tags?: string;
  loss?: boolean;
  end_condition?: number;
  // variant_id is embedded in the seed string (p{n}v{variantId}s{suffix})
}

interface SeedEnvelope {
  total_rows?: number;
  rows?: RawSeedRow[];
}

interface RawVariantFull {
  name: string;
  suits: string[];
  stackSize: number;
  maxScore: number;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseSeedForVariantId(seed: string): number {
  // Seed format: p{numPlayers}v{variantId}s{suffix}
  const m = seed.match(/v(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseUsers(users: string | undefined): Array<{ user_id: number; name: string }> {
  if (!users?.trim()) return [];
  return users
    .split(', ')
    .filter(Boolean)
    .map((name) => ({ user_id: 0, name }));
}

function parseSeedRow(row: RawSeedRow, seedStr: string): HLiveGame {
  const seed = row.seed ?? seedStr;
  return {
    id: row.id ?? 0,
    seed,
    variant_id: parseSeedForVariantId(seed),
    players: parseUsers(row.users),
    score: row.score ?? 0,
    turns: 0,
    datetime_started: row.datetime_started ?? row.datetime ?? '',
    datetime_finished: row.datetime_finished ?? row.datetime ?? '',
    loss: row.loss ?? false,
    end_condition: row.end_condition ?? 0,
    tags: parseTags(row.tags),
  };
}

// ---------------------------------------------------------------------------
// createHLiveClient
// ---------------------------------------------------------------------------

export function createHLiveClient(): HLiveClient {
  let variantsCache: HLiveVariant[] | null = null;

  async function fetchAllVariants(): Promise<HLiveVariant[]> {
    if (variantsCache) return variantsCache;

    const url = `${BASE}/api/v1/variants-full`;
    const res = await fetchWithTimeout(url, VARIANTS_TIMEOUT_MS);
    if (!res.ok) throw new Error(`hanab.live variants API error ${res.status}`);

    const raw = (await res.json()) as Record<string, RawVariantFull>;
    const variants: HLiveVariant[] = Object.entries(raw).map(([idStr, v]) => ({
      id: parseInt(idStr, 10),
      name: v.name,
      suits: Array.isArray(v.suits) ? v.suits.length : 5,
      maxScore: v.maxScore ?? (Array.isArray(v.suits) ? v.suits.length * 5 : 25),
    }));
    variants.sort((a, b) => a.id - b.id);
    variantsCache = variants;
    return variants;
  }

  return {
    async getGamesBySeed(seed: string): Promise<HLiveGame[]> {
      const allGames = new Map<number, HLiveGame>();
      let page = 0;

      while (true) {
        const url = `${BASE}/api/v1/seed/${encodeURIComponent(seed)}?size=${SEED_PAGE_SIZE}&page=${page}&col%5B0%5D=0`;
        const res = await fetchWithTimeout(url, SEED_TIMEOUT_MS);

        if (res.status === 404) break;
        if (!res.ok) throw new Error(`hanab.live seed API error ${res.status} for seed ${seed}`);

        const envelope = (await res.json()) as SeedEnvelope;
        const rows = envelope.rows ?? [];

        let newThisPage = 0;
        for (const row of rows) {
          if (row.id && !allGames.has(row.id)) {
            allGames.set(row.id, parseSeedRow(row, seed));
            newThisPage++;
          }
        }

        const totalRows = envelope.total_rows ?? null;
        if (totalRows !== null && allGames.size >= totalRows) break;
        if (newThisPage < SEED_PAGE_SIZE) break;
        page++;
      }

      return [...allGames.values()].sort((a, b) => a.id - b.id);
    },

    async getVariant(variantId: number): Promise<HLiveVariant | null> {
      const variants = await fetchAllVariants();
      return variants.find((v) => v.id === variantId) ?? null;
    },

    async getAllVariants(): Promise<HLiveVariant[]> {
      return fetchAllVariants();
    },
  };
}
