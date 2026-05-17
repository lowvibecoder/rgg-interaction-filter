export interface ParsedInventoryItem {
  playerName: string;
  itemName: string;
  itemType: "effect" | "item" | "special_roll";
  quantity: number;
}

export function parseInventoryPage(html: string, playerName: string): ParsedInventoryItem[] {
  const results: ParsedInventoryItem[] = [];
  const sections = [
    { heading: "Эффекты", type: "effect" as const },
    { heading: "Обычные предметы", type: "item" as const },
    { heading: "Спецроллы", type: "special_roll" as const },
  ];

  for (const section of sections) {
    const sectionIdx = html.indexOf(section.heading);
    if (sectionIdx === -1) continue;

    let sectionEnd = html.length;
    for (const other of sections) {
      if (other.heading === section.heading) continue;
      const idx = html.indexOf(other.heading, sectionIdx + 1);
      if (idx !== -1 && idx < sectionEnd) sectionEnd = idx;
    }
    const sectionHtml = html.substring(sectionIdx + section.heading.length, sectionEnd);
    // Skip if no items found (check for MuiListItemText-root instead of "Пусто"
    // which can appear in item names like "Пустой кубик")
    if (!sectionHtml.includes("MuiListItemText-root")) continue;

    const sectionItems: { name: string; quantity: number }[] = [];
    let pos = 0;
    while (pos < sectionHtml.length) {
      const textRoot = sectionHtml.indexOf("MuiListItemText-root", pos);
      if (textRoot === -1) break;

      const itemEnd = sectionHtml.indexOf("</li>", textRoot);
      if (itemEnd === -1) break;

      const itemBlock = sectionHtml.substring(textRoot, itemEnd);

      const spanStart = itemBlock.indexOf("<span>");
      if (spanStart !== -1) {
        const spanEnd = itemBlock.indexOf("</span>", spanStart);
        if (spanEnd !== -1) {
          let rawName = itemBlock.substring(spanStart + 6, spanEnd);
          rawName = rawName.replace(/<!--[\s\S]*?-->/g, "").replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, " ").trim();
          if (rawName && !rawName.startsWith("$") && rawName.length > 0) {
            let quantity = 1;
            const qtyMatch = itemBlock.match(/MuiListItemText-secondary[^>]*>[\s\S]*?break-all">(\d+)<\/div/);
            if (qtyMatch) {
              quantity = parseInt(qtyMatch[1], 10);
            }
            sectionItems.push({ name: rawName, quantity });
          }
        }
      }

      pos = itemEnd + 5;
    }

    // Deduplicate: effects don't stack (keep first occurrence with qty 1),
    // ordinary items and special rolls sum quantities
    const merged = new Map<string, { name: string; quantity: number }>();
    for (const item of sectionItems) {
      if (section.type === "effect") {
        if (!merged.has(item.name)) {
          merged.set(item.name, { name: item.name, quantity: 1 });
        }
      } else {
        const existing = merged.get(item.name);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          merged.set(item.name, { name: item.name, quantity: item.quantity });
        }
      }
    }

    for (const [, item] of merged) {
      results.push({ playerName, itemName: item.name, itemType: section.type, quantity: item.quantity });
    }
  }

  return results;
}
