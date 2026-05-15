import { neon } from "@neondatabase/serverless";
import { ACTIVE_PLAYERS } from "./players";

const getSql = () => neon(process.env.POSTGRES_URL!);

export async function upsertInteraction(
  id: string,
  dateAdded: number,
  senderName: string,
  senderLogin: string,
  actionType: string,
  note: string,
  rawText: string
) {
  const sql = getSql();
  await sql`
    INSERT INTO interactions (id, date_added, sender_name, sender_login, action_type, note, raw_text)
    VALUES (${id}, ${dateAdded}, ${senderName}, ${senderLogin}, ${actionType}, ${note}, ${rawText})
    ON CONFLICT (id) DO UPDATE SET
      date_added = EXCLUDED.date_added,
      sender_name = EXCLUDED.sender_name,
      sender_login = EXCLUDED.sender_login,
      action_type = EXCLUDED.action_type,
      note = EXCLUDED.note,
      raw_text = EXCLUDED.raw_text,
      fetched_at = NOW()
  `;
}

export async function upsertRecipients(
  interactionId: string,
  recipients: Array<{ recipientName: string; recipientLogin: string }>
) {
  const sql = getSql();
  await sql`DELETE FROM interaction_recipients WHERE interaction_id = ${interactionId}`;
  for (const r of recipients) {
    await sql`
      INSERT INTO interaction_recipients (interaction_id, recipient_name, recipient_login)
      VALUES (${interactionId}, ${r.recipientName}, ${r.recipientLogin})
    `;
  }
}

export async function getSenders(filters?: {
  dateFrom?: string; dateTo?: string; recipient?: string; action?: string; note?: string; activeOnly?: boolean;
}) {
  const sql = getSql();
  const conditions: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  if (filters?.dateFrom) { conditions.push(`i.date_added >= $${pi++}`); params.push(new Date(filters.dateFrom).getTime()); }
  if (filters?.dateTo) { conditions.push(`i.date_added <= $${pi++}`); params.push(new Date(filters.dateTo).getTime() + 86400000); }
  if (filters?.recipient) { conditions.push(`ir.recipient_name = $${pi++}`); params.push(filters.recipient); }
  if (filters?.action) { conditions.push(`i.action_type = $${pi++}`); params.push(filters.action); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map((_, i) => `$${pi++}`).join(",");
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
  if (filters?.dateFrom) { conditions.push(`i.date_added >= $${pi++}`); params.push(new Date(filters.dateFrom).getTime()); }
  if (filters?.dateTo) { conditions.push(`i.date_added <= $${pi++}`); params.push(new Date(filters.dateTo).getTime() + 86400000); }
  if (filters?.sender) { conditions.push(`i.sender_name = $${pi++}`); params.push(filters.sender); }
  if (filters?.action) { conditions.push(`i.action_type = $${pi++}`); params.push(filters.action); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map((_, i) => `$${pi++}`).join(",");
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
  if (filters?.dateFrom) { conditions.push(`i.date_added >= $${pi++}`); params.push(new Date(filters.dateFrom).getTime()); }
  if (filters?.dateTo) { conditions.push(`i.date_added <= $${pi++}`); params.push(new Date(filters.dateTo).getTime() + 86400000); }
  if (filters?.sender) { conditions.push(`i.sender_name = $${pi++}`); params.push(filters.sender); }
  if (filters?.recipient) { conditions.push(`ir.recipient_name = $${pi++}`); params.push(filters.recipient); }
  if (filters?.note) { conditions.push(`i.raw_text ILIKE $${pi++}`); params.push(`%${filters.note}%`); }
  if (filters?.activeOnly) {
    const ph = ACTIVE_PLAYERS.map((_, i) => `$${pi++}`).join(",");
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
  const min = new Date(Number(rows[0].min_date));
  const max = new Date(Number(rows[0].max_date));
  // If same month/year, spread to full month
  if (min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth()) {
    return {
      minDate: new Date(min.getFullYear(), min.getMonth(), 1),
      maxDate: new Date(min.getFullYear(), min.getMonth() + 1, 0),
    };
  }
  return { minDate: min, maxDate: max };
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
    conditions.push(`i.date_added >= $${paramIndex++}`);
    params.push(new Date(query.dateFrom).getTime());
  }
  if (query.dateTo) {
    conditions.push(`i.date_added <= $${paramIndex++}`);
    params.push(new Date(query.dateTo).getTime() + 86400000);
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
    const placeholders = ACTIVE_PLAYERS.map((_, i) => `$${paramIndex++}`).join(",");
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
  )) as any[];

  const countQueryStr = `
    SELECT COUNT(DISTINCT i.id) as total
    FROM interactions i
    ${query.recipient ? "JOIN interaction_recipients ir ON ir.interaction_id = i.id" : ""}
    ${where}
  `;
  const countResult = (await sql.query(countQueryStr, params)) as any[];

  const total = Number(countResult[0]?.total || 0);

  const ids = rows.map((r) => r.id);
  const recipientsMap: Record<string, { recipient_name: string; recipient_login: string }[]> = {};

  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const recipientRows = (await sql.query(
      `SELECT interaction_id, recipient_name, recipient_login FROM interaction_recipients WHERE interaction_id IN (${placeholders})`,
      ids
    )) as any[];

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
