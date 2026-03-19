/**
 * Curated knowledge-base seed.
 *
 * These are the regulations the feasibility engine actually leans on, quoted
 * from UDCPR-2020 (as updated to 30 January 2023) so the assistant can cite
 * chapter and verse without waiting for the full 492-page ingestion.
 *
 * `npm run ingest` adds the remainder of the corpus on top of this.
 */

export interface KbChunk {
  id: string;
  source: string;
  docType: 'regulation' | 'report' | 'format' | 'engine';
  regulation?: string;
  page?: number;
  title: string;
  text: string;
}

export const CURATED_CHUNKS: KbChunk[] = [
  {
    id: 'udcpr-6.3-table6g',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 6.3, Table 6-G',
    page: 125,
    title: 'Permissible FSI by road width (Table 6-G)',
    text: `Regulation 6.3 PERMISSIBLE FSI. Permissible basic FSI, additional FSI on payment of premium, and permissible TDR loading on a plot in a non-congested area, for residential and residential-with-mixed uses and other buildings in developable zones, is given in Table 6-G.

Table 6-G. Columns 4-6 apply to all Municipal Corporations and to CIDCO as Planning Authority by virtue of NTDA. Columns 7-9 apply to the remaining authorities and areas.

Road width | Basic FSI | Corp: premium FSI / max TDR / max potential | Other: premium FSI / max TDR / max potential
Below 9 m. | 1.10 | - / - / 1.10 | - / - / 1.10
9 m. and above but below 12 m. | 1.10 | 0.50 / 0.40 / 2.00 | 0.30 / 0.30 / 1.70
12 m. and above but below 15 m. | 1.10 | 0.50 / 0.65 / 2.25 | 0.30 / 0.60 / 2.00
15 m. and above but below 24 m. | 1.10 | 0.50 / 0.90 / 2.50 | 0.30 / 0.70 / 2.10
24 m. and above but below 30 m. | 1.10 | 0.50 / 1.15 / 2.75 | 0.30 / 0.90 / 2.30
30 m. and above | 1.10 | 0.50 / 1.40 / 3.00 | 0.30 / 1.10 / 2.50`,
  },
  {
    id: 'udcpr-6.3-note-i',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 6.3, Table 6-G, Note (i)',
    page: 125,
    title: 'Ancillary area FSI - 60% residential, 80% non-residential',
    text: `Note (i) to Table 6-G: In addition to the above, ancillary area FSI up to the extent of 60% of the proposed FSI in the development permission (including basic FSI, premium FSI and TDR, but excluding the area covered in Regulation No. 6.8) shall be allowed with payment of premium as specified in Regulation No. 6.1.1. This applies to all buildings in all zones.

Provided that in case of non-residential use, the extent of ancillary area FSI shall be up to 80%. No separate calculation is required for this ancillary area FSI; the entire FSI in the development permission is calculated and measured with reference to permissible FSI, premium FSI, TDR and additional FSI including the ancillary area FSI added therein.

Provided further that this ancillary area FSI applies to all other schemes such as TOD, PMAY, ITP, IT and MHADA, except the rehabilitation component in SRA.

Note 3: Utilisation of ancillary area FSI is optional; it can be used fully or partly.
Note 4: In a composite building of mixed users, premium and ancillary area FSI shall be on a pro-rata basis.`,
  },
  {
    id: 'udcpr-6.3-note-viii',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 6.3, Table 6-G, Note (viii)',
    page: 126,
    title: 'Premium rate for premium FSI - 35% of ASR',
    text: `Note (viii) to Table 6-G: Premium. The rate of premium for the premium FSI mentioned in Columns 4 and 7 shall be 35% of the rate of the said land mentioned in the Annual Statement of Rates (ASR), without considering the guidelines therein. Apportionment of that amount between the Authority and Government shall be as decided by Government from time to time. In Regional Plan areas the entire premium is paid to Government through the District offices of the Town Planning and Valuation Department.

Note (vi): The restrictions of road width do not apply where the permissible FSI is more than the basic FSI under schemes such as slum rehabilitation, redevelopment of dangerous buildings, cluster development for congested (core) areas, redevelopment of MHADA buildings, and TOD. In such schemes the regulations of the respective scheme apply.

Note (v): Out of the TDR quantum in Column 5 or 8, a minimum of 30% and a maximum of 50% shall be utilised out of TDR generated from a Slum Rehabilitation Scheme, Urban Renewal TDR, or Amenity construction TDR. If such TDR is not available, other TDR may be used.`,
  },
  {
    id: 'udcpr-7.5',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 7.5',
    page: 145,
    title: 'Protection of FSI in redevelopment of existing buildings',
    text: `Regulation 7.5 PROTECTION OF FSI IN REDEVELOPMENT OF EXISTING BUILDINGS. For redevelopment or reconstruction of existing buildings, the FSI to be allowed shall be the FSI permissible under Regulation No. 6.1 or 6.3, or the FSI consumed by the existing authorised building including TDR and premium FSI, whichever is more. Such TDR and premium FSI utilised in the existing building shall be treated as authorisedly consumed FSI entitled for redevelopment.`,
  },
  {
    id: 'udcpr-7.6',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 7.6 / 7.6.1',
    page: 145,
    title: 'Redevelopment of old dilapidated / dangerous buildings - incentive FSI',
    text: `Regulation 7.6 REDEVELOPMENT OF OLD DILAPIDATED / DANGEROUS BUILDINGS. Reconstruction or redevelopment, in whole or in part, of any building which has ceased to exist in consequence of accidental fire, natural collapse, or demolition for the reason of having been declared dangerous, dilapidated or unsafe by a lawful order of the Authority, or a building having an age of more than 30 years, shall be allowed subject to the following conditions.

7.6.1 Redevelopment of Multi-Dwelling Buildings of Co-operative Housing Societies / Apartments:
(i) FSI allowed for redevelopment shall be the FSI of the existing authorised building plus incentive FSI to the extent of 30% of the existing built-up area, or 15 Sq.m. per tenement, whichever is more. Provided further that if the existing authorised built-up area and incentive thereon is less than the maximum building potential under Regulation 6.1 or 6.3, the society may avail premium FSI or TDR up to the maximum building potential. Such incentive FSI shall not apply to redevelopment of an existing bungalow.
(ii) In cases where the carpet area occupied by a residential tenement in the existing building is less than 27.87 Sq.m., such tenement shall be entitled to a minimum carpet area of 27.87 Sq.m., and the difference shall be allowed as additional FSI without any premium. In the case of a non-residential occupier, the area to be given in the reconstructed building shall be equivalent to the area occupied in the old building.`,
  },
  {
    id: 'udcpr-11.2.4',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 11.2.4',
    page: 235,
    title: 'Generation of TDR against surrender of land - 2x / 3x',
    text: `Regulation 11.2.4 GENERATION OF THE TRANSFERABLE DEVELOPMENT RIGHTS (TDR). Transferable Development Rights against surrender of land: for surrender of the gross area of land which is subject to acquisition, free of cost and free from all encumbrances, the owner is entitled to TDR or DR irrespective of the FSI permissible or development potential of such land, at the rate given below:

Non-Congested Area: 2 times the area of surrendered land.
Congested Area: 3 times the area of surrendered land.

Note (i): TDR generated for a reservation in an area having total legal impediment or constraint on construction, such as CRZ, hazardous zone or low density zone, shall be 50% of the TDR generated as prescribed above.
Note (ii): TDR generated for a Bio Diversity Park reservation shall be 8% of gross area.

Provided that if levelling of land and construction of the compound wall or fencing is not desirable, the quantum of TDR shall be reduced to 1:1.85 and 1:2.85 in non-congested and congested areas respectively. Such construction of compound wall or fencing shall not be necessary for area under development plan roads; in such cases TDR equivalent to the full entitlement is granted without reduction.

Provided also that additional or incentive TDR to the extent of 5% of the surrendered land area shall be allowed to land owners who submit the proposal within 2 years from sanction of these regulations.`,
  },
  {
    id: 'udcpr-11.2.7',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 11.2.7 / 11.2.8',
    page: 238,
    title: 'TDR utilisation and road width; areas where TDR cannot be used',
    text: `Regulation 11.2.7 UTILISATION OF TDR AND ROAD WIDTH RELATION.
(i) The total maximum permissible built-up area and utilisation of TDR on a receiving plot shall be as per Regulation No. 6.1, 6.2 and 6.3.
(ii) The quantum of maximum permissible TDR loading in Table 6-G of Regulation 6.3 shall include a minimum of 30% and a maximum of 50% slum TDR, URT or Amenity TDR where applicable. If such TDR is not available, other TDR may be used.

Regulation 11.2.8 AREAS RESTRICTED FROM UTILISATION OF TDR. TDR shall not be permitted in: (a) Agricultural, No Development, Green zone, Green Belt, Regional Park, HTHS Zone and Bio Diversity Park reservation in the Development Plan; (b) area within the flood control line (blue line, prohibitive zone); (c) coastal regulation zone; (d) areas having developmental prohibition or restriction imposed under any Central or State Act such as CRZ regulations or Defence restriction areas.`,
  },
  {
    id: 'udcpr-14.2-tod',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 14.2',
    page: 281,
    title: 'Transit Oriented Development (TOD) - maximum FSI 4.00 and premium',
    text: `Regulation 14.2 TRANSIT ORIENTED DEVELOPMENT (TOD). These provisions apply where authorities have or propose an RTS / Metro corridor.

14.2.1.1 Definitions. TOD zone: the area 500 m around the proposed Metro station boundary as delineated by the Planning Authority with approval of the State Government. The distance of 500 m may be relaxed up to 30%.

14.2.1.2 Maximum Permissible FSI. The maximum permissible total FSI in a TOD zone shall be 4.00, including the base permissible FSI, subject to the condition that the additional FSI over and above the base permissible FSI is allowed within the overall limit.

14.2.1.2.1 Premium to be paid. Additional FSI over and above the base permissible FSI of the respective land use zone may be permitted on payment of premium. The rate of premium shall be 30% for FSI used for tenements of size equal to or less than 60 Sq.m., and 35% for the remaining FSI used for residential or commercial use, of the rate of the said land in the Annual Statement of Rates.

14.2.1.2.3 The entire area of the plot may be considered for calculating the potential of the plot in respect of premium FSI plus TDR, but NOT the basic FSI. Basic FSI shall be calculated on the area of the plot remaining with the owner after deducting the area under D.P. road or road widening.

Note: The regulations pertaining to ancillary FSI as listed in the principal DCPR apply to the above FSI. Built-up area calculation shall be in accordance with Regulation 6.6.`,
  },
  {
    id: 'udcpr-14.2.1.2-tod-table',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 14.2.1.2 / 14.2.4',
    page: 281,
    title: 'TOD maximum permissible FSI by road width, and who it applies to',
    text: `Regulation 14.2.1.2 MAXIMUM PERMISSIBLE FSI in a TOD zone. The maximum permissible total FSI in a TOD zone shall be 4.00 including the base permissible FSI, subject to the condition that the additional FSI over and above the base permissible FSI shall be allowed within the overall limit of maximum permissible FSI, as given in the table below:

Sr. No. | Road width in metres | Maximum Permissible FSI
1 | 9 m. and up to 12 m. | 2.50
2 | 12 m. and up to 15 m. | 3.00
3 | 15 m. and up to 24 m. | 3.50
4 | 24 m. and above | 4.00

Regulation 14.2.4 FOR OTHER MUNICIPAL CORPORATIONS AND OTHER METROPOLITAN REGION DEVELOPMENT AUTHORITY AND CIDCO AREA. For these areas, the regulations specified in Regulation No. 14.2.1 shall be applicable. This is what extends the TOD table above from Pune to Mira-Bhayandar, Thane, Navi Mumbai and the rest of the Mumbai Metropolitan Region.

Regulation 14.2.1.2.4(ii): TDR shall be allowed to be received on plots within the TOD zone, irrespective of location in congested or non-congested area, subject to the condition that it shall be utilised in 1/4 share with premium FSI at every stage of utilization. This is the source of the minimum 25% TDR loading requirement. Such share is calculated on the potential remaining after utilizing the in-situ FSI towards Development Plan road, reservation or amenity space.

Regulation 14.2.1.2.3: The entire area of the plot may be considered for calculating the potential of the plot in respect of premium FSI plus TDR, but NOT the basic FSI. Basic FSI shall be calculated on the area of the plot remaining with the owner after deducting the area under D.P. road or road widening.

A worked consequence: a plot abutting an 18 m road inside a metro corridor falls in the "15 m. and up to 24 m." band, so its maximum permissible total FSI is 3.50. Widen the abutting road to 24 m and the band changes to "24 m. and above", lifting maximum FSI to 4.00, which raises permissible built-up area, saleable carpet area and therefore income.`,
  },
  {
    id: 'rulebook-mumbai-vs-udcpr',
    source: 'UDCPR-2020 / DCPR-2034',
    docType: 'regulation',
    title: 'Which rulebook applies - UDCPR-2020 versus DCPR-2034 for Greater Mumbai',
    text: `UDCPR-2020 applies to all Planning Authorities and Regional Plan Areas in Maharashtra EXCEPT: the Municipal Corporation of Greater Mumbai; other Planning Authorities, Special Planning Authorities and Development Authorities within the limits of the Municipal Corporation of Greater Mumbai; MIDC; NAINA; Jawaharlal Nehru Port Trust; Hill Station Municipal Councils; eco-sensitive and eco-fragile regions notified by MoEF & CC; and Lonavala Municipal Council.

The practical consequence for redevelopment feasibility: Greater Mumbai (island city and suburbs, under BMC / MCGM) is governed by DCPR-2034, not UDCPR-2020. DCPR-2034 has a different FSI structure, different premium computation and a fungible compensatory area concept that has no direct UDCPR equivalent. Table 6-G and the TOD table in Regulation 14.2 do not apply there.

Everything else in the Mumbai Metropolitan Region is on UDCPR-2020. That includes Mira-Bhayandar Municipal Corporation (MBMC), Thane Municipal Corporation, Navi Mumbai Municipal Corporation, Kalyan-Dombivli, Vasai-Virar and the MMRDA area. The Sita Smruti reference project is in Bhayandar under MBMC, which is why it reconciles against UDCPR Table 6-G and the Regulation 14.2 TOD table.

So a feasibility tool aimed at "Mumbai" must be explicit about which authority a plot sits under. For MMR corporations outside Greater Mumbai, UDCPR governs and this application's tables are correct. For a plot inside Greater Mumbai under BMC, the DCPR-2034 tables are required and must be supplied before any figure is relied upon.`,
  },
  {
    id: 'udcpr-10.7-mbmc',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 10.7',
    page: 198,
    title: 'Mira-Bhayandar Municipal Corporation - city specific regulations',
    text: `Regulation 10.7 MIRA BHAYANDAR MUNICIPAL CORPORATION.
10.7.1 Uses permissible in Agriculture Zone. Lands along 45 m and 30 m wide roads up to a depth of 30 m may be developed for residential purposes on condition that the owner provides infrastructural facilities such as septic tank, drainage and water supply at his own cost.
10.7.2 Manori-Gorai-Uttan Notified Area. Special Development Control Regulations sanctioned for the Manori-Gorai-Uttan Notified Area, as amended from time to time, shall apply to development and redevelopment in that notified area, being a special Tourism Development Plan.

Note: UDCPR applies to all Planning Authorities and Regional Plan Areas in Maharashtra EXCEPT the Municipal Corporation of Greater Mumbai (which follows DCPR-2034), MIDC, NAINA, Jawaharlal Nehru Port Trust, Hill Station Municipal Councils, eco-sensitive regions notified by MoEF & CC, and Lonavala Municipal Council.`,
  },
  {
    id: 'udcpr-3.9-net-plot',
    source: 'UDCPR-2020',
    docType: 'regulation',
    regulation: 'Reg. 3.9 / 3.10',
    page: 61,
    title: 'Net plot area, computation of FSI, and in-situ FSI for DP sites',
    text: `Regulation 3.9 NET PLOT AREA AND COMPUTATION OF FSI. FSI is computed on the net plot area after deducting areas under Development Plan roads and reservations that are to be surrendered.

Regulation 3.10 TRANSFER OF DP SITES (OTHER THAN DP ROAD) IN LIEU OF FSI. Where in-situ FSI is granted against surrendered land, the FSI available shall be as desired by the owner and up to the maximum building potential according to road width as mentioned in Regulation 6.3. The receiving plot shall front on a road of minimum 9 m width. If some FSI remains unutilised, the owner is entitled to TDR against the remaining FSI. Where in-situ FSI is used, the procedure of DRC is not insisted upon.

Where amenity space is deemed a reservation, FSI in lieu may be made available in-situ on the remaining land. The generation of TDR or in-situ FSI shall be equivalent to the quantum in Regulation 11.2.`,
  },
  {
    id: 'sita-report-summary',
    source: 'Project Report - Sita Smruti (26/05/2026)',
    docType: 'report',
    title: 'Worked example - Sita Smruti, Bhayandar, MBMC',
    text: `Project Report: Sita Smruti, Survey No. 545(40), Hissa No. 7, Village Bhayandar. Dated 26 May 2026. Authority MBMC. ASR Rs. 40,800 per Sq.m.

Plot: 4,200.00 Sq.m as per 7/12; 4,199.00 Sq.m as per Conveyance Deed; less 1,354.00 Sq.m under an 18.00 m D.P. road; balance plot area 2,845.00 Sq.m.

Maximum permissible FSI as per UDCPR: basic FSI 1.10 x 2,845.00 = 3,129.50 Sq.m. Premium FSI in TOD zone 3.5 (plot abutting 18.0 m road): 3.5 - 1.1 = 2.40; 2.40 x 4,199.00 = 10,077.60 Sq.m. Minimum 25% TDR to be loaded = 2,519.40 Sq.m. In-situ FSI for the DP road = 2.0 x 1,354.00 = 2,708.00 Sq.m. Balance premium FSI = 7,369.60 Sq.m. Total permissible built-up area 13,207.10 Sq.m.

Maximum permissible FSI as per the redevelopment scheme: existing built-up area 4,000.74 Sq.m; 30% incentive FSI = 1,200.22 Sq.m or 15.00 Sq.m x 111 flats = 1,665.00 Sq.m, whichever is more, so 1,665.00; premium FSI 0.5 x 4,199.00 = 2,099.50 Sq.m; balance TDR FSI 5,441.86 Sq.m, of which in-situ road FSI 2,708.00 and TDR to be purchased 2,733.86 Sq.m. Total 13,207.10 Sq.m.

Ancillary FSI: commercial 80% of 1,112.00 = 889.60; residential 60% of 12,095.10 = 7,257.06; total 8,146.66 Sq.m. Total permissible built-up including ancillary 21,353.76 Sq.m = 2,29,852.00 Sq.ft.

Approximate RERA carpet available = 2,29,852 / 1.32 = 1,74,130 Sq.ft. Less existing RERA carpet: residential 1.04 x 40,196 = 41,804 Sq.ft, commercial 5,673 Sq.ft, total 47,477. Less 25% additional RERA carpet to tenants (flats only) = 10,451 Sq.ft. Balance for developer 1,16,202 Sq.ft, split as residential 1,05,275 and commercial 10,927.

Income: residential at Rs. 16,500/Sq.ft = Rs. 173.70 Cr; office at Rs. 18,000/Sq.ft = Rs. 19.67 Cr. Total income Rs. 193.37 Cr.

Expenditure: ancillary and premium charges to MBMC Rs. 6.32 Cr; MBMC development charges Rs. 5.52 Cr; TDR cost Rs. 6.25 Cr; other incidental expenses till OC Rs. 9.20 Cr; cost of construction at Rs. 4,130/Sq.ft Rs. 95.00 Cr; professional fees Rs. 2.30 Cr; commission to agents and advertising 4% Rs. 7.74 Cr; office expense Rs. 5,00,000 x 36 months Rs. 1.80 Cr; rent and other services Rs. 8.27 Cr; environmental clearance Rs. 2.00 Cr; other miscellaneous Rs. 5.00 Cr. Total expenses Rs. 149.40 Cr. Net profit Rs. 43.97 Cr.

Rent detail for 36 months: shops Rs. 100/Sq.ft x 5,673 Sq.ft x 36 = Rs. 2,04,22,800; flats Rs. 40/Sq.ft x 40,196 Sq.ft x 36 = Rs. 5,78,82,240; commission for rent 145 units x Rs. 15,000 x 2 = Rs. 43,50,000. Total Rs. 8,26,55,040.

Note in the report: stamp duty, registration fees, corpus fund, Estate Investment NOC cost, ULC NOC (if applicable) and all other construction costs will be subtracted when figuring out the profit. The numbers and areas are estimates and could change based on actual market rates.`,
  },
  {
    id: 'calculation-format',
    source: 'Format of Redevelopment Calculation (internal)',
    docType: 'format',
    title: 'Internal calculation format and the team\'s own open questions',
    text: `Internal calculation format used by the team.

Maximum permissible FSI: basic FSI = plot area x 1.1; premium FSI = plot area x 0.5; TDR = plot area x 0.9; total permissible built-up. Add ancillary FSI: commercial area x 0.8, residential area x 0.6. The total of commercial and residential area equals the total permissible built-up. Approximate RERA carpet available = total permissible built-up area x 0.77 (elsewhere written as permissible built-up / 1.30).

FSI calculation as per redevelopment scheme: existing built-up; 30% incentive, being 15 x number of tenants or plot area x 30%, whichever is higher; premium FSI; TDR (balance figure) = total permissible less items 1, 2 and 3. Built-up area in Sq.ft. Less existing RERA carpet area (MOFA area x 1.04). Less additional area of residential. Balance area for developer.

Expenses at MBMC, charges at Rs. 40,800 per Sq.m (the rate is sometimes different for different areas):
1. Payment towards 0.5 premium FSI = premium FSI x 0.35 x Rs. 40,800.
2. Payment towards ancillary area (10% of ASR) = ancillary FSI x 10% x Rs. 40,800.
Development charges: land development charges (MBMC) = plot area x 0.5% x Rs. 40,800; land development charges (Metro) = the same; development charges for MBMC commercial = 4% x area x Rs. 40,800, and the same for Metro; development charges for MBMC residential = 2% x area x Rs. 40,800, and the same for Metro; scrutiny fees = 2000/4000 x plot area plus total permissible built-up area; development fees (maximum Rs. 2 lakh) = total permissible area x 1.1 x 15; labour tax = total permissible built-up x 1% x 1.1 x Rs. 27,951; fire capitation fees = Rs. 188 x Rs. 27,951 x 1.1.

Open questions recorded in the format by the team: check whether 0.35 is standard; check whether 0.10 is standard; check whether the land development charge is on plot area and whether 0.5% is standard; how is the commercial area considered and is 4% standard; check whether the development fee rate is Rs. 15; check the labour tax rate.`,
  },
  {
    id: 'engine-formula-chain',
    source: 'Feasibility engine',
    docType: 'engine',
    title: 'How this application computes a feasibility report',
    text: `The engine computes in seven steps and every figure carries its formula.

Step 1. Maximum permissible FSI, computed two ways, taking whichever is more (Reg. 7.5). Path A (UDCPR): basic FSI area = balance plot area x basic FSI, where balance plot area = conveyance plot area minus DP road area. Premium entitlement = (TOD max FSI - basic FSI) x conveyance plot area in a TOD zone, otherwise (premium FSI + max TDR loading) x conveyance plot area. In-situ FSI = DP road area x in-situ multiplier (2.0 non-congested, 3.0 congested). Balance premium FSI = premium entitlement - in-situ FSI. Path B (redevelopment scheme): existing built-up + incentive FSI (max of 30% of existing BUA and 15 Sq.m per tenement) + premium FSI (0.5 x conveyance plot area) + balance TDR, where balance TDR = Path A total less the first three items, split into in-situ road FSI and TDR that must be purchased.

Step 2. Ancillary FSI: commercial BUA x 80% plus residential BUA x 60%. Total BUA including ancillary is converted to square feet at 10.764.

Step 3. Saleable RERA carpet: total BUA in Sq.ft divided by the loading factor (1.32) gives approximate RERA carpet. Deduct existing RERA carpet (residential MOFA x 1.04, plus commercial as-is) and the additional carpet handed to tenants (a percentage of existing residential RERA carpet, flats only). The remainder is the developer's balance carpet area.

Step 4. Income = developer residential carpet x residential rate + developer commercial carpet x commercial rate.

Step 5. Expenditure heads: premium and ancillary charges to the authority; development charges (land development for Corporation and Metro, development charges on commercial at 4% each and residential at 2% each, scrutiny fee, development fee capped at Rs. 2 lakh, labour tax, fire capitation fee); TDR purchase cost; incidentals till OC; cost of construction; professional fees; agent commission; developer office expense; rent and displacement for the construction period; and other heads including environmental clearance, stamp duty, corpus fund and miscellaneous.

Step 6. Net profit = total income - total expenditure. Margin = net profit / income. ROI = net profit / expenditure.

Step 7. Feasibility score out of 100: profit margin (40 points), return on outlay (25), surplus area ratio (20), and regulatory headroom measured as dependency on purchased TDR (15). Verdict bands: 75+ Highly Feasible, 55-75 Feasible, 40-55 Marginal, below 40 Not Feasible. A sensitivity table recomputes net profit at plus or minus 5% and 10% on construction cost, sale rates and TDR rate, and reports the breakeven sale and construction rates.

Rent is always computed on the tenants' existing carpet area, not the enhanced area they receive, and runs for the full construction period.`,
  },
  {
    id: 'dcpr-2034-mumbai-structure',
    source: 'DCPR-2034',
    docType: 'regulation',
    regulation: 'Reg. 30 / 31 / 33',
    title: 'How a Mumbai feasibility differs from the rest of Maharashtra',
    text: `Greater Mumbai is governed by DCPR-2034, not UDCPR-2020, and the difference is structural rather than cosmetic. Four things change.

First, basic FSI. DCPR Reg. 30, Table 12 gives 1.33 in the island city and 1.00 in the suburbs, against UDCPR's flat 1.10. On top of the basic FSI, the abutting road width decides how much premium FSI can be bought from MCGM and how much TDR can be loaded. A suburbs plot on an 18 m to 27 m road carries basic 1.00, premium 0.50 and TDR 0.90, giving a Table 12 potential of 2.40. Widen to 27 m and the TDR band rises to 1.20, taking the potential to 2.70. The island city runs richer: 1.33 basic and up to 3.00 total on an 18 m road.

Second, the free-of-FSI loading. UDCPR grants ancillary area FSI at 60% residential and 80% non-residential. DCPR grants fungible compensatory area under Reg. 31(3) at 35% residential and 20% commercial. Fungible area covers balconies, flower beds, voids and terraces. It is much smaller than the UDCPR allowance, which is the single biggest reason a Mumbai plot yields less saleable area per unit of FSI than an MMR plot at the same headline number.

Third, what the premium costs. UDCPR charges 35% of the ASR for premium FSI and 10% for ancillary. DCPR charges around 50% of the Ready Reckoner rate for FSI purchased from the Corporation and for the saleable share of fungible area, with commercial fungible closer to 60%. Because Mumbai RR rates are three to four times MMR ASR rates, the premium line is an order of magnitude larger in absolute terms.

Fourth, the redevelopment route. UDCPR Reg. 7.6.1 grants incentive FSI of 30% of existing built-up or 15 Sq.mt. per tenement. Mumbai does not work that way. Reg. 33(7)(B) protects the existing building and lets the society build to the Table 12 potential; Reg. 33(20)(B) then lifts the plot to a total FSI of 4.00 on the area in possession, but half the built-up area above the 33(7)(B) entitlement must be handed to MCGM as Project Affected Persons stock. That PAP obligation is a real, priced cost - typically the largest single line in a Mumbai appraisal after construction.

There is no UDCPR-style TOD table in Mumbai. Density near a metro station is handled through the Reg. 33 schemes, not a separate corridor uplift.

Practical consequence: asking "what FSI do I get" without first asking which side of the Mumbai boundary the plot sits on produces the wrong answer every time. Mira-Bhayandar, Thane, Navi Mumbai, Kalyan-Dombivli and Vasai-Virar are all UDCPR. Only Greater Mumbai under MCGM is DCPR.`,
  },
  {
    id: 'dharti-versova-analysis',
    source: 'Feasibility Report - Dharti CHS, Versova (DCPR-2034)',
    docType: 'report',
    title: 'Worked example and analysis - Dharti CHS, Versova, Mumbai suburbs',
    text: `Dharti CHS Ltd., Versova, Mumbai suburbs. A 1,538.90 Sq.mt. plot in possession on an 18.3 m road, 73 Sq.mt. surrendered to the new setback leaving a net plot of 1,465.90 Sq.mt. Thirty-three residential flats holding 1,498.33 Sq.mt. of carpet and four shops holding 138.42 Sq.mt., so 1,636.75 Sq.mt. of members' carpet in total, or 1,964.10 Sq.mt. of built-up once balconies are counted at the 1.20 convention. Ready Reckoner rate Rs. 1,22,580 per Sq.mt.

The entitlement chain. Table 12 puts an 18-to-27 m suburbs plot on basic 1.00, premium 0.50 and TDR 0.90. On the net plot that is 1,465.90 + 732.95 + 1,319.31 Sq.mt., plus 146.00 Sq.mt. of setback compensation at twice the surrendered area, giving 3,664.16 Sq.mt. under Reg. 33(7)(B). The TDR actually bought is smaller than the entitlement: 1,319.31 less 330 Sq.mt. of per-tenement credit (33 flats at 10 Sq.mt.) less 108.14 Sq.mt. of earlier road setback leaves 881.17 Sq.mt. to purchase.

Taking the Reg. 33(20)(B) route lifts the plot to 4.00 FSI on the area in possession: 6,155.60 Sq.mt. The 2,491.44 Sq.mt. of headroom above the 33(7)(B) entitlement carries a 50% PAP obligation, so 1,245.72 Sq.mt. goes to MCGM, priced at roughly Rs. 1.70 lakh per Sq.mt. - about Rs. 21.18 Cr, plus 6% stamp duty on it.

Fungible compensatory area at 35% adds 2,154.46 Sq.mt., taking the total to 8,310.06 Sq.mt., which is an effective 5.40 on the plot in possession. Construction area is taken at 1.35 times that figure, about 1,20,756 Sq.ft.

The commercial lever in this report is the additional area offered to the members, tested at 45%, 65%, 70%, 75% and 80%. At 45% the rehab built-up is 2,847.95 Sq.mt., leaving 5,462.11 Sq.mt. of sale built-up, or 53,449 Sq.ft. of sale carpet at the 1.10 loading. At 80% the rehab rises to 3,535.39 Sq.mt. and the sale carpet falls to 46,722 Sq.ft. - 6,727 Sq.ft. less, which at Rs. 55,000 per Sq.ft. is Rs. 37 Cr of revenue given away to win the tender. Net profit before tax moves from about Rs. 110 Cr at 45% to about Rs. 74 Cr at 80%, on a total cost of roughly Rs. 206 Cr either way. That sensitivity - roughly Rs. 1 Cr of profit for each additional percentage point offered - is the number to have in your head when negotiating with a society.

Cost structure at 45%: construction Rs. 57.00 Cr at Rs. 4,720 per Sq.ft. including GST, podium parking RCC Rs. 10.56 Cr at Rs. 2,950, consultants at 6%, TDR Rs. 7.45 Cr, government FSI Rs. 4.49 Cr, saleable fungible premium Rs. 9.70 Cr, PAP Rs. 21.18 Cr, open space deficiency Rs. 15.00 Cr, staircase premium Rs. 5.09 Cr, land-under-assessment tax Rs. 1.99 Cr, corpus at Rs. 1,500 per Sq.ft. of members' existing carpet Rs. 2.64 Cr, transit rent for 36 months at Rs. 150 per Sq.ft. residential and Rs. 300 commercial, marketing at 3% of sale proceeds, and finance cost at 12% for twelve months. Revenue is residential sale at Rs. 55,000 per Sq.ft. plus about Rs. 22.5 Cr of parking at Rs. 25 lakh for 90 spaces.

Two things in this report are worth carrying to any Mumbai appraisal. The corpus is quoted per square foot of the members' existing carpet, not as a lump sum - Rs. 1,500 per Sq.ft. here. And the open space deficiency premium, at Rs. 15 Cr, is larger than the entire TDR purchase; on a tight plot it deserves checking before anything else.`,
  },
  {
    id: 'analysis-method',
    source: 'Feasibility practice',
    docType: 'engine',
    title: 'How to read a feasibility - what actually decides the answer',
    text: `Across the reports in this knowledge base, the same handful of variables decide whether a redevelopment pays.

Road width is first, and it is not close. It sets the FSI band under both rulebooks. On a UDCPR plot in a metro corridor, moving from an 18 m road to a 24 m road takes maximum FSI from 3.50 to 4.00 - roughly a seventh more of everything, and the extra area is almost entirely saleable because the hand-back does not change. Measure it; do not take it from a drawing.

Second is the additional area offered to the members. It is the lever that wins tenders and the one that quietly destroys margins, because every square foot given away comes straight out of the saleable pool at the full sale rate while the construction cost on it is still paid. On the Versova scheme it runs at about Rs. 1 Cr of profit per percentage point. The right way to use it is to solve backwards: fix the margin the project must clear, then see what uplift is affordable.

Third is the construction rate and, critically, the area basis it is quoted against. The same rate applied to carpet, to built-up or to super built-up moves the largest cost line by 25 to 30 per cent. A rate that looks competitive on super built-up is expensive on carpet.

Fourth is what has to be bought rather than granted - TDR, premium FSI, PAP obligations. These are cash out before any revenue arrives, so they drive the finance cost as well as the cost line. A scheme that reaches the same permissible area with less purchased FSI is worth more than the headline profit suggests.

What does not decide the answer, and is routinely mistaken for it: the scheme selected. The scheme changes the composition of the entitlement and what must be purchased to reach it, but the saleable area is set by the permissible area less the hand-back. Incentive FSI exists to fund the members' extra area; treating it as saleable double-counts. Similarly, the total permissible built-up figure is gross potential - the number that matters is what survives the loading factor and the hand-back.

When a scheme is marginal, the questions in order are: is the road width right; is the loading factor real or assumed; what is the breakeven sale rate against today's market; and how much of the cost is purchased FSI that could be reduced by taking a different route to the same area.`,
  },
  {
    id: 'business-model',
    source: 'Asmita Builders - project brief',
    docType: 'engine',
    title: 'The redevelopment business model',
    text: `Asmita Builders runs redevelopment projects. The model: acquire an ageing residential or commercial building, demolish and rebuild it at a higher FSI, hand every existing resident back a flat with 20% more RERA carpet area than they had before, pay each of them rent for 36 months while construction runs, and sell the surplus area on the open market.

The project earns money only if the surplus area sells for more than the total of construction cost, municipal charges, TDR purchase, rent payouts and incidentals. Feasibility means: will the builder earn from this project or not.

Two distinctions matter. First, usable versus non-usable area: total permissible built-up area is gross potential, but what can actually be sold is only what survives the loading factor and the hand-back to existing occupiers. Second, the tenant uplift applies to flats only - commercial occupiers get back the area they had, with no increase.

The corpus fund paid to the society is negotiable and is often what wins or loses the redevelopment tender.`,
  },
];
