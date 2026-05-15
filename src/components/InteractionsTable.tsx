"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useSearchParams, useRouter } from "next/navigation";
import type { ParsedInteractionWithRecipients } from "@/lib/types";

dayjs.locale("ru");

interface TableProps {
  rows: ParsedInteractionWithRecipients[];
  total: number;
  page: number;
  pageSize: number;
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

export default function InteractionsTable({
  rows,
  total,
  page,
  pageSize,
}: TableProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleChangePage = (_: unknown, newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage + 1));
    router.push(`?${params.toString()}`);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", event.target.value);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Дата</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>От кого</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Кому</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Действие</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Примечание</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {dayjs(row.date_added).format("DD MMM HH:mm")}
                </TableCell>
                <TableCell>{row.sender_name}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {row.recipients.map((r) => (
                      <Chip
                        key={r.recipient_name}
                        label={r.recipient_name}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.action_type}
                    size="small"
                    sx={{
                      backgroundColor: getActionColor(row.action_type),
                      color: "#fff",
                      fontWeight: 600,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                    {row.note || ""}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  Нет взаимодействий
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="На странице:"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}–${to} из ${count}`
        }
      />
    </Paper>
  );
}
