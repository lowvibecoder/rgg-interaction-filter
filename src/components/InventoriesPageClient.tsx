"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import InventorySearch from "./InventorySearch";
import InventoryFilter from "./InventoryFilter";
import LiveTimestamp from "./LiveTimestamp";

interface PlayerOverview {
  player_name: string;
  coins: number;
  tears: number;
  effects: number;
  items: number;
  special_rolls: number;
}

interface PlayerResult {
  player_name: string;
  item_type: string;
  total_quantity: number;
}

interface GameItemInfo {
  description: string;
  source: string;
}

interface Props {
  overview: PlayerOverview[];
  allItems: string[];
  players: PlayerResult[];
  itemInfo: GameItemInfo | null;
  selectedItem: string;
  lastUpdated: string | null;
  overviewLastUpdated: string | null;
  q: string;
  panel: string;
}

export default function InventoriesPageClient({
  overview, allItems, players, itemInfo, selectedItem,
  lastUpdated, overviewLastUpdated, q: ssrQ, panel: ssrPanel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? ssrQ;
  const panel = searchParams.get("panel") ?? ssrPanel;

  const hasSearch = q.length > 0;
  const showOverview = hasSearch ? panel === "open" : panel !== "closed";

  function togglePanel(open: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (open) params.set("panel", "open");
    else params.delete("panel");
    params.delete("q");
    router.push(`/inventories?${params.toString()}`);
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Инвентари
        </Typography>
        <LiveTimestamp date={lastUpdated ?? null} />
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
        <InventorySearch />
        <InventoryFilter items={allItems} />
      </Box>

      <Box sx={{ display: "flex", position: "relative", minHeight: 400 }}>
        {!showOverview && (
          <IconButton
            onClick={() => togglePanel(true)}
            sx={{
              position: "absolute",
              right: 0,
              top: 0,
              zIndex: 10,
              color: "text.secondary",
            }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {hasSearch ? (
            selectedItem ? (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="subtitle1">
                    Предмет: <strong>{selectedItem}</strong>
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
            ) : (
              <Typography color="text.secondary">
                {allItems.length > 0
                  ? "Выберите предмет или спецролл из списка"
                  : "Ничего не найдено по вашему запросу"}
              </Typography>
            )
          ) : (
            <Typography color="text.secondary">Введите поисковый запрос или откройте общую таблицу</Typography>
          )}
        </Box>

        <Box
          sx={{
            width: showOverview ? 620 : 0,
            overflow: showOverview ? "visible" : "hidden",
            transition: "width 0.3s ease",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {showOverview && (
            <Paper
              sx={{
                width: 620,
                p: 1.5,
                bgcolor: "background.paper",
                position: "absolute",
                right: 0,
                top: 0,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <IconButton size="small" onClick={() => togglePanel(false)}>
                  <ArrowForwardIosIcon fontSize="small" />
                </IconButton>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
                  Общая информация
                </Typography>
                <LiveTimestamp date={overviewLastUpdated ?? null} />
              </Box>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap", px: 0.75, fontSize: "0.8rem" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Участник</TableCell>
                      <TableCell align="right">Монеток</TableCell>
                      <TableCell align="right">Слёз</TableCell>
                      <TableCell align="right">Эффектов</TableCell>
                      <TableCell align="right">Предметов</TableCell>
                      <TableCell align="right">Спецроллов</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overview.map((p) => (
                      <TableRow
                        key={p.player_name}
                        sx={{ "&:last-of-type td": { border: 0 } }}
                      >
                        <TableCell>{p.player_name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{p.coins}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{p.tears}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{p.effects}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{p.items}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.8rem" }}>{p.special_rolls}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}
