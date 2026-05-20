import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSql } from "@/lib/db";
import { invalidateInteractionCache } from "@/lib/interactionCache";
import { authenticateRequest } from "@/lib/auth";

export async function POST(request: Request) {
  const authError = authenticateRequest(request);
  if (authError) return authError;

  try {
    const sql = getSql();

    await sql`DELETE FROM interaction_recipients`;
    await sql`DELETE FROM interactions`;

    revalidateTag("interactions", "max");
    await invalidateInteractionCache();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Clear error:", error);
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  }
}
