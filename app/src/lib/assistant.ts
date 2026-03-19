import { calculateFeasibility } from '@/engine/calculate';
import { FIELD_META, FIELD_META_BY_KEY, coerceFieldValue, rateMasterFor, schemeFor } from '@/engine/constants';
import { DERIVED_KEYS } from '@/engine/derive';
import { formatCrore, formatValue } from '@/engine/format';
import type { DocumentPatch, FeasibilityInputs, LineItem } from '@/engine/types';
import { generate, isConfigured, type FunctionDeclaration, type GeminiContent } from './gemini';
import { formatContext, searchKnowledgeBase } from './kb/retrieve';
import { getReport, logAudit, materialise, saveReport, type ReportDoc } from './repository';

const EDITABLE_FIELDS = FIELD_META.map((f) => f.key).join(', ');

/**
 * How the assistant is expected to talk.
 *
 * The client's feedback was explicit: it should behave like an analyst who has
 * read the feasibility reports, not a search box that returns passages out of
 * them. So the retrieval results are treated as background it has already
 * absorbed - it reasons from them and answers in its own words.
 */
const VOICE = `HOW TO ANSWER

You have read every feasibility report, regulation and calculation format in the knowledge base. Talk like someone who has: explain, compare, weigh things up, and give the user a view. Answer in your own words, in continuous prose, the way a colleague would over a desk.

Specifically:
- Do NOT paste, quote or reproduce blocks of text from the source documents. Do not answer with "the report says..." followed by an extract. Read the material, work out what it means for this user's question, and say that.
- Do NOT dump a section of a PDF or a table of raw rows. If a table is genuinely the clearest answer, build a small one containing only the lines that matter.
- Lead with the answer, then the reasoning. Two or three short paragraphs beats a bulleted wall.
- Bring in what you know from the other reports when it is useful: "the Versova scheme priced its corpus at Rs. 1,500 a foot" is a useful comparison; reciting the Versova cost sheet is not.
- Where the answer depends on something the user has not told you, say which fact would change it, and say which way.
- Give a recommendation when one is warranted. "Both are defensible, but on an 18 m road I would..." is more useful than a list of considerations.
- Regulatory answers still carry the regulation number - Reg. 7.6.1(i), Table 12 - because the team has to be able to check them. Cite it inline in a sentence, not as a heading.
- If the knowledge base genuinely does not cover something, say so plainly and say what you would need.`;

const NUMBERS_RULE = `NUMBERS

You never invent, estimate or state a figure you have not been given. Every number comes from the deterministic engine. To change one, call update_parameter and let the engine recompute the chain. To test a change without committing it, call compare_scenario. If you catch yourself about to do arithmetic in your head, call a tool instead.

Amounts are in rupees unless stated. Areas are in Sq.mt. or Sq.ft. as labelled. Percentages may be given as "35%" and are normalised for you.`;

const BUSINESS = `THE BUSINESS

The builder acquires an ageing building, rebuilds it at higher FSI, hands every existing member back a flat with additional carpet area, pays them rent for the construction period (typically 36 months), and sells the surplus. It pays only if surplus sales exceed construction, municipal charges, purchased FSI and TDR, rent, corpus and incidentals.

Two rulebooks are in play and they are not interchangeable. Greater Mumbai under MCGM runs on DCPR-2034: Table 12 FSI bands, fungible compensatory area at 35% / 20%, premium at about 50% of the Ready Reckoner rate, and the Reg. 33 redevelopment routes including the 33(20)(B) lift to FSI 4.00 against a PAP obligation. Everywhere else in Maharashtra - Mira-Bhayandar, Thane, Navi Mumbai, Pune, Nagpur - runs on UDCPR-2020: Table 6-G, ancillary FSI at 60% / 80%, premium at 35% of ASR, and the Reg. 7.6 incentive schemes. The application picks the rulebook from the authority; never answer a Mumbai question with a UDCPR regulation or the reverse.

One thing the team gets wrong often: the scheme selected changes the composition of the entitlement and what has to be bought to reach it, but it does not change what can be sold. Incentive area exists so the members can be given more than they had, so it is handed back, not sold. Income is driven by permissible area less the hand-back, and by the sale rates.`;

const SYSTEM_PROMPT = `You are the feasibility analyst for Asmita Builders, a Maharashtra redevelopment developer, working alongside an open feasibility report.

${BUSINESS}

${VOICE}

${NUMBERS_RULE}

WORKING WITH THE OPEN REPORT
The current state of the report is given to you at the start of every turn, so simple questions need no tool call. When the user asks why a figure is what it is, call explain_figure - it returns the formula with the actual values substituted, which you should then explain rather than recite. When the user asks for a change, make it with update_parameter and tell them what it did to the profit and the score.

EDITABLE PARAMETERS
${EDITABLE_FIELDS}`;

const FORM_SYSTEM_PROMPT = `You are the feasibility analyst for Asmita Builders, working alongside a user who is entering the parameters for a new redevelopment feasibility report.

${BUSINESS}

${VOICE}

${NUMBERS_RULE}

WORKING WITH THE FORM
You are given the live state of the form and its running calculation at the start of every turn - the same numbers the user is looking at on screen. Treat them as current; they update as the user types.

- When the user describes a site in plain English ("1,540 sq.m plot in Versova, 18.3 m road, 33 flats, 4 shops"), map it onto the actual field names and call fill_form_fields once with everything you can infer. Say which fields you filled and which you have left for them.
- When the user asks you to change something, use fill_form_fields - the change lands in the form they are looking at.
- You can appraise the site before the report is generated: the running calculation is real, so answer questions about profit, margin and feasibility directly.
- Use lookup_entitlement for FSI bands rather than reciting a table from memory.`;

// ------------------------------------------------------------------- tooling

const commonTools: FunctionDeclaration[] = [
  {
    name: 'search_knowledge_base',
    description:
      'Search UDCPR-2020, the client\'s reference project report and the internal calculation format. Use for any regulatory or methodology question. Returns passages with regulation numbers for citation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The question or the regulation number to look up, e.g. "incentive FSI redevelopment 7.6" or "ancillary FSI percentage".' },
      },
      required: ['query'],
    },
  },
  {
    name: 'lookup_entitlement',
    description: 'Look up basic FSI, premium FSI and maximum TDR loading from UDCPR Table 6-G for a given road width and authority.',
    parameters: {
      type: 'OBJECT',
      properties: {
        roadWidthM: { type: 'NUMBER', description: 'Abutting road width in metres.' },
        authority: { type: 'STRING', description: 'MBMC, BMC, NMC, TMC, PMC, NMMC or OTHER.' },
      },
      required: ['roadWidthM'],
    },
  },
];

const reportTools: FunctionDeclaration[] = [
  ...commonTools,
  {
    name: 'get_report_summary',
    description: 'Get the current headline figures of the open report: income, expenditure, net profit, margin, feasibility score, and the key areas.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'explain_figure',
    description:
      'Explain how a specific figure in the report was derived. Returns the formula with the actual input values substituted, the governing regulation, and which input parameter drives it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The line item id (e.g. "exp.tdr") or a description of the figure (e.g. "TDR cost", "balance carpet for developer").' },
      },
      required: ['query'],
    },
  },
  {
    name: 'update_parameter',
    description:
      'Change an input parameter and recompute the entire report. This is the ONLY way to change a number. Percentages may be given as 25 or 0.25 for fraction fields; amounts are in rupees.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: { type: 'STRING', description: `The parameter key. One of: ${EDITABLE_FIELDS}` },
        value: { type: 'STRING', description: 'The new value.' },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'compare_scenario',
    description:
      'Compute what the report would look like under one or more parameter changes WITHOUT committing them. Use this for "what if" questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        changes: {
          type: 'ARRAY',
          description: 'The parameter changes to test.',
          items: {
            type: 'OBJECT',
            properties: {
              field: { type: 'STRING' },
              value: { type: 'STRING' },
            },
            required: ['field', 'value'],
          },
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'add_line_item',
    description: 'Add an ad-hoc expense line to the report, e.g. a society corpus top-up or a one-off legal cost.',
    parameters: {
      type: 'OBJECT',
      properties: {
        label: { type: 'STRING', description: 'The line description.' },
        amount: { type: 'NUMBER', description: 'Amount in rupees.' },
      },
      required: ['label', 'amount'],
    },
  },
  {
    name: 'remove_line_item',
    description: 'Remove a line item from the report by its id.',
    parameters: {
      type: 'OBJECT',
      properties: { itemId: { type: 'STRING', description: 'The line item id to remove.' } },
      required: ['itemId'],
    },
  },
  {
    name: 'recalculate',
    description: 'Force a recomputation of the report from the current inputs.',
    parameters: { type: 'OBJECT', properties: {} },
  },
];

const fillFormTool: FunctionDeclaration = {
  name: 'fill_form_fields',
  description:
    'Fill or change one or more fields in the form the user is looking at. Call once with everything you can infer from what the user described. The form recomputes immediately.',
  parameters: {
    type: 'OBJECT',
    properties: {
      fields: {
        type: 'ARRAY',
        description: 'The fields to fill.',
        items: {
          type: 'OBJECT',
          properties: {
            field: { type: 'STRING', description: `The field key. One of: ${EDITABLE_FIELDS}` },
            value: { type: 'STRING', description: 'The value to set.' },
          },
          required: ['field', 'value'],
        },
      },
    },
    required: ['fields'],
  },
};

/**
 * The form assistant gets the analysis tools too.
 *
 * The client asked for the calculation page and the assistant to stay in sync,
 * which means the assistant has to be able to see and appraise the numbers the
 * user is looking at - not just fill fields and wait for a report to exist.
 */
const formTools: FunctionDeclaration[] = [
  ...commonTools,
  fillFormTool,
  reportTools.find((t) => t.name === 'get_report_summary')!,
  reportTools.find((t) => t.name === 'explain_figure')!,
  reportTools.find((t) => t.name === 'compare_scenario')!,
];

// ----------------------------------------------------------------- execution

export interface AssistantChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  display: string;
}

export interface AssistantResult {
  text: string;
  changes: AssistantChange[];
  /** Field values for the form page to apply client-side. */
  formFills: { field: string; value: unknown }[];
  citations: { source: string; regulation?: string }[];
  toolLog: { name: string; args: Record<string, unknown>; summary: string }[];
  reportUpdated: boolean;
  error?: string;
}

function findLineItem(inputs: FeasibilityInputs, customItems: LineItem[], query: string) {
  const result = calculateFeasibility(inputs, customItems);
  const all = result.sections.flatMap((s) => s.items.map((it) => ({ section: s.title, item: it })));
  const q = query.toLowerCase().trim();

  const exact = all.find((x) => x.item.id.toLowerCase() === q);
  if (exact) return exact;

  const scored = all
    .map((x) => {
      const hay = `${x.item.id} ${x.item.label}`.toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 10;
      for (const term of q.split(/\s+/).filter((t) => t.length > 2)) {
        if (hay.includes(term)) score += 2;
      }
      return { x, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.x;
}

/**
 * The state the assistant is looking at, in the same terms the user is.
 *
 * This is the sync point between the two panes: whatever the user has typed
 * into the calculation page arrives here on every turn, so the assistant is
 * never answering about a stale version of the numbers.
 */
function summariseState(inputs: FeasibilityInputs, customItems: LineItem[] = []): string {
  const r = calculateFeasibility(inputs, customItems);
  const scheme = schemeFor(r.inputs.schemeType);
  return [
    `Project: ${r.inputs.projectName || '(unnamed)'}, ${r.inputs.village || '(no locality)'} - authority ${r.inputs.authority}`,
    `Governing rulebook: ${r.rulebook.name} (${r.rulebook.region}); loading granted as ${r.rulebook.loadingLabel}`,
    `Scheme: ${scheme.label} (${scheme.regulation}); incentive area ${r.inputs.incentiveAreaTreatment === 'RETAINED_BY_MEMBERS' ? 'retained by the members' : 'treated as saleable'}`,
    `Plot ${formatValue(r.inputs.plotAreaConveyanceSqm, 'sqm')} on a ${r.inputs.roadWidthM} m road; ${formatValue(r.inputs.dpRoadAreaSqm, 'sqm')} surrendered`,
    `Total permissible built-up incl. ${r.rulebook.loadingLabel.toLowerCase()}: ${formatValue(r.areas.totalBuaInclAncillarySqm, 'sqm')} (${formatValue(r.areas.totalBuaInclAncillarySqft, 'sqft')})`,
    `Carpet handed back to members: ${formatValue(r.areas.totalHandBackCarpetSqft, 'sqft')} (of which ${formatValue(r.areas.additionalCarpetToTenantsSqft, 'sqft')} is the uplift at ${(r.inputs.additionalCarpetToTenantsPct * 100).toFixed(0)}%)`,
    `Balance carpet for the developer: ${formatValue(r.areas.developerBalanceCarpetSqft, 'sqft')} - residential ${formatValue(r.areas.developerResidentialCarpetSqft, 'sqft')}, commercial ${formatValue(r.areas.developerCommercialCarpetSqft, 'sqft')}`,
    `TDR to be purchased: ${formatValue(r.fsi.pathB.tdrToPurchaseSqm, 'sqm')}`,
    r.fsi.dcpr ? `PAP obligation to MCGM: ${formatValue(r.fsi.dcpr.papBuaSqm, 'sqm')}` : '',
    `Total income: ${formatCrore(r.summary.totalIncome)}`,
    `Total expenditure: ${formatCrore(r.summary.totalExpenditure)}`,
    `Net profit: ${formatCrore(r.summary.netProfit)}`,
    `Margin: ${r.summary.marginPct.toFixed(2)}%  |  ROI: ${r.summary.roiPct.toFixed(2)}%`,
    `Feasibility score: ${r.score.score}/100 - ${r.score.verdict}`,
    `Construction Rs. ${r.inputs.constructionRatePerSqft}/Sq.ft on ${r.inputs.constructionCostBasis}  |  Residential sale Rs. ${r.inputs.residentialSaleRatePerSqft}/Sq.ft  |  Commercial sale Rs. ${r.inputs.commercialSaleRatePerSqft}/Sq.ft`,
    `Corpus basis: ${r.inputs.corpusFundBasis === 'PER_SQFT_EXISTING_CARPET' ? `Rs. ${r.inputs.corpusFundRatePerSqft}/Sq.ft of existing carpet` : 'lump sum'}`,
    `Breakeven residential rate Rs. ${r.sensitivity.breakevenResidentialRatePerSqft.toFixed(0)}/Sq.ft; breakeven construction rate Rs. ${r.sensitivity.breakevenConstructionRatePerSqft.toFixed(0)}/Sq.ft`,
    r.warnings.length ? `Warnings: ${r.warnings.join(' | ')}` : 'No warnings.',
  ]
    .filter(Boolean)
    .join('\n');
}

interface ExecContext {
  report: ReportDoc | null;
  /** Mutated in place across the tool loop, persisted once at the end. */
  workingInputs: FeasibilityInputs | null;
  customItems: LineItem[];
  patches: DocumentPatch[];
  changes: AssistantChange[];
  formFills: { field: string; value: unknown }[];
  citations: { source: string; regulation?: string }[];
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ExecContext,
): Promise<{ response: Record<string, unknown>; summary: string }> {
  switch (name) {
    case 'search_knowledge_base': {
      const hits = await searchKnowledgeBase(String(args.query ?? ''), 4);
      for (const h of hits) {
        if (!ctx.citations.some((c) => c.source === h.chunk.source && c.regulation === h.chunk.regulation)) {
          ctx.citations.push({ source: h.chunk.source, regulation: h.chunk.regulation });
        }
      }
      return {
        response: { passages: formatContext(hits) },
        summary: `${hits.length} passage(s) for "${args.query}"`,
      };
    }

    case 'lookup_entitlement': {
      const { entitlementFor } = await import('@/engine/constants');
      const width = Number(args.roadWidthM);
      const authority = (String(args.authority ?? 'MBMC').toUpperCase() || 'MBMC') as never;
      const e = entitlementFor(width, authority);
      return {
        response: {
          roadWidthBand: e.row.label,
          basicFsi: e.basicFsi,
          premiumFsi: e.premiumFsi,
          maxTdrLoading: e.maxTdr,
          maxBuildingPotential: e.maxPotential,
          citation: 'UDCPR-2020 Reg. 6.3, Table 6-G',
        },
        summary: `Table 6-G for ${width} m: basic ${e.basicFsi}, premium ${e.premiumFsi}, TDR ${e.maxTdr}`,
      };
    }

    case 'get_report_summary': {
      if (!ctx.workingInputs) return { response: { error: 'Nothing is loaded yet.' }, summary: 'no state' };
      return { response: { summary: summariseState(ctx.workingInputs, ctx.customItems) }, summary: 'summary returned' };
    }

    case 'explain_figure': {
      if (!ctx.workingInputs) return { response: { error: 'Nothing is loaded yet.' }, summary: 'no state' };
      const hit = findLineItem(ctx.workingInputs, ctx.customItems, String(args.query ?? ''));
      if (!hit) return { response: { error: `No figure matching "${args.query}".` }, summary: 'not found' };
      const meta = hit.item.drivenBy ? FIELD_META_BY_KEY.get(hit.item.drivenBy) : undefined;
      return {
        response: {
          id: hit.item.id,
          section: hit.section,
          label: hit.item.label,
          value: formatValue(hit.item.value, hit.item.unit),
          formula: hit.item.formula ?? 'Direct input, no formula.',
          regulation: hit.item.regulation ?? 'n/a',
          note: hit.item.note ?? '',
          drivenByField: hit.item.drivenBy ?? null,
          drivenByLabel: meta?.label ?? null,
        },
        summary: `explained ${hit.item.id}`,
      };
    }

    case 'update_parameter': {
      if (!ctx.report || !ctx.workingInputs) return { response: { error: 'No report is open.' }, summary: 'no report' };
      const field = String(args.field) as keyof FeasibilityInputs;
      const meta = FIELD_META_BY_KEY.get(field);
      if (!meta) {
        return { response: { error: `"${field}" is not an editable parameter.` }, summary: 'invalid field' };
      }
      const coerced = coerceFieldValue(field, args.value);
      if (coerced === undefined) {
        return { response: { error: `Could not interpret "${args.value}" for ${meta.label}.` }, summary: 'bad value' };
      }
      const oldValue = ctx.workingInputs[field];
      if (oldValue === coerced) {
        return { response: { note: `${meta.label} is already ${String(coerced)}.` }, summary: 'no change' };
      }

      (ctx.workingInputs as unknown as Record<string, unknown>)[field] = coerced;

      // Setting a regulation-derived value pins it, otherwise the next
      // recompute would derive straight over the top of it.
      if (DERIVED_KEYS.has(field)) {
        const pins = new Set(ctx.workingInputs.overrides ?? []);
        pins.add(field);
        ctx.workingInputs.overrides = [...pins];
      }

      // If the authority changed, reload its rate master defaults.
      if (field === 'authority') {
        const rm = rateMasterFor(coerced as never);
        Object.assign(ctx.workingInputs, {
          asrRatePerSqm: rm.asrRatePerSqm,
          labourTaxRatePerSqm: rm.labourTaxRatePerSqm,
          fireCapitationRatePerSqm: rm.fireCapitationRatePerSqm,
          constructionRatePerSqft: rm.constructionRatePerSqft,
          tdrRatePerSqft: rm.tdrRatePerSqft,
          residentialSaleRatePerSqft: rm.residentialSaleRatePerSqft,
          commercialSaleRatePerSqft: rm.commercialSaleRatePerSqft,
          flatRentPerSqftPerMonth: rm.flatRentPerSqftPerMonth,
          shopRentPerSqftPerMonth: rm.shopRentPerSqftPerMonth,
        });
      }

      const after = calculateFeasibility(ctx.workingInputs, ctx.customItems);
      ctx.changes.push({
        field,
        label: meta.label,
        oldValue,
        newValue: coerced,
        display: `${meta.label}: ${String(oldValue)} -> ${String(coerced)}`,
      });

      return {
        response: {
          updated: meta.label,
          from: oldValue,
          to: coerced,
          newNetProfit: formatCrore(after.summary.netProfit),
          newMarginPct: after.summary.marginPct.toFixed(2),
          newScore: after.score.score,
          newVerdict: after.score.verdict,
        },
        summary: `${meta.label} ${String(oldValue)} -> ${String(coerced)}`,
      };
    }

    case 'compare_scenario': {
      if (!ctx.workingInputs) return { response: { error: 'No report is open.' }, summary: 'no report' };
      const changes = (args.changes ?? []) as { field: string; value: unknown }[];
      const trial: FeasibilityInputs = { ...ctx.workingInputs };
      const applied: string[] = [];
      for (const c of changes) {
        const key = c.field as keyof FeasibilityInputs;
        const meta = FIELD_META_BY_KEY.get(key);
        if (!meta) continue;
        const coerced = coerceFieldValue(key, c.value);
        if (coerced === undefined) continue;
        (trial as unknown as Record<string, unknown>)[key] = coerced;
        applied.push(`${meta.label} = ${String(coerced)}`);
      }
      const base = calculateFeasibility(ctx.workingInputs, ctx.customItems);
      const next = calculateFeasibility(trial, ctx.customItems);
      return {
        response: {
          applied,
          baseNetProfit: formatCrore(base.summary.netProfit),
          scenarioNetProfit: formatCrore(next.summary.netProfit),
          difference: formatCrore(next.summary.netProfit - base.summary.netProfit),
          baseMarginPct: base.summary.marginPct.toFixed(2),
          scenarioMarginPct: next.summary.marginPct.toFixed(2),
          scenarioScore: next.score.score,
          scenarioVerdict: next.score.verdict,
          committed: false,
        },
        summary: `scenario: ${applied.join(', ')}`,
      };
    }

    case 'add_line_item': {
      const amount = Number(args.amount);
      if (!Number.isFinite(amount)) return { response: { error: 'Amount must be a number in rupees.' }, summary: 'bad amount' };
      const item: LineItem = {
        id: `custom.${Date.now().toString(36)}`,
        label: String(args.label ?? 'Additional expense'),
        value: amount,
        unit: 'inr',
        note: 'Added via the assistant',
      };
      ctx.customItems.push(item);
      ctx.changes.push({
        field: 'customItems',
        label: item.label,
        oldValue: null,
        newValue: amount,
        display: `Added "${item.label}" at ${formatCrore(amount)}`,
      });
      const after = ctx.workingInputs ? calculateFeasibility(ctx.workingInputs, ctx.customItems) : null;
      return {
        response: {
          added: item.label,
          amount: formatCrore(amount),
          itemId: item.id,
          newNetProfit: after ? formatCrore(after.summary.netProfit) : undefined,
        },
        summary: `added ${item.label}`,
      };
    }

    case 'remove_line_item': {
      const id = String(args.itemId);
      const before = ctx.customItems.length;
      ctx.customItems = ctx.customItems.filter((i) => i.id !== id);
      if (ctx.customItems.length === before) {
        // Not a custom item - suppress a generated line via a patch instead.
        const section =
          ctx.report && ctx.workingInputs
            ? findLineItem(ctx.workingInputs, ctx.customItems, id)?.item
            : undefined;
        if (!section) return { response: { error: `No line item "${id}".` }, summary: 'not found' };
        const sectionId = materialise(ctx.report!).sections.find((s) => s.items.some((it) => it.id === id))?.id;
        if (sectionId) {
          const existing = ctx.patches.find((p) => p.sectionId === sectionId);
          if (existing) existing.removedItemIds = [...(existing.removedItemIds ?? []), id];
          else ctx.patches.push({ sectionId, removedItemIds: [id] });
        }
      }
      ctx.changes.push({ field: 'lineItem', label: id, oldValue: id, newValue: null, display: `Removed line "${id}"` });
      return { response: { removed: id }, summary: `removed ${id}` };
    }

    case 'recalculate': {
      if (!ctx.workingInputs) return { response: { error: 'No report is open.' }, summary: 'no report' };
      const r = calculateFeasibility(ctx.workingInputs, ctx.customItems);
      return {
        response: {
          netProfit: formatCrore(r.summary.netProfit),
          marginPct: r.summary.marginPct.toFixed(2),
          score: r.score.score,
          verdict: r.score.verdict,
        },
        summary: 'recalculated',
      };
    }

    case 'fill_form_fields': {
      const fields = (args.fields ?? []) as { field: string; value: unknown }[];
      const applied: string[] = [];
      const rejected: string[] = [];
      for (const f of fields) {
        const key = f.field as keyof FeasibilityInputs;
        const meta = FIELD_META_BY_KEY.get(key);
        if (!meta) {
          rejected.push(f.field);
          continue;
        }
        const coerced = coerceFieldValue(key, f.value);
        if (coerced === undefined) {
          rejected.push(f.field);
          continue;
        }
        ctx.formFills.push({ field: key, value: coerced });
        applied.push(`${meta.label} = ${String(coerced)}`);

        // Keep the assistant's own view in step with what the form is about to
        // show, so anything it computes later in the turn is already current.
        if (ctx.workingInputs) {
          (ctx.workingInputs as unknown as Record<string, unknown>)[key] = coerced;
          if (DERIVED_KEYS.has(key)) {
            ctx.workingInputs.overrides = [...new Set([...(ctx.workingInputs.overrides ?? []), key])];
          }
        }
      }

      // Report back what the change did, so the assistant can say so.
      let outcome: Record<string, unknown> = {};
      if (ctx.workingInputs && applied.length > 0) {
        try {
          const after = calculateFeasibility(ctx.workingInputs, ctx.customItems);
          outcome = {
            netProfit: formatCrore(after.summary.netProfit),
            marginPct: after.summary.marginPct.toFixed(2),
            score: after.score.score,
            verdict: after.score.verdict,
            developerCarpetSqft: Math.round(after.areas.developerBalanceCarpetSqft),
          };
        } catch {
          // Half-entered forms need not compute yet.
        }
      }

      return {
        response: { applied, rejected, ...outcome },
        summary: `filled ${applied.length} field(s)`,
      };
    }

    default:
      return { response: { error: `Unknown tool "${name}".` }, summary: 'unknown tool' };
  }
}

// ------------------------------------------------------------------ the loop

export interface RunAssistantArgs {
  message: string;
  history: { role: 'user' | 'model'; text: string }[];
  reportId: string | null;
  /**
   * The live, possibly unsaved state of the calculation page. Sent on every
   * turn so the assistant and the UI never drift apart - without it the form
   * assistant would be reasoning about a blank project while the user looks at
   * a filled-in one.
   */
  draftInputs?: FeasibilityInputs | null;
}

const MAX_TOOL_ROUNDS = 6;

export async function runAssistant(args: RunAssistantArgs): Promise<AssistantResult> {
  const empty: AssistantResult = {
    text: '',
    changes: [],
    formFills: [],
    citations: [],
    toolLog: [],
    reportUpdated: false,
  };

  if (!isConfigured()) {
    return {
      ...empty,
      text: 'The Gemini API key is not configured. Add GEMINI_API_KEY to .env.local and restart the dev server.',
      error: 'missing_api_key',
    };
  }

  const report = args.reportId ? await getReport(args.reportId) : null;

  // A saved report is the source of truth when one is open; otherwise the live
  // form state is, so the assistant sees exactly what is on the user's screen.
  const workingInputs = report ? { ...report.inputs } : args.draftInputs ? { ...args.draftInputs } : null;

  const ctx: ExecContext = {
    report,
    workingInputs,
    customItems: report ? [...(report.customItems ?? [])] : [],
    patches: report ? [...(report.patches ?? [])] : [],
    changes: [],
    formFills: [],
    citations: [],
  };

  const tools = report ? reportTools : formTools;
  const system = report ? SYSTEM_PROMPT : FORM_SYSTEM_PROMPT;

  const contents: GeminiContent[] = args.history
    .slice(-12)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));

  // Give the model the current state up front so simple questions need no tool call.
  let state: string | null = null;
  if (workingInputs) {
    try {
      state = summariseState(workingInputs, ctx.customItems);
    } catch {
      // A half-entered form need not compute; the assistant can still help.
      state = null;
    }
  }
  const preamble = state
    ? `${report ? 'Current state of the open report' : 'Live state of the calculation page the user is looking at'}:\n${state}\n\nUser message: ${args.message}`
    : args.message;
  contents.push({ role: 'user', parts: [{ text: preamble }] });

  const toolLog: AssistantResult['toolLog'] = [];
  let finalText = '';

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const res = await generate({ contents, systemInstruction: system, tools, temperature: 0.2 });

      if (res.functionCalls.length === 0) {
        finalText = res.text;
        break;
      }

      contents.push({
        role: 'model',
        parts: res.functionCalls.map((fc) => ({ functionCall: fc })),
      });

      const responseParts = [];
      for (const call of res.functionCalls) {
        const { response, summary } = await executeTool(call.name, call.args ?? {}, ctx);
        toolLog.push({ name: call.name, args: call.args ?? {}, summary });
        responseParts.push({ functionResponse: { name: call.name, response } });
      }
      contents.push({ role: 'user', parts: responseParts });

      if (round === MAX_TOOL_ROUNDS - 1) {
        const wrap = await generate({ contents, systemInstruction: system, temperature: 0.2 });
        finalText = wrap.text;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ...empty, toolLog, text: `The assistant could not complete that request. ${message}`, error: message };
  }

  // Persist any committed changes once, at the end of the turn.
  let reportUpdated = false;
  if (report && ctx.changes.length > 0 && ctx.workingInputs) {
    await saveReport(report._id, {
      inputs: ctx.workingInputs,
      customItems: ctx.customItems,
      patches: ctx.patches,
    });
    for (const c of ctx.changes) {
      await logAudit({
        reportId: report._id,
        field: c.field,
        label: c.label,
        oldValue: c.oldValue,
        newValue: c.newValue,
        source: 'chatbot',
      });
    }
    reportUpdated = true;
  }

  return {
    text: finalText || 'Done.',
    changes: ctx.changes,
    formFills: ctx.formFills,
    citations: ctx.citations,
    toolLog,
    reportUpdated,
  };
}
