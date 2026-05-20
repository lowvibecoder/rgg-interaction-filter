import { NextRequest, NextResponse } from "next/server";
import { fetchAndUpsertOverview, ensureTables } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = authenticateRequest(req);
  if (authError) return authError;

  try {
    await ensureTables();
    const result = await fetchAndUpsertOverview();

    return NextResponse.json({ ...result, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
