# BioMatch add-on

Extends the core brief v2.0 (question-bank.json + scoring.js). See `BioMatch_Addon_Brief.pdf`.

- `addons-config.json`: all thresholds, cost ranges, weights (demo assumptions, calibrate later)
- `addons.js`: financingCheck, teamModel, marketModel, ip06, addonChecks, deriveGaps, wantedValueAdd, buildSyndicates, simulateImpact
- `examples.js`: test case "Lumora" (run `node examples.js`, expected output in `examples-output.txt`).
  `core.readiness` and `core.matchAll` are stubs: replace them with the functions from scoring.js.

Integration in short:
1. After core F1-F10: `const a = addonChecks(startup, cfg)` → merge `a.findings` into the startup's findings.
2. Readiness: `s_TM = 0.5 * s_TM(questions) + 0.5 * a.team.sTM`, `s_MK = 0.5 * s_MK(questions) + 0.5 * a.market.sMK`, IP06 as new question.
3. Matching: startup fit value-add uses `wantedValueAdd(ticked, deriveGaps(a.findings, coreFiredIds, startup), cfg)`.
4. Syndicates: `buildSyndicates(startup, vcs, matchesWithoutLeadFilter, gaps, cfg)`; again with `{ roundSizeEur: targetRound }` if F11 fired.
5. Next best steps: `simulateImpact(startup, a.findings, vcs, { readiness, matchAll }, cfg)` → sort by `impact.rankKey`.
