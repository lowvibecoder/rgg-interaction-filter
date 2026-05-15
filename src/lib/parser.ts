import type { RggInteraction, ParsedInteraction } from "./types";

export let lastParseDebug = { found: 0, parsed: 0 };

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
 * This requires TWO passes: JS string unescaping, then JSON unescaping.
 */
function cleanRscJson(raw: string): string {
  // Pass 1: JS string literal unescaping
  // \\\\ -> \\  (JS literal double-backslash -> JSON backslash)
  // \\" -> \"   (JS literal escaped quote -> JSON escaped quote)
  // \\n -> \n   (JS literal newline -> JSON newline)
  // etc.
  let s = raw
    .replace(/\\\\/g, "\x00")  // JS \\ -> temp marker
    .replace(/\\"/g, '"')      // JS \" -> "
    .replace(/\\n/g, "\n")     // JS \n -> newline
    .replace(/\\r/g, "\r")     // JS \r -> CR
    .replace(/\\t/g, "\t")     // JS \t -> tab
    .replace(/\x00/g, "\\")    // temp marker -> JSON backslash
    .replace(/\\\//g, "/");    // JS \/ -> /

  // Pass 2: JSON unescaping (handles remaining escape sequences)
  s = s
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");

  // Remove RSC markers
  s = s
    .replace(/\$D/g, "")
    .replace(/\$L\d+/g, "null")
    .replace(/\$undefined/g, "null")
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
  let totalObjectsFound = 0;
  let breakOnBracket = false;

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
        totalObjectsFound++;
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

  lastParseDebug = { found: totalObjectsFound, parsed: results.length };
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
