import { NextResponse } from "next/server";
import { parseInteractions } from "@/lib/parser";
import { upsertInteraction, upsertRecipients } from "@/lib/db";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch("https://rgg.land/interactions");
    const html = await res.text();

    const parsed = parseInteractions(html);

    let inserted = 0;
    for (const interaction of parsed) {
      await upsertInteraction(
        interaction.id,
        interaction.dateAdded,
        interaction.senderName,
        interaction.senderLogin,
        interaction.actionType,
        interaction.note,
        interaction.rawText
      );
      await upsertRecipients(interaction.id, interaction.recipients);
      inserted++;
    }

    return NextResponse.json({
      success: true,
      count: inserted,
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
