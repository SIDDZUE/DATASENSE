# DataSense AI — Frontend

Next.js 15 (App Router, Turbopack) + React 19 + Tailwind CSS v4 frontend for the
DataSense AI platform. All data comes from the FastAPI backend at
`http://127.0.0.1:8000`; there is no mock data layer.

## Run against the real backend

Start the backend first (from the repository root):

```powershell
.\scripts\start.ps1
```

Then, in this directory:

```powershell
npm install
npm run build
npm run start
```

Open <http://localhost:3000>.

Use the production build for verification. `npm run dev` works for editing but adds
dev-only warnings in this environment.

## Verification scripts

Both scripts need the production build running on port 3000 and the backend on 8000.

```powershell
node scripts/ui-audit.mjs      # 14 pages, console errors, screenshots
node scripts/e2e-upload.mjs    # real upload dialog + cascade-delete check
```

## Layout

```
src/app/            App Router routes (marketing and app shells)
src/components/     Hand-rolled UI kit, charts, shell, upload dialog
src/lib/            API client, dataset context, formatters, types
scripts/            Playwright audit and E2E scripts
```

Project documentation lives in `../docs/`; the architecture, dataset provenance and
verified test results are in `../README.md` and `../docs/TESTING.md`.
