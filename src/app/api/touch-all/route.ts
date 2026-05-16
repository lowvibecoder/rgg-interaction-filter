import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { ACTIVE_PLAYERS } from "@/lib/players";
import { parseInventoryPage } from "@/lib/inventoryParser";
import { parseInteractions } from "@/lib/parser";
import { upsertInteraction, upsertRecipients, upsertPlayerOverview } from "@/lib/db";
import { parseInventoryOverview } from "@/lib/inventoryOverviewParser";

export async function GET() {
  try {
    const sql = neon(process.env.POSTGRES_URL!);

    // Ensure all tables exist
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

    const now = Date.now();
    const tasks: string[] = [];

    // Check interactions staleness
    try {
      const intRows = await sql`SELECT MAX(fetched_at) as last_update FROM interactions`;
      const intLast = intRows[0]?.last_update as Date | null;
      if (!intLast || now - new Date(intLast).getTime() > 120000) {
        tasks.push("interactions");
      }
    } catch { tasks.push("interactions"); }

    // Check inventories staleness
    try {
      const invRows = await sql`SELECT MAX(updated_at) as last_update FROM player_items`;
      const invLast = invRows[0]?.last_update as Date | null;
      if (!invLast || now - new Date(invLast).getTime() > 120000) {
        tasks.push("inventories");
      }
    } catch { tasks.push("inventories"); }

    // Check player overview staleness
    try {
      const ovRows = await sql`SELECT MAX(updated_at) as last_update FROM player_overview`;
      const ovLast = ovRows[0]?.last_update as Date | null;
      if (!ovLast || now - new Date(ovLast).getTime() > 120000) {
        tasks.push("overview");
      }
    } catch { tasks.push("overview"); }

  const results: Record<string, unknown> = {};

  await Promise.all(
    tasks.map(async (task) => {
      try {
        if (task === "interactions") {
          // Direct call to parse logic
          const res = await fetch("https://rgg.land/interactions");
          const html = await res.text();
          const parsed = parseInteractions(html);
          let inserted = 0;
          for (const interaction of parsed) {
            await upsertInteraction(
              interaction.id, interaction.dateAdded, interaction.senderName,
              interaction.senderLogin, interaction.actionType, interaction.note, interaction.rawText
            );
            await upsertRecipients(interaction.id, interaction.recipients);
            inserted++;
          }
          results.interactions = { success: true, count: inserted, parsed: parsed.length };
        } else if (task === "inventories") {
          const allItems: { playerName: string; itemName: string; itemType: string; quantity: number }[] = [];
          const batchResults = await Promise.allSettled(
            ACTIVE_PLAYERS.map(async (player) => {
              const res = await fetch(`https://rgg.land/inventories/${encodeURIComponent(player.toLowerCase())}`, {
                signal: AbortSignal.timeout(5000),
              });
              return parseInventoryPage(await res.text(), player);
            })
          );
          for (const r of batchResults) {
            if (r.status === "fulfilled") allItems.push(...r.value);
          }
          await sql`DELETE FROM player_items`;
          let inserted = 0;
          for (const item of allItems) {
            await sql`
              INSERT INTO player_items (player_name, item_name, item_type, quantity)
              VALUES (${item.playerName}, ${item.itemName}, ${item.itemType}, ${item.quantity})
              ON CONFLICT (player_name, item_name, item_type)
              DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
            `;
            inserted++;
          }
          results.inventories = { success: true, total: inserted, players: ACTIVE_PLAYERS.length };
        } else if (task === "overview") {
          const res = await fetch("https://rgg.land/inventories");
          const html = await res.text();
          const players = parseInventoryOverview(html);
          let inserted = 0;
          for (const p of players) {
            await upsertPlayerOverview(p.playerName, p.coins, p.tears, p.effects, p.items, p.specialRolls);
            inserted++;
          }
          results.overview = { success: true, count: inserted };
        }
      } catch (e: unknown) {
        results[task] = { error: String(e) };
      }
    })
  );

  return NextResponse.json({ touched: tasks, results, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
