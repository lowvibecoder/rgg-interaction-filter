"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Button,
  List, ListItemButton, ListItemText, CircularProgress, Tooltip,
} from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import InventorySearch from "./InventorySearch";
import InventoryFilter from "./InventoryFilter";
import LiveTimestamp from "./LiveTimestamp";
import { ACTIVE_PLAYERS } from "@/lib/players";

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

interface PlayerInventoryItem {
  item_name: string;
  item_type: string;
  quantity: number;
  source: string | null;
}

interface Props {
  overview: PlayerOverview[];
  allItems: string[];
  players: PlayerResult[];
  itemInfo: string | null;
  selectedItem: string;
  lastUpdated: string | null;
  overviewLastUpdated: string | null;
  q: string;
  panel: string;
  gameItemMap: Record<string, string>;
}

function filterItems(items: string[], q: string, gameItemMap: Record<string, string>): string[] {
  if (!q) return items;
  const lower = q.toLowerCase();
  return items.filter((name) => {
    if (name.toLowerCase().includes(lower)) return true;
    const desc = gameItemMap[name];
    if (desc && desc.toLowerCase().includes(lower)) return true;
    return false;
  });
}

const ACTIVE_SET = new Set(ACTIVE_PLAYERS);

function ItemLine({ item, description, onCopy }: { item: PlayerInventoryItem; description: string; onCopy: (text: string) => void }) {
  return (
    <Tooltip title={description || ""} arrow placement="right">
      <Typography
        variant="body2"
        onClick={() => onCopy(item.item_name)}
        sx={{ fontSize: "0.8rem", cursor: "pointer", "&:hover": { color: "primary.main" }, userSelect: "none" }}
      >
        {item.item_name}{item.quantity > 1 ? ` x${item.quantity}` : ""}
      </Typography>
    </Tooltip>
  );
}

function PlayerInventoryModal({ player, gameItemMap, onClose }: {
  player: string | null;
  gameItemMap: Record<string, string>;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    items: PlayerInventoryItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!player) { setData(null); return; }
    setLoading(true);
    fetch(`/api/inventory/${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [player]);

  const open = player !== null;

  const deduplicated = useMemo(() => {
    if (!data) return null;
    const seen = new Set<string>();
    return data.items.filter((i) => {
      const key = i.item_name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);

  const effects = useMemo(() => deduplicated?.filter((i) => i.item_type === "effect") ?? [], [deduplicated]);
  const ordinaryItems = useMemo(() => deduplicated?.filter((i) => i.item_type === "item") ?? [], [deduplicated]);
  const specialRolls = useMemo(() => deduplicated?.filter((i) => i.item_type === "special_roll") ?? [], [deduplicated]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {player ? `Инвентарь ${player}` : "Инвентарь"}
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", gap: 2, minHeight: 400 }}>
        <Box sx={{ width: 200, flexShrink: 0, borderRight: 1, borderColor: "divider", pr: 1, display: "flex", flexDirection: "column" }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Активные игроки</Typography>
          <List dense sx={{ flex: 1, overflow: "auto" }}>
            {ACTIVE_PLAYERS.map((name) => (
              <ListItemButton
                key={name}
                selected={name === player}
                sx={{ borderRadius: 1, py: 0.15 }}
              >
                <ListItemText
                  primary={name}
                  sx={{ "& .MuiListItemText-primary": { fontSize: "0.85rem" } }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : !data ? (
            <Typography color="text.secondary">Выберите игрока</Typography>
          ) : (
            <>
              <Box sx={{ display: "flex", gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600, color: "warning.main" }}>Эффекты</Typography>
                  {effects.map((i) => <ItemLine key={i.item_name} item={i} description={gameItemMap[i.item_name] || ""} onCopy={copyToClipboard} />)}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>Обычные предметы</Typography>
                  {ordinaryItems.map((i) => <ItemLine key={i.item_name} item={i} description={gameItemMap[i.item_name] || ""} onCopy={copyToClipboard} />)}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600, color: "secondary.main" }}>Спецроллы</Typography>
                  {specialRolls.map((i) => <ItemLine key={i.item_name} item={i} description={gameItemMap[i.item_name] || ""} onCopy={copyToClipboard} />)}
                </Box>
              </Box>
              {effects.length === 0 && ordinaryItems.length === 0 && specialRolls.length === 0 && (
                <Typography color="text.secondary">Нет предметов</Typography>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function InventoriesPageClient({
  overview, allItems, players, itemInfo, selectedItem,
  lastUpdated, overviewLastUpdated, q: ssrQ, panel: ssrPanel, gameItemMap,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q");
  const panel = searchParams.get("panel") ?? ssrPanel;
  const [localQ, setLocalQ] = useState(urlQ ?? ssrQ);

  // Sync localQ from URL changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalQ(urlQ ?? ssrQ);
  }, [urlQ, ssrQ]);

  const showSearchArea = localQ.length > 0 || selectedItem.length > 0;
  const showOverview = showSearchArea ? panel === "open" : panel !== "closed";

  // Always filter to active players only
  const filteredOverview = useMemo(() => overview.filter((p) => ACTIVE_SET.has(p.player_name)), [overview]);

  const filteredItems = useMemo(() => filterItems(allItems, localQ, gameItemMap), [allItems, localQ, gameItemMap]);

  const togglePanel = useCallback((open: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set("panel", "open");
      params.delete("q");
    } else {
      params.set("panel", "closed");
    }
    router.push(`/inventories?${params.toString()}`);
  }, [router, searchParams]);

  const handleSearchChange = useCallback((newQ: string) => {
    setLocalQ(newQ);
    const params = new URLSearchParams(searchParams.toString());
    if (newQ) params.set("q", newQ);
    else params.delete("q");
    params.delete("item");
    params.delete("panel");
    router.push(`/inventories?${params.toString()}`);
  }, [router, searchParams]);

  // Modal state
  const [modalPlayer, setModalPlayer] = useState<string | null>(null);

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto", p: 2 }}>
      <PlayerInventoryModal player={modalPlayer} gameItemMap={gameItemMap} onClose={() => setModalPlayer(null)} />

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Инвентари
        </Typography>
        <LiveTimestamp date={lastUpdated ?? null} />
      </Box>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2, alignItems: "center" }}>
        <InventorySearch q={localQ} onChange={handleSearchChange} />
        <InventoryFilter items={filteredItems} gameItemMap={gameItemMap} />
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
          {showSearchArea ? (
            selectedItem ? (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1">
                    Предмет: <strong>{selectedItem}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    — найдено у {players.length} игроков
                  </Typography>
                </Box>
                {itemInfo && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5, whiteSpace: "pre-line", fontSize: "0.8rem" }}>
                    {itemInfo}
                  </Typography>
                )}
                {players.length > 0 ? (
                  <TableContainer component={Paper} sx={{ bgcolor: "background.paper", maxWidth: 600 }}>
                    <Table size="small" sx={{ "& td, & th": { px: 1, py: 0.5, fontSize: "0.8rem" } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Игрок</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Тип</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Кол-во</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {players.map((p) => (
                          <TableRow key={p.player_name + p.item_type} sx={{ "&:last-of-type td": { border: 0 } }}>
                            <TableCell>{p.player_name}</TableCell>
                            <TableCell>
                              <Chip
                                label={p.item_type === "effect" ? "Эффект" : p.item_type === "item" ? "Предмет" : "Спецролл"}
                                size="small"
                                color={p.item_type === "effect" ? "warning" : p.item_type === "item" ? "primary" : "secondary"}
                                sx={{ height: 20, fontSize: "0.7rem" }}
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
                {filteredItems.length > 0
                  ? "Выберите содержимое инвентаря из списка"
                  : "Ничего не найдено по вашему запросу"}
              </Typography>
            )
          ) : (
            <Typography color="text.secondary">Введите поисковый запрос или откройте общую таблицу</Typography>
          )}
        </Box>

        <Box
          sx={{
            width: showOverview ? 480 : 0,
            overflow: showOverview ? "visible" : "hidden",
            transition: "width 0.3s ease",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {showOverview && (
            <Paper
              sx={{
                width: 480,
                p: 1,
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
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Общая информация
                </Typography>
                <LiveTimestamp date={overviewLastUpdated ?? null} />
              </Box>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap", px: 0.5, py: 0.3, fontSize: "0.75rem" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Участник</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Монеток</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Слёз</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Эффектов</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Предметов</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>Спецроллов</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOverview.map((p) => (
                      <TableRow
                        key={p.player_name}
                        sx={{ "&:last-of-type td": { border: 0 } }}
                      >
                        <TableCell
                          sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline", color: "primary.main" }, fontSize: "0.75rem", py: 0.3 }}
                          onClick={() => setModalPlayer(p.player_name)}
                        >
                          {p.player_name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.3 }}>{p.coins}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.3 }}>{p.tears}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.3 }}>{p.effects}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.3 }}>{p.items}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.75rem", py: 0.3 }}>{p.special_rolls}</TableCell>
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
