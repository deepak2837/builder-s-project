# Build Prompt — AI-Powered Real Estate Redevelopment Feasibility Generator (POC)

**Client:** Asmita Builders
**Deliverable:** A working proof-of-concept web application
**Reference material supplied:** `Project Report Sita Smruti 25% Additonal.pdf`, `Format of Revelopement Calculation.xlsx`, `UDCPR_compressed_2.pdf` (UDCPR-2020, 492 pages), `Maharashtra-UDCPR-Amendment-Bill-2026.pdf`, `meeting rough notes.txt`

---

## 1. Context

Asmita Builders runs **redevelopment projects**. The model is: acquire an ageing residential/commercial building, demolish and rebuild it at a much higher FSI, hand every existing resident back a flat with **20% more RERA carpet area than they had before**, pay each of them **rent for 36 months** while construction runs, and sell the surplus area on the open market. The project earns money only if the surplus area sells for more than the total of construction cost, municipal charges, TDR purchase, rent payouts and incidentals.

Today the builder's team does this entire calculation by hand in Excel, cross-checking against UDCPR-2020, MBMC/BMC/NMC circulars and the Annual Statement of Rates (ASR). It is slow and it does not scale across the many sites they evaluate.

**Build them a web application that takes the project parameters as input and generates a complete, editable, exportable feasibility report — with a Gemini-powered assistant sitting alongside it that can answer questions about the report and edit the document on command.**

This is a POC. Build the core loop end to end and build it correctly; do not build auth, billing or multi-tenancy.

---

## 2. What the user does, start to finish

1. Lands on a **base page**: a parameter input form on the left, an AI assistant docked on the right. The assistant helps them fill the form — explains what a field means, suggests a value, or fills fields from a plain-English description of the site.
2. Submits the form. The **feasibility engine** runs the full calculation chain.
3. Lands on a **split-view workspace**:
   - **Left:** the generated feasibility report as a rich, Google-Docs-style editable document. Exportable to PDF, DOCX and XLSX.
   - **Right:** the **contextual chatbot**, now scoped to this report.
4. Chats with the report. Two distinct capabilities:
   - **Q&A** — "Why is the TDR cost this high?", "What does Regulation 7.6 say about incentive FSI?", "What's the profit margin?" Answers draw on the generated report *and* the knowledge-base documents.
   - **Document mutation** — "Change the construction rate to ₹4,500/sq.ft", "Make it 25% additional carpet instead of 20%", "Add a row for stamp duty of ₹3 Cr". The engine recalculates and the document updates live, with changed figures highlighted.
5. Every generated report is **saved to MongoDB** and reachable from a **report history** page — list, reopen, duplicate-and-tweak, compare, delete.

---

## 3. Tech stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Editor:** TipTap or Lexical — must support programmatic node updates so the chatbot can patch specific figures in place
- **Backend:** Next.js API routes (or a separate Express service if cleaner)
- **Database:** **local MongoDB** — `mongodb://localhost:27017`, database name `asmita_feasibility`. Create the DB and collections on first run; seed it with the Sita Smruti project as a demo record.
- **AI:** Google Gemini API. Key lives in `.env` as `GEMINI_API_KEY` (do not hardcode it, do not commit `.env`). Use Gemini for the chatbot, form assistance and RAG answers.
- **Vector search:** local embeddings for the knowledge base — MongoDB Atlas Vector Search if available, otherwise a local vector store (LanceDB / ChromaDB / a flat-file cosine-similarity index). Keep it simple; the corpus is small.
- **Export:** `docx` for Word, `puppeteer`/`react-pdf` for PDF, `exceljs` for Excel.

---

## 4. Input form — field specification

Group the form into collapsible sections. Every rate constant must be **editable by the user with a sensible default pre-filled**, because rates vary by municipality and by year. Show the default, show the source, let them override.

### 4.1 Project identity
| Field | Type | Notes |
|---|---|---|
| Project name | text | e.g. "Sita Smruti" |
| Survey / Hissa no. | text | |
| Village / locality | text | |
| Municipal authority | select | MBMC, BMC, NMC, TMC, PMC, NMMC, Other |
| Report date | date | |

### 4.2 Plot & land
| Field | Unit | Notes |
|---|---|---|
| Plot area as per 7/12 extract | sq.m | |
| Plot area as per Conveyance Deed | sq.m | Premium FSI and TDR are computed on this; basic FSI is not |
| Area under DP road / reservation | sq.m | Surrendered to the authority |
| Balance plot area | sq.m | **Auto-calculated** = Conveyance area − DP road area |
| Abutting road width | m | Drives the FSI entitlement from UDCPR Table 6-G |
| Zone | select | Residential / Commercial / Mixed / Public-Semi-Public |
| Congested or Non-congested area | select | Changes both the FSI table and the TDR generation multiplier |
| Is the plot in a TOD zone? | toggle | If yes, expose max permissible TOD FSI (default 4.00; use 3.5 where the sanctioned figure is lower) |

### 4.3 Existing building
| Field | Unit | Notes |
|---|---|---|
| Existing built-up area as per sanctioned plan | sq.m | |
| Number of residential tenements | count | |
| Number of commercial units / shops | count | |
| Existing residential carpet area (MOFA) | sq.ft | |
| Existing commercial carpet area | sq.ft | |
| Age of building | years | >30 years unlocks Reg. 7.6 incentive FSI |
| Building status | select | Normal / Dilapidated / Declared dangerous |

### 4.4 Entitlement & scheme parameters
| Field | Default | Notes |
|---|---|---|
| Basic FSI | 1.10 | From UDCPR Table 6-G |
| Premium FSI | 0.50 | Table 6-G, Municipal Corporation column |
| Max TDR loading | road-width driven | Table 6-G |
| Incentive FSI for redevelopment | max(30% of existing BUA, 15 sq.m × tenements) | UDCPR Reg. 7.6.1(i) |
| In-situ FSI multiplier for surrendered road land | 2.0 (non-congested) / 3.0 (congested) | UDCPR Reg. 11.2.4 |
| Minimum TDR to be loaded | 25% | Of the premium-FSI component, where mandated |
| Ancillary FSI — residential | 60% | UDCPR Note (i) to Table 6-G |
| Ancillary FSI — commercial | 80% | Same note, non-residential |
| Residential : Commercial split | user-set % | **The builder must be able to set this freely** — it drives income, dev charges and ancillary FSI |
| Built-up → RERA carpet loading factor | 1.32 | Also seen as 1.30 in the Excel format — expose it |
| MOFA → RERA carpet conversion | 1.04 | Applied to existing residential carpet |
| **Additional carpet area offered to tenants** | **20%** | The brief says 20%; the sample report uses 25%. **Make this a first-class input.** Applies to flats only, not shops |

### 4.5 Rates & financials
| Field | Default (Sita Smruti) | Notes |
|---|---|---|
| ASR / Ready Reckoner rate | ₹40,800 / sq.m | Varies by area — flag prominently |
| Premium rate on premium FSI | 35% of ASR | UDCPR Reg. 6.3 Note (viii) |
| Premium rate on ancillary FSI | 10% of ASR | |
| Land development charge — MBMC | 0.5% of ASR × plot area | |
| Land development charge — Metro | 0.5% of ASR × plot area | |
| Development charge, commercial — MBMC / Metro | 4% each | On commercial BUA incl. ancillary |
| Development charge, residential — MBMC / Metro | 2% each | On residential BUA incl. ancillary |
| Scrutiny fee | ₹2,000 per 4,000 sq.m of plot + ₹5/sq.m of BUA | |
| Development fee | BUA × 1.1 × ₹15, capped at ₹2,00,000 | |
| Labour tax | 1% × (BUA + podium area) × ₹27,951 | |
| Fire capitation fee | ₹250 × (BUA + podium area) | Excel format shows ₹188 × ₹27,951 × 1.1 — expose the choice |
| Assumed podium area | 7,000 sq.m | |
| TDR purchase rate | ₹2,124 / sq.ft incl. 18% GST | |
| Cost of construction | ₹4,130 / sq.ft incl. 18% GST | **Builder's own input — the single biggest cost line** |
| Professional fees | ₹100 / sq.ft | Planning, design, MEP, PMC, structural |
| Other incidentals till OC | ₹400 / sq.ft | |
| Agent commission & advertising | 4% of gross sales | |
| Developer office expense | ₹5,00,000 / month × 36 | |
| Environmental clearance | ₹2.00 Cr | |
| Stamp duty & registration | user input | |
| Other miscellaneous (deficiency, OLT etc.) | ₹5.00 Cr | |
| Corpus fund to society | user input, may be ₹0 | Negotiable — per meeting notes |
| Residential sale rate | ₹16,500 / sq.ft | |
| Commercial / office sale rate | ₹18,000 / sq.ft | |

### 4.6 Rent & displacement (36-month cycle)
| Field | Default | Notes |
|---|---|---|
| Construction / rent period | 36 months | Must be editable — 3 years is the norm, not a law |
| Monthly rent per sq.ft — flats | ₹40 | × existing residential carpet |
| Monthly rent per sq.ft — shops | ₹100 | × existing commercial carpet |
| Brokerage per unit | ₹15,000 | |
| Number of brokerage cycles | 2 | |
| Total units for brokerage | count | Residential + commercial |

---

## 5. The feasibility engine

Implement this as a **pure, testable calculation module** — no AI in the math. Gemini explains and edits; deterministic code computes. Every output line must carry the formula and the input values that produced it, so the report can show its working and the chatbot can explain any number.

Unit conversion throughout: **1 sq.m = 10.764 sq.ft**.

### Step 1 — Maximum permissible FSI, computed two ways, take the higher

**Path A — as per UDCPR:**
```
Balance plot area      = Conveyance plot area − DP road area
Basic FSI area         = Balance plot area × Basic FSI (1.10)
Premium FSI area       = (Max TOD/zone FSI − Basic FSI) × Conveyance plot area
                         e.g. (3.50 − 1.10) × 4,199 = 10,077.60 sq.m
In-situ FSI (DP road)  = DP road area × in-situ multiplier (2.0)
Balance premium FSI    = Premium FSI area − In-situ FSI
Total permissible BUA  = Basic + In-situ + Balance premium
```
> Note the deliberate asymmetry, per UDCPR Reg. 14.2.1.2.3: **basic FSI is computed on the balance plot area, premium FSI and TDR on the full conveyance plot area.**

**Path B — as per Redevelopment Scheme (UDCPR Reg. 7.5 / 7.6):**
```
1. Existing authorised built-up area                      (input)
2. Incentive FSI = max(30% × existing BUA, 15 sq.m × no. of tenements)
3. Premium FSI   = 0.50 × Conveyance plot area
4. Balance TDR   = Total permissible BUA (Path A) − (1) − (2) − (3)
   4a. In-situ FSI of road = DP road area × 2.0
   4b. Balance TDR to purchase = (4) − (4a)
Total = 1 + 2 + 3 + 4a + 4b
```

**Maximum permissible built-up area = max(Path A, Path B).**

Report both paths side by side, as the sample report does. Path B is what determines **how much TDR the builder must actually buy** — carry `4b` forward to the TDR cost line.

### Step 2 — Ancillary FSI
```
Commercial BUA        = Total permissible BUA × commercial %
Residential BUA       = Total permissible BUA × residential %
Ancillary commercial  = Commercial BUA × 0.80
Ancillary residential = Residential BUA × 0.60
Total BUA incl. ancillary = Total permissible BUA + ancillary commercial + ancillary residential
```
Validate: commercial BUA + residential BUA must equal total permissible BUA.

### Step 3 — Saleable RERA carpet area
```
Total BUA incl. ancillary (sq.ft) = Total BUA incl. ancillary (sq.m) × 10.764
Approx. RERA carpet available     = Total BUA (sq.ft) ÷ 1.32

Less existing RERA carpet:
  Residential = Existing residential MOFA carpet × 1.04
  Commercial  = Existing commercial carpet (as-is)
Less additional carpet to tenants = Existing residential RERA carpet × 20%   ← flats only

Balance carpet available to developer =
    Approx. RERA carpet − existing RERA carpet − additional carpet to tenants
```
Split the developer's balance into residential and commercial per the user's ratio.

> **This is the "usable vs non-usable" distinction from the brief.** Total permissible built-up area is gross potential; what the developer can actually *sell* is only what survives the loading factor and the tenant hand-back. Show all three numbers explicitly in the report — gross BUA, RERA carpet, and developer-saleable carpet — and label them clearly.

### Step 4 — Income
```
Residential income = Developer residential carpet × residential rate
Commercial income  = Developer commercial carpet  × commercial rate
Total income       = Residential + Commercial
```

### Step 5 — Expenditure

**5a. Premium & ancillary charges to the authority**
```
Premium FSI payment    = Premium FSI area × 0.35 × ASR
Ancillary area payment = Total ancillary area × 0.10 × ASR
```

**5b. Development charges** — MBMC and Metro are charged separately at the same rate; compute both.
```
Land development (MBMC)     = 0.5% × Conveyance plot area × ASR
Land development (Metro)    = 0.5% × Conveyance plot area × ASR
Development, commercial     = 4% × commercial BUA incl. ancillary × ASR   ← ×2 (MBMC + Metro)
Development, residential    = 2% × residential BUA incl. ancillary × ASR  ← ×2 (MBMC + Metro)
Scrutiny fee                = (₹2,000 × plot area ÷ 4,000) + (BUA incl. ancillary × ₹5)
Development fee             = min(BUA incl. ancillary × 1.1 × ₹15, ₹2,00,000)
Labour tax                  = 1% × (BUA incl. ancillary + podium) × ₹27,951
Fire capitation fee         = ₹250 × (BUA incl. ancillary + podium)
```

**5c. TDR cost**
```
TDR cost = Balance TDR to purchase (sq.m) × 10.764 × TDR rate per sq.ft
```

**5d. Construction & project costs**
```
Cost of construction = Total BUA incl. ancillary (sq.ft) × construction rate
Professional fees    = Total BUA incl. ancillary (sq.ft) × ₹100
Other incidentals    = Total BUA incl. ancillary (sq.ft) × ₹400
Agent commission     = Total income × 4%
Office expense       = Monthly office cost × project months
```

**5e. Rent & displacement — the redevelopment-specific cost**
```
Shop rent  = Existing commercial carpet (sq.ft) × shop rent/sq.ft × months
Flat rent  = Existing residential carpet (sq.ft) × flat rent/sq.ft × months
Brokerage  = Total units × brokerage per unit × cycles
Total rent cost = Shop rent + Flat rent + Brokerage
```
> Rent is calculated on the tenants' **existing** carpet area, not the enhanced area. Charge it for the full construction period. This line is often ₹8–10 Cr on a mid-sized project and is the cost most frequently under-estimated — surface it prominently.

**5f. Other**
Environmental clearance, stamp duty & registration, corpus fund, and other miscellaneous — user-supplied, added as line items.

### Step 6 — Summary & verdict
```
Total expenditure = 5a + 5b + 5c + 5d + 5e + 5f
Net profit        = Total income − Total expenditure
Profit margin %   = Net profit ÷ Total income × 100
ROI %             = Net profit ÷ Total expenditure × 100
```

### Step 7 — Feasibility score

The builder wants a single read on whether a site is worth pursuing. Compute a **0–100 feasibility score** with a visible breakdown — never a black box:

- **Profit margin** (weight 40) — <10% poor, 10–20% moderate, 20–30% good, >30% excellent
- **ROI** (weight 25)
- **Surplus-area ratio** (weight 20) — developer-saleable carpet ÷ total RERA carpet. The more area left after tenant hand-back, the healthier the project
- **Regulatory headroom** (weight 15) — how much of the permissible FSI the scheme actually consumes, and whether TDR is available at the assumed rate

Render as **Highly Feasible / Feasible / Marginal / Not Feasible**, with the top two or three drivers named in plain English.

Also run a **sensitivity table**: recompute net profit at ±5% and ±10% on construction cost, sale rate, and TDR rate. Show the breakeven sale rate. This is what turns the report from a calculation into a decision tool.

---

## 6. Report output structure

Mirror the Sita Smruti report exactly — the builder's team already reads in this format:

1. **Page 1 — FSI computation.** Both paths side by side, "whichever is more" highlighted.
2. **Page 2 — Area statement & income.** Permissible BUA → ancillary → RERA carpet → less existing → less tenant additional → developer balance → income at the sale rates.
3. **Page 3 — Municipal charges.** Premium & ancillary to the authority; the full itemised development-charges table; TDR cost; incidentals.
4. **Page 4 — Construction & project costs.** Construction, professional fees, commission, office expense, and the 36-month rent block itemised by shops / flats / brokerage.
5. **Page 5 — Summary.** Total income, the 12-line expenditure table, total expenses, net profit, feasibility score, sensitivity table, and the standard disclaimer:
   > *"Stamp duty, registration fees, corpus fund, Estate Investment NOC cost, ULC NOC (if applicable) and all other construction costs will be subtracted when figuring out the profit. The numbers and areas in the table are estimates and could change based on actual market rates."*

Every figure must be traceable — hovering or clicking a number reveals the formula and inputs behind it.

---

## 7. The chatbot

One assistant, two contexts.

**On the form page:** helps the user fill fields. "What is ancillary FSI?", "My plot is on an 18 m road in Bhayandar, what FSI do I get?", "Fill this from: 4,200 sq.m plot, 111 flats, 18 m road, MBMC." Answers from the knowledge base and can write values into form fields.

**In the workspace:** scoped to the open report.

Implement document mutation with **Gemini function calling**, not string replacement. Expose tools like:

- `update_parameter(field, value)` — change an input and re-run the whole engine
- `recalculate()` — re-run with current inputs
- `add_line_item(section, label, amount)` / `remove_line_item(id)`
- `explain_figure(field)` — return the formula, inputs and governing regulation
- `compare_scenario(changes)` — compute a variant without committing it
- `search_knowledge_base(query)` — RAG retrieval

Rules for the assistant:
- Every mutation flows through the engine. **The chatbot never invents a number.** If asked to change construction cost, it changes the input and the engine recomputes everything downstream.
- Changed figures are highlighted in the document with an undo affordance.
- Regulatory answers must cite the regulation number and document (e.g. "UDCPR Reg. 7.6.1(i)").
- When a figure cannot be derived from the knowledge base, say so rather than guessing.

---

## 8. Knowledge base

Ingest, chunk and embed the supplied documents. Keep the corpus tight — 5–6 documents, as scoped:

1. `UDCPR_compressed_2.pdf` — UDCPR-2020 as updated to 30 Jan 2023. **Chunk by regulation number**, retaining the regulation ID as metadata so citations work.
2. `Maharashtra-UDCPR-Amendment-Bill-2026.pdf` — **this is a scanned/image PDF with no extractable text layer. It needs OCR** (Tesseract or a vision model) before it can be indexed.
3. `Project Report Sita Smruti 25% Additonal.pdf` — the golden reference report and worked example.
4. `Format of Revelopement Calculation.xlsx` — the internal calculation format, including the team's own open questions in the Comments column.
5. MBMC / BMC / NMC circulars and ASR tables — to be supplied by the client.

Priority sections to index carefully, because the engine leans on them:
- **Table 6-G** (Reg. 6.3) — road width → basic FSI / premium FSI / max TDR loading / max building potential
- **Note (i) to Table 6-G** — ancillary FSI 60% residential, 80% non-residential
- **Note (viii) to Table 6-G** — premium at 35% of ASR
- **Reg. 7.5** — protection of FSI in redevelopment
- **Reg. 7.6.1** — incentive FSI: 30% of existing BUA or 15 sq.m/tenement, whichever is more; minimum 27.87 sq.m carpet entitlement per tenement
- **Reg. 11.2.4** — TDR generation: 2× surrendered land in non-congested areas, 3× in congested
- **Reg. 11.2.7** — TDR utilisation vs road width
- **Reg. 14.2** — TOD zones: max FSI 4.00, premium at 30%/35% of ASR, and the rule that premium FSI and TDR compute on the entire plot while basic FSI does not
- **Reg. 10.7** — Mira-Bhayandar Municipal Corporation specifics

Hardcode Table 6-G as **structured data in the engine** (not just as retrievable text) so road width automatically drives the FSI entitlement:

| Road width | Basic FSI | Premium FSI (Corp.) | Max TDR (Corp.) | Max potential (Corp.) |
|---|---|---|---|---|
| Below 9 m | 1.10 | — | — | 1.10 |
| 9–12 m | 1.10 | 0.50 | 0.40 | 2.00 |
| 12–15 m | 1.10 | 0.50 | 0.65 | 2.25 |
| 15–24 m | 1.10 | 0.50 | 0.90 | 2.50 |
| 24–30 m | 1.10 | 0.50 | 1.15 | 2.75 |
| 30 m and above | 1.10 | 0.50 | 1.40 | 3.00 |

(For non-Corporation authorities the premium/TDR/potential columns are 0.30 / 0.30 / 1.70 through 0.30 / 1.10 / 2.50 — include both column sets.)

---

## 9. Data model (MongoDB, `asmita_feasibility`)

```
projects        _id, name, survey_no, village, authority, created_at, updated_at
inputs          _id, project_id, version, all form fields, created_at
reports         _id, project_id, input_version, computed_outputs (full line-item tree),
                document_json (editor state), feasibility_score, created_at
rate_masters    _id, authority, effective_from, ASR, all rate constants
                → so MBMC / BMC / NMC each carry their own defaults
chat_sessions   _id, report_id, messages[], tool_calls[], created_at
kb_documents    _id, filename, doc_type, chunks[] {text, embedding, regulation_no, page}
audit_log       _id, report_id, field, old_value, new_value, source (user | chatbot), timestamp
```

**Report history is a hard requirement.** Version reports rather than overwriting them, so a project's assumptions can be compared over time. Every chatbot edit writes to `audit_log`.

---

## 10. Reference sites

Study these for the calculation model and the presentation of regulatory outputs — a paid product already solving the adjacent problem:

- https://udcpr.in/ — entitlement calculator, buildability analysis, feasibility assessment with branded PDF output
- https://udcpr.in/visual-guide — interactive diagrams: FSI build-up, setbacks & margins, chowk, metro-corridor FSI, internal roads
- https://udcpr.in/information — UDCPR tables 6-G, 6-A, 6-D, 7-A, 8-B/8-C, 14-O
- https://udcpr.in/tools — Quick Area & Demand, FSI & Buildability, Parking Requirement, ASR/Ready Reckoner, Side Margin & Setback

Our differentiator is the **redevelopment-specific economics** — tenant hand-back at +20%, 36-month rent liability, corpus fund, and the profit verdict — plus the conversational document workspace. UDCPR Pro stops at entitlement; we go through to net profit.

---

## 11. Validation — the acceptance test

**Enter the Sita Smruti inputs and the engine must reproduce the supplied report.** Ship this as an automated test.

| Line | Expected |
|---|---|
| Total permissible built-up area | 13,207.10 sq.m |
| Ancillary FSI | 8,146.66 sq.m |
| Total BUA incl. ancillary | 21,353.76 sq.m = 2,29,852 sq.ft |
| Approx. RERA carpet available | 1,74,130 sq.ft |
| Balance carpet for developer | 1,16,202 sq.ft |
| Total income | ₹193.37 Cr |
| Premium & ancillary charges | ₹6.32 Cr |
| MBMC development charges | ₹5.52 Cr |
| TDR cost | ₹6.25 Cr |
| Cost of construction | ₹95.00 Cr |
| Rent & services (36 months) | ₹8.27 Cr |
| Total expenses | ₹149.40 Cr |
| **Net profit** | **₹43.97 Cr** (22.74% margin) |

Note the sample report uses **25%** additional carpet to tenants; the standing brief says **20%**. The test should run at 25% to match the document, with 20% as the application default.

---

## 12. Discrepancies found in the source documents — resolve these as configurable inputs

Reading the PDF and the Excel format side by side surfaced four genuine conflicts. Do not silently pick one; expose each as a setting with the default noted.

1. **"Other incidental expenses till OC"** — the report states `₹400 × 40,112.29 sq.m × 10.764`, which computes to ₹17.27 Cr, but the stated answer is ₹9.20 Cr. ₹9.20 Cr reconciles only with `₹400 × 2,29,852 sq.ft` (the total BUA including ancillary). **Implement it as ₹400/sq.ft × total BUA incl. ancillary** and flag the source line as a probable typo for the client to confirm.
2. **Loading factor** — the report divides by **1.32**; the Excel format shows both **×0.77** and **÷1.30**. Default to 1.32, expose the field.
3. **Fire capitation fee** — the report uses `₹250 × (BUA + podium)`; the Excel shows `₹188 × ₹27,951 × 1.1`. Default to the report's formula.
4. **Labour tax** — the report adds a 7,000 sq.m assumed podium area before applying 1%; the Excel omits it. Default to including it, with the podium area editable.

The Excel's Comments column also carries the team's own unresolved questions — *"Check whether 0.35 is standard"*, *"Check whether 0.5% is on plot area"*, *"How is this area considered, is 4% standard"*, *"Check whether rate is ₹15"*. Every one of these is now a configurable rate in §4.5. Surface the corresponding UDCPR citation as a tooltip next to each so the user can verify rather than guess.

---

## 13. Explicitly out of scope for this POC

Named in the meeting notes but **deferred** — do not build:

- User accounts, login, roles (add after the core loop is validated)
- Apollo.io lead-generation integration
- 99acres / live market-rate feeds for automatic sale-rate lookup
- Pan-India and international regulatory coverage beyond Maharashtra/UDCPR
- Multi-project portfolio dashboards

Design the rate-master and authority abstractions so these can be added later without rework, but ship the single-project Maharashtra flow first.

---

## 14. Build order

1. Feasibility engine as a standalone, fully tested module — validated against Sita Smruti. **Nothing else matters if the math is wrong.**
2. MongoDB schema, rate masters, and report persistence.
3. Input form with live validation and auto-calculated derived fields.
4. Report generation and the document editor.
5. Knowledge-base ingestion and RAG.
6. Chatbot with function calling and document mutation.
7. Export to PDF / DOCX / XLSX.
8. Report history, versioning and comparison.
9. Feasibility score and sensitivity analysis.

---

**Where a regulation, rate or business rule is ambiguous, ask rather than assume.** The client's team has the domain knowledge; wrong assumptions compound silently through the calculation chain and produce a confident, wrong ₹43 Cr.
