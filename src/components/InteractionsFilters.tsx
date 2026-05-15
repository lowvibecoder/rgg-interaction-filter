"use client";

import {
  TextField,
  MenuItem,
  Stack,
  Button,
  Autocomplete,
} from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface FiltersProps {
  senders: string[];
  recipients: string[];
  actionTypes: string[];
}

export default function InteractionsFilters({
  senders,
  recipients,
  actionTypes,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [sender, setSender] = useState(searchParams.get("sender") || "");
  const [recipient, setRecipient] = useState(
    searchParams.get("recipient") || ""
  );
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [note, setNote] = useState(searchParams.get("note") || "");

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (sender) params.set("sender", sender);
    if (recipient) params.set("recipient", recipient);
    if (action) params.set("action", action);
    if (note) params.set("note", note);
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSender("");
    setRecipient("");
    setAction("");
    setNote("");
    router.push("?");
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
        <TextField
          label="Дата с"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Дата по"
          type="date"
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          sx={{ minWidth: 160 }}
        />
        <Autocomplete
          options={senders}
          value={sender || null}
          onChange={(_, v) => setSender(v || "")}
          renderInput={(params) => (
            <TextField {...params} label="От кого" size="small" sx={{ minWidth: 180 }} />
          )}
          size="small"
          sx={{ minWidth: 180 }}
        />
        <Autocomplete
          options={recipients}
          value={recipient || null}
          onChange={(_, v) => setRecipient(v || "")}
          renderInput={(params) => (
            <TextField {...params} label="Кому" size="small" sx={{ minWidth: 180 }} />
          )}
          size="small"
          sx={{ minWidth: 180 }}
        />
        <TextField
          select
          label="Действие"
          size="small"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Все</MenuItem>
          {actionTypes.map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Поиск в тексте"
          size="small"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={applyFilters}>
          Применить
        </Button>
        <Button variant="outlined" onClick={clearFilters}>
          Сбросить
        </Button>
      </Stack>
    </Stack>
  );
}
