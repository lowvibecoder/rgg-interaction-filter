"use client";

import { TextField } from "@mui/material";

export default function InventorySearch({ q, onChange }: { q: string; onChange: (v: string) => void }) {
  return (
    <TextField
      size="small"
      placeholder="Поиск по названию или описанию"
      value={q}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        minWidth: 200, flexGrow: 1, maxWidth: 300,
        "& .MuiInputBase-input": { fontSize: "1rem" },
        "& .MuiInputLabel-root": { fontSize: "1rem" },
      }}
    />
  );
}
