import { neon } from "@neondatabase/serverless";
import { ACTIVE_PLAYERS } from "./players";
import { dateFromStr, dateToEndTimestamp, OFFSET } from "./dateUtils";

export { dateFromStr, dateToEndTimestamp };

let _sql: ReturnType<typeof neon> | null = null;
export const getSql = () => {
  if (!_sql) {
    const url = process.env.POSTGRES_URL;
    if (!url) throw new Error("POSTGRES_URL environment variable is not set");
    _sql = neon(url);
  }
  return _sql;
};

export async function batchUpsertInteractions(
  interactions: Array<{
    id: string; dateAdded: number; senderName: string; senderLogin: string;
    actionType: string; note: string; rawText: string;
  }>
) {
  const sql = getSql();
  if (interactions.length === 0) return { inserted: 0, updated: 0 };

  const fields = 7;
  const values = interactions.map((_, i) => {
    const base = i * fields;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, NOW())`;
  }).join(", ");
  const params = interactions.flatMap((x) => [x.id, x.dateAdded, x.senderName, x.senderLogin, x.actionType, x.note, x.rawText]);

  await sql.query(
    `INSERT INTO interactions (id, date_added, sender_name, sender_login, action_type, note, raw_text, fetched_at)
     VALUES ${values}
     ON CONFLICT (id) DO UPDATE SET fetched_at = NOW()`,
    params
  );

  return { inserted: interactions.length };
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

export async function getSendersAll(): Promise<{ sender_name: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT DISTINCT sender_name FROM interactions ORDER BY sender_name
  `) as { sender_name: string }[];
}

export async function getRecipientsAll(): Promise<{ recipient_name: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT DISTINCT ir.recipient_name FROM interactions i
    JOIN interaction_recipients ir ON ir.interaction_id = i.id
    ORDER BY ir.recipient_name
  `) as { recipient_name: string }[];
}

export async function getActionTypesAll(): Promise<{ action_type: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT DISTINCT action_type FROM interactions ORDER BY action_type
  `) as { action_type: string }[];
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

  const selectCols = `i.id, i.date_added, i.sender_name, i.sender_login, i.action_type, i.note, i.fetched_at`;

  const queryStr = `
    SELECT DISTINCT ${selectCols},
           COUNT(*) OVER() as total
    FROM interactions i
    ${query.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : ""}
    ${where}
    ORDER BY i.date_added DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  const rows = (await sql.query(
    queryStr,
    [...params, pageSize, offset]
  )) as { id: string; date_added: number; sender_name: string; sender_login: string; action_type: string; note: string; raw_text?: string; fetched_at: string; total: string }[];

  const total = Number(rows[0]?.total || 0);

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

export async function getGameItems(): Promise<{ name: string; description: string; source: string; icon: string }[]> {
  const sql = getSql();
  return (await sql`
    SELECT name, description, source, icon FROM game_items ORDER BY name LIMIT 10000
  `) as { name: string; description: string; source: string; icon: string }[];
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
    LIMIT 1000
  ` as { player_name: string; coins: number; tears: number; effects: number; items: number; special_rolls: number }[];
}

export async function getPlayerOverviewLastUpdated(): Promise<Date | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT MAX(updated_at) as last_update FROM player_overview
  ` as { last_update: Date | null }[];
  return rows[0]?.last_update || null;
}

