# SeriesBio · OpenAI DevDay Exchange Berlin Hackathon

**Web app:** `site/` – run `python3 -m http.server 5174` from this folder and open http://localhost:5174/site/. Pages, demo path and what is still simulated: [`site/README.md`](site/README.md).

**Next up:** AI onboarding (deck or URL → pre-filled Startup CV via OpenAI structured outputs + NDA filter). Keep your own `OPENAI_API_KEY` in a local `.env` – it is git-ignored, never commit it.

---

# BioMatch – Startup CV builder · Dev handover

Everything needed to build the Startup CV builder: all screens, all states, and the scoring logic behind them.
All companies and VCs in the data are fictional.

## Start here (10 minutes)

1. Open `mockup/BioMatch_Mockup.html` in any browser (offline, no login). Use the bar at the top to switch between the 4 screens. Everything is clickable and the score recalculates live.
2. Read `docs/BioMatch_Dev_Brief_Scoring.pdf` (4 pages): structure, KPI weights, formulas, gates, matching.
3. Run `npm test` (Node 18+, no dependencies). The tests check the reference values your implementation must reproduce.

## Folder structure

| Folder | Content |
| --- | --- |
| `docs/` | `BioMatch_Dev_Brief_Scoring.pdf` (formulas, weights, short) · `BioMatch_Spec_v2.pdf` (full spec + complete question bank, 30 pages) |
| `mockup/` | `BioMatch_Mockup.html` – all 4 screens in one clickable file |
| `mockup/screens/` | Source of each screen: markup + state logic (`class Component … renderVals()`) |
| `screenshots/` | Every screen and key state as PNG (see below) |
| `src/` | **Source of truth for the logic:** `question-bank.json`, `scoring.js`, `examples.js` |
| `tests/` | Reference tests (`npm test`) |

## Screens and states

| # | Screen | Screenshot | What it shows |
| --- | --- | --- | --- |
| 1 | Stage and template (onboarding) | `01_…D2…`, `02_…D4…` | TRL → band D1–D4, modality modules, company type, round → question counts, top weights, round warning |
| 2 | Startup CV builder | `03_…draft_61.3`, `04_…product-plan`, `05_…listed_65.1`, `09_…phone` | Section nav, question cards with points, evidence checklist, proof fields with registry status, live readiness ring (60 = listing line), next best steps, listing checks, flags, dimension bars, evidence confidence |
| 3 | Pitch deck scan | `06_…blocked`, `07_…cleared` | Upload, confidentiality scan findings, attestation, slide checklist, download toggle |
| 4 | What investors see | `08_investor_preview` | Public CV, readiness 65.2, match list |

Demo path in the mockup: builder starts at 61.3 (Draft) → Product and plan: TPP = Draft → Market: thesis stated + public link → **65.1 Listed**.

## Important for implementation

- **`src/scoring.js` is authoritative.** The screen files contain a simplified copy of the logic only so the mockup runs offline. Do not port the mockup logic; call `readiness()` and `match()` instead (works in Node and browser via `window.BioMatchScoring`).
- **Questions are data, not code.** Text, options, points, required/optional per band, modules, checks and gates all live in `question-bank.json`. The UI renders from it.
- **No confidential data.** Only the non-confidential tier is stored: no sequences, structures, unpublished data, P&L. Deck scan blocks before storage; metadata is stripped.
- Thesis similarity uses keyword overlap as a stand-in; swap in embeddings for production.

## Reference values (must match)

| Case | Expected |
| --- | --- |
| Nuvaris final (D2, small molecule) | Readiness **65.2**, Listed · TM 13.9 · SC 16.6 · PD 11.1 · IP 5.1 · RC 2.5 · CM 3.1 · MK 7.0 · FN 2.9 · EV 3.0 |
| Nuvaris draft | **61.3**, Draft (required questions open) |
| Matching | Rheinland **95** Strong · Helvetia **68** Good (portfolio conflict −10) · Northstar **46** Weak · Atlantic filtered out |

See `src/README.md` for the answer format and API.
