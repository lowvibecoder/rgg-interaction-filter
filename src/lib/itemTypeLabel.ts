export function getItemTypeLabel(type: string): string {
  return type === "effect" ? "Эффект" : type === "item" ? "Предмет" : "Спецролл";
}

export function getItemTypeColor(type: string): "warning" | "primary" | "secondary" {
  return type === "effect" ? "warning" : type === "item" ? "primary" : "secondary";
}
