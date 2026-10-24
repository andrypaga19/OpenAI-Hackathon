// Test values for the add-ons. Run: node examples.js
// core.readiness / core.matchAll are STUBS standing in for the core scoring.js; replace with the real functions.
import { readFileSync } from "node:fs";
import { addonChecks, deriveGaps, wantedValueAdd, buildSyndicates, simulateImpact } from "./addons.js";

const cfg = JSON.parse(readFileSync(new URL("./addons-config.json", import.meta.url)));
const eur = (n) => `€${(n / 1e6).toFixed(1)}M`;

const lumora = {
  id: "su_lumora", band: "D2", modules: ["SM"], area: "oncology", country: "DE", grants: ["EXIST Forschungstransfer"],
  round: { sizeEur: 2000000, nextMilestone: "ind_enabling_complete", monthsToMilestone: 24, monthlyBurnEur: 90000, runwayMonths: 5, leadSecured: false },
  team: [
    { name: "Dr. Anna Weber", role: "ceo", founder: true, fulltime: false, highestDegree: "phd", institution: "Charité", domainMatch: true, hIndex: 12, backgroundYears: { academia: 7 }, evidence: ["linkedin"] },
    { name: "Dr. Malik Osei", role: "cso", founder: true, fulltime: true, highestDegree: "phd", institution: "Max Planck Institute", domainMatch: true, hIndex: 9, backgroundYears: { academia: 6, industryRnd: 1 }, evidence: ["cv"] },
    { name: "Sara Novak", role: "other", founder: false, fulltime: false, highestDegree: "msc", institution: "TU Berlin", selfAssessment: { commercial: 7 } },
  ],
  market: { patients: 50000, annualPriceEur: 80000, eligibleSharePct: 50, source: "", firstInClass: true, peakSharePct: 40 },
  ip: { licenceType: "option", priorityYear: 2024, institutionEquityPct: 25, founderOwnershipRange: "50-75" },
};

const vcs = [
  { id: "vc_helix", name: "Helix Seed Partners", type: "vc", roles: ["lead", "co"], ticket: { min: 250000, max: 1500000 }, valueAdd: ["venture_building", "ceo_recruiting", "tto_negotiation"], reserveEur: 3000000 },
  { id: "vc_munich", name: "Munich Translational Fund", type: "vc", roles: ["lead", "co"], ticket: { min: 1000000, max: 5000000 }, valueAdd: ["lab_access", "cro_network", "ip_expertise", "cap_table_restructuring"], reserveEur: 8000000 },
  { id: "vc_rhine", name: "Rhine Pharma Ventures", type: "cvc", roles: ["co"], ticket: { min: 1000000, max: 8000000 }, valueAdd: ["pharma_network", "regulatory_expertise", "market_access"], reserveEur: 25000000 },
  { id: "vc_charite", name: "Charité Founders Circle", type: "angels", roles: ["co"], ticket: { min: 100000, max: 750000 }, valueAdd: ["ip_expertise", "tto_negotiation", "venture_building"], reserveEur: 500000 },
  { id: "vc_spree", name: "Spree Angels Health", type: "angels", roles: ["co"], ticket: { min: 50000, max: 500000 }, valueAdd: ["venture_building", "market_access"], reserveEur: 300000 },
  { id: "vc_public", name: "Public Seed Fund", type: "public", roles: ["lead", "co"], ticket: { min: 500000, max: 1000000 }, valueAdd: ["syndicate_network", "grant_expertise"], reserveEur: 2000000 },
];

// --- STUB core (replace with scoring.js) ---
const base = { vc_helix: 74, vc_munich: 62, vc_rhine: 60, vc_charite: 58, vc_spree: 55, vc_public: 52 };
const core = {
  readiness: (s) => 63 + (s.round.sizeEur >= 5000000 ? 2 : 0) + (s.team.length > 3 ? 4 : 0) + (s.ip.licenceType === "exclusive" ? 2 : 0),
  matchAll: (s) => vcs.map((v) => ({ vcId: v.id, score: base[v.id] + (s.team.length > 3 ? 6 : 0) + (s.ip.licenceType === "exclusive" ? 3 : 0) - (v.ticket.min > s.round.sizeEur ? 100 : 0) })),
};

const a = addonChecks(lumora, cfg);
console.log(`TEAM score ${a.team.score}/100 ${JSON.stringify(a.team.competencies)} missing: ${a.team.missing.join(", ") || "-"}`);
a.team.proofRequests.forEach((p) => console.log(`  proof: ${p.text}`));
console.log(`MARKET ${a.market.summary}`);
console.log(`IP06 launch ~${a.ip06.launchYear}, protection at launch ${a.ip06.protectionAtLaunchYears}y, points ${a.ip06.points}`);

const gaps = deriveGaps(a.findings, [], lumora);
console.log(`\nGAPS ${gaps.join(", ")}`);
console.log(`WANTED VALUE-ADD ${wantedValueAdd(["pharma_network"], gaps, cfg).join(", ")}`);

const impacts = simulateImpact(lumora, a.findings, vcs, core, cfg);
console.log("\nFINDINGS");
for (const f of a.findings) {
  console.log(`  ${f.checkId} [${f.severity}] ${f.title}: ${f.evidence.summary}`);
  f.actions.forEach((x) => console.log(`     -> ${x.text}`));
  const im = impacts.find((i) => i.checkId === f.checkId)?.impact;
  if (im) console.log(`     impact: readiness +${im.readinessGain}, avg match +${im.matchGain}, best syndicate +${im.syndicateGain} (rank ${im.rankKey})`);
}

const show = (label, list) => {
  console.log(`\n${label}`);
  list.forEach((s, i) => {
    console.log(`  #${i + 1} score ${s.score}: ${s.members.map((m) => `${m.name} (${m.role}, ${eur(m.ticketEur)})`).join(" + ")}`);
    s.why.forEach((w) => console.log(`     ${w}`));
  });
};
const matches = core.matchAll(lumora);
show(`SYNDICATES @ ${eur(lumora.round.sizeEur)}`, buildSyndicates(lumora, vcs, matches, gaps, cfg));
const target = a.findings.find((f) => f.checkId === "F11")?.evidence.targetRoundEur;
if (target) {
  const bigger = { ...lumora, round: { ...lumora.round, sizeEur: target } };
  show(`SYNDICATES @ ${eur(target)} (target round from F11)`, buildSyndicates(bigger, vcs, core.matchAll(bigger), gaps, cfg, { roundSizeEur: target }));
}
