import { NextResponse } from "next/server";
import { parseGamePage } from "@/lib/gameDataParser";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = [
    { url: "https://rgg.land/wheels", key: "wheels" },
    { url: "https://rgg.land/items", key: "items" },
    { url: "https://rgg.land/rolls", key: "rolls" },
    { url: "https://rgg.land/effects", key: "effects" },
    { url: "https://rgg.land/global-events", key: "global-events" },
  ];

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL!);

  let totalInserted = 0;
  const results: Record<string, number> = {};

  for (const page of pages) {
    try {
      const res = await fetch(page.url);
      const html = await res.text();
      const items = parseGamePage(html, page.key);

      let inserted = 0;
      for (const item of items) {
        try {
          await sql`
            INSERT INTO game_items (name, description, source, icon)
            VALUES (${item.title}, ${item.description || ""}, ${item.source}, ${item.icon || ""})
            ON CONFLICT (name, source) DO UPDATE SET
              description = EXCLUDED.description,
              icon = EXCLUDED.icon
          `;
          inserted++;
        } catch { /* skip duplicates */ }
      }
      results[page.key] = inserted;
      totalInserted += inserted;
    } catch (e) {
      results[page.key] = -1; // error
    }
  }

  return NextResponse.json({
    success: true,
    total: totalInserted,
    results,
    timestamp: new Date().toISOString(),
  });
}
