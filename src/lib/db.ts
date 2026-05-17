import { neon } from "@neondatabase/serverless";
import { unstable_cache } from "next/cache";
import { ACTIVE_PLAYERS } from "./players";

let _sql: ReturnType<typeof neon> | null = null;
export const getSql = () => {
  if (!_sql) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL environment variable is not set");
    _sql = neon(url);
  }
  return _sql;
};

// Timezone offset in ms: use TZ_OFFSET env var (in hours), fallback to server timezone
const TZ_HOURS = process.env.TZ_OFFSET ? Number(process.env.TZ_OFFSET) : -new Date().getTimezoneOffset() / 60;
const OFFSET = TZ_HOURS * 60 * 60 * 1000; // local timezone offset in ms

// Convert YYYY-MM-DD to local midnight timestamp
function dateFromStr(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + OFFSET;
}
function dateToEndTimestamp(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d + 1) + OFFSET - 1;
}

export async function batchUpsertInteractions(
  interactions: Array<{
    id: string; dateAdded: number; senderName: string; senderLogin: string;
    actionType: string; note: string; rawText: string;
  }>
) {
  const sql = getSql();
  if (interactions.length === 0) return { inserted: 0, updated: 0 };

  // Find which IDs already exist
  const ids = interactions.map((x) => x.id);
  const existingIds = new Set<string>();
  const batchSize = 500;
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const ph = chunk.map((_, j) => `$${j + 1}`).join(", ");
    const rows = await sql.query(`SELECT id FROM interactions WHERE id IN (${ph})`, chunk) as { id: string }[];
    for (const r of rows) existingIds.add(r.id);
  }

  const newItems = interactions.filter((x) => !existingIds.has(x.id));
  const existingItems = interactions.filter((x) => existingIds.has(x.id));

  let inserted = 0;
  if (newItems.length > 0) {
    const fields = 7;
    const values = newItems.map((_, i) => {
      const base = i * fields;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, NOW())`;
    }).join(", ");
    const params = newItems.flatMap((x) => [x.id, x.dateAdded, x.senderName, x.senderLogin, x.actionType, x.note, x.rawText]);
    await sql.query(
      `INSERT INTO interactions (id, date_added, sender_name, sender_login, action_type, note, raw_text, fetched_at) VALUES ${values}`,
      params
    );
    inserted = newItems.length;
  }

  let updated = 0;
  if (existingItems.length > 0) {
    const updateIds = existingItems.map((x) => x.id);
    const placeholders = updateIds.map((_, i) => `$${i + 1}`).join(", ");
    await sql.query(
      `UPDATE interactions SET fetched_at = NOW() WHERE id IN (${placeholders})`,
      updateIds
    );
    updated = existingItems.length;
  }

  return { inserted, updated };
}

export async function batchUpsertAllRecipients(
  recipients: Array<{ interactionId: string; recipientName: string; recipientLogin: string }>
) {
  const sql = getSql();
  if (recipients.length === 0) return;

  const values = recipients.map((_, i) => {
    const base = i * 3;
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  }).join(", ");
  const params = recipients.flatMap((r) => [r.interactionId, r.recipientName, r.recipientLogin]);
  await sql.query(
    `INSERT INTO interaction_recipients (interaction_id, recipient_name, recipient_login) VALUES ${values}
     ON CONFLICT DO NOTHING`,
    params
  );
}

export async function getSenders(filters?: {
  dateFrom?: string; dateTo?: string; recipient?: string; action?: string; note?: string; activeOnly?: boolean;
}) {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  if (filters?.dateFrom) {
    conditions.push(`i.date_added >= $${pi++}::bigint`);
    params.push(String(dateFromStr(filters.dateFrom)));
  }
  if (filters?.dateTo) {
    conditions.push(`i.date_added <= $${pi++}::bigint`);
    params.push(String(dateToEndTimestamp(filters.dateTo)));
  }
  if (filters?.recipient) { conditions.push(`ir.recipient_name = $${pi++}`); params.push(filters.recipient); }
  if (filters?.action) { conditions.push(`i.action_type = $${pi++}`); params.push(filters.action); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map(() => `$${pi++}`).join(",");
    conditions.push(`i.sender_name IN (${ph})`);
    params.push(...ACTIVE_PLAYERS);
  }
  const join = filters?.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : "";
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT DISTINCT i.sender_name FROM interactions i ${join} ${where} ORDER BY i.sender_name`,
    params
  )) as { sender_name: string }[];
  return rows;
}

export async function getRecipients(filters?: {
  dateFrom?: string; dateTo?: string; sender?: string; action?: string; note?: string; activeOnly?: boolean;
}) {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  if (filters?.dateFrom) { conditions.push(`i.date_added >= $${pi++}::bigint`); params.push(String(dateFromStr(filters.dateFrom))); }
  if (filters?.dateTo) { conditions.push(`i.date_added <= $${pi++}::bigint`); params.push(String(dateToEndTimestamp(filters.dateTo))); }
  if (filters?.sender) { conditions.push(`i.sender_name = $${pi++}`); params.push(filters.sender); }
  if (filters?.action) { conditions.push(`i.action_type = $${pi++}`); params.push(filters.action); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map(() => `$${pi++}`).join(",");
    conditions.push(`i.sender_name IN (${ph})`);
    params.push(...ACTIVE_PLAYERS);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT DISTINCT ir.recipient_name FROM interactions i
     JOIN interaction_recipients ir ON ir.interaction_id = i.id
     ${where} ORDER BY ir.recipient_name`,
    params
  )) as { recipient_name: string }[];
  return rows;
}

export async function getActionTypes(filters?: {
  dateFrom?: string; dateTo?: string; sender?: string; recipient?: string; note?: string; activeOnly?: boolean;
}) {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  if (filters?.dateFrom) { conditions.push(`i.date_added >= $${pi++}::bigint`); params.push(String(dateFromStr(filters.dateFrom))); }
  if (filters?.dateTo) { conditions.push(`i.date_added <= $${pi++}::bigint`); params.push(String(dateToEndTimestamp(filters.dateTo))); }
  if (filters?.sender) { conditions.push(`i.sender_name = $${pi++}`); params.push(filters.sender); }
  if (filters?.recipient) { conditions.push(`ir.recipient_name = $${pi++}`); params.push(filters.recipient); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map(() => `$${pi++}`).join(",");
    conditions.push(`i.sender_name IN (${ph})`);
    params.push(...ACTIVE_PLAYERS);
  }
  const join = filters?.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : "";
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql.query(
    `SELECT DISTINCT i.action_type FROM interactions i ${join} ${where} ORDER BY i.action_type`,
    params
  )) as { action_type: string }[];
  return rows;
}

export async function getDateRange() {
  const sql = getSql();
  const rows = (await sql`
    SELECT MIN(date_added) as min_date, MAX(date_added) as max_date FROM interactions
  `) as { min_date: number | null; max_date: number | null }[];
  if (!rows[0]?.min_date || !rows[0]?.max_date) {
    return { minDate: null, maxDate: null };
  }
  const min = Number(rows[0].min_date);
  const max = Number(rows[0].max_date);
  // Shift by local timezone offset to align with user's local date
  const minD = new Date(min + OFFSET);
  const maxD = new Date(max + OFFSET);
  if (minD.getUTCFullYear() === maxD.getUTCFullYear() && minD.getUTCMonth() === maxD.getUTCMonth()) {
    return {
      minDate: new Date(Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), 1)),
      maxDate: new Date(Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    };
  }
  return { minDate: minD, maxDate: maxD };
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

interface InteractionResult {
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

export async function getInteractions(query: InteractionQuery) {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (query.dateFrom) {
    conditions.push(`i.date_added >= $${paramIndex++}::bigint`);
    params.push(String(dateFromStr(query.dateFrom)));
  }
  if (query.dateTo) {
    conditions.push(`i.date_added <= $${paramIndex++}::bigint`);
    params.push(String(dateToEndTimestamp(query.dateTo)));
  }
  if (query.sender) {
    conditions.push(`i.sender_name = $${paramIndex++}`);
    params.push(query.sender);
  }
  if (query.recipient) {
    conditions.push(`ir.recipient_name = $${paramIndex++}`);
    params.push(query.recipient);
  }
  if (query.action) {
    conditions.push(`i.action_type = $${paramIndex++}`);
    params.push(query.action);
  }
  if (query.note) {
    conditions.push(`i.raw_text ILIKE $${paramIndex++}`);
    params.push(`%${query.note}%`);
  }
  if (query.activeOnly) {
    const placeholders = ACTIVE_PLAYERS.map(() => `$${paramIndex++}`).join(",");
    conditions.push(`i.sender_name IN (${placeholders})`);
    params.push(...ACTIVE_PLAYERS);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const page = query.page || 1;
  const pageSize = query.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const queryStr = `
    SELECT DISTINCT i.id, i.date_added, i.sender_name, i.sender_login,
           i.action_type, i.note, i.raw_text, i.fetched_at
    FROM interactions i
    ${query.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : ""}
    ${where}
    ORDER BY i.date_added DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  const rows = (await sql.query(
    queryStr,
    [...params, pageSize, offset]
  )) as { id: string; date_added: number; sender_name: string; sender_login: string; action_type: string; note: string; raw_text: string; fetched_at: string }[];

  const countQueryStr = `
    SELECT COUNT(DISTINCT i.id) as total
    FROM interactions i
    ${query.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : ""}
    ${where}
  `;
  const countResult = (await sql.query(countQueryStr, params)) as { total: string }[];

  const total = Number(countResult[0]?.total || 0);

  const ids = rows.map((r) => r.id);
  const recipientsMap: Record<string, { recipient_name: string; recipient_login: string }[]> = {};

  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const recipientRows = (await sql.query(
      `SELECT interaction_id, recipient_name, recipient_login FROM interaction_recipients WHERE interaction_id IN (${placeholders})`,
      ids
    )) as { interaction_id: string; recipient_name: string; recipient_login: string }[];

    for (const r of recipientRows) {
      if (!recipientsMap[r.interaction_id]) recipientsMap[r.interaction_id] = [];
      recipientsMap[r.interaction_id].push({
        recipient_name: r.recipient_name,
        recipient_login: r.recipient_login,
      });
    }
  }

  return {
    rows: rows.map((r) => ({
      ...r,
      recipients: recipientsMap[r.id] || [],
    })) as InteractionResult[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

interface GameItemRecord {
  name: string;
  description: string;
  source: string;
  icon: string;
}

export async function getGameItems(): Promise<GameItemRecord[]> {
  const sql = getSql();
  return (await sql`
    SELECT name, description, source, icon FROM game_items
  `) as GameItemRecord[];
}

export async function getInventoryItems(searchTerm?: string): Promise<string[]> {
  const sql = getSql();
  if (searchTerm) {
    const rows = await sql`
      SELECT DISTINCT pi.item_name
      FROM player_items pi
      LEFT JOIN game_items gi ON gi.name = pi.item_name
      WHERE pi.item_name ILIKE ${'%' + searchTerm + '%'}
         OR gi.description ILIKE ${'%' + searchTerm + '%'}
      ORDER BY pi.item_name
    ` as { item_name: string }[];
    return rows.map(r => r.item_name);
  }
  const rows = await sql`
    SELECT DISTINCT item_name FROM player_items ORDER BY item_name
  ` as { item_name: string }[];
  return rows.map(r => r.item_name);
}

export async function getPlayerOverallInventory(playerName: string): Promise<{
  item_name: string;
  item_type: string;
  quantity: number;
  source: string | null;
}[]> {
  const sql = getSql();
  return await sql`
    SELECT pi.item_name, pi.item_type, SUM(pi.quantity) as quantity, MIN(gi.source) as source
    FROM player_items pi
    LEFT JOIN game_items gi ON gi.name = pi.item_name
    WHERE pi.player_name = ${playerName}
    GROUP BY pi.item_name, pi.item_type
    ORDER BY pi.item_type, pi.item_name
  ` as { item_name: string; item_type: string; quantity: number; source: string | null }[];
}

export async function getPlayersByInventoryItem(itemName: string): Promise<{
  player_name: string;
  item_type: string;
  total_quantity: number;
}[]> {
  const sql = getSql();
  return await sql`
    SELECT player_name, item_type, SUM(quantity) as total_quantity
    FROM player_items
    WHERE item_name = ${itemName}
    GROUP BY player_name, item_type
    ORDER BY player_name
  ` as { player_name: string; item_type: string; total_quantity: number }[];
}

export async function getInventoryLastUpdated(): Promise<Date | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT MAX(updated_at) as last_update FROM player_items
  ` as { last_update: Date | null }[];
  return rows[0]?.last_update || null;
}

export async function getInteractionsLastUpdated(): Promise<Date | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT MAX(fetched_at) as last_update FROM interactions
  ` as { last_update: Date | null }[];
  return rows[0]?.last_update || null;
}

// ── Player Overview ──

export async function upsertPlayerOverview(
  playerName: string,
  coins: number,
  tears: number,
  effects: number,
  items: number,
  specialRolls: number
) {
  const sql = getSql();
  await sql`
    INSERT INTO player_overview (player_name, coins, tears, effects, items, special_rolls, updated_at)
    VALUES (${playerName}, ${coins}, ${tears}, ${effects}, ${items}, ${specialRolls}, NOW())
    ON CONFLICT (player_name)
    DO UPDATE SET
      coins = EXCLUDED.coins,
      tears = EXCLUDED.tears,
      effects = EXCLUDED.effects,
      items = EXCLUDED.items,
      special_rolls = EXCLUDED.special_rolls,
      updated_at = NOW()
  `;
}

export async function getPlayerOverviews(): Promise<{
  player_name: string;
  coins: number;
  tears: number;
  effects: number;
  items: number;
  special_rolls: number;
}[]> {
  const sql = getSql();
  return await sql`
    SELECT player_name, coins, tears, effects, items, special_rolls
    FROM player_overview
    ORDER BY player_name
  ` as { player_name: string; coins: number; tears: number; effects: number; items: number; special_rolls: number }[];
}

export async function getPlayerOverviewLastUpdated(): Promise<Date | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT MAX(updated_at) as last_update FROM player_overview
  ` as { last_update: Date | null }[];
  return rows[0]?.last_update || null;
}

export async function batchUpsertPlayerOverviews(
  players: Array<{ playerName: string; coins: number; tears: number; effects: number; items: number; specialRolls: number }>
) {
  const sql = getSql();
  if (players.length === 0) return;
  const values = players.map((_, i) => {
    const base = i * 6;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, NOW())`;
  }).join(", ");
  const params = players.flatMap((p) => [p.playerName, p.coins, p.tears, p.effects, p.items, p.specialRolls]);
  await sql.query(
    `INSERT INTO player_overview (player_name, coins, tears, effects, items, special_rolls, updated_at)
     VALUES ${values}
     ON CONFLICT (player_name) DO UPDATE SET
       coins = EXCLUDED.coins,
       tears = EXCLUDED.tears,
       effects = EXCLUDED.effects,
       items = EXCLUDED.items,
       special_rolls = EXCLUDED.special_rolls,
       updated_at = NOW()`,
    params
  );
}

// ── Cached wrappers for server components ──

export const getCachedGameItems = unstable_cache(
  async () => getGameItems(),
  ["game-items"],
  { revalidate: false, tags: ["game-items"] }
);

export const getCachedInventoryItems = unstable_cache(
  async (searchTerm?: string) => getInventoryItems(searchTerm),
  ["inventory-items"],
  { revalidate: false, tags: ["inventory-items"] }
);

export const getCachedPlayerOverviews = unstable_cache(
  async () => getPlayerOverviews(),
  ["player-overviews"],
  { revalidate: false, tags: ["player-overviews"] }
);

export const getCachedSenders = unstable_cache(
  async (filters?: {
    dateFrom?: string; dateTo?: string; recipient?: string; action?: string; note?: string; activeOnly?: boolean;
  }) => getSenders(filters),
  ["senders"],
  { revalidate: false, tags: ["interactions"] }
);

export const getCachedRecipients = unstable_cache(
  async (filters?: {
    dateFrom?: string; dateTo?: string; sender?: string; action?: string; note?: string; activeOnly?: boolean;
  }) => getRecipients(filters),
  ["recipients"],
  { revalidate: false, tags: ["interactions"] }
);

export const getCachedActionTypes = unstable_cache(
  async (filters?: {
    dateFrom?: string; dateTo?: string; sender?: string; recipient?: string; note?: string; activeOnly?: boolean;
  }) => getActionTypes(filters),
  ["action-types"],
  { revalidate: false, tags: ["interactions"] }
);

export const getCachedDateRange = unstable_cache(
  async () => getDateRange(),
  ["date-range"],
  { revalidate: false, tags: ["interactions"] }
);

export const getCachedInteractionsLastUpdated = unstable_cache(
  async () => getInteractionsLastUpdated(),
  ["interactions-last-updated"],
  { revalidate: false, tags: ["interactions"] }
);

export const getCachedInventoryLastUpdated = unstable_cache(
  async () => getInventoryLastUpdated(),
  ["inventory-last-updated"],
  { revalidate: false, tags: ["inventory-items"] }
);

export const getCachedPlayerOverviewLastUpdated = unstable_cache(
  async () => getPlayerOverviewLastUpdated(),
  ["player-overview-last-updated"],
  { revalidate: false, tags: ["player-overviews"] }
);

export const getCachedPlayersByInventoryItem = unstable_cache(
  async (itemName: string) => getPlayersByInventoryItem(itemName),
  ["players-by-item"],
  { revalidate: false, tags: ["inventory-items"] }
);
