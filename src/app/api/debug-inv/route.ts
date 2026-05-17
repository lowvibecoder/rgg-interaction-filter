import { NextResponse } from "next/server";
import { getAllInventoryItems, getPlayerOverviews } from "@/lib/inventoryCache";
import { getRedis } from "@/lib/redis";

export async function GET() {
  const r = getRedis();
  const items = await getAllInventoryItems();
  const overviews = await getPlayerOverviews();

  let rawInvAll: string | null = null;
  let rawInvMeta: string | null = null;
  let rawInvOverview: string | null = null;
  let testWrite = false;

  if (r) {
    try {
      rawInvAll = await r.get("inv:all");
      rawInvMeta = await r.get("inv:meta");
      rawInvOverview = await r.get("inv:overview");

      await r.set("debug:test", "ok", { ex: 60 });
      const testRead = await r.get("debug:test");
      testWrite = testRead === "ok";
    } catch (e) {
      rawInvAll = `error: ${e}`;
    }
  }

  return NextResponse.json({
    redisConnected: !!r,
    itemsCount: items.length,
    overviewsCount: overviews.length,
    rawInvAllLength: rawInvAll?.length ?? null,
    rawInvMeta,
    rawInvOverviewLength: rawInvOverview?.length ?? null,
    testWrite,
    sampleItems: items.slice(0, 3),
    sampleOverviews: overviews.slice(0, 3),
  });
}
