import { Typography, Stack, Box } from "@mui/material";
import InteractionsFilters from "@/components/InteractionsFilters";
import InteractionsTable from "@/components/InteractionsTable";
import LiveTimestamp from "@/components/LiveTimestamp";
import { getCachedInteractionsDelta } from "@/lib/interactionCache";
import {
  getCachedSendersAll,
  getCachedRecipientsAll,
  getCachedActionTypesAll,
  getCachedDateRange,
  getCachedGameItems,
  getCachedInteractionsLastUpdated,
} from "@/lib/redisCache";
import { ACTIVE_PLAYERS } from "@/lib/players";
import { buildGameItemMap } from "@/lib/buildGameItemMap";

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

  const [allSenders, allRecipients, allActionTypes, interactionData, dateRange, gameItems, lastUpdated] =
    await Promise.all([
      getCachedSendersAll(),
      getCachedRecipientsAll(),
      getCachedActionTypesAll(),
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
      getCachedInteractionsLastUpdated(),
    ]);

  // Filter dropdown options in-memory from unfiltered lists
  const activeSet = new Set(ACTIVE_PLAYERS);
  const senderSet = new Set(interactionData.rows.map((r) => r.sender_name));
  const recipientSet = new Set(interactionData.rows.flatMap((r) => r.recipients.map((rec) => rec.recipient_name)));
  const actionSet = new Set(interactionData.rows.map((r) => r.action_type));

  const senders = allSenders
    .filter((s) => {
      if (baseFilters.activeOnly && !activeSet.has(s.sender_name)) return false;
      return senderSet.has(s.sender_name);
    })
    .map((s) => s.sender_name);

  const recipients = allRecipients
    .filter((r) => recipientSet.has(r.recipient_name))
    .map((r) => r.recipient_name);

  const actionTypes = allActionTypes
    .filter((a) => actionSet.has(a.action_type))
    .map((a) => a.action_type);

  const gameItemMap = buildGameItemMap(gameItems);

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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Взаимодействия{" "}
        <LiveTimestamp date={toIsoString(lastUpdated)} label="обновлено" />
      </Typography>
      <InteractionsFilters
        senders={senders}
        recipients={recipients}
        actionTypes={actionTypes}
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
