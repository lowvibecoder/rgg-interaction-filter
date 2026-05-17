"use client";

import { useEffect } from "react";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefreshTrigger() {
  useEffect(() => {
    const trigger = () => fetch("/api/auto-refresh").catch(() => {});
    trigger();
    const id = setInterval(trigger, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
