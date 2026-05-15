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
import { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface FiltersProps {
  senders: string[];
  allRecipients: string[];
  allActionTypes: string[];
  activeRecipients: string[];
  activeActionTypes: string[];
  activePlayers: string[];
  defaultMinDate: string | null;
  defaultMaxDate: string | null;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function InteractionsFilters({
  senders,
  allRecipients,
  allActionTypes,
  activeRecipients,
  activeActionTypes,
  activePlayers,
  defaultMinDate,
  defaultMaxDate,
}: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const parsedDefaultMin = defaultMinDate ? new Date(defaultMinDate) : null;
  const parsedDefaultMax = defaultMaxDate ? new Date(defaultMaxDate) : null;

  const currentMonthSame =
    parsedDefaultMin && parsedDefaultMax &&
    parsedDefaultMin.getFullYear() === parsedDefaultMax.getFullYear() &&
    parsedDefaultMin.getMonth() === parsedDefaultMax.getMonth();

  const buildParams = useCallback(
    (overrides: Record<string, string | null>) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [key, val] of Object.entries(overrides)) {
        if (val === null || val === "") p.delete(key);
        else p.set(key, val);
      }
      return p;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (overrides: Record<string, string | null>) => {
      router.push(`?${buildParams(overrides).toString()}`);
    },
    [router, buildParams]
  );

  // Read current values from URL for initial state
  const urlDateFrom = searchParams.get("dateFrom");
  const urlDateTo = searchParams.get("dateTo");
  const urlSender = searchParams.get("sender") || "";
  const urlRecipient = searchParams.get("recipient") || "";
  const urlAction = searchParams.get("action") || "";
  const urlNote = searchParams.get("note") || "";
  const urlActiveOnly = searchParams.get("activeOnly") !== "false";

  // Local state for note (debounced)
  const [noteInput, setNoteInput] = useState(urlNote);
  const debouncedNote = useDebounce(noteInput, 400);

  // Sync debounced note to URL
  useEffect(() => {
    if (debouncedNote !== urlNote) {
      navigate({ note: debouncedNote || null });
    }
  }, [debouncedNote]);

  // Re-sync when URL changes externally
  useEffect(() => {
    setNoteInput(urlNote);
  }, [urlNote]);

  const activeOnly = urlActiveOnly;

  const filteredSenders = useMemo(
    () => (activeOnly ? senders.filter((s) => activePlayers.includes(s)) : senders),
    [senders, activePlayers, activeOnly]
  );
  const filteredRecipients = useMemo(
    () => (activeOnly ? activeRecipients : allRecipients),
    [allRecipients, activeRecipients, activeOnly]
  );
  const filteredActionTypes = useMemo(
    () => (activeOnly ? activeActionTypes : allActionTypes),
    [allActionTypes, activeActionTypes, activeOnly]
  );

  const dateFrom = urlDateFrom ? new Date(urlDateFrom) : parsedDefaultMin;
  const dateTo = urlDateTo ? new Date(urlDateTo) : parsedDefaultMax;

  const clearFilters = () => {
    setNoteInput("");
    const params = new URLSearchParams();
    if (parsedDefaultMin) params.set("dateFrom", parsedDefaultMin.toISOString().slice(0, 10));
    if (parsedDefaultMax) params.set("dateTo", parsedDefaultMax.toISOString().slice(0, 10));
    params.set("activeOnly", "true");
    router.push(`?${params.toString()}`);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ru} localeText={ruRU.components.MuiLocalizationProvider.defaultProps.localeText}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
          <DatePicker
            label="Дата с"
            format="dd.MM.yyyy"
            value={dateFrom}
            onChange={(v) => navigate({ dateFrom: v ? v.toISOString().slice(0, 10) : null })}
            views={currentMonthSame ? ["day"] : undefined}
            view={currentMonthSame ? "day" : undefined}
            openTo={currentMonthSame ? "day" : undefined}
            minDate={currentMonthSame ? parsedDefaultMin ?? undefined : undefined}
            maxDate={currentMonthSame ? parsedDefaultMax ?? undefined : undefined}
            slotProps={{ textField: { size: "small", sx: { minWidth: 160 } } }}
          />
          <DatePicker
            label="Дата по"
            format="dd.MM.yyyy"
            value={dateTo}
            onChange={(v) => navigate({ dateTo: v ? v.toISOString().slice(0, 10) : null })}
            views={currentMonthSame ? ["day"] : undefined}
            view={currentMonthSame ? "day" : undefined}
            openTo={currentMonthSame ? "day" : undefined}
            minDate={currentMonthSame ? parsedDefaultMin ?? undefined : undefined}
            maxDate={currentMonthSame ? parsedDefaultMax ?? undefined : undefined}
            slotProps={{ textField: { size: "small", sx: { minWidth: 160 } } }}
          />
          <Autocomplete
            options={filteredSenders}
            value={urlSender || null}
            onChange={(_, v) => navigate({ sender: v || null })}
            renderInput={(params) => (
              <TextField {...params} label="От кого" size="small" sx={{ minWidth: 180 }} />
            )}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <Autocomplete
            options={filteredRecipients}
            value={urlRecipient || null}
            onChange={(_, v) => navigate({ recipient: v || null })}
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
            value={urlAction}
            onChange={(e) => navigate({ action: e.target.value || null })}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Все</MenuItem>
            {filteredActionTypes.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={
              <Checkbox
                checked={activeOnly}
                onChange={(e) => navigate({ activeOnly: e.target.checked ? "true" : "false" })}
              />
            }
            label="Только активные игроки"
          />
          <TextField
            label="Поиск в тексте"
            size="small"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="outlined" onClick={clearFilters}>
            Сбросить
          </Button>
        </Stack>
      </Stack>
    </LocalizationProvider>
  );
}
