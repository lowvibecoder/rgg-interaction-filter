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

      console.log("[touch-all] last updated:", {
        interactions: intLast?.toISOString(),
        inventory: invLast?.toISOString(),
        overview: overviewLast?.toISOString(),
      });

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

      console.log("[touch-all] tasks to run:", tasks);
    } catch (e) {
      console.error("[touch-all] error checking timestamps:", e);
      tasks.push("interactions", "inventories", "overview", "game-data");
    }

    const results: Record<string, unknown> = {};

    await Promise.all(
      tasks.map(async (task) => {
        try {
          console.log("[touch-all] starting task:", task);
          if (task === "interactions") {
            results.interactions = await fetchAndUpsertInteractions();
          } else if (task === "inventories") {
            results.inventories = await fetchAndUpsertInventories();
          } else if (task === "overview") {
            results.overview = await fetchAndUpsertOverview();
          } else if (task === "game-data") {
            results["game-data"] = await fetchAndUpsertGameData();
          }
          console.log("[touch-all] task done:", task, results[task]);
        } catch (e: unknown) {
          console.error("[touch-all] task error:", task, e);
          results[task] = { error: String(e) };
        }
      })
    );

    return NextResponse.json({ touched: tasks, results, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
