import { getRedis } from "./redis";
import { getSql } from "./db";
import {
  getGameItems, getInteractionsLastUpdated, getDateRange,
  getSendersAll, getRecipientsAll, getActionTypesAll,
} from "./db";
import {
  getUniqueItemNames, getPlayersByItem, getPlayerOverviews,
  getInventoryLastUpdated, getPlayerOverviewLastUpdated,
} from "./inventoryCache";

const TTL = 300;
const TTL_LONG = 86400;

async function cached<T>(key: string, fn: () => Promise<T>, ttl = TTL): Promise<T> {
  const r = getRedis();
  if (!r) return fn();
  try {
    const raw = await r.get<string>(key);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const data = await fn();
  try {
    await r.set(key, JSON.stringify(data), { ex: ttl });
  } catch { /* ignore */ }
  return data;
}

export function getCachedGameItems() {
  return cached("cache:game-items", () => getGameItems(), TTL_LONG);
}

export function getCachedInventoryItems() {
  return cached("cache:inventory-items", () => getUniqueItemNames());
}

export function getCachedPlayerOverviews() {
  return cached("cache:player-overviews", () => getPlayerOverviews());
}

export function getCachedInventoryLastUpdated() {
  return cached("cache:inventory-last-updated", () => getInventoryLastUpdated());
}

export function getCachedPlayerOverviewLastUpdated() {
  return cached("cache:player-overview-last-updated", () => getPlayerOverviewLastUpdated());
}

export function getCachedInteractionsLastUpdated() {
  return cached("cache:interactions-last-updated", () => getInteractionsLastUpdated());
}

export function getCachedDateRange() {
  return cached("cache:date-range", () => getDateRange());
}

export function getCachedSendersAll() {
  return cached("cache:senders:all", () => getSendersAll(), TTL_LONG);
}

export function getCachedRecipientsAll() {
  return cached("cache:recipients:all", () => getRecipientsAll(), TTL_LONG);
}

export function getCachedActionTypesAll() {
  return cached("cache:action-types:all", () => getActionTypesAll(), TTL_LONG);
}

export function getCachedPlayersByInventoryItem(itemName: string) {
  return cached(`cache:players-by-item:${itemName}`, () => getPlayersByItem(itemName));
}

export async function getCachedAllInventoryItems() {
  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get<unknown[]>("inv:all");
      if (Array.isArray(raw) && raw.length > 0) return raw as { playerName: string; itemName: string; itemType: string; quantity: number }[];
    } catch { /* fall through to DB */ }
  }
  // DB fallback: aggregate from player_items
  const sql = getSql();
  const rows = await sql`
    SELECT player_name, item_name, item_type, quantity
    FROM player_items
    ORDER BY player_name, item_name
    LIMIT 50000
  ` as { player_name: string; item_name: string; item_type: string; quantity: number }[];
  return rows.map(r => ({
    playerName: r.player_name,
    itemName: r.item_name,
    itemType: r.item_type,
    quantity: r.quantity,
  }));
}

export async function invalidateAllCache() {
  const r = getRedis();
  if (!r) return;
  const keys = await r.keys("cache:*");
  if (keys.length > 0) await r.del(...keys);
}
