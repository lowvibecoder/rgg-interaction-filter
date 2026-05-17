import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getInventoryLastUpdated, getInteractionsLastUpdated } from "@/lib/db";
import { fetchAndUpsertInventories, fetchAndUpsertInteractions, fetchAndUpsertOverview, ensureTables } from "@/lib/services";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  const [invLast, intLast] = await Promise.all([
    getInventoryLastUpdated(),
    getInteractionsLastUpdated(),
  ]);

  const now = Date.now();
  const invAge = invLast ? now - new Date(invLast).getTime() : Infinity;
  const intAge = intLast ? now - new Date(intLast).getTime() : Infinity;

  const needInv = invAge > REFRESH_INTERVAL_MS;
  const needInt = intAge > REFRESH_INTERVAL_MS;

  if (!needInv && !needInt) {
    return NextResponse.json({
      status: "ok",
      refreshed: false,
      inventoryAge: Math.round(invAge / 60000),
      interactionsAge: Math.round(intAge / 60000),
    });
  }

  try {
    await ensureTables();
    if (needInv) {
      await fetchAndUpsertInventories();
      await fetchAndUpsertOverview();
    }
    if (needInt) {
      await fetchAndUpsertInteractions();
    }
  } catch (e) {
    return NextResponse.json({
      status: "error",
      error: String(e),
    }, { status: 500 });
  }

  if (needInv) {
    revalidateTag("inventory-items", "max");
    revalidateTag("player-overviews", "max");
  }
  if (needInt) {
    revalidateTag("interactions", "max");
  }

  return NextResponse.json({
    status: "ok",
    refreshed: true,
    inventory: needInv ? "updated" : "skipped",
    interactions: needInt ? "updated" : "skipped",
  });
}
