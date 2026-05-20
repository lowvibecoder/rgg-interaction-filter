export function buildGameItemMap(gameItems: { name: string; description: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of gameItems) {
    map[item.name] = item.description;
  }
  return map;
}
