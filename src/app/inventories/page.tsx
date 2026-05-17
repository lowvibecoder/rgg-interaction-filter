import type { Metadata } from "next";
import {
  getCachedInventoryItems, getCachedGameItems, getCachedPlayerOverviews,
  getCachedInventoryLastUpdated, getCachedPlayerOverviewLastUpdated,
  getCachedPlayersByInventoryItem, getCachedAllInventoryItems,
} from "@/lib/redisCache";
import InventoriesPageClient from "@/components/InventoriesPageClient";

export const metadata: Metadata = {
  title: "Инвентари | RGG",
};

interface PageProps {
  searchParams: Promise<{ item?: string; q?: string; panel?: string; view?: string; hideEffects?: string; hideItems?: string; hideSpecialRolls?: string }>;
}

export const revalidate = 300;

export default async function InventoriesPage({ searchParams }: PageProps) {
  const { item, q, panel, view, hideEffects, hideItems, hideSpecialRolls } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (item) params.set("item", item);
  if (panel) params.set("panel", panel);
  if (view) params.set("view", view);
  if (hideEffects !== undefined) params.set("hideEffects", hideEffects);
  if (hideItems !== undefined) params.set("hideItems", hideItems);
  if (hideSpecialRolls !== undefined) params.set("hideSpecialRolls", hideSpecialRolls);
  if (!params.has("hideEffects")) params.set("hideEffects", "true");
  if (!params.has("hideItems")) params.set("hideItems", "false");
  if (!params.has("hideSpecialRolls")) params.set("hideSpecialRolls", "true");
  const [allItems, allInventoryItems, gameItems, lastUpdated, overview, overviewLastUpdated] = await Promise.all([
    getCachedInventoryItems(),
    getCachedAllInventoryItems(),
    getCachedGameItems(),
    getCachedInventoryLastUpdated(),
    getCachedPlayerOverviews(),
    getCachedPlayerOverviewLastUpdated(),
  ]);

  const gameItemMap: Record<string, string> = {};
  for (const gi of gameItems) {
    gameItemMap[gi.name] = gi.description;
  }

  const players = item ? await getCachedPlayersByInventoryItem(item) : [];
  const itemInfo = item ? (gameItemMap[item] ?? null) : null;

  return (
    <InventoriesPageClient
      overview={overview}
      allItems={allItems}
      allInventoryItems={allInventoryItems}
      players={players}
      itemInfo={itemInfo}
      selectedItem={item || ""}
      lastUpdated={lastUpdated?.toISOString() ?? null}
      overviewLastUpdated={overviewLastUpdated?.toISOString() ?? null}
      q={q || ""}
      panel={panel || "open"}
      gameItemMap={gameItemMap}
      />
  );
}
