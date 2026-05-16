import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { ACTIVE_PLAYERS } from "@/lib/players";
import { parseInventoryPage } from "@/lib/inventoryParser";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.POSTGRES_URL!);

  // Ensure table exists
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

  // Clear existing data
  await sql`DELETE FROM player_items`;

  const allItems: { playerName: string; itemName: string; itemType: string; quantity: number }[] = [];
  const errors: string[] = [];

  // Process all players in parallel with a shorter timeout
  const results = await Promise.allSettled(
    ACTIVE_PLAYERS.map(async (player) => {
      const res = await fetch(`https://rgg.land/inventories/${encodeURIComponent(player.toLowerCase())}`, {
        signal: AbortSignal.timeout(5000),
      });
      const html = await res.text();
      return parseInventoryPage(html, player);
    })
  );
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value);
    } else {
      errors.push("batch failed");
    }
  }

  // Batch insert
  let totalInserted = 0;
  for (const item of allItems) {
    await sql`
      INSERT INTO player_items (player_name, item_name, item_type, quantity)
      VALUES (${item.playerName}, ${item.itemName}, ${item.itemType}, ${item.quantity})
      ON CONFLICT (player_name, item_name, item_type)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()
    `;
    totalInserted++;
  }

  return NextResponse.json({
    success: true,
    total: totalInserted,
    players: ACTIVE_PLAYERS.length,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  });
}
