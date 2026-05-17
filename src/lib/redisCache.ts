import { getRedis } from "./redis";
import {
  getGameItems, getInteractionsLastUpdated, getDateRange,
  getSenders, getRecipients, getActionTypes,
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

export function getCachedInventoryItems(searchTerm?: string) {
  const key = searchTerm ? `cache:inventory-items:${searchTerm}` : "cache:inventory-items";
  return cached(key, () => getUniqueItemNames());
}

export function getCachedPlayerOverviews() {
  return cached("cache:player-overviews", () => getPlayerOverviews());
}

export function getCachedInventoryLastUpdated() {
  return getInventoryLastUpdated();
}

export function getCachedPlayerOverviewLastUpdated() {
  return getPlayerOverviewLastUpdated();
}

export function getCachedInteractionsLastUpdated() {
  return cached("cache:interactions-last-updated", () => getInteractionsLastUpdated());
}

export function getCachedDateRange() {
  return cached("cache:date-range", () => getDateRange());
}

export function getCachedSenders(filters?: {
  dateFrom?: string; dateTo?: string; recipient?: string; action?: string; note?: string; activeOnly?: boolean;
}) {
  const key = `cache:senders:${JSON.stringify(filters ?? {})}`;
  return cached(key, () => getSenders(filters));
}

export function getCachedRecipients(filters?: {
  dateFrom?: string; dateTo?: string; sender?: string; action?: string; note?: string; activeOnly?: boolean;
}) {
  const key = `cache:recipients:${JSON.stringify(filters ?? {})}`;
  return cached(key, () => getRecipients(filters));
}

export function getCachedActionTypes(filters?: {
  dateFrom?: string; dateTo?: string; sender?: string; recipient?: string; note?: string; activeOnly?: boolean;
}) {
  const key = `cache:action-types:${JSON.stringify(filters ?? {})}`;
  return cached(key, () => getActionTypes(filters));
}

export function getCachedPlayersByInventoryItem(itemName: string) {
  return cached(`cache:players-by-item:${itemName}`, () => getPlayersByItem(itemName));
}

export async function invalidateAllCache() {
  const r = getRedis();
  if (!r) return;
  const keys = await r.keys("cache:*");
  if (keys.length > 0) await r.del(...keys);
}
