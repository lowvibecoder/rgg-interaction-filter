export interface PlayerOverview {
  playerName: string;
  coins: number;
  tears: number;
  effects: number;
  items: number;
  specialRolls: number;
}

function concatRscPayload(html: string): string | null {
  const pushPattern = /self\.__next_f\.push\(\[[^\]]+,\s*"((?:[^"\\]|\\.)*)"\]\)/g;
  const chunks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pushPattern.exec(html)) !== null) {
    chunks.push(m[1]);
  }
  if (chunks.length === 0) return null;
  return chunks
    .join("")
    .replace(/\\\\/g, "\x00")
    .replace(/\\"/g, '"')
    .replace(/\x00/g, "\\");
}

export function parseInventoryOverview(html: string): PlayerOverview[] {
  const payload = concatRscPayload(html);
  if (!payload) return [];

  const rows: PlayerOverview[] = [];
  const rowRe = /\[\"\$","\$L58",null,\{"children":"([^"]+?)"\}\],\[\"\$","\$L58",null,\{"children":(\d+)\}\],\[\"\$","\$L58",null,\{"children":(\d+)\}\],\[\"\$","\$L58",null,\{"children":(\d+)\}\],\[\"\$","\$L58",null,\{"children":(\d+)\}\],\[\"\$","\$L58",null,\{"children":(\d+)\}/g;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(payload)) !== null) {
    rows.push({
      playerName: m[1],
      coins: parseInt(m[2], 10),
      tears: parseInt(m[3], 10),
      effects: parseInt(m[4], 10),
      items: parseInt(m[5], 10),
      specialRolls: parseInt(m[6], 10),
    });
  }

  return rows;
}
