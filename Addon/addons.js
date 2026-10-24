// BioMatch add-ons: financing check (F11), team model, market model, IP06 + cap-table checks,
// gap-derived value-add, Syndicate Builder and impact simulation for next best steps.
// Plain JS, no dependencies. Works on the entities of the core brief (camelCase).
// Numbers and decisions come from here; the LLM only phrases the cards.

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const band = (bands, v) => bands.reduce((p, [min, pts]) => ((v || 0) >= min ? pts : p), 0);
const eurM = (n) => `€${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
const round1 = (n) => Math.round(n * 10) / 10;

function finding(id, severity, dimension, gapTag, title, why, evidence, actions) {
  return { checkId: id, severity, dimension, gapTag, title, why, evidence, actions };
}

// ---------------------------------------------------------------- F11 financing check

function costGroup(startup, cfg) {
  const order = ["cgt", "bio", "sm"]; // most expensive active module decides
  const groups = (startup.modules || ["SM"]).map((m) => cfg.modalityCostGroup[m]).filter(Boolean);
  return order.find((g) => groups.includes(g)) || "sm";
}

export function milestoneCost(startup, milestoneId, cfg) {
  const m = cfg.milestones.find((x) => x.id === milestoneId);
  if (!m) return null;
  const [lo, hi] = m.costEurM[costGroup(startup, cfg)];
  return { id: m.id, label: m.label, lo: lo * 1e6, mid: ((lo + hi) / 2) * 1e6, hi: hi * 1e6, months: m.months };
}

export function nextRoundEstimate(startup, cfg) {
  const id = startup.round?.nextMilestone || cfg.defaultNextMilestoneByBand[startup.band];
  const i = cfg.milestones.findIndex((m) => m.id === id);
  const after = cfg.milestones[i + 1];
  return after ? milestoneCost(startup, after.id, cfg).mid : (startup.round?.sizeEur || 0) * 2;
}

export function financingCheck(startup, cfg) {
  const r = startup.round || {};
  const milestoneId = r.nextMilestone || cfg.defaultNextMilestoneByBand[startup.band];
  const cost = milestoneCost(startup, milestoneId, cfg);
  if (!r.sizeEur || !cost) return null;

  const burn = r.monthlyBurnEur || 0;
  const cash = burn * (r.runwayMonths || 0);
  const months = r.monthsToMilestone || cost.months[1];
  const ownBurnNeed = burn * (months + cfg.monthsToRaiseNextRound);
  const required = Math.max(cost.mid, ownBurnNeed);
  const available = r.sizeEur + cash;
  if (available >= required) return null;

  const severity = available < cost.lo ? "critical" : "warning";
  const targetRound = Math.ceil((required - cash) / cfg.roundStepEur) * cfg.roundStepEur;
  const actions = [{ type: "raise_more", targetRoundEur: targetRound, text: `Increase the round to about ${eurM(targetRound)} so it reaches "${cost.label}" with a buffer for the next fundraise.` }];

  const target = cfg.milestones.findIndex((m) => m.id === milestoneId);
  const reached = r.reachedMilestoneIndex ?? cfg.reachedMilestoneIndexByBand[startup.band] ?? -1;
  for (let i = target - 1; i > reached; i--) {
    const c = milestoneCost(startup, cfg.milestones[i].id, cfg);
    if (available >= (c.lo + c.mid) / 2) {
      actions.push({ type: "earlier_milestone", milestone: c.id, text: `Re-scope this round to "${c.label}" (typical cost ${eurM(c.lo)}-${eurM(c.hi)}). That fits your ${eurM(r.sizeEur)} and creates the data for the next round.` });
      actions.push({ type: "tranche", text: `Structure the round in tranches: ${eurM(r.sizeEur)} now until "${c.label}", a second tranche of about ${eurM(Math.max(0, targetRound - r.sizeEur))} on that milestone.` });
      break;
    }
  }
  const used = (startup.grants || []).map((g) => g.toLowerCase());
  const grants = (cfg.grantSuggestions[startup.country] || cfg.grantSuggestions.default).filter((g) => !used.some((u) => g.toLowerCase().includes(u) || u.includes(g.toLowerCase())));
  if (grants.length) actions.push({ type: "non_dilutive", text: `Close part of the gap with non-dilutive funding: ${grants.join(", ")}.` });
  actions.push({ type: "syndicate", targetRoundEur: targetRound, text: `Use the Syndicate Builder to assemble a lead plus co-investors for ${eurM(targetRound)}.` });

  return finding("F11", severity, "FN", "funding_gap", "Round does not reach its milestone",
    "Rounds that cannot reach their milestone leave the startup without the data needed for the next round (valley-of-death trap).",
    {
      roundSizeEur: r.sizeEur, cashOnHandEur: cash, availableEur: available, milestone: cost.label, milestoneCostEur: [cost.lo, cost.hi],
      ownBurnNeedEur: ownBurnNeed, requiredEur: required, gapEur: required - available, targetRoundEur: targetRound,
      summary: `Your ${eurM(r.sizeEur)} round plus ${eurM(cash)} cash = ${eurM(available)}. "${cost.label}" typically costs ${eurM(cost.lo)}-${eurM(cost.hi)} for this modality${burn ? `; your burn over ${months}+${cfg.monthsToRaiseNextRound} months needs ${eurM(ownBurnNeed)}` : ""}. Gap: ${eurM(required - available)}.`,
    }, actions);
}

// ---------------------------------------------------------------- Team model

export function memberEvidence(m) {
  if (m.verified) return "verified";
  if ((m.evidence || []).some((d) => ["cv", "linkedin", "reference"].includes(d.type || d))) return "document";
  return "self_reported";
}

function institutionTier(name, cfg) {
  if (!name) return "other";
  const n = name.toLowerCase();
  for (const [tier, list] of Object.entries(cfg.team.institutionTiers)) if (list.some((x) => n.includes(x.toLowerCase()))) return tier;
  return "other";
}

export function scoreMember(m, cfg) {
  const t = cfg.team;
  const y = m.backgroundYears || {};
  const c = { science: 0, translational: 0, commercial: 0, entrepreneurial: 0, leadership: 0 };
  const why = [];
  const add = (k, pts, text) => { pts = Math.round(pts); if (pts > 0) { c[k] += pts; why.push(`${k} +${pts}: ${text}`); } };
  const tier = institutionTier(m.institution, cfg);

  add("science", t.degreeScience[m.highestDegree] || 0, `degree ${m.highestDegree}`);
  add("science", t.institutionPoints[tier], `${tier} institution (${m.institution})`);
  add("science", band(t.hIndexBands, m.hIndex), `h-index ${m.hIndex}`);
  add("science", m.domainMatch ? 15 : 0, "expertise in this indication/modality");
  add("science", 0.4 * band(t.yearsBands, y.academia), `${y.academia}y research`);

  add("translational", band(t.yearsBands, y.industryRnd), `${y.industryRnd}y pharma/biotech R&D`);
  add("translational", Math.min(40, (m.programsToClinic || 0) * 20), `${m.programsToClinic} program(s) taken to IND/clinic`);
  add("translational", ["cmo", "head_regulatory", "head_development"].includes(m.role) ? 15 : 0, `role ${m.role}`);
  add("translational", ["md", "md_phd"].includes(m.highestDegree) ? 10 : 0, "medical degree");

  add("commercial", Math.max(band(t.yearsBands, y.industryCommercial), band(t.yearsBands, y.vcInvesting), 0.8 * band(t.yearsBands, y.consultingBanking), 0.8 * band(t.yearsBands, y.startupOperator)), "years in pharma BD / VC / consulting / startup operations");
  add("commercial", m.highestDegree === "mba" || m.businessDegree ? 15 : 0, "business degree");
  add("commercial", Math.min(30, (m.dealsClosed || 0) * 10), `${m.dealsClosed} licensing/partnering deal(s)`);

  add("entrepreneurial", Math.min(30, (m.startupsFounded || 0) * 15), `${m.startupsFounded} startup(s) founded`);
  add("entrepreneurial", Math.min(50, (m.exits || 0) * 25), `${m.exits} exit(s)`);
  add("entrepreneurial", band(t.capitalRaisedBands, m.capitalRaisedEur), `raised ${eurM(m.capitalRaisedEur || 0)} before`);

  const total = Object.values(y).reduce((a, v) => a + (v || 0), 0);
  add("leadership", m.seniorRole ? 40 : 0, "previous VP / C-level / director role");
  add("leadership", 0.6 * band(t.yearsBands, total), `${total}y total experience`);
  add("leadership", (m.peopleLed || 0) >= 10 ? 20 : (m.peopleLed || 0) >= 3 ? 10 : 0, `led ${m.peopleLed} people`);

  // Slider (0-10) may raise a competency; unproven values are capped
  for (const [k, v] of Object.entries(m.selfAssessment || {})) if (k in c && v * 10 > c[k]) { why.push(`${k} = ${v * 10}: self-assessment slider`); c[k] = v * 10; }
  for (const k in c) c[k] = clamp(c[k]);

  const evidence = memberEvidence(m);
  const proofRequests = [];
  if (evidence === "self_reported") {
    for (const k in c) if (c[k] > t.unprovenCap) {
      proofRequests.push({ member: m.name, competency: k, claimed: c[k], counted: t.unprovenCap, text: `Upload CV or LinkedIn for ${m.name} to unlock ${c[k] - t.unprovenCap} ${k} points.` });
      c[k] = t.unprovenCap;
    }
  }
  return { name: m.name, role: m.role, fulltime: m.fulltime !== false, evidence, competencies: c, why, proofRequests };
}

export function teamModel(startup, cfg) {
  if (!startup.team?.length) return null;
  const t = cfg.team;
  const members = startup.team.map((m) => scoreMember(m, cfg));
  const competencies = {};
  for (const k of Object.keys(members[0].competencies)) {
    const v = members.map((m) => m.competencies[k] * (m.fulltime ? 1 : t.partTimeFactor)).sort((a, b) => b - a);
    competencies[k] = Math.round(clamp(v[0] + 0.15 * (v[1] || 0)));
  }
  const weights = t.stageWeights[startup.band] || t.stageWeights.D2;
  let score = Object.entries(weights).reduce((a, [k, w]) => a + w * competencies[k], 0);
  const penalties = [];
  const ceo = startup.team.find((m) => m.role === "ceo");
  if (!ceo || ceo.fulltime === false) { score -= 10; penalties.push(ceo ? "CEO not full-time (-10)" : "no CEO (-10)"); }
  if (!startup.team.some((m) => m.domainMatch)) { score -= 5; penalties.push("nobody with expertise in this indication/modality (-5)"); }
  score = Math.round(clamp(score));
  const missing = (t.requiredCompetencies[startup.band] || []).filter((k) => competencies[k] < t.competencyThreshold);
  return { score, sTM: score / 100, competencies, weights, missing, penalties, members, proofRequests: members.flatMap((m) => m.proofRequests) };
}

// ---------------------------------------------------------------- Market model

export function marketModel(startup, cfg) {
  const m = startup.market;
  const k = cfg.market;
  if (!m?.patients || !m?.annualPriceEur) return null;
  const tam = m.patients * m.annualPriceEur;
  const sam = tam * ((m.eligibleSharePct ?? 100) / 100);
  const scenarios = k.shareScenariosPct.map((p) => ({ sharePct: p, peakRevenueEur: sam * p / 100 }));
  const base = scenarios.find((s) => s.sharePct === k.baseCaseSharePct);
  const limit = m.firstInClass ? k.credibleShareMaxPct.firstInClass : k.credibleShareMaxPct.followOn;
  const founder = m.peakSharePct ? { sharePct: m.peakSharePct, peakRevenueEur: sam * m.peakSharePct / 100 } : null;
  const credible = founder && founder.sharePct <= limit ? { ...founder, label: "founder case" } : { ...base, label: "base case" };
  const pos = (k.posByBand[startup.band] ?? 0.05) * (k.areaFactor[startup.area] ?? 1);
  const score = band(k.scoreBands, credible.peakRevenueEur);
  return {
    tamEur: tam, samEur: sam, scenarios, founderCase: founder, credibleCase: credible, founderShareCredible: !founder || founder.sharePct <= limit,
    probabilityOfSuccessPct: round1(pos * 100), riskAdjustedPeakEur: credible.peakRevenueEur * pos, score, sMK: score / 100, sourced: !!m.source,
    summary: `TAM ${eurM(tam)}, SAM ${eurM(sam)}. Peak revenue at ${scenarios.map((s) => `${s.sharePct}%: ${eurM(s.peakRevenueEur)}`).join(", ")}. Credible case (${credible.label}, ${credible.sharePct}%): ${eurM(credible.peakRevenueEur)}; risk-adjusted ~${eurM(credible.peakRevenueEur * pos)}.`,
  };
}

// ---------------------------------------------------------------- IP06

export function ip06(startup, cfg) {
  const py = startup.ip?.priorityYear;
  const launchYear = new Date().getFullYear() + (cfg.ip.yearsToMarketByBand[startup.band] ?? 10);
  if (!py) return { launchYear, protectionAtLaunchYears: null, points: 0 };
  const years = py + 20 - launchYear;
  return { launchYear, patentExpiryYear: py + 20, protectionAtLaunchYears: years, points: cfg.ip.ip06Points.find(([min]) => years >= min)[1] };
}

// ---------------------------------------------------------------- Add-on checks F11-F18

export function addonChecks(startup, cfg) {
  const out = [];
  const tm = teamModel(startup, cfg);
  const mk = marketModel(startup, cfg);
  const ip = ip06(startup, cfg);
  const atLeastD2 = ["D2", "D3", "D4"].includes(startup.band);

  const f11 = financingCheck(startup, cfg);
  if (f11) out.push(f11);

  if (tm?.missing.length) {
    out.push(finding("F12", "open_question", "TM", null, "Missing competency in the team",
      "Investors check whether the team covers the competencies needed for the next milestone, not just the science.",
      { summary: `Below ${cfg.team.competencyThreshold}/100 for ${startup.band}: ${tm.missing.map((k) => `${k} (${tm.competencies[k]})`).join(", ")}. Team score ${tm.score}/100.`, competencies: tm.competencies },
      tm.missing.map((k) => ({ type: "hire", competency: k, text: `Add ${cfg.team.hireText[k]}.` }))));
  }

  if (mk) {
    const peak = mk.credibleCase.peakRevenueEur;
    if (peak < cfg.market.smallInfoEur) {
      out.push(finding("F13", peak < cfg.market.smallStrongEur ? "warning" : "info", "MK", "market", "Peak revenue potential looks small for venture capital",
        "VC funds need outcomes that can return the fund. Smaller markets may fit licensing deals, grants or strategic investors better.",
        { summary: mk.summary, peakRevenueEur: peak },
        [{ type: "market", text: "Show expansion potential: further indications, regions or combination use." },
         { type: "funding", text: "Consider a licensing-led strategy, strategic (pharma/CVC) investors or grants instead of classic VC." }]));
    }
    if (!mk.founderShareCredible) {
      out.push(finding("F18", "info", "MK", "market", "Assumed market share looks optimistic",
        "High peak-share assumptions without a first-in-class position reduce credibility.",
        { summary: `Assumed ${mk.founderCase.sharePct}% share. We use the ${cfg.market.baseCaseSharePct}% base case (${eurM(mk.credibleCase.peakRevenueEur)}).` },
        [{ type: "market", text: "Show a conservative base case next to your upside case." }]));
    }
    if (!mk.sourced) {
      out.push(finding("F18", "info", "MK", "market", "Market numbers without a source",
        "Unsourced market numbers are discounted by investors.", { summary: "No source for patients or price." },
        [{ type: "proof", text: "Add a source (epidemiology study, registry, comparable drug price)." }]));
    }
  } else if (atLeastD2) {
    out.push(finding("F18", "info", "MK", "market", "Market cannot be sized yet",
      "Without patient numbers and a price assumption, investors cannot see the upside.", { summary: "Patients or annual price missing." },
      [{ type: "answer", text: "Enter treatable patients per year, annual price and eligible share. We calculate TAM, SAM and peak revenue at 1/5/10%." }]));
  }

  if (atLeastD2 && ["option", "non_exclusive"].includes(startup.ip?.licenceType)) {
    out.push(finding("F14", "warning", "IP", "ip_licensing", "No exclusive rights to the core IP",
      "Without exclusive or assigned rights, an investor cannot be sure the company controls its core asset.",
      { summary: `Rights to the core IP: ${startup.ip.licenceType}.` },
      [{ type: "ip", text: "Convert the option or non-exclusive licence into an exclusive licence (or assignment) for the field of use before the round." },
       { type: "match", text: "Look for investors with TTO negotiation experience." }]));
  }

  if (ip.protectionAtLaunchYears !== null && ip.protectionAtLaunchYears < 6) {
    out.push(finding("F15", "warning", "IP", "ip_licensing", "Patent protection runs out soon after launch",
      "Short remaining protection at launch limits the revenue window and the value for acquirers.",
      { summary: `Core patent expires ~${ip.patentExpiryYear}, estimated launch ~${ip.launchYear}: ~${ip.protectionAtLaunchYears} years left.` },
      [{ type: "ip", text: "File follow-up patents (formulation, use, second generation) and check regulatory exclusivity (orphan, data exclusivity)." }]));
  }

  const eq = startup.ip?.institutionEquityPct;
  if (eq >= cfg.ip.institutionEquityInfoPct) {
    out.push(finding("F16", eq >= cfg.ip.institutionEquityWarnPct ? "warning" : "info", "IP", "cap_table", "High institutional equity stake",
      "Large institutional stakes leave too little equity for founders and future investors and can make the company unfinanceable.",
      { summary: `Institution holds ${eq}% of equity.` },
      [{ type: "cap_table", text: "Renegotiate towards a lower stake (milestone payments or royalties instead of equity). Public IP-transfer initiatives in Germany argue for lower institutional stakes." }]));
  }

  const fo = startup.ip?.founderOwnershipRange;
  if (fo === "<25" || (fo === "25-50" && ["D1", "D2"].includes(startup.band))) {
    out.push(finding("F17", fo === "<25" ? "warning" : "info", "FN", "cap_table", "Low founder ownership for this stage",
      "If founders hold too little early on, a new lead finds too little equity left and founder motivation is at risk.",
      { summary: `Combined founder ownership: ${fo}%.` },
      [{ type: "cap_table", text: "Clean up the cap table before raising (buy back dead equity, ESOP top-up, renegotiate early terms)." }]));
  }

  return { findings: out, team: tm, market: mk, ip06: ip };
}

// ---------------------------------------------------------------- Gaps -> wanted value-add

const CORE_CHECK_GAPS = { F3: "ip_licensing", F6: "funding_gap", F9: "commercial_leadership", F10: "regulatory" };
const COMPETENCY_GAPS = { science: "science", commercial: "commercial_leadership", translational: "translational", leadership: "commercial_leadership", entrepreneurial: "commercial_leadership" };

// coreFindingIds: ids of core F-checks (F1-F10) that fired for this startup
export function deriveGaps(addonFindings, coreFindingIds = [], startup = {}) {
  const gaps = new Set(coreFindingIds.map((id) => CORE_CHECK_GAPS[id]).filter(Boolean));
  for (const f of addonFindings) {
    if (f.checkId === "F12") f.actions.forEach((a) => gaps.add(COMPETENCY_GAPS[a.competency]));
    else if (f.gapTag && f.severity !== "info") gaps.add(f.gapTag);
  }
  if (startup.round && startup.round.leadSecured === false) gaps.add("syndication");
  return [...gaps];
}

export function wantedValueAdd(founderTicked = [], gaps, cfg) {
  return [...new Set([...founderTicked, ...gaps.flatMap((g) => cfg.gapToValueAdd[g] || [])])];
}

// ---------------------------------------------------------------- Syndicate Builder

// vcs: VC entities. matches: [{ vcId, score }] from the core matcher for this startup,
// computed WITHOUT the "startup needs lead and VC cannot lead" filter (co-investors are welcome here).
export function buildSyndicates(startup, vcs, matches, gaps, cfg, { roundSizeEur = startup.round?.sizeEur } = {}) {
  const S = cfg.syndicate;
  const byId = Object.fromEntries(vcs.map((v) => [v.id, v]));
  const covers = (vc) => gaps.filter((g) => (cfg.gapToValueAdd[g] || []).some((x) => (vc.valueAdd || []).includes(x)));
  const reserves = (vc) => vc.reserveEur ?? (vc.reserveRatio && vc.fundSizeEur ? vc.reserveRatio * vc.fundSizeEur : 0);
  const pool = matches.filter((m) => m.score >= S.minMatch && byId[m.vcId]).map((m) => ({ ...m, vc: byId[m.vcId], covers: covers(byId[m.vcId]) }));
  const leads = pool
    .filter((p) => (p.vc.roles || []).includes("lead") && p.vc.ticket.max >= S.leadMinShare * roundSizeEur && p.vc.ticket.min <= S.leadMaxMinTicketShare * roundSizeEur)
    .sort((a, b) => b.score - a.score).slice(0, S.maxLeadCandidates);
  const nextRound = nextRoundEstimate(startup, cfg);
  const results = [];

  for (const lead of leads) {
    const leadTicket = Math.min(roundSizeEur, clamp(S.leadTargetShare * roundSizeEur, lead.vc.ticket.min, lead.vc.ticket.max));
    const members = [{ ...lead, role: "lead", ticketEur: leadTicket }];
    const covered = new Set(lead.covers);
    const types = new Set([lead.vc.type]);
    let remaining = roundSizeEur - leadTicket;
    let others = pool.filter((p) => p.vcId !== lead.vcId && ((p.vc.roles || []).includes("co") || (p.vc.roles || []).includes("lead")));

    while (remaining > 0 && members.length < S.maxMembers) {
      const pick = others
        .map((p) => ({ p, k: p.score + 10 * p.covers.filter((g) => !covered.has(g)).length + (types.has(p.vc.type) ? 0 : 5) }))
        .sort((a, b) => b.k - a.k)
        .find(({ p }) => Math.min(p.vc.ticket.max, remaining) >= p.vc.ticket.min);
      if (!pick) break;
      const ticket = Math.min(pick.p.vc.ticket.max, remaining);
      members.push({ ...pick.p, role: "co", ticketEur: ticket });
      remaining -= ticket;
      pick.p.covers.forEach((g) => covered.add(g));
      types.add(pick.p.vc.type);
      others = others.filter((p) => p.vcId !== pick.p.vcId);
    }

    if (remaining <= 0 && gaps.includes("funding_gap")) covered.add("funding_gap");
    if (gaps.includes("syndication")) covered.add("syndication");
    const avg = members.reduce((a, m) => a + m.score, 0) / members.length;
    const gapCoverage = gaps.length ? covered.size / gaps.length : 1;
    const followOn = members.reduce((a, m) => a + reserves(m.vc), 0);
    const shortfall = Math.max(0, remaining);
    const score = Math.round(0.4 * avg + 30 * gapCoverage + 20 * Math.min(1, followOn / nextRound) + 10 * Math.min(1, types.size / 3) - (shortfall > 0 ? 15 : 0));
    const uncovered = gaps.filter((g) => !covered.has(g));
    results.push({
      startupId: startup.id, roundSizeEur, score, shortfallEur: shortfall, gapCoverage: Math.round(gapCoverage * 100),
      followOnReserveEur: followOn, nextRoundEstimateEur: nextRound,
      members: members.map((m) => ({ vcId: m.vcId, name: m.vc.name, type: m.vc.type, role: m.role, ticketEur: m.ticketEur, match: m.score, covers: m.covers })),
      why: [
        `${lead.vc.name} leads with ${eurM(leadTicket)}${lead.covers.length ? ` and covers ${lead.covers.join(", ")}` : ""}.`,
        ...members.slice(1).map((m) => `${m.vc.name} adds ${eurM(m.ticketEur)}${m.covers.length ? ` and helps with ${m.covers.join(", ")}` : ""}.`),
        `Combined follow-on reserves ${eurM(followOn)} vs ~${eurM(nextRound)} expected next round.`,
        shortfall > 0 ? `Shortfall of ${eurM(shortfall)}: round not fully covered.` : "Round fully covered.",
        ...(uncovered.length ? [`Gaps no member covers: ${uncovered.join(", ")}.`] : []),
      ],
    });
  }
  const seen = new Set();
  return results.sort((a, b) => b.score - a.score).filter((s) => {
    const key = s.members.map((m) => m.vcId).sort().join("+");
    return seen.has(key) ? false : seen.add(key);
  }).slice(0, cfg.syndicate.top);
}

// ---------------------------------------------------------------- Impact simulation (next best steps)

export function fixPatch(startup, f, cfg) {
  switch (f.checkId) {
    case "F11": return { round: { ...startup.round, sizeEur: f.evidence.targetRoundEur } };
    case "F12": return { team: [...startup.team, ...f.actions.map((a) => cfg.team.typicalHire[a.competency])] };
    case "F14": return { ip: { ...startup.ip, licenceType: "exclusive" } };
    case "F16": return { ip: { ...startup.ip, institutionEquityPct: 8 } };
    case "F17": return { ip: { ...startup.ip, founderOwnershipRange: "50-75" } };
    default: return null;
  }
}

// core = { readiness(startup) -> number, matchAll(startup) -> [{ vcId, score }] } from the core scoring.js
export function simulateImpact(startup, findings, vcs, core, cfg) {
  const snap = (s) => {
    const a = addonChecks(s, cfg);
    const matches = core.matchAll(s);
    const top3 = [...matches].sort((x, y) => y.score - x.score).slice(0, 3);
    const syn = buildSyndicates(s, vcs, matches, deriveGaps(a.findings, [], s), cfg)[0];
    return { readiness: core.readiness(s), avgTop3Match: top3.length ? Math.round(top3.reduce((t, m) => t + m.score, 0) / top3.length) : 0, bestSyndicate: syn?.score ?? 0 };
  };
  const now = snap(startup);
  return findings.map((f) => {
    const patch = fixPatch(startup, f, cfg);
    if (!patch) return { checkId: f.checkId, impact: null };
    const after = snap({ ...startup, ...patch });
    const readinessGain = round1(after.readiness - now.readiness);
    const matchGain = after.avgTop3Match - now.avgTop3Match;
    const syndicateGain = after.bestSyndicate - now.bestSyndicate;
    return { checkId: f.checkId, impact: { before: now, after, readinessGain, matchGain, syndicateGain, rankKey: round1(readinessGain + 0.5 * matchGain + 0.5 * syndicateGain) } };
  });
}
