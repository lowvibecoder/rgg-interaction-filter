export interface GameItem {
  title: string;
  description?: string;
  icon?: string;
  source: string;
}

/**
 * JS string unescaping for RSC payload: \\\\ -> \\, \\" -> ", \\n -> \n etc.
 */
function jsUnescape(s: string): string {
  return s.replace(/\\\\/g, "\x00").replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\x00/g, "\\");
}

/**
 * Extract game items from RSC payload of any game data page.
 */
export function parseGamePage(html: string, source: string): GameItem[] {
  const results: GameItem[] = [];

  // Try source-specific marker first (e.g. \"wheels\":[), then fallback to \"items\":[
  // For "global-events", also try camelCase "globalEvents":[
  let sourceMarker = `\\"${source}\\":[`;
  let startIdx = html.lastIndexOf(sourceMarker);
  if (startIdx === -1) {
    sourceMarker = `\\"${source.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}\\":[`;
    startIdx = html.lastIndexOf(sourceMarker);
  }
  if (startIdx === -1) {
    sourceMarker = '\\"items\\":[';
    startIdx = html.lastIndexOf(sourceMarker);
  }
  if (startIdx === -1) return [];

  const arrStart = startIdx + sourceMarker.length - 1;
  if (arrStart >= html.length) return [];

  let depth = 0, endIdx = -1, inString = false, escaped = false;
  for (let i = arrStart; i < html.length; i++) {
    const ch = html[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  if (endIdx === -1) return [];

  let jsonStr = html.slice(arrStart, endIdx);
  // Clean RSC markers
  jsonStr = jsonStr
    .replace(/\$D/g, "").replace(/\$L\d+/g, '"null"').replace(/\$undefined/g, "null").replace(/\$[A-Z]/g, "");

  // Extract objects one by one
  let objDepth = 0, objStart = -1, inStr = false, esc = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === "{") {
      if (objDepth === 0) objStart = i;
      objDepth++;
    } else if (ch === "}") {
      objDepth--;
      if (objDepth === 0 && objStart >= 0) {
        const raw = jsonStr.slice(objStart, i + 1);
        const unescaped = jsUnescape(raw);
        try {
          const obj = JSON.parse(unescaped);
          const title = obj.title?.trim();
          if (title && !title.startsWith("$")) {
            let icon = "";
            if (obj.slug || obj.icon) {
              icon = obj.slug || obj.icon || "";
            }
            const desc = (obj.description || "").replace(/\\n/g, "\n").trim();
            results.push({ title, description: desc, icon, source });
          }
        } catch { /* skip invalid */ }
        objStart = -1;
      }
    }
  }

  return results;
}
