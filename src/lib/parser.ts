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
  // The RSC payload with actual data is the LAST occurrence in the HTML
  const marker = '"interactions":[';
  const startIdx = html.lastIndexOf(marker);
  if (startIdx === -1) return [];

  // Find the array start - the `[` right after `"interactions":`
  const jsonStart = startIdx + marker.length - 1;
  if (jsonStart >= html.length) return [];

  // Parse JSON with bracket matching, accounting for escaped strings in the HTML
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

  // Clean up RSC special markers BEFORE un-escaping
  jsonStr = jsonStr
    .replace(/\$D/g, "") // Date markers like $D2026-...
    .replace(/\$L\d+/g, '"null"') // Lazy component markers like $L47
    .replace(/\$undefined/g, "null")
    .replace(/\"\$[A-Z]\"/g, '""'); // Other RSC markers

  // Unescape JSON string (it's escaped inside the __next_f.push string)
  jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\//g, "/");

  try {
    const data = JSON.parse(jsonStr);
    const arr = Array.isArray(data) ? data : [];
    // The data might be wrapped in an extra array: [[item1, item2]]
    if (arr.length === 1 && Array.isArray(arr[0])) return arr[0] as RggInteraction[];
    return arr as RggInteraction[];
  } catch {
    return [];
  }
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
