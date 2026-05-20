import type { Metadata } from "next";
import {
  getCachedInventoryItems, getCachedGameItems, getCachedPlayerOverviews,
  getCachedInventoryLastUpdated, getCachedPlayerOverviewLastUpdated,
  getCachedPlayersByInventoryItem, getCachedAllInventoryItems,
} from "@/lib/redisCache";
import InventoriesPageClient from "@/components/InventoriesPageClient";
import { buildGameItemMap } from "@/lib/buildGameItemMap";

export const metadata: Metadata = {
  title: "Инвентари | RGG",
};

interface PageProps {
  searchParams: Promise<{ item?: string; q?: string; panel?: string }>;
}

export const revalidate = 300;

export default async function InventoriesPage({ searchParams }: PageProps) {
  const { item, q, panel } = await searchParams;
  const [allItems, allInventoryItems, gameItems, lastUpdated, overview, overviewLastUpdated] = await Promise.all([
    getCachedInventoryItems(),
    getCachedAllInventoryItems(),
    getCachedGameItems(),
    getCachedInventoryLastUpdated(),
    getCachedPlayerOverviews(),
    getCachedPlayerOverviewLastUpdated(),
  ]);

  const gameItemMap = buildGameItemMap(gameItems);

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
