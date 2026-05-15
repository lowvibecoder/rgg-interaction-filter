import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  const sql = neon(process.env.POSTGRES_URL!);

  // Check if data is fresh (less than 60s old)
  const rows = await sql`SELECT MAX(updated_at) as last_update FROM player_items`;
  const lastUpdate = rows[0]?.last_update as Date | null;

  if (lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 60000) {
    return NextResponse.json({ status: "skipped", lastUpdate });
  }

  // Call parse-inventories internally
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.PARSE_URL || "https://rgg-filters.vercel.app";

  const res = await fetch(`${origin}/api/parse-inventories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PARSE_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();
  return NextResponse.json({ status: data.success ? "parsed" : "error", ...data });
}
