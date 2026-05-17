import { Typography, Stack, Box } from "@mui/material";
import InteractionsFilters from "@/components/InteractionsFilters";
import InteractionsTable from "@/components/InteractionsTable";
import LiveTimestamp from "@/components/LiveTimestamp";
import AutoRefreshTrigger from "@/components/AutoRefreshTrigger";
import { getCachedInteractionsDelta } from "@/lib/interactionCache";
import {
  getCachedSenders,
  getCachedRecipients,
  getCachedActionTypes,
  getCachedDateRange,
  getCachedGameItems,
  getInteractionsLastUpdated,
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
    pin?: string;
    page?: string;
  }>;
}

export const revalidate = 300;

export default async function InteractionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = params.page ? Math.max(1, parseInt(params.page, 10)) : 1;
  const pageSize = 500;

  const baseFilters = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    note: params.note,
    activeOnly: params.activeOnly === undefined ? true : params.activeOnly === "true",
  };

  const [senders, recipients, actionTypes, interactionData, dateRange, gameItems, lastUpdated] =
    await Promise.all([
      getCachedSenders({ ...baseFilters, recipient: params.recipient, action: params.action }),
      getCachedRecipients({ ...baseFilters, sender: params.sender, action: params.action }),
      getCachedActionTypes({ ...baseFilters, sender: params.sender, recipient: params.recipient }),
      getCachedInteractionsDelta({
        ...baseFilters,
        sender: params.sender,
        recipient: params.recipient,
        action: params.action,
        page,
        pageSize,
      }),
      getCachedDateRange(),
      getCachedGameItems(),
      getInteractionsLastUpdated(),
    ]);

  const gameItemMap: Record<string, string> = {};
  for (const item of gameItems) {
    gameItemMap[item.name] = item.description;
  }

  function toDateStr(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
  }
  function toIsoString(d: Date | string | null | undefined): string | null {
    if (!d) return null;
    return typeof d === "string" ? d : d.toISOString();
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <AutoRefreshTrigger />
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Взаимодействия{" "}
        <LiveTimestamp date={toIsoString(lastUpdated)} label="обновлено" />
      </Typography>
      <InteractionsFilters
        senders={senders.map((s) => s.sender_name)}
        recipients={recipients.map((r) => r.recipient_name)}
        actionTypes={actionTypes.map((a) => a.action_type)}
        defaultMinDate={toDateStr(dateRange.minDate)}
        defaultMaxDate={toDateStr(dateRange.maxDate)}
      />
      <Stack spacing={3} sx={{ mt: 2 }}>
        <InteractionsTable
          rows={interactionData.rows}
          total={interactionData.total}
          page={interactionData.page}
          totalPages={interactionData.totalPages}
          gameItemMap={gameItemMap}
        />
      </Stack>
    </Box>
  );
}
