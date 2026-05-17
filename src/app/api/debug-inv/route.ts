import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { InventoryItem } from "@/lib/inventoryCache";

const INV_ALL_KEY = "inv:all";

export async function GET() {
  const r = getRedis();
  if (!r) return NextResponse.json({ error: "Redis not connected" });

  // Test 1: Direct read
  const raw1 = await r.get<string>(INV_ALL_KEY);
  
  // Test 2: Read without type param
  const raw2 = await r.get(INV_ALL_KEY);
  
  // Test 3: Try parsing
  let parsed: any = null;
  let parseError: string | null = null;
  try {
    parsed = raw1 ? JSON.parse(raw1) : null;
  } catch (e: any) {
    parseError = e.message;
  }

  return NextResponse.json({
    raw1Type: typeof raw1,
    raw1Length: raw1?.length ?? null,
    raw1Preview: raw1 ? raw1.substring(0, 200) : null,
    raw2Type: typeof raw2,
    raw2Length: typeof raw2 === 'string' ? raw2.length : null,
    parsedCount: parsed?.length ?? null,
    parseError,
    sample: parsed?.slice(0, 2) ?? null,
  });
}
