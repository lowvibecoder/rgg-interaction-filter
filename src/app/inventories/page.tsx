import { Typography, Box, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from "@mui/material";
import { getInventoryItems, getPlayersByInventoryItem } from "@/lib/db";
import InventoryFilter from "@/components/InventoryFilter";

interface PageProps {
  searchParams: Promise<{ item?: string }>;
}

export default async function InventoriesPage({ searchParams }: PageProps) {
  const { item } = await searchParams;
  const items = await getInventoryItems();
  const players = item ? await getPlayersByInventoryItem(item) : [];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Инвентари
      </Typography>
      <Stack spacing={3}>
        <Box>
          <InventoryFilter items={items} />
        </Box>
        {item && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Предмет: <strong>{item}</strong> — найдено у {players.length} игроков
            </Typography>
            {players.length > 0 ? (
              <TableContainer component={Paper} sx={{ bgcolor: "background.paper" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Игрок</TableCell>
                      <TableCell>Тип</TableCell>
                      <TableCell align="right">Количество</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {players.map((p) => (
                      <TableRow key={p.player_name + p.item_type}>
                        <TableCell>{p.player_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={p.item_type === "effect" ? "Эффект" : p.item_type === "item" ? "Предмет" : "Спецролл"}
                            size="small"
                            color={p.item_type === "effect" ? "warning" : p.item_type === "item" ? "primary" : "secondary"}
                          />
                        </TableCell>
                        <TableCell align="right">{p.total_quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary">Ничего не найдено</Typography>
            )}
          </Box>
        )}
        {!item && (
          <Typography color="text.secondary">Выберите предмет или спецролл из списка</Typography>
        )}
      </Stack>
    </Box>
  );
}
