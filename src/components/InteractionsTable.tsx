"use client";

import {
  Chip,
  Stack,
  Typography,
  Box,
  Tooltip,
  IconButton,
} from "@mui/material";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import LastPageIcon from "@mui/icons-material/LastPage";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
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
  page: number;
  totalPages: number;
  gameItemMap: Record<string, string>;
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

export default function InteractionsTable({ rows, total, page, totalPages, gameItemMap }: TableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          gap: 0.25,
          px: 2,
          py: 1,
          borderBottom: 2,
          borderColor: "divider",
          bgcolor: "#1a1a1a",
          fontWeight: 700,
          fontSize: "1rem",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Box sx={{ width: 70, flexShrink: 0 }}>Дата</Box>
        <Box sx={{ width: 140, flexShrink: 0 }}>От кого</Box>
        <Box sx={{ width: 140, flexShrink: 0 }}>Кому</Box>
        <Box sx={{ width: 130, flexShrink: 0 }}>Действие</Box>
        <Box sx={{ flex: 1, minWidth: 150 }}>Примечание</Box>
      </Box>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{
            display: "flex",
            gap: 0.25,
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography
            variant="body2"
            sx={{ width: 70, flexShrink: 0, whiteSpace: "nowrap", color: "text.secondary", lineHeight: 1.3, fontSize: "1rem" }}
          >
            {dayjs(Number(row.date_added)).format("DD.MM")}
            <br />
            {dayjs(Number(row.date_added)).format("HH:mm")}
          </Typography>
          <Typography variant="body2" sx={{ width: 140, flexShrink: 0, fontSize: "1rem" }}>
            {row.sender_name}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", gap: 0.5, width: 140, flexShrink: 0 }}
          >
            {row.recipients.map((r, idx) => (
              <Chip
                key={`${r.recipient_name}-${r.recipient_login}-${idx}`}
                label={r.recipient_name}
                size="small"
                variant="outlined"
                sx={{ fontSize: "1rem" }}
              />
            ))}
          </Stack>
          <Box sx={{ width: 130, flexShrink: 0 }}>
            <GameActionChip actionType={row.action_type} gameItemMap={gameItemMap} />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "pre-line", flex: 1, minWidth: 150, fontSize: "1rem" }}
          >
            {row.note || ""}
          </Typography>
        </Box>
      ))}
      <Stack direction="row" spacing={0.5} sx={{ py: 1, justifyContent: "center", alignItems: "center" }}>
        <IconButton size="small" onClick={() => goToPage(1)} disabled={page <= 1}>
          <FirstPageIcon />
        </IconButton>
        <IconButton size="small" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
          <KeyboardArrowLeft />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ mx: 1, fontSize: "1rem" }}>
          {page} / {totalPages} (всего: {total})
        </Typography>
        <IconButton size="small" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
          <KeyboardArrowRight />
        </IconButton>
        <IconButton size="small" onClick={() => goToPage(totalPages)} disabled={page >= totalPages}>
          <LastPageIcon />
        </IconButton>
      </Stack>
    </Box>
  );
}

function GameActionChip({
  actionType,
  gameItemMap,
}: {
  actionType: string;
  gameItemMap: Record<string, string>;
}) {
  const description = gameItemMap[actionType];

  const copyAction = () => {
    navigator.clipboard.writeText(actionType).catch(() => {});
  };

  const chip = (
    <Typography
      onClick={copyAction}
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
        cursor: "pointer",
        userSelect: "none",
        fontSize: "0.9rem",
      }}
    >
      {actionType}
    </Typography>
  );

  if (description) {
    return (
      <Tooltip
        title={
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5, fontSize: "0.9rem" }}>
              {actionType}
            </Typography>
            <Typography variant="caption" sx={{ whiteSpace: "pre-line", fontSize: "0.85rem" }}>
              {description}
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
