"use client";

import { useEffect, useState } from "react";
import { Box, CircularProgress, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefreshTrigger() {
  const [refreshing, setRefreshing] = useState(false);

  const trigger = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/auto-refresh");
      const data = await res.json();
      if (data.refreshed) {
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    trigger();
    const id = setInterval(trigger, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!refreshing) return null;

  return (
    <Tooltip title="Обновление данных...">
      <Box sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 9999 }}>
        <CircularProgress size={24} />
      </Box>
    </Tooltip>
  );
}
