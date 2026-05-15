"use client";

import {
  Chip,
  Stack,
  Typography,
  Box,
  Tooltip,
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
  gameItemMap: Record<string, { description: string; source: string }>;
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

type GameItemInfo = { description: string; source: string };

export default function InteractionsTable({ rows, total, gameItemMap }: TableProps) {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
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
        <Box sx={{ width: 70, flexShrink: 0 }}>Дата</Box>
        <Box sx={{ width: 120, flexShrink: 0 }}>От кого</Box>
        <Box sx={{ width: 200, flexShrink: 0 }}>Кому</Box>
        <Box sx={{ width: 150, flexShrink: 0 }}>Действие</Box>
        <Box sx={{ minWidth: 200 }}>Примечание</Box>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            display: "flex",
            gap: 0.5,
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography
            variant="body2"
            sx={{ width: 70, flexShrink: 0, whiteSpace: "nowrap", color: "text.secondary", lineHeight: 1.3 }}
          >
            {dayjs(Number(row.date_added)).format("DD.MM")}
            <br />
            {dayjs(Number(row.date_added)).format("HH:mm")}
          </Typography>
          <Typography variant="body2" sx={{ width: 120, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {row.sender_name}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", gap: 0.5, width: 200, flexShrink: 0 }}
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
          <Box sx={{ width: 150, flexShrink: 0 }}>
            <GameActionChip actionType={row.action_type} gameItemMap={gameItemMap} />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "pre-line", minWidth: 200 }}
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

function GameActionChip({
  actionType,
  gameItemMap,
}: {
  actionType: string;
  gameItemMap: Record<string, { description: string; source: string }>;
}) {
  const info = gameItemMap[actionType];
  const chip = (
    <Typography
      variant="caption"
      sx={{
        display: "inline-block",
        px: 1,
        py: 0.3,
        borderRadius: "4px",
        backgroundColor: getActionColor(actionType),
        color: "#fff",
        fontWeight: 600,
        lineHeight: 1.3,
        wordBreak: "break-word",
        overflowWrap: "break-word",
        whiteSpace: "normal",
      }}
    >
      {actionType}
    </Typography>
  );

  if (info?.description) {
    return (
      <Tooltip
        title={
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
              {actionType}
            </Typography>
            <Typography variant="caption" sx={{ whiteSpace: "pre-line", fontSize: "0.75rem" }}>
              {info.description}
            </Typography>
          </Box>
        }
        arrow
        placement="right"
      >
        {chip}
      </Tooltip>
    );
  }

  return chip;
}
