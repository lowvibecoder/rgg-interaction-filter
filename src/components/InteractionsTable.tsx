"use client";

import {
  Chip,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import updateLocale from "dayjs/plugin/updateLocale";
import type { ParsedInteractionWithRecipients } from "@/lib/types";

dayjs.extend(updateLocale);
dayjs.locale("ru");
dayjs.updateLocale("ru", {
  months: [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ],
  monthsShort: [
    "янв", "фев", "мар", "апр", "мая", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ],
});

interface TableProps {
  rows: ParsedInteractionWithRecipients[];
  total: number;
}

const actionColors: Record<string, string> = {
  Лечение: "#4caf50",
  Проклятие: "#f44336",
  Кража: "#ff9800",
  Телепорт: "#9c27b0",
  Передача: "#2196f3",
  Сглаз: "#e91e63",
  Защита: "#00bcd4",
  Атака: "#f44336",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(actionColors)) {
    if (action.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#1e1e1e";
}

export default function InteractionsTable({ rows, total }: TableProps) {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: 2,
          borderColor: "divider",
          bgcolor: "#1a1a1a",
          fontWeight: 700,
          fontSize: "0.875rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ minWidth: 56 }}>Дата</Box>
        <Box sx={{ minWidth: 120 }}>От кого</Box>
        <Box sx={{ minWidth: 150, flex: 1 }}>Кому</Box>
        <Box sx={{ minWidth: 130 }}>Действие</Box>
        <Box sx={{ minWidth: 200, flex: 2 }}>Примечание</Box>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            display: "flex",
            gap: 2,
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography
            variant="body2"
            sx={{ minWidth: 60, whiteSpace: "nowrap", color: "text.secondary", lineHeight: 1.3 }}
          >
            {dayjs(Number(row.date_added)).format("DD.MM")}
            <br />
            {dayjs(Number(row.date_added)).format("HH:mm")}
          </Typography>
          <Typography variant="body2" sx={{ minWidth: 120 }}>
            {row.sender_name}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", gap: 0.5, minWidth: 150, flex: 1 }}
          >
            {row.recipients.map((r) => (
              <Chip
                key={r.recipient_name}
                label={r.recipient_name}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
          <Box sx={{ minWidth: 130 }}>
            <Chip
              label={row.action_type}
              size="small"
              sx={{
                backgroundColor: getActionColor(row.action_type),
                color: "#fff",
                fontWeight: 600,
              }}
            />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "pre-line", minWidth: 200, flex: 2 }}
          >
            {row.note || ""}
          </Typography>
        </Box>
      ))}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: "center", py: 2 }}
      >
        Всего: {total}
      </Typography>
    </Box>
  );
}
