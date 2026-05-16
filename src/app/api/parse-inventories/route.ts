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

  try {
    const sql = neon(process.env.POSTGRES_URL!);

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

    await sql`DELETE FROM player_items`;

    const allItems: { playerName: string; itemName: string; itemType: string; quantity: number }[] = [];
    const errors: string[] = [];

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

    let totalInserted = 0;
    // Batch insert in chunks of 50 to avoid oversized queries
    for (let i = 0; i < allItems.length; i += 50) {
      const chunk = allItems.slice(i, i + 50);
      const values = chunk.map((_, j) => {
        const base = j * 4;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4})`;
      }).join(",");
      const params = chunk.flatMap((item) => [item.playerName, item.itemName, item.itemType, item.quantity]);
      await sql.query(
        `INSERT INTO player_items (player_name, item_name, item_type, quantity)
         VALUES ${values}
         ON CONFLICT (player_name, item_name, item_type)
         DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
        params
      );
      totalInserted += chunk.length;
    }

    return NextResponse.json({
      success: true,
      total: totalInserted,
      players: ACTIVE_PLAYERS.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
