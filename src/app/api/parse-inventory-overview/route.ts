import { NextRequest, NextResponse } from "next/server";
import { fetchAndUpsertOverview, ensureTables } from "@/lib/services";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.PARSE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTables();
    const result = await fetchAndUpsertOverview();

    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
