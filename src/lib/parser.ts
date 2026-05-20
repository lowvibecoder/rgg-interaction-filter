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

function cleanRscJson(raw: string): string {
  const s = raw
    .replace(/\\\\/g, "\x00")
    .replace(/\\"/g, '"')
    .replace(/\x00/g, "\\")
    .replace(/\$D/g, "")
    .replace(/\$L\d+/g, "null")
    .replace(/\$undefined/g, "null")
    .replace(/\$[A-Z]/g, "");
  return s;
}

function parseRscPayload(html: string): RggInteraction[] {
  // Try to find interactions marker directly in raw HTML
  const marker = '\\"interactions\\":[';
  const startIdx = html.lastIndexOf(marker);
  if (startIdx !== -1) {
    const arrStart = startIdx + marker.length - 1;
    const results: RggInteraction[] = [];
    let pos = arrStart + 1;
    let braceDepth = 0;
    let inString = false;
    let escaped = false;
    let objectStart = -1;

    function tryParseObject(raw: string): RggInteraction | null {
      const cleaned = cleanRscJson(raw);
      try {
        const obj = JSON.parse(cleaned);
        if (obj && typeof obj === "object" && obj._id && obj.dateAdded) {
          return obj as RggInteraction;
        }
      } catch {
        // skip
      }
      return null;
    }

    while (pos < html.length) {
      const ch = html[pos];
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        pos++;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        pos++;
        continue;
      }
      if (inString) {
        pos++;
        continue;
      }
      if (ch === "{") {
        if (braceDepth === 0) objectStart = pos;
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0 && objectStart >= 0) {
          const raw = html.slice(objectStart, pos + 1);
          const parsed = tryParseObject(raw);
          if (parsed) results.push(parsed);
          objectStart = -1;
        }
      } else if (ch === "]" && braceDepth === 0) {
        break;
      }
      pos++;
    }
    return results;
  }

  // Fallback: try __next_f.push pattern
  const pushPattern = /self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]/;
  const match = html.match(pushPattern);
  if (!match) return [];

  const rawData = match[1];
  const cleaned = cleanRscJson(rawData);
  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object') return [];
    const results: RggInteraction[] = [];
    function findInteractions(obj: unknown) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object' && item._id && item.dateAdded) {
            results.push(item as RggInteraction);
          }
          findInteractions(item);
        }
      } else {
        for (const val of Object.values(obj)) {
          findInteractions(val);
        }
      }
    }
    findInteractions(data);
    return results;
  } catch {
    return [];
  }
}

export function parseInteractions(html: string): ParsedInteraction[] {
  const raw = parseRscPayload(html);

  return raw
    .filter((item) => item.text && !item.text.startsWith("$"))
    .map((item) => {
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
