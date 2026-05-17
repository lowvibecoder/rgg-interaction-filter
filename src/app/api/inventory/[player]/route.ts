import { NextRequest, NextResponse } from "next/server";
import { getPlayerInventory } from "@/lib/inventoryCache";
import { ACTIVE_PLAYERS } from "@/lib/players";
import { getCachedGameItems } from "@/lib/redisCache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ player: string }> }
) {
  const { player } = await params;
  const playerName = ACTIVE_PLAYERS.find(
    (p) => p.toLowerCase() === player.toLowerCase()
  );
  if (!playerName) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const items = await getPlayerInventory(playerName);
  const gameItems = await getCachedGameItems();
  const itemMap = new Map<string, string>();
  for (const gi of gameItems) itemMap.set(gi.name, gi.source);

  return NextResponse.json({
    player: playerName,
    items: items.map((item) => ({
      ...item,
      source: itemMap.get(item.item_name) ?? null,
    })),
    activePlayers: ACTIVE_PLAYERS,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
