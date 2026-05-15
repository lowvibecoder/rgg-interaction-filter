import { Typography, Stack, Box } from "@mui/material";
import InteractionsFilters from "@/components/InteractionsFilters";
import InteractionsTable from "@/components/InteractionsTable";
import {
  getInteractions,
  getSenders,
  getRecipients,
  getActionTypes,
  getDateRange,
} from "@/lib/db";
import { ACTIVE_PLAYERS } from "@/lib/players";

interface PageProps {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    sender?: string;
    recipient?: string;
    action?: string;
    note?: string;
    activeOnly?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeOnly = params.activeOnly !== "false";

  const [
    senders,
    allRecipients,
    allActionTypes,
    interactionData,
    dateRange,
    activeRecipients,
    activeActionTypes,
  ] = await Promise.all([
    getSenders(),
    getRecipients(false),
    getActionTypes(false),
    getInteractions({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sender: params.sender,
      recipient: params.recipient,
      action: params.action,
      note: params.note,
      activeOnly,
      pageSize: 10000,
    }),
    getDateRange(),
    getRecipients(true),
    getActionTypes(true),
  ]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Взаимодействия
      </Typography>
      <Stack spacing={3}>
        <InteractionsFilters
          senders={senders.map((s) => s.sender_name)}
          allRecipients={allRecipients.map((r) => r.recipient_name)}
          allActionTypes={allActionTypes.map((a) => a.action_type)}
          activeRecipients={activeRecipients.map((r) => r.recipient_name)}
          activeActionTypes={activeActionTypes.map((a) => a.action_type)}
          activePlayers={ACTIVE_PLAYERS}
          defaultMinDate={dateRange.minDate?.toISOString() ?? null}
          defaultMaxDate={dateRange.maxDate?.toISOString() ?? null}
        />
        <InteractionsTable
          rows={interactionData.rows}
          total={interactionData.total}
        />
      </Stack>
    </Box>
  );
}
