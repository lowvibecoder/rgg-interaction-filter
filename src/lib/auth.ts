import { NextResponse } from "next/server";

export function authenticateRequest(request: { headers: { get: (name: string) => string | null } }): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token !== process.env.PARSE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
