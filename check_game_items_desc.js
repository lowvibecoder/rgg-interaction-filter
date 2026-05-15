const fs = require("fs");
const { neon } = require("@neondatabase/serverless");
const env = fs.readFileSync(".env.local", "utf-8");
const m = env.match(/POSTGRES_URL="([^"]+)"/);
const sql = neon(m[1]);

async function main() {
  const items = await sql`SELECT name, description, source FROM game_items WHERE name = 'Бомба'`;
  console.log("game_items entry for Бомба:", items.length ? JSON.stringify(items[0]) : "NOT FOUND");

  // Also check how many game_items have descriptions
  const withDesc = await sql`SELECT COUNT(*) as c FROM game_items WHERE description != ''`;
  console.log("Items with description:", withDesc[0].c);

  const total = await sql`SELECT COUNT(*) as c FROM game_items`;
  console.log("Total game_items:", total[0].c);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
