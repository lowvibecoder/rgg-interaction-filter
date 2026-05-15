const fs = require('fs');
const html = fs.readFileSync('C:/Users/User/AppData/Local/Temp/rgg_full.html', 'utf-8');

const marker = '\\"interactions\\":[';
const startIdx = html.lastIndexOf(marker);
const arrStart = startIdx + marker.length - 1;

// Bracket match
let depth = 0, inString = false, escaped = false, end = -1;
for (let i = arrStart; i < html.length; i++) {
  const ch = html[i];
  if (escaped) { escaped = false; continue; }
  if (ch === '\\') { escaped = true; continue; }
  if (ch === '"') { inString = !inString; continue; }
  if (inString) continue;
  if (ch === '[') depth++;
  else if (ch === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
}

const arr = html.slice(arrStart, end);

// Extract and try to parse each object
let objDepth = 0, objStart = -1, total = 0, parsed = 0, firstFail = null;

for (let i = 0; i < arr.length; i++) {
  const ch = arr[i];
  if (escaped) { escaped = false; continue; }
  if (ch === '\\') { escaped = true; continue; }
  if (ch === '"') { inString = !inString; continue; }
  if (inString) continue;
  if (ch === '{') { if (objDepth === 0) objStart = i; objDepth++; }
  else if (ch === '}') {
    objDepth--;
    if (objDepth === 0 && objStart >= 0) {
      total++;
      const raw = arr.slice(objStart, i + 1);
      // JS unescaping: \\ -> \, \" -> "
      // Leave \n, \t, etc. for JSON.parse
      let s = raw.replace(/\\\\/g, '\x00').replace(/\\"/g, '"').replace(/\x00/g, '\\');
      // RSC cleanup
      s = s.replace(/\$D/g, '').replace(/\$L\d+/g, 'null').replace(/\$undefined/g, 'null').replace(/\$[A-Z]/g, '');
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === 'object' && obj._id && obj.dateAdded) {
          parsed++;
        } else if (!firstFail) {
          firstFail = { index: total, reason: 'invalid obj' };
        }
      } catch (e) {
        if (!firstFail) {
          firstFail = { index: total, reason: e.message.substring(0, 150), preview: s.substring(0, 400) };
        }
      }
      objStart = -1;
    }
  }
}

console.log('Total:', total, 'Parsed:', parsed);
if (firstFail) {
  console.log('First fail at', firstFail.index);
  console.log('Reason:', firstFail.reason);
  console.log('Preview:', firstFail.preview);
}
