"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Autocomplete, TextField } from "@mui/material";

export default function InventoryFilter({ items }: { items: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedItem = searchParams.get("item") || "";

  return (
    <Autocomplete
      options={items}
      value={selectedItem || null}
      onChange={(_, newValue) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newValue) {
          params.set("item", newValue);
        } else {
          params.delete("item");
        }
        router.push(`/inventories?${params.toString()}`);
      }}
      renderInput={(params) => (
        <TextField {...params} label="Выберите предмет или спецролл" variant="outlined" size="small" />
      )}
      sx={{ minWidth: 350, maxWidth: 600 }}
    />
  );
}
