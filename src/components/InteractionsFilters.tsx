"use client";

import {
  TextField,
  MenuItem,
  Stack,
  Button,
  Autocomplete,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ru } from "date-fns/locale/ru";
import { ruRU } from "@mui/x-date-pickers/locales";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo } from "react";

interface FiltersProps {
  senders: string[];
  recipients: string[];
  actionTypes: string[];
  activePlayers: string[];
  defaultMinDate: string | null;
  defaultMaxDate: string | null;
}

export default function InteractionsFilters({
  senders,
  recipients,
  actionTypes,
  activePlayers,
  defaultMinDate,
  defaultMaxDate,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const parsedDefaultMin = defaultMinDate ? new Date(defaultMinDate) : null;
  const parsedDefaultMax = defaultMaxDate ? new Date(defaultMaxDate) : null;

  const [dateFrom, setDateFrom] = useState<Date | null>(() => {
    if (searchParams.get("dateFrom")) return new Date(searchParams.get("dateFrom")!);
    return parsedDefaultMin;
  });
  const [dateTo, setDateTo] = useState<Date | null>(() => {
    if (searchParams.get("dateTo")) return new Date(searchParams.get("dateTo")!);
    return parsedDefaultMax;
  });
  const [sender, setSender] = useState(searchParams.get("sender") || "");
  const [recipient, setRecipient] = useState(
    searchParams.get("recipient") || ""
  );
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [note, setNote] = useState(searchParams.get("note") || "");
  const [activeOnly, setActiveOnly] = useState(
    searchParams.get("activeOnly") !== "false"
  );

  const filteredSenders = useMemo(
    () => (activeOnly ? senders.filter((s) => activePlayers.includes(s)) : senders),
    [senders, activePlayers, activeOnly]
  );
  const filteredRecipients = useMemo(
    () => (activeOnly ? recipients.filter((r) => activePlayers.includes(r)) : recipients),
    [recipients, activePlayers, activeOnly]
  );

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom.toISOString().slice(0, 10));
    if (dateTo) params.set("dateTo", dateTo.toISOString().slice(0, 10));
    if (sender) params.set("sender", sender);
    if (recipient) params.set("recipient", recipient);
    if (action) params.set("action", action);
    if (note) params.set("note", note);
    params.set("activeOnly", String(activeOnly));
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    setDateFrom(parsedDefaultMin);
    setDateTo(parsedDefaultMax);
    setSender("");
    setRecipient("");
    setAction("");
    setNote("");
    setActiveOnly(true);
    const params = new URLSearchParams();
    if (parsedDefaultMin) params.set("dateFrom", parsedDefaultMin.toISOString().slice(0, 10));
    if (parsedDefaultMax) params.set("dateTo", parsedDefaultMax.toISOString().slice(0, 10));
    router.push(`?${params.toString()}`);
  };

  const sameMonth =
    parsedDefaultMin && parsedDefaultMax &&
    parsedDefaultMin.getFullYear() === parsedDefaultMax.getFullYear() &&
    parsedDefaultMin.getMonth() === parsedDefaultMax.getMonth();

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru} localeText={ruRU.components.MuiLocalizationProvider.defaultProps.localeText}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
          <DatePicker
            label="Дата с"
            format="dd.MM.yyyy"
            value={dateFrom}
            onChange={(v) => setDateFrom(v)}
            views={sameMonth ? ["day"] : undefined}
            view={sameMonth ? "day" : undefined}
            openTo={sameMonth ? "day" : undefined}
            minDate={sameMonth ? parsedDefaultMin ?? undefined : undefined}
            maxDate={sameMonth ? parsedDefaultMax ?? undefined : undefined}
            slotProps={{
              textField: { size: "small", sx: { minWidth: 160 } },
            }}
          />
          <DatePicker
            label="Дата по"
            format="dd.MM.yyyy"
            value={dateTo}
            onChange={(v) => setDateTo(v)}
            views={sameMonth ? ["day"] : undefined}
            view={sameMonth ? "day" : undefined}
            openTo={sameMonth ? "day" : undefined}
            minDate={sameMonth ? parsedDefaultMin ?? undefined : undefined}
            maxDate={sameMonth ? parsedDefaultMax ?? undefined : undefined}
            slotProps={{
              textField: { size: "small", sx: { minWidth: 160 } },
            }}
          />
          <Autocomplete
            options={filteredSenders}
            value={sender || null}
            onChange={(_, v) => setSender(v || "")}
            renderInput={(params) => (
              <TextField {...params} label="От кого" size="small" sx={{ minWidth: 180 }} />
            )}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <Autocomplete
            options={filteredRecipients}
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
          <FormControlLabel
            control={
              <Checkbox
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
            }
            label="Только активные игроки"
          />
          <TextField
            label="Поиск в тексте"
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" onClick={applyFilters}>
            Применить
          </Button>
          <Button variant="outlined" onClick={clearFilters}>
            Сбросить
          </Button>
        </Stack>
      </Stack>
    </LocalizationProvider>
  );
}
