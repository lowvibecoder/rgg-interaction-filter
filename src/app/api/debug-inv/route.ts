import { NextResponse } from "next/server";
import { getAllInventoryItems, getPlayerOverviews } from "@/lib/inventoryCache";
import { getRedis } from "@/lib/redis";

export async function GET() {
  const r = getRedis();
  const items = await getAllInventoryItems();
  const overviews = await getPlayerOverviews();

  return NextResponse.json({
    redisConnected: !!r,
    itemsCount: items.length,
    overviewsCount: overviews.length,
    sampleItems: items.slice(0, 5),
    sampleOverviews: overviews.slice(0, 3),
  });
}
