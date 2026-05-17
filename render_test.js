import puppeteer from "puppeteer";

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("https://rgg.land/interactions", { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 5000));

  // Find the scrollable container (Virtuoso)
  const allActions = new Set();
  for (let scroll = 0; scroll < 20; scroll++) {
    const texts = await page.evaluate(() => {
      // Find Virtuoso viewport
      const vp = document.querySelector('[data-testid="virtuoso-item-list"]') ||
                 document.querySelector('[class*="virtuoso"]') ||
                 document.querySelector('[style*="overflow"]');
      if (!vp) return [];
      const items = vp.querySelectorAll("*");
      const results = [];
      for (const el of items) {
        if (el.childElementCount > 0) continue; // leaf nodes only
        const t = el.textContent?.trim();
        if (t && t.length > 20 && !t.includes("RGG") && !t.includes("Карта") && !t.includes("Взаимодействия")) {
          results.push(t.substring(0, 300));
          if (results.length >= 5) break;
        }
      }
      return results;
    });
    
    for (const t of texts) allActions.add(t);
    
    // Scroll the Virtuoso container
    await page.evaluate(() => {
      const vp = document.querySelector('[data-testid="virtuoso-item-list"]') ||
                 document.querySelector('[class*="virtuoso"]') ||
                 document.querySelector('[style*="overflow"]');
      if (vp) vp.scrollTop += 500;
    });
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("=== Unique interaction texts ===");
  for (const t of allActions) {
    console.log(t.substring(0, 250));
    console.log("---");
  }
  console.log("Total:", allActions.size);
  await browser.close();
})().catch((e) => console.error("Error:", e.message));
