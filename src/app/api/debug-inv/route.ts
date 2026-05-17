import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET() {
  try {
    const r = getRedis();
    if (!r) return NextResponse.json({ error: "Redis not connected" });

    const raw = await r.get("inv:all");
    
    let parsed: any = null;
    let parseError: string | null = null;
    if (raw && typeof raw === "string") {
      try {
        parsed = JSON.parse(raw);
      } catch (e: any) {
        parseError = e.message;
      }
    }

    return NextResponse.json({
      rawType: typeof raw,
      rawLength: typeof raw === "string" ? raw.length : null,
      rawPreview: typeof raw === "string" ? raw.substring(0, 300) : null,
      parsedCount: Array.isArray(parsed) ? parsed.length : null,
      parseError,
      sample: Array.isArray(parsed) ? parsed.slice(0, 2) : null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
