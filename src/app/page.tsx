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

  const baseFilters = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    note: params.note,
    activeOnly: params.activeOnly !== "false",
  };

  const [senders, recipients, actionTypes, interactionData, dateRange] =
    await Promise.all([
      getSenders({ ...baseFilters, recipient: params.recipient, action: params.action }),
      getRecipients({ ...baseFilters, sender: params.sender, action: params.action }),
      getActionTypes({ ...baseFilters, sender: params.sender, recipient: params.recipient }),
      getInteractions({
        ...baseFilters,
        sender: params.sender,
        recipient: params.recipient,
        action: params.action,
        pageSize: 10000,
      }),
      getDateRange(),
    ]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Взаимодействия
      </Typography>
      <Stack spacing={3}>
        <InteractionsFilters
          senders={senders.map((s) => s.sender_name)}
          recipients={recipients.map((r) => r.recipient_name)}
          actionTypes={actionTypes.map((a) => a.action_type)}
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
