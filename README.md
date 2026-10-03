# Decision Loop

A guided management decision workbench. Not an “upload data and ask AI” chatbot — Decision Loop walks a manager through the seven moves of a sound decision and keeps the judgment with the human:

**Question → Data → KPI → Analysis → Decision → Measurement → Pivot → (back to Question)**

The tool computes and charts. The user frames the question, chooses what to measure, separates facts from assumptions, commits with stated confidence, and pre-commits to pivot triggers.

## What’s inside

- **Decision Loop** — seven guided steps, each with a principle, coaching questions, common traps, and “readiness” checks that grade the quality of the thinking (not the answer).
- **CRM Workspace** — upload several CSVs at once. Recognized business files get CRM-style views:
  | File type (detected by headers) | View |
  |---|---|
  | `company_summary` | Overview header, targets, board question |
  | `accounts` | Account list, filters, account record drawer, segment / owner / industry roll-ups |
  | `crm_opportunities` | Kanban board, win rate by source / rep / product / type, lost reasons |
  | `marketing_campaigns` | Channel ROI, CAC, campaign table |
  | `sales_activity_weekly` | Activity vs. outcomes by rep |
  | `product_usage_monthly` | Adoption trend, add-on users, per-account adoption change |
  | `monthly_financials` | Revenue, EBITDA, cash runway vs. reserve, monthly P&L |
  | `employees_and_hiring_plan` | Roster, loaded cost, planned hires |
  | `plan_scenarios` | Scenarios + pressure test of plan assumptions vs. 2026 evidence |
  | anything else | Generic searchable table |
- **Evidence board** — pin any number in the workspace or analysis. The board feeds the Analysis step (gate: 5+ data points from 3+ files) and the exports.
- **Exports** — a one-page **Board update** (answers the six board questions) and a full **Decision brief**, as Markdown or print-to-PDF.
- **Optional AI coach** — “Challenge my thinking” asks hard questions about what the user wrote. It never recommends the decision. It receives the user’s text and summary numbers, never raw rows.
- **Example cases** — the Northstar Learning Systems board case (10 linked CSVs in `public/samples/northstar/`), plus a SaaS pricing case and a K-12 tutoring case.

All parsing and analysis happen in the browser. State auto-saves to the browser’s local storage.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). The AI coach endpoint only runs on Vercel (or with `vercel dev`); everything else works locally.

## Deploy (GitHub → Vercel)

1. Create a new GitHub repo and push this folder (GitHub Desktop: *Add Existing Repository* → *Publish*).
2. In Vercel: **Add New → Project → Import** the repo. Vercel detects Vite automatically (build `npm run build`, output `dist`).
3. Optional, to enable the AI coach: **Project → Settings → Environment Variables**
   - `ANTHROPIC_API_KEY` = your key
   - `ANTHROPIC_MODEL` = optional override (default `claude-sonnet-5-5`)
   Redeploy after adding variables. Without a key, the coach button explains that it is not configured and the rest of the app works normally.

## Project layout

```
api/coach.js                 Vercel serverless function (optional AI coach)
public/samples/northstar/    Northstar case CSVs + assignment brief
src/App.jsx                  Shell, mode toggle, exports
src/lib/stages.js            Stage definitions: principles, coaching, traps, readiness checks
src/lib/workspace.js         Multi-file loading and file-type detection
src/lib/crm.js               CRM summaries (accounts, pipeline, marketing, usage, finance, team, plan)
src/lib/analysis.js          KPI engine (sum/avg/ratio/share/latest, filters, trends, segments)
src/lib/brief.js             Board update + decision brief builders
src/components/              Workspace views, charts, coach panel, evidence board
src/stages/                  The seven stage screens
```

## Adding a new recognized file type

Add a signature to `KINDS` in `src/lib/workspace.js`, a summary function in `src/lib/crm.js`, and a tab in `src/components/Workspace.jsx`.
