import { Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from "@mui/material";
import type { Metadata } from "next";
import { getInventoryItems, getPlayersByInventoryItem, getGameItems, getInventoryLastUpdated } from "@/lib/db";
import InventoryFilter from "@/components/InventoryFilter";
import LiveTimestamp from "@/components/LiveTimestamp";

export const metadata: Metadata = {
  title: "Инвентари | RGG",
};

interface PageProps {
  searchParams: Promise<{ item?: string }>;
}

export default async function InventoriesPage({ searchParams }: PageProps) {
  const { item } = await searchParams;
  const [allItems, gameItems, lastUpdated] = await Promise.all([getInventoryItems(), getGameItems(), getInventoryLastUpdated()]);

  const gameItemMap = new Map<string, { description: string; source: string }>();
  for (const gi of gameItems) {
    gameItemMap.set(gi.name, { description: gi.description, source: gi.source });
  }

  const players = item ? await getPlayersByInventoryItem(item) : [];
  const itemInfo = item ? gameItemMap.get(item) : null;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Инвентари
        </Typography>
        <LiveTimestamp date={lastUpdated?.toISOString() ?? null} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box>
          <InventoryFilter items={allItems} />
        </Box>
        {item && (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="subtitle1">
                Предмет: <strong>{item}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                — найдено у {players.length} игроков
              </Typography>
            </Box>
            {itemInfo?.description && (
              <Paper sx={{ p: 1.5, mb: 2, bgcolor: "background.paper" }}>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "pre-line", fontSize: "0.75rem" }}>
                  {itemInfo.description}
                </Typography>
              </Paper>
            )}
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
      </Box>
    </Box>
  );
}
