# BioMatch – scoring engine and question bank (v2.0)

Reference implementation of the BioMatch spec: the Startup CV question bank, the stage-fair Readiness Score and the reciprocal Matching Score. Plain JavaScript, no dependencies; runs in the browser or in Node.

## Files

| File | What it is |
| --- | --- |
| `question-bank.json` | 18 profile fields, 46 scored core questions, 6 modality modules (19 scored + 4 descriptive questions), band weights, consistency checks, gates and levels |
| `scoring.js` | `readiness(bank, startup)` and `match(startup, vc)` |
| `examples.js` | Fictional demo data: Nuvaris Therapeutics (final and draft state) and four VCs |

## Quick start (Node)

```js
const bank = require('./question-bank.json');
const S = require('./scoring.js');
const { nuvaris, vcs } = require('./examples.js');

const r = S.readiness(bank, nuvaris);
console.log(r.score, r.level);            // 65.2 'Listed'
console.log(r.actions);                   // top 3 next steps, ranked by score gain

const startup = Object.assign({}, nuvaris, {
  readiness: r.score, confidence: r.verification.confidence, band: r.band
});
vcs.forEach(vc => {
  const m = S.match(startup, vc);
  console.log(vc.name, m.score, m.label, m.strengths, m.gap, m.hardFilterFailures);
});
// Rheinland Bio Ventures 95 Strong match
// Helvetia Life Science Fund 68 Good match (portfolio conflict −10)
// Atlantic Precision Partners 0 Filtered out
// Northstar Generalist Ventures 46 Weak match
```

In the browser, load `scoring.js` with a script tag; it exposes `window.BioMatchScoring`.

## Answer format

- Single choice: `{ option: <index>, proof: { value: 'ID or link', verified: true|false } }`
- Multi choice (IP05): `{ options: [<index>, ...] }`
- Evidence checklist (SC02): `{ items: ['ivpoc', 'te', ...], proofs: { hsafe: { value: 'NCT…', verified: true } } }`
- Number (PD05): `{ value: 18 }`
- Positioning (SC07): `{ option: <index>, bullets: ['…', '…', '…'] }`

## Rules implemented

- Template = development band (D1–D4, from the TRL answer) × modality modules; questions are required (R), optional bonus (O) or hidden (–) per band.
- Dimension score = mean of required answers + 0.1 × mean of optional answers (max 1); dimensions without required questions take their best optional answer; External validation always does.
- Proof rule: an answer that needs a public identifier and has none scores like the best lower option.
- Cell and gene therapy modifier: 5 points move from Science to CMC.
- Gates G1–G5 and checks F1–F10 as in the spec; listed at 60 when all gates pass.
- Matching: hard filters on both sides, then `sqrt(VC fit × startup fit) − 10 × conflict`.

Thesis similarity uses keyword overlap as a stand-in; swap in text embeddings for production.
