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

/**
 * Convert RSC-escaped string to a clean JSON string.
 * The data is inside a JS string literal within self.__next_f.push([1,"..."])
 */
function cleanRscJson(raw: string): string {
  let s = raw
    // Unescape JSON: \" -> ", \\n -> \n, \\/ -> /
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\\//g, "/")
    // Remove RSC Date markers: $D2026-... -> 2026-...
    .replace(/\$D/g, "")
    // Replace RSC Lazy refs with null
    .replace(/\$L\d+/g, "null")
    .replace(/\$undefined/g, "null")
    // Remove other RSC markers
    .replace(/\$[A-Z]/g, "");
  return s;
}

/**
 * Extract individual JSON objects one at a time from the escaped string.
 * This handles the RSC data format more robustly than bulk parsing.
 */
export function parseRscPayload(html: string): RggInteraction[] {
  const marker = '\\"interactions\\":[';
  const startIdx = html.lastIndexOf(marker);
  if (startIdx === -1) return [];

  const arrStart = startIdx + marker.length - 1;

  // Extract each top-level object from the array
  const results: RggInteraction[] = [];
  let pos = arrStart + 1; // skip the [
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
      // skip invalid objects
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
      if (braceDepth === 0) {
        objectStart = pos;
      }
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
      break; // end of interactions array
    }

    pos++;
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
