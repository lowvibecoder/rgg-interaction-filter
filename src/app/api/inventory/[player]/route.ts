import { NextRequest, NextResponse } from "next/server";
import { getPlayerOverallInventory } from "@/lib/db";
import { ACTIVE_PLAYERS } from "@/lib/players";

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

  const items = await getPlayerOverallInventory(playerName);

  return NextResponse.json({
    player: playerName,
    items: items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
    })),
    activePlayers: ACTIVE_PLAYERS,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
    },
  });
}
