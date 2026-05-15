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
 * Convert JS-string-escaped data to valid JSON.
 * Raw data is inside self.__next_f.push([1,"..."]), so it has
 * JS escaping: \\ -> \, \" -> ". Leave \n, \t etc. for JSON.parse.
 */
function cleanRscJson(raw: string): string {
  let s = raw
    .replace(/\\\\/g, "\x00")  // JS \\ -> temp
    .replace(/\\"/g, '"')      // JS \" -> "
    .replace(/\x00/g, "\\")    // temp -> \
    .replace(/\$D/g, "")       // RSC Date markers
    .replace(/\$L\d+/g, "null") // RSC Lazy refs
    .replace(/\$undefined/g, "null")
    .replace(/\$[A-Z]/g, "");   // Other RSC markers
  return s;
}

/**
 * Extract RSC payload from self.__next_f.push call
 */
export function parseRscPayload(html: string): RggInteraction[] {
  // Find the RSC payload: self.__next_f.push([1,"...")
  const pushPattern = /self\.__next_f\.push\(\[1,\s*"([^"]+)"\]/;
  const match = html.match(pushPattern);
  if (!match) return [];

  const rawData = match[1];
  const cleaned = cleanRscJson(rawData);

  // Parse the cleaned JSON to get the interactions array
  try {
    const data = JSON.parse(cleaned);
    if (!data || typeof data !== 'object') return [];

    // Find interactions array
    const interactions: any[] = [];
    if (Array.isArray(data.interactions)) {
      for (const item of data.interactions) {
        if (item && typeof item === 'object' && item._id && item.dateAdded) {
          interactions.push(item as RggInteraction);
        }
      }
    }
    return interactions;
  } catch {
    return [];
  }

      }
    }
    return interactions;
  } catch {
    return [];
  }
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
