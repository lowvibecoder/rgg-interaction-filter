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
    return NextResponse.json({ refreshed: false, reason: "data fresh" });
  }

  // Trigger in background — don't await
  (async () => {
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
      console.error("auto-refresh error:", e);
    } finally {
      // Always revalidate so next request gets fresh DB data
      if (needInv) {
        revalidateTag("inventory-items", "max");
        revalidateTag("player-overviews", "max");
      }
      if (needInt) {
        revalidateTag("interactions", "max");
      }
    }
  })();

  return NextResponse.json({
    refreshed: true,
    inventory: needInv ? "triggered" : "skipped",
    interactions: needInt ? "triggered" : "skipped",
  });
}
