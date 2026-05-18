import { revalidateTag } from "next/cache";
import { ACTIVE_PLAYERS } from "./players";
import { parseInteractions } from "./parser";
import { parseInventoryPage } from "./inventoryParser";
import { parseInventoryOverview } from "./inventoryOverviewParser";
import { parseGamePage } from "./gameDataParser";
import {
  batchUpsertInteractions,
  batchUpsertAllRecipients,
  getSql,
} from "./db";
import { invalidateInteractionCache } from "./interactionCache";
import { setAllInventoryItems, setPlayerOverviews } from "./inventoryCache";

export async function ensureTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      date_added BIGINT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_login TEXT NOT NULL,
      action_type TEXT NOT NULL,
      note TEXT DEFAULT '',
      raw_text TEXT DEFAULT '',
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS interaction_recipients (
      interaction_id TEXT NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
      recipient_name TEXT NOT NULL,
      recipient_login TEXT NOT NULL,
      PRIMARY KEY (interaction_id, recipient_name, recipient_login)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS player_items (
      player_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (player_name, item_name, item_type)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS player_overview (
      player_name TEXT PRIMARY KEY,
      coins INTEGER NOT NULL DEFAULT 0,
      tears INTEGER NOT NULL DEFAULT 0,
      effects INTEGER NOT NULL DEFAULT 0,
      items INTEGER NOT NULL DEFAULT 0,
      special_rolls INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS game_items (
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      source TEXT NOT NULL,
      icon TEXT DEFAULT '',
      PRIMARY KEY (name, source)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_recipients_name_interaction ON interaction_recipients(recipient_name, interaction_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interactions_raw_text_trgm ON interactions USING gin (raw_text gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interactions_date_added ON interactions(date_added DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interactions_sender_date ON interactions(sender_name, date_added DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_player_items_item_name ON player_items(item_name)`;
}

export async function fetchAndUpsertInteractions() {
  const res = await fetch("https://rgg.land/interactions");
  const html = await res.text();
  const parsed = parseInteractions(html);

  await batchUpsertInteractions(parsed);
  const allRecipients = parsed.flatMap((interaction) =>
    interaction.recipients.map((r) => ({
      interactionId: interaction.id,
      recipientName: r.recipientName,
      recipientLogin: r.recipientLogin,
    }))
  );
  await batchUpsertAllRecipients(allRecipients);

  if (parsed.length > 0) {
    revalidateTag("interactions", "max");
    await invalidateInteractionCache();
  }

  return { success: true, count: parsed.length, parsed: parsed.length };
}

export async function fetchAndUpsertInventories() {
  const allItems: { playerName: string; itemName: string; itemType: string; quantity: number }[] = [];

  const results = await Promise.allSettled(
    ACTIVE_PLAYERS.map(async (player) => {
      const res = await fetch(`https://rgg.land/inventories/${encodeURIComponent(player.toLowerCase())}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.error(`Failed to fetch inventory for ${player}: ${res.status}`);
        return { player, items: [] };
      }
      const items = parseInventoryPage(await res.text(), player);
      return { player, items };
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
    }
  }

  await setAllInventoryItems(allItems);
  revalidateTag("inventory-items", "max");

  return { success: true, total: allItems.length, players: ACTIVE_PLAYERS.length };
}

export async function fetchAndUpsertOverview() {
  const res = await fetch("https://rgg.land/inventories");
  const html = await res.text();
  const players = parseInventoryOverview(html);

  await setPlayerOverviews(players.map((p) => ({
    player_name: p.playerName,
    coins: p.coins,
    tears: p.tears,
    effects: p.effects,
    items: p.items,
    special_rolls: p.specialRolls,
  })));
  revalidateTag("player-overviews", "max");

  return { success: true, count: players.length };
}

const GAME_DATA_PAGES = [
  { url: "https://rgg.land/wheels", key: "wheels" },
  { url: "https://rgg.land/items", key: "items" },
  { url: "https://rgg.land/rolls", key: "rolls" },
  { url: "https://rgg.land/effects", key: "effects" },
  { url: "https://rgg.land/global-events", key: "global-events" },
];

export async function fetchAndUpsertGameData() {
  const sql = getSql();

  const fetchResults = await Promise.allSettled(
    GAME_DATA_PAGES.map(async (page) => {
      const res = await fetch(page.url);
      const html = await res.text();
      return { key: page.key, items: parseGamePage(html, page.key) };
    })
  );

  let totalInserted = 0;
  const results: Record<string, number> = {};

  for (const result of fetchResults) {
    if (result.status === "rejected") {
      results[result.reason?.key ?? "unknown"] = -1;
      continue;
    }
    const { key, items } = result.value;
    let inserted = 0;
    if (items.length > 0) {
      const values = items.map((_, i) => {
        const base = i * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(", ");
      const params = items.flatMap((item) => [item.title, item.description || "", item.source, item.icon || ""]);
      await sql.query(
        `INSERT INTO game_items (name, description, source, icon)
         VALUES ${values}
         ON CONFLICT (name, source) DO UPDATE SET
           description = EXCLUDED.description,
           icon = EXCLUDED.icon`,
        params
      );
      inserted = items.length;
    }
    results[key] = inserted;
    totalInserted += inserted;
  }

  if (totalInserted > 0) {
    revalidateTag("game-items", "max");
    const r = (await import("@/lib/redis")).getRedis();
    if (r) await r.set("cache:game-data-last-updated", Date.now(), { ex: 86400 * 7 });
  }

  return { success: true, total: totalInserted, results };
}
