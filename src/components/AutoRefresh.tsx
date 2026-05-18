"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const last = localStorage.getItem("touch-all-ts");
    const now = Date.now();
    if (last && now - Number(last) < COOLDOWN_MS) {
      console.log("[AutoRefresh] skipped, cooldown active");
      return;
    }

    console.log("[AutoRefresh] calling touch-all...");
    fetch("/api/touch-all")
      .then((r) => r.json())
      .then((data) => {
        console.log("[AutoRefresh] touch-all response:", data);
        if (data.touched?.length > 0) {
          console.log("[AutoRefresh] refreshing page, touched:", data.touched);
          router.refresh();
        } else {
          console.log("[AutoRefresh] nothing to update");
        }
      })
      .catch((e) => console.error("[AutoRefresh] fetch failed:", e));
    localStorage.setItem("touch-all-ts", String(now));
  }, [router]);

  return null;
}
