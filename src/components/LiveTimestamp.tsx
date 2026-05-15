"use client";

import { useState, useEffect } from "react";

export default function LiveTimestamp({ date, label = "обновлено" }: { date: Date | string | null; label?: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    if (!date) return;
    const target = new Date(date);

    const tick = () => {
      const diff = Date.now() - target.getTime();
      if (diff < 0) { setDisplay("только что"); return; }
      const sec = Math.floor(diff / 1000);
      const min = Math.floor(sec / 60);
      const hrs = Math.floor(min / 60);

      if (sec < 10) setDisplay("только что");
      else if (sec < 60) setDisplay(`${sec} сек. назад`);
      else if (min < 60) setDisplay(`${min} мин. назад`);
      else if (hrs < 24) setDisplay(`${hrs} ч. ${min % 60} мин. назад`);
      else setDisplay(`${Math.floor(hrs / 24)} дн. назад`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;

  return (
    <span style={{ fontSize: "0.75rem", color: "var(--mui-palette-text-secondary, #999)" }}>
      {label}: {display}
    </span>
  );
}
