/**
 * DataSense AI - full-page browser smoke test + screenshots.
 * Visits every route, records console errors / failed requests, saves PNGs.
 *
 * Usage:  node scripts/ui-audit.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), "../reports/screenshots");
mkdirSync(OUT, { recursive: true });

// [name, url, waitForSelector?, settleMs]
const PAGES = [
  ["landing", "/"],
  ["dashboard", "/dashboard"],
  ["datasets", "/datasets"],
  ["dataset-detail", "/datasets/9c9fb0dd447f"],
  ["explorer", "/explorer?dataset=9c9fb0dd447f"],
  ["data-quality", "/data-quality"],
  ["analysis", "/analysis"],
  ["models", "/models"],
  ["anomalies", "/anomalies"],
  ["iot-monitor", "/iot-monitor"],
  ["decisions", "/decisions"],
  ["reports", "/reports"],
  ["settings", "/settings"],
  ["pricing", "/pricing"],
];

const results = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${String(e).slice(0, 300)}`));
page.on("requestfailed", (r) => {
  // ignore aborted (usually React fast-nav or favicon noise)
  if (!r.failure()?.errorText?.includes("ERR_ABORTED"))
    consoleErrors.push(`REQFAIL ${r.url().slice(0, 120)} ${r.failure()?.errorText}`);
});

for (const [name, path] of PAGES) {
  const errsBefore = consoleErrors.length;
  try {
    const resp = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200); // let charts settle
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const status = resp?.status() ?? "?";
    results.push({ name, status, errors: consoleErrors.length - errsBefore, ok: true });
    console.log(`OK   ${name.padEnd(16)} ${status}  (+${consoleErrors.length - errsBefore} errors)`);
    for (const e of consoleErrors.slice(errsBefore)) {
      if (!e.includes("cannot be a descendant") && !e.includes("cannot contain a nested") &&
          !e.includes("hydration error.") && !e.includes("ancestor stack trace"))
        console.log(`     [${name}] ${e.replace(/\n/g, " ").slice(0, 160)}`);
    }
  } catch (e) {
    results.push({ name, ok: false, error: String(e).slice(0, 200) });
    console.log(`FAIL ${name.padEnd(16)} ${String(e).slice(0, 200)}`);
  }
}

// interaction smoke checks ------------------------------------------------
try {
  // dataset detail: switch to WDBC and check profile renders
  await page.goto(BASE + "/datasets/9d8fc1ec7786", { waitUntil: "networkidle", timeout: 45000 });
  await page.screenshot({ path: `${OUT}/dataset-detail-wdbc.png`, fullPage: true });
  console.log("OK   dataset-detail-wdbc");
} catch (e) { console.log("FAIL dataset-detail-wdbc", String(e).slice(0, 200)); }

// dataset consistency: the topbar label must name the dataset the body shows
const CONSISTENCY = [
  ["/datasets/9c9fb0dd447f", "AI4I"],
  ["/datasets/9d8fc1ec7786", "Breast Cancer"],
  ["/explorer?dataset=5616616def35", "Air Quality"],
  ["/analysis?dataset=88762f42d133", "Household"],
];
for (const [path, expect] of CONSISTENCY) {
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(600);
    const header = await page.locator("header p").first().innerText();
    if (!header.includes(expect)) {
      consoleErrors.push(`MISMATCH ${path} header="${header}" expected~"${expect}"`);
      console.log(`FAIL consistency ${path} header="${header}"`);
    } else {
      console.log(`OK   consistency ${path.padEnd(28)} header ok`);
    }
  } catch (e) { console.log("FAIL consistency", path, String(e).slice(0, 160)); }
}

// mobile viewport spot check
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mctx.newPage();
try {
  await mpage.goto(BASE + "/dashboard", { waitUntil: "networkidle", timeout: 45000 });
  await mpage.screenshot({ path: `${OUT}/mobile-dashboard.png`, fullPage: true });
  console.log("OK   mobile-dashboard");
} catch (e) { console.log("FAIL mobile-dashboard", String(e).slice(0, 200)); }

await browser.close();

console.log("\n--- CONSOLE ERRORS (" + consoleErrors.length + ") ---");
consoleErrors.slice(0, 40).forEach((e) => console.log("  " + e));
const fails = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${results.length - fails.length}/${results.length} pages rendered, ${consoleErrors.length} console errors`);
process.exit(fails.length ? 1 : 0);
