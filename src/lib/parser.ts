import type { RggInteraction, ParsedInteraction } from "./types";

function extractActionType(text: string): { actionType: string; note: string } {
  const firstLineEnd = text.indexOf("\n");
  if (firstLineEnd === -1) {
    return { actionType: text.trim(), note: "" };
  }
  const actionType = text.slice(0, firstLineEnd).trim();
  const note = text.slice(firstLineEnd).trim();
  return { actionType, note };
}

export function parseRscPayload(html: string): RggInteraction[] {
  const marker = '"interactions":[';
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return [];

  const jsonStart = html.indexOf("[", startIdx + marker.length - 1);
  if (jsonStart === -1) return [];

  let depth = 0;
  let endIdx = -1;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  if (endIdx === -1) return [];

  let jsonStr = html.slice(jsonStart, endIdx);

  // Clean up RSC special markers
  jsonStr = jsonStr
    .replace(/\$D/g, "") // Date markers
    .replace(/\$L\d+/g, "") // Lazy component markers
    .replace(/\$undefined/g, "null")
    .replace(/\$[A-Z]/g, ""); // Other RSC markers

  // Fix escaped unicode
  jsonStr = jsonStr.replace(/\\(u[0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  // Fix escaped forward slashes
  jsonStr = jsonStr.replace(/\\\//g, "/");

  try {
    const data = JSON.parse(jsonStr);
    return Array.isArray(data) ? data : [];
  } catch {
    // If JSON parse fails, try within __next_f data
    return extractFromNextF(html);
  }
}

function extractFromNextF(html: string): RggInteraction[] {
  // Try to find interaction data in self.__next_f.push format
  const regex = /self\.__next_f\.push\(\[1,"[^"]*\\"interactions\\":(\[.*?\])\\"/g;
  const results: RggInteraction[] = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      let jsonStr = match[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\$D/g, "")
        .replace(/\\\//g, "/");

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      }
    } catch {
      // continue to next match
    }
  }

  return results;
}

export function parseInteractions(html: string): ParsedInteraction[] {
  const raw = parseRscPayload(html);

  return raw.map((item) => {
    const { actionType, note } = extractActionType(item.text);
    return {
      id: item._id,
      dateAdded: item.dateAdded,
      senderName: item.sender.displayName,
      senderLogin: item.sender.login,
      actionType,
      note,
      rawText: item.text,
      recipients: item.recipients.map((r) => ({
        recipientName: r.displayName,
        recipientLogin: r.login,
      })),
    };
  });
}
