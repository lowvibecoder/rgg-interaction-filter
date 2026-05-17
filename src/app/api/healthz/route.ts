import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getInteractionsLastUpdated } from "@/lib/db";
import { fetchAndUpsertInventories, fetchAndUpsertInteractions, fetchAndUpsertOverview, ensureTables } from "@/lib/services";
import { invalidateAllCache, getCachedInventoryLastUpdated, getCachedInteractionsLastUpdated } from "@/lib/redisCache";
import { refreshInteractionCache, setInteractionHash } from "@/lib/interactionCache";
import { getRedis } from "@/lib/redis";

const INV_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const INT_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

async function fetchWithHash(url: string): Promise<{ html: string; hash: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const html = await res.text();
    const hash = simpleHash(html);
    return { html, hash };
  } catch {
    return null;
  }
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

async function getContentHash(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  return await r.get<string>(key);
}

async function setContentHash(key: string, hash: string) {
  const r = getRedis();
  if (!r) return;
  await r.set(key, hash, { ex: 86400 * 7 });
}

export async function GET() {
  const [invLast, intLast] = await Promise.all([
    getCachedInventoryLastUpdated(),
    getCachedInteractionsLastUpdated(),
  ]);

  const now = Date.now();
  const invAge = invLast ? now - new Date(invLast).getTime() : Infinity;
  const intAge = intLast ? now - new Date(intLast).getTime() : Infinity;

  const needInv = invAge > INV_REFRESH_MS;
  const needInt = intAge > INT_REFRESH_MS;

  if (!needInv && !needInt) {
    return NextResponse.json({
      status: "ok",
      refreshed: false,
      inventoryAgeMin: Math.round(invAge / 60000),
      interactionsAgeMin: Math.round(intAge / 60000),
    });
  }

  let invUpdated = false;
  let intUpdated = false;
  let invTotal = 0;

  try {
    await ensureTables();

    if (needInv) {
      const overviewResult = await fetchWithHash("https://rgg.land/inventories");
      if (overviewResult) {
        const prevHash = await getContentHash("hash:overview");
        if (prevHash !== overviewResult.hash) {
          await fetchAndUpsertOverview();
          await setContentHash("hash:overview", overviewResult.hash);
          invUpdated = true;
        }
      }

      const { ACTIVE_PLAYERS } = await import("@/lib/players");
      let anyInvChanged = false;
      await Promise.all(
        ACTIVE_PLAYERS.map(async (player) => {
          const url = `https://rgg.land/inventories/${encodeURIComponent(player.toLowerCase())}`;
          const result = await fetchWithHash(url);
          if (result) {
            const prevHash = await getContentHash(`hash:inv:${player}`);
            if (prevHash !== result.hash) {
              anyInvChanged = true;
              await setContentHash(`hash:inv:${player}`, result.hash);
            }
          }
        })
      );

      if (anyInvChanged) {
        const invResult = await fetchAndUpsertInventories();
        invTotal = invResult.total;
        invUpdated = true;
      }
    }

    if (needInt) {
      const intResult = await fetchWithHash("https://rgg.land/interactions");
      if (intResult) {
        const prevHash = await getContentHash("hash:interactions");
        if (prevHash !== intResult.hash) {
          await fetchAndUpsertInteractions();
          await setContentHash("hash:interactions", intResult.hash);
          await setInteractionHash(intResult.hash);
          intUpdated = true;
        }
      }
    }
  } catch (e) {
    return NextResponse.json({
      status: "error",
      error: String(e),
    }, { status: 500 });
  }

  if (invUpdated || intUpdated) {
    await invalidateAllCache();
  }
  if (intUpdated) {
    await refreshInteractionCache();
  }

  if (invUpdated) {
    revalidateTag("inventory-items", "max");
    revalidateTag("player-overviews", "max");
  }
  if (intUpdated) {
    revalidateTag("interactions", "max");
  }

  return NextResponse.json({
    status: "ok",
    refreshed: invUpdated || intUpdated,
    inventory: needInv ? (invUpdated ? "updated" : "unchanged") : "skipped",
    interactions: needInt ? (intUpdated ? "updated" : "unchanged") : "skipped",
    invTotal,
  });
}
