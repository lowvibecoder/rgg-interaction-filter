import { NextResponse } from "next/server";
import {
  fetchAndUpsertInteractions,
  fetchAndUpsertInventories,
  fetchAndUpsertOverview,
  fetchAndUpsertGameData,
  ensureTables,
} from "@/lib/services";
import { getSql } from "@/lib/db";

export async function GET() {
  try {
    await ensureTables();

    const sql = getSql();
    const now = Date.now();
    const tasks: string[] = [];

    try {
      const rows = await sql`
        SELECT
          (SELECT MAX(fetched_at) FROM interactions) as interactions_last,
          (SELECT MAX(updated_at) FROM player_items) as inventories_last,
          (SELECT MAX(updated_at) FROM player_overview) as overview_last,
          (SELECT MAX(updated_at) FROM game_items) as game_data_last
      ` as { interactions_last: Date | null; inventories_last: Date | null; overview_last: Date | null; game_data_last: Date | null }[];
      const r = rows[0];
      const threshold = 300000;
      if (!r.interactions_last || now - new Date(r.interactions_last).getTime() > threshold) tasks.push("interactions");
      if (!r.inventories_last || now - new Date(r.inventories_last).getTime() > threshold) tasks.push("inventories");
      if (!r.overview_last || now - new Date(r.overview_last).getTime() > threshold) tasks.push("overview");
      if (!r.game_data_last || now - new Date(r.game_data_last).getTime() > threshold) tasks.push("game-data");
    } catch {
      tasks.push("interactions", "inventories", "overview", "game-data");
    }

    const results: Record<string, unknown> = {};

    await Promise.all(
      tasks.map(async (task) => {
        try {
          if (task === "interactions") {
            results.interactions = await fetchAndUpsertInteractions();
          } else if (task === "inventories") {
            results.inventories = await fetchAndUpsertInventories();
          } else if (task === "overview") {
            results.overview = await fetchAndUpsertOverview();
          } else if (task === "game-data") {
            results["game-data"] = await fetchAndUpsertGameData();
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
