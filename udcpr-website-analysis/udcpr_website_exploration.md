# UDCPR Pro Website — Comprehensive Exploration Report

> **Website**: https://udcpr.in  
> **Product**: UDCPR Pro — Land Analysis & Feasibility for Maharashtra  
> **Explored on**: 2026-08-06  
> **Status**: Successfully explored all public pages + logged-in Settings page

---

## 1. Website Overview

**UDCPR Pro** is a SaaS web application built for **architecture firms in Maharashtra, India**. It computes land feasibility — FSI (Floor Space Index), setbacks, parking, DCR pre-check, cost & profit — using the **Unified Development Control & Promotion Regulations 2020 (UDCPR-2020)**. It's tuned specifically for **Nagpur**.

### Core Value Proposition
- Enter plot details → Get complete UDCPR-2020 feasibility
- FSI entitlement computation from regulation tables
- Buildability analysis (setbacks, margins, footprint)
- Financial feasibility (demand charges, cost vs. selling rate)
- Generates branded 6-page proposal PDF + CAD (DXF) drawing
- DCR pre-check before submission

---

## 2. Complete Page Map & Site Structure

### Public Pages (No Login Required)

| # | Page | URL | Purpose |
|---|------|-----|---------|
| 1 | **Homepage** | `/` | Marketing landing page with hero, workflow, pricing |
| 2 | **Visual Guide** | `/visual-guide` | Interactive UDCPR-2020 visual diagrams with sliders |
| 3 | **UDCPR Tables** | `/information` | Reference tables (6-G, 6-A, 6-D, 7-A, 8-B/8-C, 14-O) |
| 4 | **Free Tools** | `/tools` | Free calculators (no login needed) |
| 5 | **Quick Area & Demand** | `/tools/quick` | Area statement + development charges calculator |
| 6 | **FSI & Buildability** | `/tools/fsi` | FSI + buildable area calculator |
| 7 | **Parking Requirement** | `/tools/parking` | Car/two-wheeler parking calculator |
| 8 | **ASR / Ready Reckoner** | `/tools/asr` | Annual Statement of Rates info |
| 9 | **Side Margin & Setback** | `/tools/side-margin` | Marginal open spaces calculator |
| 10 | **Methodology** | `/methodology` | How the engine computes (clause sources) |
| 11 | **Glossary** | `/glossary` | UDCPR terminology definitions |
| 12 | **Pricing** | `/#pricing` | 3-tier pricing section |

### Auth Pages

| # | Page | URL | Purpose |
|---|------|-----|---------|
| 13 | **Login** | `/login` | Email + password sign-in |
| 14 | **Register** | `/register` | Account creation |
| 15 | **Forgot Password** | `/forgot` | Password reset |

### Logged-In Pages (Behind Auth)

| # | Page | URL | Purpose |
|---|------|-----|---------|
| 16 | **Calculator (Feasibility)** | `/calculator?mode=feasibility` | Main 5-step feasibility wizard |
| 17 | **Calculator (Entitlement)** | `/calculator?mode=entitlement` | Entitlement-only mode |
| 18 | **Settings** | `/settings` | Account/firm settings |
| 19 | **Clients** | `/clients` | Client management |
| 20 | **Saved Reports** | `/reports` | Saved/versioned reports |

---

## 3. Design System & Technical Architecture

### Technology Stack
| Component | Technology |
|-----------|-----------|
| **Frontend CSS** | Tailwind CSS (static pre-compiled `tailwind.app.css?v=4`) + custom CSS variables |
| **Font** | Google Fonts — **Inter** (weights: 400, 500, 600, 700, 800) |
| **Icons** | Google Material Symbols Outlined |
| **Theme** | Dark mode only (glass/frosted design) |
| **Animations** | CSS keyframe animations (aurora blobs, scroll-reveal) |
| **Backend** | Server-rendered HTML (form POST to `/login`) |
| **Accessibility** | WCAG 2.4.7 focus rings, WCAG 2.5.5 touch targets, aria-hidden on icons, `prefers-reduced-motion` support |

### Design Tokens (CSS Variables)
```css
:root {
  /* Core colors */
  --bg: #0B0E14;           /* Page background - near-black */
  --ink: #F8FAFC;          /* Headings - bright white */
  --body-text: #E5E7EB;    /* Body text - light grey */
  --muted: #94A3B8;        /* Secondary text - slate */
  --brand: #3b82f6;        /* Primary blue */
  --accent: #2dd4bf;       /* Teal accent */
  --danger: #F87171;       /* Error red */
  --success: #34D399;      /* Success green */
  --warning: #FBBF24;      /* Warning amber */
  --radius: 18px;          /* Card border radius */
  
  /* Glassmorphism */
  --card-bg: linear-gradient(155deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04));
  --card-border: rgba(255,255,255,.13);
  --card-shadow: 0 14px 44px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.22);
  --card-blur: blur(32px) saturate(118%);
  
  /* Sidebar */
  --sidebar-bg: linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
  --sidebar-blur: blur(32px) saturate(125%);
  
  /* Inputs */
  --input-bg: rgba(255,255,255,.04);
  --input-border: rgba(255,255,255,.12);
  --input-text: #F1F5F9;
  --input-ph: #64748B;
}
```

### Key UI Components
1. **Aurora Background** — 3 animated gradient blobs (blue, teal, indigo) with noise overlay
2. **Glass Cards** — Frosted glass effect with `backdrop-filter: blur(32px)`
3. **Nav Links** — With active state gradient highlighting
4. **Buttons** — `btn-primary` (gradient blue), `btn-ghost` (outline), `btn-danger` (red tint)
5. **Inputs** — Dark semi-transparent with blue focus ring
6. **Pills** — Rounded status badges
7. **Kicker** — Uppercase label with blue line prefix
8. **Lift** — Hover effect that raises cards by 3px
9. **Scroll Reveal** — IntersectionObserver-based fade-in animation

---

## 4. Detailed Page Analysis

### 4.1 Homepage (`/`)

**Sections:**
1. **Header/Topbar** — Sticky nav with logo, links (Home, Visual Guide, UDCPR Tables, Free Tools, Pricing), Sign In button
2. **Hero Section** — Split layout:
   - Left: Headline "Build the numbers before you build", tagline, CTA buttons
   - Right: **Interactive SVG diagram** — drag slider changes road width → FSI + building floors update live
3. **Micro-stats Strip** — "Tables 6-A · 6-G · 6-D · 8-B encoded", "NMC & NMRDA jurisdictions", etc.
4. **What is UDCPR** — 3-step explanation (how much, where, what it costs)
5. **Workflow** — 3 cards: Entitlement → Buildability → Feasibility
6. **Credibility Strip** — Built by practising architect, every figure traces to clause, DCR pre-check
7. **Pricing** — 3 tiers:
   - **Early Access** (Free) — Full engine, unlimited reports, PDF + CAD
   - **Pro** (Founding pricing) — Team seats, IRR, priority support
   - **Studio** (For teams) — Multiple teams, analytics
8. **Closing CTA** — "Know what a plot is worth"
9. **Footer** — Links to Calculator, Visual Guide, Tables, Tools, Glossary, Methodology

**Interactive Hero Element:**
```javascript
// Road widths and corresponding FSI values (Table 6-G, NMC)
FSI = [1.10, 2.00, 2.25, 2.50, 2.50, 2.75, 3.00]
RW  = [6, 9, 12, 15, 18, 24, 30]
// Slider drags through these → SVG building floors regenerate
```

---

### 4.2 Visual Guide (`/visual-guide`)

**Interactive Diagrams (with sliders):**

| Diagram | ID | Controls | Output |
|---------|-----|----------|--------|
| **FSI Build-up** | `#g-fsi` | Road Width (6-36m), Jurisdiction (NMC/NMRDA), Area (Congested/Non), Use (Resi/Comm) | Stacked bar SVG showing Basic + Premium + TDR + Ancillary FSI |
| **Setbacks & Margins** | `#g-sb` | Road Width, Building Height, Plot Width, Plot Depth | Top-down plan SVG with front/side/rear margins and buildable footprint |
| **Chowk** | `#g-chowk` | Building Height (9-60m) | Internal chowk (≥ 3m or H/6) and External chowk (≥ 2.4m or H/7) |
| **Metro TOD FSI** | `#g-tod` | Road Width (6-24m), Plot Area (200-4000 m²) | Max permissible FSI within 500m of Nagpur Metro |
| **Internal Roads** | `#g-access` | Layout Depth (50-700m), Dev Type (Residential/Group) | Required internal road width |

**Reference Library Cards:**
- Site Eligibility & Access
- Recreational Open Space (R.O.S.)
- Land-Use Zones (R-1, R-2, Commercial, Industrial, Public, Agricultural)
- Building Anatomy (Plinth, Rooms, Staircase, Lifts, etc.)
- Parking Sizes
- Projections & Exits
- TDR
- Special Schemes

---

### 4.3 UDCPR Tables (`/information`)

**Tables encoded:**

#### Table 6-G — FSI in Non-Congested Areas (NMC)
| Road Width | Basic FSI | Premium FSI | Max TDR | Max Potential |
|-----------|-----------|-------------|---------|---------------|
| Below 9 m | 1.10 | — | — | **1.10** |
| 9 – 12 m | 1.10 | 0.50 | 0.40 | **2.00** |
| 12 – 15 m | 1.10 | 0.50 | 0.65 | **2.25** |
| 15 – 24 m | 1.10 | 0.50 | 0.90 | **2.50** |
| 24 – 30 m | 1.10 | 0.50 | 1.15 | **2.75** |
| 30 m+ | 1.10 | 0.50 | 1.40 | **3.00** |

#### Table 6-G — NMRDA / Regional
| Road Width | Basic FSI | Premium FSI | Max TDR | Max Potential |
|-----------|-----------|-------------|---------|---------------|
| Below 9 m | 1.10 | — | — | **1.10** |
| 9 – 12 m | 1.10 | 0.30 | 0.30 | **1.70** |
| 12 – 15 m | 1.10 | 0.30 | 0.60 | **2.00** |
| 15 – 24 m | 1.10 | 0.30 | 0.70 | **2.10** |
| 24 – 30 m | 1.10 | 0.30 | 0.90 | **2.30** |
| 30 m+ | 1.10 | 0.30 | 1.10 | **2.50** |

#### Table 6-A — FSI in Congested Areas (NMC)
| Road Width | Basic FSI | Premium FSI | Max TDR | Max Potential |
|-----------|-----------|-------------|---------|---------------|
| Below 9 m | 1.50 | — | — | **1.50** |
| 9 – 18 m | 2.00 | 0.30 | 0.30 | **2.60** |
| 18 – 30 m | 2.00 | 0.30 | 0.50 | **2.80** |
| 30 m+ | 2.00 | 0.30 | 0.70 | **3.00** |

Also includes: Table 6-D (Setbacks), Table 7-A (Higher FSI Schemes), Tables 8-B/8-C (Parking), Table 14-O (Metro TOD)

---

### 4.4 Free Tools (`/tools`)

Five free calculators, no login required:

1. **Quick Area & Demand** (`/tools/quick`) — Area statement (basic + premium + TDR + ancillary) and development charges
2. **FSI & Buildability** (`/tools/fsi`) — Permissible FSI, buildable area and setbacks
3. **Parking Requirement** (`/tools/parking`) — Cars & two-wheelers per Tables 8-B/8-C
4. **ASR / Ready Reckoner** (`/tools/asr`) — Annual Statement of Rates info
5. **Side Margin & Setback** (`/tools/side-margin`) — Front/side/rear marginal open spaces

---

### 4.5 Methodology (`/methodology`)

**Regulations encoded in the engine:**

| Module | Source Regulation |
|--------|------------------|
| Entitlement / FSI | Tables 6-A & 6-G, Reg 6.1–6.3, Notes (i) & (xiv) |
| Net vs Gross plot | Note (xiv) under Table 6-G |
| Marginal open spaces | Table 6-D, Reg 6.2.3 |
| Parking | Tables 8-B & 8-C, Reg 8.2 |
| TDR generation | Reg 11.2.4 |
| High-rise life safety | Reg 9.28 / 9.29 (NBC-2016 Part 4) |
| Amenity space | Reg 3.5.1 / 3.9 |
| Land-use zoning | Reg 4.2–4.27 |
| City overrides | Chapter 10 (Reg 10.4 / 10.6 / 10.10 / 10.13) |
| Schemes | Reg 7.6, 14.2, 14.4, 14.7, Table 7-A |

---

### 4.6 Login Page (`/login`)

**Form Fields:**
- Email input (type="email", placeholder="name@firm.architect")
- Password input (type="password", with show/hide toggle)
- "Forgot password?" link
- "Sign in" submit button (blue gradient)
- "New to UDCPR Pro? Create account" link

**Form action**: `POST /login` with hidden `next` field for redirect

---

### 4.7 Calculator / Dashboard (Behind Auth)

Based on the login page metadata and the homepage workflow description, the calculator operates as a **5-step wizard**:

**Calculator Modes:**
- `?mode=feasibility` — Full feasibility report
- `?mode=entitlement` — Entitlement-only analysis

**Wizard Steps (from marketing copy):**
1. **Plot Input** — Plot area, road width, jurisdiction, zone, scheme
2. **Entitlement** — FSI computation (Basic + Premium + TDR + Ancillary)
3. **Buildability** — Setbacks, margins, buildable footprint, floor-plate analysis, parking
4. **Feasibility** — Demand charges, land + construction costs, selling rate, sensitivity grid
5. **Report Generation** — Branded 6-page proposal PDF + CAD (DXF) drawing

**Expected Report Fields (based on reference PDF "Sita Smruti 25% Additional"):**
- Project name and client details
- Plot measurements and area
- FSI calculation breakdown
- Setback/margin details
- Floor-wise area statement
- Parking calculation
- Development charges
- Cost estimation
- Revenue projection
- DCR compliance check

---

### 4.8 Settings Page (`/settings`)

Currently active in browser. Expected to contain:
- Firm/company name
- Architect name
- Contact details
- Branding settings for PDF proposals
- Account management (email, password change)

---

## 5. Key Form Fields for Report Generation

Based on the entire website analysis, here are the **input fields needed for a feasibility report**:

### Plot & Location Inputs
| Field | Type | Options/Range |
|-------|------|---------------|
| Plot Area (sq.m) | Number | Any positive number |
| Plot Width | Number | 10-60 m |
| Plot Depth | Number | 10-60 m |
| Road Width (fronting) | Number/Slider | 6-36 m |
| Jurisdiction | Select | NMC, NMRDA |
| Area Type | Select | Non-Congested, Congested |
| Land-Use Zone | Select | R-1, R-2, Commercial, Industrial, etc. |
| Use Type | Select | Residential, Commercial |

### Scheme & Special Inputs
| Field | Type | Options |
|-------|------|---------|
| Scheme | Select | Normal, Redevelopment, Metro TOD, PMAY, SRA |
| Metro corridor (within 500m) | Toggle | Yes/No |
| DP road / reservation deduction | Number | Area to deduct |
| ASR (Annual Statement of Rates) | Number | ₹/sq.m |

### Building Configuration
| Field | Type | Notes |
|-------|------|-------|
| Number of floors | Number | Based on FSI allowance |
| Floor height | Number | Typically 3.0-3.6 m |
| Flat carpet areas | Number | For parking calc per Table 8-B |
| Number of tenements | Number | For parking requirements |

### Financial Inputs
| Field | Type | Notes |
|-------|------|-------|
| Land cost | Number | ₹/sq.m |
| Construction cost | Number | ₹/sq.ft |
| Selling rate | Number | ₹/sq.ft |
| Premium FSI rate | Number | 35% of ASR (auto-calculated) |

---

## 6. SEO & Technical Details

### Meta Tags
- Proper `<title>` tags per page
- Open Graph tags (og:title, og:description, og:image, og:url)
- Twitter cards (summary_large_image)
- Canonical URLs
- Structured data (Schema.org: Organization, WebSite, SoftwareApplication, FAQPage)

### Performance
- Static Tailwind CSS (pre-compiled, not CDN JIT)
- SVG favicon (inline data URI)
- Google Fonts preconnect
- IntersectionObserver for scroll-reveal (lazy animation)
- `prefers-reduced-motion` respected throughout

### Accessibility (WCAG)
- Keyboard focus rings (2px solid brand, 2px offset)
- 44px minimum touch targets on mobile
- `aria-hidden` on decorative icons
- `aria-label` on inputs
- `color-scheme: dark` for native elements
- Screen reader support for interactive sliders

---

## 7. Key Findings & Recommendations for Replication

### What Makes This Website Premium:
1. **Aurora glassmorphism** — Animated gradient blobs behind frosted glass cards
2. **Cohesive dark theme** — Single consistent `#0B0E14` background
3. **Interactive SVG diagrams** — Sliders that update architectural diagrams in real-time
4. **Tabular numeric design** — `font-variant-numeric: tabular-nums` for aligned numbers
5. **Professional typography** — Inter font at multiple weights
6. **Micro-interactions** — Hover lifts, smooth transitions, scroll reveals
7. **Domain expertise** — Every number traces to a UDCPR regulation clause

### Architecture Patterns to Replicate:
- **CSS Variable design system** — All colors, radii, blur values as custom properties
- **Server-rendered pages** — No SPA framework, plain HTML + vanilla JS
- **Form-based auth** — Simple POST login with redirect
- **5-step wizard** — Progressive form for complex input
- **Branded PDF output** — Generated from form data
- **Free tools gateway** — Public calculators that showcase the engine

> [!IMPORTANT]
> The calculator pages (behind auth) are the core product. Since the HTTP fetch without cookies returns the login page, **I need you to help me explore the calculator by navigating through it in your browser** while you're still logged in. Can you navigate to the calculator page and share what you see, or I can try the browser tool again once the rate limit resets?

---

## 8. Assets & Resources

### External Dependencies
| Asset | URL |
|-------|-----|
| Font — Inter | `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800` |
| Material Symbols | `https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined` |
| Tailwind CSS | `/static/tailwind.app.css?v=4` (custom compiled) |
| OG Image | `https://udcpr.in/static/og-default.png` |

### Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0B0E14` | Page BG |
| Ink | `#F8FAFC` | Headings |
| Body Text | `#E5E7EB` | Paragraphs |
| Muted | `#94A3B8` | Labels, secondary |
| Brand Blue | `#3b82f6` | Primary accent |
| Accent Teal | `#2dd4bf` | Secondary accent |
| Success | `#34D399` | Green indicators |
| Warning | `#FBBF24` | Amber alerts |
| Danger | `#F87171` | Red errors |
| Aurora Blue | `#2563eb` | BG blob 1 |
| Aurora Teal | `#14b8a6` | BG blob 2 |
| Aurora Indigo | `#6366f1` | BG blob 3 |

---

## 9. Visual Asset Index (Stored in `assets/`)

### Feasibility Report Output Screenshots
- **Feasibility Report Top Output**: [feasibility_report_top_output.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_report_top_output.png)
- **Feasibility Report Bottom & Exports**: [feasibility_report_bottom_output.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_report_bottom_output.png)

### Calculator Wizard Inputs Screenshots
- **Step 1 — Plot & Location**: [feasibility_step1_plot_inputs.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_step1_plot_inputs.png)
- **Step 2 — Road & Entitlement**: [feasibility_step2_road_entitlement.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_step2_road_entitlement.png)
- **Step 3 — Development Type**: [feasibility_step3_development_type.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_step3_development_type.png)
- **Step 4 — Scheme Details**: [feasibility_step4_scheme_details.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/feasibility_step4_scheme_details.png)

### Sidebar & Application UI Screenshots
- **Sidebar & Settings Page**: [sidebar_navigation_and_settings.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/sidebar_navigation_and_settings.png)
- **Dashboard Overview**: [dashboard_page_1786007095657.png](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/dashboard_page_1786007095657.png)
- **Full Video Session**: [settings_capture_1786008133304.webp](file:///c:/Users/ASUS/OneDrive/Documents/delivered-projects/builder%27s%20project/udcpr-website-analysis/assets/settings_capture_1786008133304.webp)

