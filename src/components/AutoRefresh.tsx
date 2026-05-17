"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh() {
  const router = useRouter();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    fetch("/api/touch-all")
      .then((r) => r.json())
      .then((data) => {
        if (data.touched && data.touched.length > 0) {
          router.refresh();
        }
      })
      .catch(() => {});
  }, [router]);

  return null;
}
