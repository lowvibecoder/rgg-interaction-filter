import type { Metadata } from "next";
import {
  getInventoryItems, getPlayersByInventoryItem, getGameItems,
  getInventoryLastUpdated, getPlayerOverviews, getPlayerOverviewLastUpdated,
} from "@/lib/db";
import InventoriesPageClient from "@/components/InventoriesPageClient";

export const metadata: Metadata = {
  title: "Инвентари | RGG",
};

interface PageProps {
  searchParams: Promise<{ item?: string; q?: string; panel?: string }>;
}

export default async function InventoriesPage({ searchParams }: PageProps) {
  const { item, q } = await searchParams;
  const [allItems, gameItems, lastUpdated, overview, overviewLastUpdated] = await Promise.all([
    getInventoryItems(q || undefined),
    getGameItems(),
    getInventoryLastUpdated(),
    getPlayerOverviews(),
    getPlayerOverviewLastUpdated(),
  ]);

  const gameItemMap = new Map<string, { description: string; source: string }>();
  for (const gi of gameItems) {
    gameItemMap.set(gi.name, { description: gi.description, source: gi.source });
  }

  const players = item ? await getPlayersByInventoryItem(item) : [];
  const itemInfo = item ? (gameItemMap.get(item) ?? null) : null;

  return (
    <InventoriesPageClient
      overview={overview}
      allItems={allItems}
      players={players}
      itemInfo={itemInfo}
      selectedItem={item || ""}
      lastUpdated={lastUpdated?.toISOString() ?? null}
      overviewLastUpdated={overviewLastUpdated?.toISOString() ?? null}
    />
  );
}
