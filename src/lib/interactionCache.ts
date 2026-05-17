import { getSql } from "./db";
import { getRedis } from "./redis";

const CACHE_KEY = "interactions:all";
const LAST_SYNC_KEY = "interactions:lastSync";

interface CachedInteraction {
  id: string;
  date_added: number;
  sender_name: string;
  sender_login: string;
  action_type: string;
  note: string;
  raw_text: string;
  fetched_at: string;
  recipients: { recipient_name: string; recipient_login: string }[];
}

interface InteractionQuery {
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  recipient?: string;
  action?: string;
  note?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

// Convert YYYY-MM-DD to local midnight timestamp (matches db.ts logic)
const TZ_HOURS = process.env.TZ_OFFSET ? Number(process.env.TZ_OFFSET) : -new Date().getTimezoneOffset() / 60;
const OFFSET = TZ_HOURS * 60 * 60 * 1000;

function dateFromStr(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + OFFSET;
}
function dateToEndTimestamp(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d + 1) + OFFSET - 1;
}

// Get all interactions from cache, pulling only new ones from DB
export async function getCachedInteractionsDelta(query: InteractionQuery): Promise<{
  rows: CachedInteraction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const all = await getAllInteractions();
  return applyFiltersAndPagination(all, query);
}

// Full cache invalidation (on parse/clear)
export async function invalidateInteractionCache() {
  const r = getRedis();
  if (r) {
    await r.del(CACHE_KEY);
    await r.del(LAST_SYNC_KEY);
  }
}

async function getAllInteractions(): Promise<CachedInteraction[]> {
  const r = getRedis();
  if (!r) return fallbackFetch();

  try {
    const cachedJson = await r.get<string>(CACHE_KEY);
    const lastSync = await r.get<number>(LAST_SYNC_KEY) ?? 0;

    // Check DB for new interactions since last sync
    const sql = getSql();
    const newRows = await sql.query(
      `SELECT id, date_added, sender_name, sender_login, action_type, note, raw_text, fetched_at
       FROM interactions WHERE date_added > $1::bigint ORDER BY date_added DESC`,
      [String(lastSync)]
    ) as { id: string; date_added: number; sender_name: string; sender_login: string; action_type: string; note: string; raw_text: string; fetched_at: string }[];

    if (newRows.length === 0 && cachedJson) {
      return JSON.parse(cachedJson);
    }

    // Fetch recipients for new interactions
    const newIds = newRows.map((r) => r.id);
    const recipientsMap: Record<string, { recipient_name: string; recipient_login: string }[]> = {};
    if (newIds.length > 0) {
      const placeholders = newIds.map((_, i) => `$${i + 1}`).join(",");
      const recipientRows = await sql.query(
        `SELECT interaction_id, recipient_name, recipient_login FROM interaction_recipients WHERE interaction_id IN (${placeholders})`,
        newIds
      ) as { interaction_id: string; recipient_name: string; recipient_login: string }[];
      for (const row of recipientRows) {
        if (!recipientsMap[row.interaction_id]) recipientsMap[row.interaction_id] = [];
        recipientsMap[row.interaction_id].push({
          recipient_name: row.recipient_name,
          recipient_login: row.recipient_login,
        });
      }
    }

    // Merge new into cached
    const cached: CachedInteraction[] = cachedJson ? JSON.parse(cachedJson) : [];
    const existingIds = new Set(cached.map((c) => c.id));
    const merged = [...cached];

    for (const row of newRows) {
      if (!existingIds.has(row.id)) {
        merged.push({
          ...row,
          recipients: recipientsMap[row.id] || [],
        });
      }
    }

    // Sort by date descending
    merged.sort((a, b) => b.date_added - a.date_added);

    // Save to Redis
    await r.set(CACHE_KEY, JSON.stringify(merged));
    await r.set(LAST_SYNC_KEY, Date.now());

    return merged;
  } catch {
    return fallbackFetch();
  }
}

async function fallbackFetch(): Promise<CachedInteraction[]> {
  const { getInteractions } = await import("./db");
  const result = await getInteractions({ page: 1, pageSize: 100000 });
  const r = getRedis();
  if (r) {
    await r.set(CACHE_KEY, JSON.stringify(result.rows));
    await r.set(LAST_SYNC_KEY, Date.now());
  }
  return result.rows as CachedInteraction[];
}

function applyFiltersAndPagination(
  all: CachedInteraction[],
  query: InteractionQuery
): { rows: CachedInteraction[]; total: number; page: number; pageSize: number; totalPages: number } {
  let filtered = all;

  if (query.dateFrom) {
    const fromTs = dateFromStr(query.dateFrom);
    filtered = filtered.filter((r) => r.date_added >= fromTs);
  }
  if (query.dateTo) {
    const toTs = dateToEndTimestamp(query.dateTo);
    filtered = filtered.filter((r) => r.date_added <= toTs);
  }
  if (query.sender) {
    filtered = filtered.filter((r) => r.sender_name === query.sender);
  }
  if (query.recipient) {
    filtered = filtered.filter((r) => r.recipients.some((rec) => rec.recipient_name === query.recipient));
  }
  if (query.action) {
    filtered = filtered.filter((r) => r.action_type === query.action);
  }
  if (query.note) {
    const noteLower = query.note.toLowerCase();
    filtered = filtered.filter((r) => r.raw_text.toLowerCase().includes(noteLower));
  }
  if (query.activeOnly) {
    const activeSet = new Set([
      "D_e_l_y","Ditoshey","Foxi","fropsya","itsMORIKO","kcIOxan","MariTerryCore",
      "nedrugaya","pepelnayaa","rekvizit8bit","RUSTY","sad_moustache","snezha_mrr",
      "sol1st","squimeh","STREAMIRKA","Tijoe","Wes_Play","WhiskeredPlay",
    ]);
    filtered = filtered.filter((r) => activeSet.has(r.sender_name));
  }

  const total = filtered.length;
  const page = query.page || 1;
  const pageSize = query.pageSize || 50;
  const offset = (page - 1) * pageSize;
  const totalPages = Math.ceil(total / pageSize);

  return {
    rows: filtered.slice(offset, offset + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}
