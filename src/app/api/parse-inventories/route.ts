import { NextResponse } from "next/server";
import { fetchAndUpsertInventories, ensureTables } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth";

export async function POST(request: Request) {
  const authError = authenticateRequest(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const result = await fetchAndUpsertInventories();

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
