import { NextResponse } from "next/server";
import { fetchAndUpsertInteractions } from "@/lib/services";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
