"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const last = localStorage.getItem("touch-all-ts");
    const now = Date.now();
    if (last && now - Number(last) < COOLDOWN_MS) return;

    fetch("/api/touch-all")
      .then((r) => r.json())
      .then((data) => {
        if (data.touched?.length > 0) router.refresh();
      })
      .catch(() => {});
    localStorage.setItem("touch-all-ts", String(now));
  }, [router]);

  return null;
}
