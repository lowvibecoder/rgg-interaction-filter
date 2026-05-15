import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  const sql = neon(process.env.POSTGRES_URL!);
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.PARSE_URL || "https://rgg-filters.vercel.app";
  const headers = {
    Authorization: `Bearer ${process.env.PARSE_SECRET}`,
    "Content-Type": "application/json",
  };

  const now = Date.now();
  const tasks: string[] = [];

  // Check interactions staleness
  const intRows = await sql`SELECT MAX(fetched_at) as last_update FROM interactions`;
  const intLast = intRows[0]?.last_update as Date | null;
  if (!intLast || now - new Date(intLast).getTime() > 120000) {
    tasks.push("interactions");
  }

  // Check inventories staleness
  const invRows = await sql`SELECT MAX(updated_at) as last_update FROM player_items`;
  const invLast = invRows[0]?.last_update as Date | null;
  if (!invLast || now - new Date(invLast).getTime() > 120000) {
    tasks.push("inventories");
  }

  const results: Record<string, unknown> = {};

  // Run stale tasks in parallel
  await Promise.all(
    tasks.map(async (task) => {
      try {
        const endpoint = task === "interactions" ? "/api/parse" : "/api/parse-inventories";
        const res = await fetch(`${origin}${endpoint}`, { method: "POST", headers });
        results[task] = await res.json();
      } catch (e) {
        results[task] = { error: String(e) };
      }
    })
  );

  return NextResponse.json({ touched: tasks, results, timestamp: new Date().toISOString() });
}
