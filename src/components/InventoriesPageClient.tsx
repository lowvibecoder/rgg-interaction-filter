"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, ToggleButtonGroup, ToggleButton,
  List, ListItemButton, ListItemText, CircularProgress, Tooltip,
  Checkbox, FormControlLabel, FormGroup,
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

interface InventoryItemWithTimer {
  playerName: string;
  itemName: string;
  itemType: string;
  quantity: number;
  timer: number | null;
}

interface Props {
  overview: PlayerOverview[];
  allItems: string[];
  allInventoryItems: { playerName: string; itemName: string; itemType: string; quantity: number }[];
  players: PlayerResult[];
  itemInfo: string | null;
  selectedItem: string;
  lastUpdated: string | null;
  overviewLastUpdated: string | null;
  q: string;
  panel: string;
  gameItemMap: Record<string, string>;
}

function filterItems(items: string[], q: string, gameItemMap: Record<string, string>, hideEffects: boolean, hideItems: boolean, hideSpecialRolls: boolean): string[] {
  if (!q && !hideEffects && !hideItems && !hideSpecialRolls) return items;
  const lower = q.toLowerCase();
  return items.filter((name) => {
    const desc = gameItemMap[name] || "";
    const itemType = getItemTypeFromMap(name, gameItemMap);
    if (hideEffects && itemType === "effect") return false;
    if (hideItems && itemType === "item") return false;
    if (hideSpecialRolls && itemType === "special_roll") return false;
    if (!q) return true;
    if (name.toLowerCase().includes(lower)) return true;
    if (desc && desc.toLowerCase().includes(lower)) return true;
    return false;
  });
}

function getItemTypeFromMap(itemName: string, gameItemMap: Record<string, string>): string {
  const desc = gameItemMap[itemName] || "";
  if (desc.includes("Эффект")) return "effect";
  if (desc.includes("Спецролл")) return "special_roll";
  return "item";
}

function extractTimer(description: string, itemName: string): number | null {
  if (!description) return null;
  const escaped = itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}.*?(\\d+)\\s*сек`, "i"),
    new RegExp(`таймера\\s+${escaped}.*?(\\d+)\\s*сек`, "i"),
    new RegExp(`${escaped}.*?(\\d+)\\s*мин`, "i"),
    new RegExp(`таймера\\s+${escaped}.*?(\\d+)\\s*мин`, "i"),
  ];
  for (const re of patterns) {
    const m = description.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

const ACTIVE_SET = new Set(ACTIVE_PLAYERS);

function ItemLine({ item, description, onCopy }: { item: PlayerInventoryItem; description: string; onCopy: (text: string) => void }) {
  const timer = item.item_type === "effect" ? extractTimer(description, item.item_name) : null;
  const displayName = timer !== null ? `${item.item_name} (${timer})` : item.item_name;
  return (
    <Tooltip title={description || ""} arrow placement="right">
      <Typography
        variant="body2"
        onClick={() => onCopy(item.item_name)}
        sx={{ fontSize: "1rem", cursor: "pointer", "&:hover": { color: "primary.main" }, userSelect: "none" }}
      >
        {displayName}{item.quantity > 1 ? ` x${item.quantity}` : ""}
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
                onClick={() => {
                  setLoading(true);
                  setData(null);
                  fetch(`/api/inventory/${encodeURIComponent(name)}`)
                    .then((r) => r.json())
                    .then((d) => { setData(d); setLoading(false); })
                    .catch(() => setLoading(false));
                }}
                sx={{ borderRadius: 1, py: 0.15 }}
              >
                <ListItemText
                  primary={name}
                  sx={{ "& .MuiListItemText-primary": { fontSize: "1rem" } }}
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
  overview, allItems, allInventoryItems, players, itemInfo, selectedItem,
  lastUpdated, overviewLastUpdated, q: ssrQ, panel: ssrPanel, gameItemMap,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q");
  const panel = searchParams.get("panel") ?? ssrPanel;
  const viewMode = searchParams.get("view") ?? "items";
  const hideEffects = searchParams.get("hideEffects") !== "false";
  const hideItems = searchParams.get("hideItems") === "true";
  const hideSpecialRolls = searchParams.get("hideSpecialRolls") !== "false";
  const [localQ, setLocalQ] = useState(urlQ ?? ssrQ);

  useEffect(() => {
    setLocalQ(urlQ ?? ssrQ);
  }, [urlQ, ssrQ]);

  const showSearchArea = localQ.length > 0 || selectedItem.length > 0;
  const showOverview = showSearchArea ? panel === "open" : panel !== "closed";

  const filteredOverview = useMemo(() => overview.filter((p) => ACTIVE_SET.has(p.player_name)), [overview]);
  const filteredItems = useMemo(() => filterItems(allItems, localQ, gameItemMap, hideEffects, hideItems, hideSpecialRolls), [allItems, localQ, gameItemMap, hideEffects, hideItems, hideSpecialRolls]);

  const allItemsWithTimers: InventoryItemWithTimer[] = useMemo(() => {
    return allInventoryItems.map((item) => {
      const desc = gameItemMap[item.itemName] || "";
      const timer = item.itemType === "effect" ? extractTimer(desc, item.itemName) : null;
      return { ...item, timer };
    });
  }, [allInventoryItems, gameItemMap]);

  const filteredItemsWithTimers = useMemo(() => {
    let filtered = allItemsWithTimers;
    if (hideEffects) filtered = filtered.filter((i) => i.itemType !== "effect");
    if (hideItems) filtered = filtered.filter((i) => i.itemType !== "item");
    if (hideSpecialRolls) filtered = filtered.filter((i) => i.itemType !== "special_roll");
    if (localQ) {
      const lower = localQ.toLowerCase();
      filtered = filtered.filter((i) => {
        if (i.itemName.toLowerCase().includes(lower)) return true;
        const desc = gameItemMap[i.itemName] || "";
        if (desc.toLowerCase().includes(lower)) return true;
        return false;
      });
    }
    return filtered.sort((a, b) =>
      a.playerName.localeCompare(b.playerName) ||
      a.itemType.localeCompare(b.itemType) ||
      a.itemName.localeCompare(b.itemName)
    );
  }, [allItemsWithTimers, hideEffects, hideItems, hideSpecialRolls, localQ, gameItemMap]);

  const summedItems = useMemo(() => {
    const map = new Map<string, { itemName: string; itemType: string; totalQuantity: number; players: string[]; timer: number | null }>();
    for (const item of allInventoryItems) {
      const desc = gameItemMap[item.itemName] || "";
      const timer = item.itemType === "effect" ? extractTimer(desc, item.itemName) : null;
      const key = `${item.itemName}||${item.itemType}`;
      const existing = map.get(key);
      if (existing) {
        if (item.itemType !== "effect") {
          existing.totalQuantity += item.quantity;
        }
        if (!existing.players.includes(item.playerName)) {
          existing.players.push(item.playerName);
        }
      } else {
        map.set(key, {
          itemName: item.itemName,
          itemType: item.itemType,
          totalQuantity: item.itemType === "effect" ? 1 : item.quantity,
          players: [item.playerName],
          timer,
        });
      }
    }
    let result = [...map.values()];
    if (hideEffects) result = result.filter((i) => i.itemType !== "effect");
    if (hideItems) result = result.filter((i) => i.itemType !== "item");
    if (hideSpecialRolls) result = result.filter((i) => i.itemType !== "special_roll");
    if (localQ) {
      const lower = localQ.toLowerCase();
      result = result.filter((i) => {
        if (i.itemName.toLowerCase().includes(lower)) return true;
        const desc = gameItemMap[i.itemName] || "";
        if (desc.toLowerCase().includes(lower)) return true;
        return false;
      });
    }
    return result.sort((a, b) =>
      a.itemType.localeCompare(b.itemType) ||
      a.itemName.localeCompare(b.itemName)
    );
  }, [allInventoryItems, gameItemMap, hideEffects, hideItems, hideSpecialRolls, localQ]);

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

  const handleViewChange = useCallback((_: unknown, newView: string | null) => {
    if (!newView) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", newView);
    router.push(`/inventories?${params.toString()}`);
  }, [router, searchParams]);

  const toggleFilter = useCallback((key: string, value: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, String(value));
    router.push(`/inventories?${params.toString()}`);
  }, [router, searchParams]);

  const resetFilters = useCallback(() => {
    setLocalQ("");
    const params = new URLSearchParams();
    params.set("panel", "open");
    params.set("view", "items");
    params.set("hideEffects", "true");
    params.set("hideItems", "false");
    params.set("hideSpecialRolls", "true");
    router.push(`/inventories?${params.toString()}`);
  }, [router]);

  const [modalPlayer, setModalPlayer] = useState<string | null>(null);

  const selectedItemTimer = useMemo(() => {
    if (!selectedItem) return null;
    const desc = gameItemMap[selectedItem];
    return desc ? extractTimer(desc, selectedItem) : null;
  }, [selectedItem, gameItemMap]);

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
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
          sx={{ "& .MuiToggleButton-root": { fontSize: "0.9rem", px: 1.5 } }}
        >
          <ToggleButton value="items">По игрокам</ToggleButton>
          <ToggleButton value="summed">Сумма</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="outlined" size="small" onClick={resetFilters}>
          Сбросить
        </Button>
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selectedItem ? (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle1">
                  Предмет: <strong>{selectedItem}{selectedItemTimer !== null ? ` (${selectedItemTimer})` : ""}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  — найдено у {players.length} игроков
                </Typography>
              </Box>
              {itemInfo && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-line", fontSize: "1rem" }}>
                  {itemInfo}
                </Typography>
              )}
              {players.length > 0 ? (
                <TableContainer component={Paper} sx={{ bgcolor: "background.paper", maxWidth: 600, mt: 0.5 }}>
                  <Table size="small" sx={{ "& td, & th": { px: 1, py: 0.5, fontSize: "1rem" } }}>
                    <TableHead>
                      <TableRow>
                        {viewMode === "summed" ? (
                          <>
                            <TableCell sx={{ fontWeight: 600 }}>Предмет</TableCell>
                            <TableCell sx={{ fontWeight: 600, width: 70 }}>Тип</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, width: 50 }}>Кол-во</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Игроки</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell sx={{ fontWeight: 600 }}>Игрок</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Предмет</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Тип</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Кол-во</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewMode === "summed" ? (
                        <TableRow sx={{ "&:last-of-type td": { border: 0 } }}>
                          <TableCell>
                            <Tooltip title={gameItemMap[selectedItem] || ""} arrow placement="right">
                              <span style={{ cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(selectedItem)}>{selectedItem}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ width: 70 }}>
                            <Chip
                              label={players[0].item_type === "effect" ? "Эффект" : players[0].item_type === "item" ? "Предмет" : "Спецролл"}
                              size="small"
                              color={players[0].item_type === "effect" ? "warning" : players[0].item_type === "item" ? "primary" : "secondary"}
                              sx={{ height: 24, fontSize: "0.85rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ width: 50 }}>
                            {players[0].item_type === "effect" ? players.length : players.reduce((s, p) => s + p.total_quantity, 0)}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {players.map((p) => (
                                <Chip key={p.player_name} label={p.player_name} size="small" sx={{ height: 24, fontSize: "1rem" }} />
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ) : (
                        players.map((p) => (
                          <TableRow key={p.player_name + p.item_type} sx={{ "&:last-of-type td": { border: 0 } }}>
                            <TableCell>{p.player_name}</TableCell>
                            <TableCell>
                              <Tooltip title={gameItemMap[selectedItem] || ""} arrow placement="right">
                                <span style={{ cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(selectedItem)}>{selectedItem}</span>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={p.item_type === "effect" ? "Эффект" : p.item_type === "item" ? "Предмет" : "Спецролл"}
                                size="small"
                                color={p.item_type === "effect" ? "warning" : p.item_type === "item" ? "primary" : "secondary"}
                                sx={{ height: 24, fontSize: "0.85rem" }}
                              />
                            </TableCell>
                            <TableCell align="right">{p.item_type === "effect" ? 1 : p.total_quantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary">Ничего не найдено</Typography>
              )}
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Все предметы ({viewMode === "summed" ? summedItems.length : filteredItemsWithTimers.length})
                </Typography>
                <FormGroup row sx={{ "& .MuiFormControlLabel-root": { mr: 1 } }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={hideEffects} onChange={(e) => toggleFilter("hideEffects", e.target.checked)} />}
                    label="Без эффектов"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.9rem" } }}
                  />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={hideItems} onChange={(e) => toggleFilter("hideItems", e.target.checked)} />}
                    label="Без предметов"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.9rem" } }}
                  />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={hideSpecialRolls} onChange={(e) => toggleFilter("hideSpecialRolls", e.target.checked)} />}
                    label="Без спецроллов"
                    sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.9rem" } }}
                  />
                </FormGroup>
              </Box>
              {(viewMode === "summed" ? summedItems.length : filteredItemsWithTimers.length) === 0 ? (
                <Typography color="text.secondary">
                  {localQ ? "Ничего не найдено по вашему запросу" : "Введите поисковый запрос или откройте общую таблицу"}
                </Typography>
              ) : (
                <TableContainer component={Paper} sx={{ bgcolor: "background.paper", width: "100%" }}>
                  <Table size="small" stickyHeader sx={{ "& td, & th": { px: 0.5, py: 0.25, fontSize: "1rem", whiteSpace: "nowrap" } }}>
                    <TableHead>
                      <TableRow>
                        {viewMode === "summed" ? (
                          <>
                            <TableCell sx={{ fontWeight: 600 }}>Предмет</TableCell>
                            <TableCell sx={{ fontWeight: 600, width: 70 }}>Тип</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, width: 50 }}>Кол-во</TableCell>
                            <TableCell sx={{ fontWeight: 600, maxWidth: 200 }}>Игроки</TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell sx={{ fontWeight: 600, width: 100 }}>Игрок</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Предмет</TableCell>
                            <TableCell sx={{ fontWeight: 600, width: 70 }}>Тип</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, width: 50 }}>Кол-во</TableCell>
                          </>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {viewMode === "summed" ? summedItems.map((item, idx) => (
                        <TableRow key={`${item.itemName}-${item.itemType}-${idx}`} sx={{ "&:last-of-type td": { border: 0 } }}>
                          <TableCell>
                            <Tooltip title={gameItemMap[item.itemName] || ""} arrow placement="right">
                              <span style={{ cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(item.itemName)}>{item.itemName}{item.timer !== null ? ` (${item.timer})` : ""}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ width: 70 }}>
                            <Chip
                              label={item.itemType === "effect" ? "Эффект" : item.itemType === "item" ? "Предмет" : "Спецролл"}
                              size="small"
                              color={item.itemType === "effect" ? "warning" : item.itemType === "item" ? "primary" : "secondary"}
                              sx={{ height: 24, fontSize: "0.85rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ width: 50 }}>{item.totalQuantity}</TableCell>
                          <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {item.players.map((p) => (
                                <Chip key={p} label={p} size="small" sx={{ height: 24, fontSize: "1rem" }} />
                              ))}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )) : filteredItemsWithTimers.map((item, idx) => (
                        <TableRow key={`${item.playerName}-${item.itemName}-${item.itemType}-${idx}`} sx={{ "&:last-of-type td": { border: 0 } }}>
                          <TableCell sx={{ width: 100 }}>{item.playerName}</TableCell>
                          <TableCell>
                            <Tooltip title={gameItemMap[item.itemName] || ""} arrow placement="right">
                              <span style={{ cursor: "pointer" }} onClick={() => navigator.clipboard.writeText(item.itemName)}>{item.itemName}{item.timer !== null ? ` (${item.timer})` : ""}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ width: 70 }}>
                            <Chip
                              label={item.itemType === "effect" ? "Эффект" : item.itemType === "item" ? "Предмет" : "Спецролл"}
                              size="small"
                              color={item.itemType === "effect" ? "warning" : item.itemType === "item" ? "primary" : "secondary"}
                              sx={{ height: 24, fontSize: "0.85rem" }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ width: 50 }}>{item.itemType === "effect" ? 1 : item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ flexShrink: 0, alignSelf: "flex-start" }}>
          {showOverview ? (
            <Paper sx={{ width: 540, p: 1, bgcolor: "background.paper" }}>
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
                <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap", px: 0.5, py: 0.3, fontSize: "0.85rem" } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Участник</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Монеток</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Слёз</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Эффектов</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Предметов</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.8rem" }}>Спецроллов</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOverview.map((p) => (
                      <TableRow key={p.player_name} sx={{ "&:last-of-type td": { border: 0 } }}>
                        <TableCell
                          sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline", color: "primary.main" }, fontSize: "0.85rem", py: 0.3 }}
                          onClick={() => setModalPlayer(p.player_name)}
                        >
                          {p.player_name}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", py: 0.3 }}>{p.coins}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", py: 0.3 }}>{p.tears}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", py: 0.3 }}>{p.effects}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", py: 0.3 }}>{p.items}</TableCell>
                        <TableCell align="right" sx={{ fontSize: "0.85rem", py: 0.3 }}>{p.special_rolls}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            <IconButton
              onClick={() => togglePanel(true)}
              sx={{ color: "text.secondary" }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </Box>
  );
}
