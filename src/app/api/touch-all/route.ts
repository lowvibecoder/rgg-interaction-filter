import { NextResponse } from "next/server";
import {
  fetchAndUpsertInteractions,
  fetchAndUpsertInventories,
  fetchAndUpsertOverview,
  fetchAndUpsertGameData,
  ensureTables,
} from "@/lib/services";
import { getInventoryLastUpdated, getPlayerOverviewLastUpdated } from "@/lib/inventoryCache";
import { getInteractionsLastUpdated } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export async function GET() {
  try {
    await ensureTables();

    const now = Date.now();
    const tasks: string[] = [];

    try {
      const [intLast, invLast, overviewLast] = await Promise.all([
        getInteractionsLastUpdated(),
        getInventoryLastUpdated(),
        getPlayerOverviewLastUpdated(),
      ]);

      const r = getRedis();
      let gameLast: Date | null = null;
      if (r) {
        const raw = await r.get<number>("cache:game-data-last-updated");
        if (raw) gameLast = new Date(raw);
      }

      const threshold = 300000;
      if (!intLast || now - intLast.getTime() > threshold) tasks.push("interactions");
      if (!invLast || now - invLast.getTime() > threshold) tasks.push("inventories");
      if (!overviewLast || now - overviewLast.getTime() > threshold) tasks.push("overview");
      if (!gameLast || now - gameLast.getTime() > threshold) tasks.push("game-data");
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
