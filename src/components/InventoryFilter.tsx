"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Autocomplete, TextField, Tooltip } from "@mui/material";

export default function InventoryFilter({ items, gameItemMap }: { items: string[]; gameItemMap: Record<string, string> }) {
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
        <TextField {...params} label="Выберите содержимое инвентаря" variant="outlined" size="small"
          sx={{ "& .MuiInputBase-input": { fontSize: "1rem" }, "& .MuiInputLabel-root": { fontSize: "1rem" } }}
        />
      )}
      renderOption={(props, option) => (
        <Tooltip title={gameItemMap[option] || ""} arrow placement="right">
          <li {...props} style={{ fontSize: "1rem" }}>{option}</li>
        </Tooltip>
      )}
      sx={{ minWidth: 350, maxWidth: 600, "& .MuiAutocomplete-input": { fontSize: "1rem" } }}
    />
  );
}
