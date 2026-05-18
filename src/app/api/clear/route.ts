import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSql } from "@/lib/db";
import { invalidateInteractionCache } from "@/lib/interactionCache";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
