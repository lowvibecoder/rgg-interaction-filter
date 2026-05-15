import { Typography, Stack, Box } from "@mui/material";
import InteractionsFilters from "@/components/InteractionsFilters";
import InteractionsTable from "@/components/InteractionsTable";
import {
  getInteractions,
  getSenders,
  getRecipients,
  getActionTypes,
} from "@/lib/db";

interface PageProps {
  searchParams: Promise<{
    dateFrom?: string;
    dateTo?: string;
    sender?: string;
    recipient?: string;
    action?: string;
    note?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;

  const [senders, recipients, actionTypes, interactionData] =
    await Promise.all([
      getSenders(),
      getRecipients(),
      getActionTypes(),
      getInteractions({
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
        sender: params.sender,
        recipient: params.recipient,
        action: params.action,
        note: params.note,
        page: params.page ? Number(params.page) : 1,
        pageSize: params.pageSize ? Number(params.pageSize) : 50,
      }),
    ]);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Взаимодействия
      </Typography>
      <Stack spacing={3}>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <Typography variant="body2" color="text.secondary">
            Всего: {interactionData.total}
          </Typography>
        </Stack>
        <InteractionsFilters
          senders={senders.map((s) => s.sender_name)}
          recipients={recipients.map((r) => r.recipient_name)}
          actionTypes={actionTypes.map((a) => a.action_type)}
        />
        <InteractionsTable
          rows={interactionData.rows}
          total={interactionData.total}
          page={interactionData.page}
          pageSize={interactionData.pageSize}
        />
      </Stack>
    </Box>
  );
}
