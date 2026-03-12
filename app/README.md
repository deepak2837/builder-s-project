# Asmita Builders — Feasibility Generator (POC)

AI-powered redevelopment feasibility reports for Maharashtra, built on UDCPR-2020.

Enter a project's parameters, get a complete feasibility report as an editable, exportable
document, and talk to it — the Gemini-powered assistant answers questions from the knowledge
base and edits the document on command.

---

## Quick start

```bash
npm install
```

```bash
npm test
```

```bash
npm run seed
```

```bash
npm run ingest
```

```bash
npm run dev
```

Then open http://localhost:3000.

`npm test` runs the acceptance suite — 58 assertions that reproduce the client's own
Sita Smruti project report. Run it before trusting any change to the engine.

---

## Configuration

`.env.local`:

| Variable | Default | Notes |
|---|---|---|
| `GEMINI_API_KEY` | — | Required for the assistant. The rest of the app works without it. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Falls back to `gemini-2.0-flash`, then `gemini-1.5-flash`. |
| `MONGODB_URI` | `mongodb://localhost:27017` | |
| `MONGODB_DB` | `asmita_feasibility` | Created on first connection, along with all collections. |

**MongoDB is optional for the POC.** If `mongod` is not reachable the app falls back to JSON
files under `.data/` and says so in the status pill in the header — so nobody has to guess
where their reports went. Start MongoDB and reload to switch over; no code change needed.

---

## Deployment

Live at **https://asmita-feasibility.netlify.app** (Netlify project `asmita-feasibility`),
backed by MongoDB Atlas cluster `rajendertestcluster`, database `asmita_feasibility`.

```bash
npx netlify deploy --build --prod
```

The build script is `npm test && next build`, so a deploy **fails if the engine stops
reproducing the reference report**. That is deliberate — a silently wrong ₹44 Cr is worse
than a failed deploy.

Environment variables are set on the Netlify project (`GEMINI_API_KEY` and `MONGODB_URI` as
secrets). To change one:

```bash
npx netlify env:set MONGODB_URI "..." --context production --secret
```

Two deployment notes:

- **Netlify SSO protection.** New projects on this team inherit `site_sso_login = true`, which
  returns 401 to anyone not logged into Netlify. It was disabled for this project only; the
  team-wide default is untouched, so the next project created will need the same treatment.
- **Atlas network access** must allow `0.0.0.0/0`, because Netlify functions have no fixed
  egress IP. It already does — the deployed site connects.

If Mongo is ever unreachable in production the app falls back to per-container temp files,
which lose data between invocations. That state is impossible to miss: a red banner appears
across the top of every page saying reports will not be saved.

## Architecture

```
src/
  engine/            Pure TypeScript. No AI, no I/O, fully testable.
    types.ts         Domain model
    constants.ts     UDCPR Table 6-G, rate masters, field metadata, defaults
    calculate.ts     The seven-step calculation chain
    score.ts         Feasibility score and its visible workings
    document.ts      Turns a result into the renderable/exportable document
    __tests__/run.ts Acceptance test against the source report
  lib/
    store.ts         MongoDB with a JSON-file fallback behind one interface
    repository.ts    Projects, versioned reports, chat sessions, audit log
    gemini.ts        Dependency-free REST client with function calling
    assistant.ts     Tool definitions and the tool-execution loop
    kb/              Curated UDCPR corpus + BM25 retrieval
    export/          XLSX and DOCX writers
  app/               Next.js App Router pages and API routes
  components/        Form, document, chat panel
scripts/
  ingest.ts          Chunks the source PDFs into the knowledge base
  seed.ts            Loads the Sita Smruti reference project
```

### The cascade

Everything the regulations can decide is **derived**, not typed in. The primary inputs are the
plot, the abutting road width, whether the plot sits in a metro corridor, and the existing
building. From those, `engine/derive.ts` computes basic FSI, premium FSI, maximum TDR loading,
the TOD ceiling, the in-situ multiplier, the minimum TDR share, both ancillary percentages, the
incentive-FSI basis and the charge rates — each carrying the regulation it came from.

Change the road width and permissible FSI, saleable carpet, income and profit all move with it:

| Road width | TOD max FSI | Permissible BUA | Developer carpet | Income | Net profit |
|---|---|---|---|---|---|
| 12 m | 3.00 | 11,107.60 sq.m | 88,521 sq.ft | ₹147.31 Cr | ₹22.88 Cr |
| 15–18 m | 3.50 | 13,207.10 sq.m | 1,16,202 sq.ft | ₹193.37 Cr | ₹44.06 Cr |
| 24 m+ | 4.00 | 15,306.60 sq.m | 1,43,884 sq.ft | ₹239.44 Cr | ₹65.25 Cr |

The TOD ceiling is UDCPR Reg. 14.2.1.2, which Reg. 14.2.4 extends from Pune to every other
Municipal Corporation and Metropolitan Region Authority — which is what puts MBMC on it. The
25% minimum TDR share comes from Reg. 14.2.1.2.4(ii).

Any derived value can be **pinned** with the padlock when a local circular differs from the
state rule; it then holds while everything else keeps deriving. Typing into a derived field
pins it automatically, so an edit never silently disappears on the next recompute.

### The one rule that matters

**The engine computes; the model explains.** Gemini never produces a number. When the
assistant is asked to change something it calls `update_parameter`, the engine recomputes the
entire chain, and the document re-renders. Every figure in the report carries the formula that
produced it and the regulation that governs it — click any line to see them.

---

## What the engine implements

Seven steps, all traceable:

1. **Maximum permissible FSI**, computed two ways and taking whichever is more (Reg. 7.5) —
   the UDCPR entitlement, and the redevelopment scheme. Basic FSI is computed on the balance
   plot area while premium FSI and TDR use the full conveyance area, per Reg. 14.2.1.2.3.
2. **Ancillary FSI** — 60% residential, 80% non-residential (Table 6-G, Note (i)).
3. **Saleable RERA carpet** — gross built-up divided by the loading factor, less the area
   returned to existing occupiers, less the tenant uplift (flats only).
4. **Income** from the developer's balance carpet at the assumed sale rates.
5. **Expenditure** — premium and ancillary charges, the full development-charges table,
   TDR purchase, incidentals, construction, professional fees, commission, office expense,
   the 36-month rent liability, and other heads.
6. **Net profit, margin and ROI.**
7. **Feasibility score** out of 100 — margin (40), ROI (25), surplus-area ratio (20),
   regulatory headroom (15) — plus a sensitivity table and breakeven rates.

Rent is always computed on each occupier's **existing** carpet area, not the enhanced area
they receive, and runs for the full construction period.

---

## Reconciliation with the source report

The engine reproduces every figure in `Project Report Sita Smruti 25% Additonal.pdf` exactly:
13,207.10 Sq.m permissible BUA, 1,16,202 Sq.ft balance carpet, ₹193.37 Cr income, ₹6.32 Cr
premium charges, ₹5.52 Cr development charges, ₹6.25 Cr TDR, ₹8.27 Cr rent.

It reports **net profit of ₹44.06 Cr** where the source document prints ₹43.97 Cr. The
difference is not an error in either: the source rounds three heads up to a "Say Rs. X Cr"
figure before summing — construction (94.93 → 95.00), incidentals (9.19 → 9.20) and
commission (7.73 → 7.74) — which adds ₹0.09 Cr. The acceptance test asserts both the precise
arithmetic and the published total, so the reconciliation is checked on every run.

## Known issues in the supplied documents

Surfaced by the engine, left as configurable inputs rather than silently resolved:

1. **Incidental expenses formula.** The report states `₹400 × 40,112.29 Sq.m × 10.764`, which
   computes to ₹17.27 Cr, but prints ₹9.20 Cr. Only `₹400 × 2,29,852 Sq.ft` reconciles. The
   engine uses the total BUA including ancillary; the stated area basis looks like a typo.
2. **Loading factor.** The report divides by 1.32; the internal Excel shows ×0.77 and ÷1.30.
   Default 1.32, editable.
3. **Fire capitation fee.** Report: `₹250 × (BUA + podium)`. Excel: `₹188 × ₹27,951 × 1.1`.
   Default follows the report.
4. **Labour tax.** The report adds a 7,000 Sq.m assumed podium before applying 1%; the Excel
   omits it. Default includes it, with the podium area editable.
5. **Tenant uplift.** The standing brief says 20%; the sample report was run at 25%. The
   application defaults to 20% and the seed loads both versions so they can be compared.
6. **The 2026 Amendment Bill PDF is a scan** with no text layer. `npm run ingest` detects this
   and warns. It needs OCR before the assistant can cite it.

---

## Deferred (per the brief)

Auth and user accounts, Apollo.io lead generation, 99acres market-rate feeds, pan-India
regulatory coverage beyond Maharashtra, and portfolio dashboards. The rate-master and
authority abstractions are shaped so these can be added without rework.
