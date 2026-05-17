import { getRedis } from "./redis";

const INV_ALL_KEY = "inv:all";
const INV_OVERVIEW_KEY = "inv:overview";
const INV_META_KEY = "inv:meta";

export interface InventoryItem {
  playerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
}

export interface PlayerOverview {
  player_name: string;
  coins: number;
  tears: number;
  effects: number;
  items: number;
  special_rolls: number;
}

export interface InventoryMeta {
  updatedAt: number;
}

async function getRedisOrThrow() {
  const r = getRedis();
  if (!r) throw new Error("Redis not configured");
  return r;
}

// ── Write ──

export async function setAllInventoryItems(items: InventoryItem[]) {
  const r = await getRedisOrThrow();
  await r.set(INV_ALL_KEY, JSON.stringify(items), { ex: 86400 });
  await r.set(INV_META_KEY, JSON.stringify({ updatedAt: Date.now() }), { ex: 86400 });
}

export async function setPlayerOverviews(overviews: PlayerOverview[]) {
  const r = await getRedisOrThrow();
  await r.set(INV_OVERVIEW_KEY, JSON.stringify(overviews), { ex: 86400 });
  await r.set(INV_META_KEY, JSON.stringify({ updatedAt: Date.now() }), { ex: 86400 });
}

// ── Read ──

export async function getAllInventoryItems(): Promise<InventoryItem[]> {
  const r = getRedis();
  if (!r) return [];
  const raw = await r.get<string>(INV_ALL_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getUniqueItemNames(): Promise<string[]> {
  const items = await getAllInventoryItems();
  const names = new Set<string>();
  for (const item of items) names.add(item.itemName);
  return [...names].sort();
}

export async function getPlayersByItem(itemName: string): Promise<{
  player_name: string;
  item_type: string;
  total_quantity: number;
}[]> {
  const items = await getAllInventoryItems();
  const filtered = items.filter((i) => i.itemName === itemName);
  const map = new Map<string, { player_name: string; item_type: string; total_quantity: number }>();
  for (const item of filtered) {
    const key = `${item.playerName}||${item.itemType}`;
    const existing = map.get(key);
    if (existing) {
      existing.total_quantity += item.quantity;
    } else {
      map.set(key, { player_name: item.playerName, item_type: item.itemType, total_quantity: item.quantity });
    }
  }
  return [...map.values()].sort((a, b) => a.player_name.localeCompare(b.player_name));
}

export async function getPlayerInventory(playerName: string): Promise<{
  item_name: string;
  item_type: string;
  quantity: number;
}[]> {
  const items = await getAllInventoryItems();
  const filtered = items.filter((i) => i.playerName === playerName);
  const map = new Map<string, { item_name: string; item_type: string; quantity: number }>();
  for (const item of filtered) {
    const key = `${item.itemName}||${item.itemType}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { item_name: item.itemName, item_type: item.itemType, quantity: item.quantity });
    }
  }
  return [...map.values()].sort((a, b) => a.item_type.localeCompare(b.item_type) || a.item_name.localeCompare(b.item_name));
}

export async function getPlayerOverviews(): Promise<PlayerOverview[]> {
  const r = getRedis();
  if (!r) return [];
  const raw = await r.get<string>(INV_OVERVIEW_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getInventoryLastUpdated(): Promise<Date | null> {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get<string>(INV_META_KEY);
  if (!raw) return null;
  const meta: InventoryMeta = JSON.parse(raw);
  return new Date(meta.updatedAt);
}

export async function getPlayerOverviewLastUpdated(): Promise<Date | null> {
  return getInventoryLastUpdated();
}

// ── Invalidate ──

export async function invalidateInventoryCache() {
  const r = getRedis();
  if (!r) return;
  await r.del(INV_ALL_KEY, INV_OVERVIEW_KEY, INV_META_KEY);
}
