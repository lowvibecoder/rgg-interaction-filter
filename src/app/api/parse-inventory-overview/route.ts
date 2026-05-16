import { NextRequest, NextResponse } from "next/server";
import { parseInventoryOverview } from "@/lib/inventoryOverviewParser";
import { upsertPlayerOverview } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.PARSE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://rgg.land/inventories");
    const html = await res.text();
    const players = parseInventoryOverview(html);

    let inserted = 0;
    for (const p of players) {
      await upsertPlayerOverview(p.playerName, p.coins, p.tears, p.effects, p.items, p.specialRolls);
      inserted++;
    }

    return NextResponse.json({ success: true, count: inserted });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
