"use client";

import { useState, useEffect } from "react";

function calcDisplay(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "только что";
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  if (sec < 10) return "только что";
  if (sec < 60) return `${sec} сек. назад`;
  if (min < 60) return `${min} мин. назад`;
  if (hrs < 24) return `${hrs} ч. ${min % 60} мин. назад`;
  return `${Math.floor(hrs / 24)} дн. назад`;
}

export default function LiveTimestamp({ date, label = "обновлено" }: { date: Date | string | null; label?: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!date) return;
    const target = new Date(date);

    const tick = () => setDisplay(calcDisplay(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;

  // For SSR: compute initial display synchronously
  const ssrDisplay = display || calcDisplay(new Date(date));

  return (
    <span style={{ fontSize: "0.75rem", color: "var(--mui-palette-text-secondary, #999)" }}>
      {label}: {ssrDisplay}
    </span>
  );
}
