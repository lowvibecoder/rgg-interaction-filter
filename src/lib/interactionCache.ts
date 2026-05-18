import { getSql, getInteractions } from "./db";
import { getRedis } from "./redis";

const CACHE_KEY = "interactions:all";
const HASH_KEY = "interactions:hash";
const LAST_SYNC_KEY = "interactions:lastSyncTs";

interface CachedInteraction {
  id: string;
  date_added: number;
  sender_name: string;
  sender_login: string;
  action_type: string;
  note: string;
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

export async function getCachedInteractionsDelta(query: InteractionQuery): Promise<{
  rows: CachedInteraction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  // Note filter requires raw_text which is not cached (bandwidth savings).
  // Fall back to direct DB query when note filter is active.
  if (query.note) {
    const dbResult = await getInteractions(query);
    return {
      rows: dbResult.rows.map((r) => ({
        id: r.id,
        date_added: r.date_added,
        sender_name: r.sender_name,
        sender_login: r.sender_login,
        action_type: r.action_type,
        note: r.note,
        fetched_at: r.fetched_at,
        recipients: r.recipients,
      })),
      total: dbResult.total,
      page: dbResult.page,
      pageSize: dbResult.pageSize,
      totalPages: dbResult.totalPages,
    };
  }

  const all = await getAllInteractions();
  return applyFiltersAndPagination(all, query);
}

export async function setInteractionHash(hash: string) {
  const r = getRedis();
  if (r) await r.set(HASH_KEY, hash, { ex: 86400 * 7 });
}

// Called by healthz after parsing new interactions — merges only new rows into cache
export async function refreshInteractionCache() {
  const r = getRedis();
  if (!r) return;

  const sql = getSql();
  const lastSync = await r.get<number>(LAST_SYNC_KEY) ?? 0;

  // Only fetch rows newer than last sync (raw_text excluded — only needed for DB-level ILIKE filtering)
  const newRows = await sql.query(
    `SELECT id, date_added, sender_name, sender_login, action_type, note, fetched_at
     FROM interactions WHERE date_added > $1::bigint ORDER BY date_added DESC`,
    [String(lastSync)]
  ) as { id: string; date_added: number; sender_name: string; sender_login: string; action_type: string; note: string; fetched_at: string }[];

  if (newRows.length === 0) return;

  // Fetch recipients for new interactions
  const newIds = newRows.map((r) => r.id);
  const recipientsMap: Record<string, { recipient_name: string; recipient_login: string }[]> = {};
  if (newIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < newIds.length; i += batchSize) {
      const chunk = newIds.slice(i, i + batchSize);
      const placeholders = chunk.map((_, j) => `$${j + 1}`).join(",");
      const recipientRows = await sql.query(
        `SELECT interaction_id, recipient_name, recipient_login FROM interaction_recipients WHERE interaction_id IN (${placeholders})`,
        chunk
      ) as { interaction_id: string; recipient_name: string; recipient_login: string }[];
      for (const row of recipientRows) {
        if (!recipientsMap[row.interaction_id]) recipientsMap[row.interaction_id] = [];
        recipientsMap[row.interaction_id].push({
          recipient_name: row.recipient_name,
          recipient_login: row.recipient_login,
        });
      }
    }
  }

  // Merge into existing cache
  const cachedJson = await r.get<string>(CACHE_KEY);
  const cached: CachedInteraction[] = cachedJson ? JSON.parse(cachedJson) : [];
  const existingIds = new Set(cached.map((c) => c.id));

  for (const row of newRows) {
    if (!existingIds.has(row.id)) {
      cached.push({
        ...row,
        recipients: recipientsMap[row.id] || [],
      });
    }
  }

  cached.sort((a, b) => b.date_added - a.date_added);
  await r.set(CACHE_KEY, JSON.stringify(cached), { ex: 86400 });
  // Use max date_added from fetched rows, NOT wall clock time
  const maxDateAdded = Math.max(...newRows.map((r) => r.date_added));
  await r.set(LAST_SYNC_KEY, maxDateAdded);
}

export async function invalidateInteractionCache() {
  const r = getRedis();
  if (r) {
    await r.del(CACHE_KEY);
    await r.del(HASH_KEY);
    await r.del(LAST_SYNC_KEY);
  }
}

async function getAllInteractions(): Promise<CachedInteraction[]> {
  const r = getRedis();
  if (!r) return fallbackFetch();

  try {
    const cachedJson = await r.get<string>(CACHE_KEY);
    if (cachedJson) {
      return JSON.parse(cachedJson);
    }
  } catch { /* ignore */ }

  return fallbackFetch();
}

async function fallbackFetch(): Promise<CachedInteraction[]> {
  const sql = getSql();
  const r = getRedis();

  // Initial build: fetch ALL from DB (only happens once, then cached in Redis)
  // raw_text excluded — only needed for DB-level ILIKE filtering (note filter falls back to DB)
  const rows = await sql.query(
    `SELECT i.id, i.date_added, i.sender_name, i.sender_login,
            i.action_type, i.note, i.fetched_at
     FROM interactions i
     ORDER BY i.date_added DESC`
  ) as { id: string; date_added: number; sender_name: string; sender_login: string; action_type: string; note: string; fetched_at: string }[];

  const ids = rows.map((r) => r.id);
  const recipientsMap: Record<string, { recipient_name: string; recipient_login: string }[]> = {};

  if (ids.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      const placeholders = chunk.map((_, j) => `$${j + 1}`).join(",");
      const recipientRows = await sql.query(
        `SELECT interaction_id, recipient_name, recipient_login FROM interaction_recipients WHERE interaction_id IN (${placeholders})`,
        chunk
      ) as { interaction_id: string; recipient_name: string; recipient_login: string }[];
      for (const row of recipientRows) {
        if (!recipientsMap[row.interaction_id]) recipientsMap[row.interaction_id] = [];
        recipientsMap[row.interaction_id].push({
          recipient_name: row.recipient_name,
          recipient_login: row.recipient_login,
        });
      }
    }
  }

  const result: CachedInteraction[] = rows.map((r) => ({
    ...r,
    recipients: recipientsMap[r.id] || [],
  }));

  if (r) {
    await r.set(CACHE_KEY, JSON.stringify(result), { ex: 86400 });
    if (rows.length > 0) {
      await r.set(LAST_SYNC_KEY, Math.max(...rows.map((r) => r.date_added)));
    }
  }

  return result;
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
    // Note filter requires raw_text (not in cache for bandwidth savings).
    // Caller should fall back to DB query when note filter is active.
    // Here we skip this filter — results will be unfiltered by note.
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
