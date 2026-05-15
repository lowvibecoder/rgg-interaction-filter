"use client";

import {
  Chip,
  Stack,
  Typography,
  Paper,
  Box,
} from "@mui/material";
import { Virtuoso } from "react-virtuoso";
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
  return "#757575";
}

function InteractionRow({ item }: { item: ParsedInteractionWithRecipients }) {
  return (
    <Box
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
        sx={{ minWidth: 120, whiteSpace: "nowrap", color: "text.secondary" }}
      >
        {dayjs(Number(item.date_added)).format("DD MMM YYYY HH:mm")}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 120 }}>
        {item.sender_name}
      </Typography>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ flexWrap: "wrap", gap: 0.5, minWidth: 150, flex: 1 }}
      >
        {item.recipients.map((r) => (
          <Chip
            key={r.recipient_name}
            label={r.recipient_name}
            size="small"
            variant="outlined"
          />
        ))}
      </Stack>
      <Box sx={{ minWidth: 120 }}>
        <Chip
          label={item.action_type}
          size="small"
          sx={{
            backgroundColor: getActionColor(item.action_type),
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
        {item.note || ""}
      </Typography>
    </Box>
  );
}

export default function InteractionsTable({ rows, total }: TableProps) {
  return (
    <Paper>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: 2,
          borderColor: "divider",
          bgcolor: "action.hover",
          fontWeight: 700,
          fontSize: "0.875rem",
        }}
      >
        <Box sx={{ minWidth: 120 }}>Дата</Box>
        <Box sx={{ minWidth: 120 }}>От кого</Box>
        <Box sx={{ minWidth: 150, flex: 1 }}>Кому</Box>
        <Box sx={{ minWidth: 120 }}>Действие</Box>
        <Box sx={{ minWidth: 200, flex: 2 }}>Примечание</Box>
      </Box>
      <Virtuoso
        useWindowScroll
        data={rows}
        totalCount={rows.length}
        itemContent={(_, item) => <InteractionRow item={item} />}
        components={{
          Footer: () => (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 2 }}
            >
              Всего: {total}
            </Typography>
          ),
        }}
      />
    </Paper>
  );
}
