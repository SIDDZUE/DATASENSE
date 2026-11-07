/** E2E: upload a small genuine CSV through the real UI dialog, then delete it. */
import { chromium } from "playwright";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = process.env.API_URL || "http://127.0.0.1:8000";
const CSV = "sensor_id,timestamp,temperature_c,humidity_pct,reading_ok\n" +
  Array.from({ length: 60 }, (_, i) =>
    `S-${(i % 4) + 1},2026-01-01T${String(i % 24).padStart(2, "0")}:00:00,${(20 + (i % 7)).toFixed(1)},${(40 + (i % 13)).toFixed(0)},${i % 9 === 0 ? "false" : "true"}`).join("\n") + "\n";

// The fixture lives in the OS temp dir, not in the app's upload folder, so a
// failed run can never leave residue inside data/uploads.
const PATH = join(tmpdir(), "datasense_e2e_upload.csv");
writeFileSync(PATH, CSV);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let code = 1;
try {
  await page.goto(BASE + "/datasets", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /upload dataset/i }).first().click();
  await page.waitForSelector("dialog[open]", { timeout: 10000 });

  // choose file
  await page.setInputFiles('input[type="file"]', PATH);
  // name auto-fills from filename; add provenance
  await page.fill('input[placeholder*="Factory"]', "E2E Upload Test");
  await page.fill('input[placeholder*="archive"]', "https://example.org/e2e");
  await page.getByRole("button", { name: /upload & profile/i }).click();

  // wait for toast or table refresh
  await page.waitForTimeout(4000);
  const body = await page.textContent("body");
  const ok = body.includes("E2E Upload Test");
  console.log(ok ? "PASS upload E2E — dataset appears in the list" : "FAIL dataset not in list");
  await page.screenshot({ path: "../reports/screenshots/e2e-upload.png", fullPage: true });

  // cleanup: delete the uploaded dataset via the API and verify the cascade
  const ds = await (await fetch(`${API}/api/datasets`)).json();
  const created = ds.datasets.find((d) => d.name === "E2E Upload Test");
  let cleanupOk = false;
  if (created) {
    const del = await fetch(`${API}/api/datasets/${created.id}`, { method: "DELETE" });
    const stillThere = (await (await fetch(`${API}/api/datasets/${created.id}`)).status) !== 404;
    const parquet = resolve(process.cwd(), `../data/processed/${created.id}.parquet`);
    const upload = resolve(process.cwd(), `../data/uploads/${created.id}.csv`);
    const rowGone = del.ok && !stillThere;
    const filesGone = !existsSync(parquet) && !existsSync(upload);
    cleanupOk = rowGone && filesGone;
    console.log(cleanupOk
      ? "PASS cleanup — dataset row and its processed/upload files deleted"
      : `FAIL cleanup — rowGone=${rowGone} filesGone=${filesGone}`);
  } else {
    console.log("FAIL cleanup — uploaded dataset not found via API");
  }

  console.log(`pageerrors: ${errors.length}`);
  code = ok && cleanupOk && errors.length === 0 ? 0 : 1;
} catch (e) {
  console.log("FAIL", String(e).slice(0, 400));
} finally {
  await browser.close();
  try { rmSync(PATH, { force: true }); } catch {}
  process.exitCode = code;
}
