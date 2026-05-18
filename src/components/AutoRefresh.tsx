"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefresh() {
  const router = useRouter();

  const checkAndRefresh = useCallback(() => {
    const last = localStorage.getItem("touch-all-ts");
    const now = Date.now();
    if (last && now - Number(last) < COOLDOWN_MS) return;

    localStorage.setItem("touch-all-ts", String(now));
    fetch("/api/touch-all")
      .then((r) => r.json())
      .then((data) => {
        if (data.touched?.length > 0) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const handler = () => checkAndRefresh();
    document.addEventListener("click", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [checkAndRefresh]);

  return null;
}
