import { NextResponse } from "next/server";
import { fetchAndUpsertInteractions, ensureTables } from "@/lib/services";
import { authenticateRequest } from "@/lib/auth";

export async function POST(request: Request) {
  const authError = authenticateRequest(request);
  if (authError) return authError;

  try {
    await ensureTables();
    const result = await fetchAndUpsertInteractions();

    return NextResponse.json({
      ...result,
      errors: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse interactions" },
      { status: 500 }
    );
  }
}
