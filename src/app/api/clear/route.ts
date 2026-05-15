import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.POSTGRES_URL!);

    const delRecipients = await sql`DELETE FROM interaction_recipients`;
    const delInteractions = await sql`DELETE FROM interactions`;

    return NextResponse.json({
      success: true,
      deleted: { recipients: delRecipients.length, interactions: delInteractions.length },
    });
  } catch (error) {
    console.error("Clear error:", error);
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  }
}
