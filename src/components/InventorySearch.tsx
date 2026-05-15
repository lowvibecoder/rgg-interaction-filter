"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@mui/material";

export default function InventorySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") || "";

  return (
    <TextField
      size="small"
      placeholder="Поиск по названию или описанию"
      defaultValue={currentQ}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("q", e.target.value);
        else params.delete("q");
        params.delete("item");
        router.push(`/inventories?${params.toString()}`);
      }}
      sx={{ minWidth: 300 }}
    />
  );
}
