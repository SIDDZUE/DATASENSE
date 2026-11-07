/** Debug: capture full hydration error text on a single page. */
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:3000/datasets";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") {
    const t = m.text();
    if (t.includes("Hydration") || t.includes("hydration") || t.includes("diff")) {
      console.log("=== FULL ERROR ===");
      console.log(t.slice(0, 2500));
      console.log("=== END ===");
    }
  }
});
page.on("pageerror", (e) => console.log("PAGEERROR FULL:", String(e).slice(0, 2500)));
await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);
await browser.close();
