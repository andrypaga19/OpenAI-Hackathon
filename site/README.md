# SeriesBio – web app (demo)

Static site, no build step. All scores come from `../src/scoring.js` and `../Addon/addons.js`; nothing is re-implemented.

## Run

Serve the **handover root** (so `site/`, `src/` and `Addon/` are all reachable), then open `/site/`:

```bash
python3 -m http.server 5174
```

http://localhost:5174/site/

## Pages

| Page | What it shows |
| --- | --- |
| `index.html` | Landing: Startup (bulb) or VC (capsule) |
| `onboarding.html` | Stage and template: TRL → band, modalities → modules, company type, round, live template summary |
| `cv.html` | Startup CV builder rendered from `question-bank.json`: live readiness ring, next best steps, coaching (core F-checks + add-on F11–F18), listing gates, dimension bars, evidence confidence. Financing section edits the round to trigger F11. |
| `deck.html` | Pitch deck scan. Demo findings (“Replay the v1 scan”) or a real PDF scanned in the browser with pdf.js against the dev-brief rules (sequences, SMILES, SEQ ID NO, confidential keywords, financial statements). |
| `profile.html` | What investors see, built on `Design.pdf`: hero, overview + verified key facts, team model, evidence, market model, Syndicate Builder, radar + dimension tiles, AI review, matches. `?as=vc&vc=<id>&s=<startup>` opens it from the investor side. |
| `investor.html` | Investor deal flow: pick a fund, listed startups ranked by `match()`, filtered pairs with reasons. |

## Demo path

Builder starts at **61.3 Draft** → Product and plan: TPP = Draft → Market: partnering thesis + public link → **65.1 Listed** → Nuvaris appears in Rheinland’s deal flow at **95**. Set the round to €2M in Financing to see F11 and the two-scenario Syndicate Builder. “Reset demo” in the top bar restores the start state (saved in localStorage).

## Files

- `js/store.js` – state, engine calls, shared helpers (ring, radar, app bar)
- `js/data.js` – extra fictional demo data: Nuvaris add-on fields, three more funds, three more startups (answers completed per band, then scored by the engine)
- `css/app.css` – Luma-style black/white design system

## Not real yet

- Registry checks are simulated: a well-formed DOI / NCT / patent number counts as verified.
- The AI review is rule-based text; swap in an LLM that rephrases without changing numbers.
- AI onboarding (deck/URL → pre-filled CV via OpenAI structured outputs) needs an API key and a small backend.
- Thesis similarity is keyword overlap (as in `scoring.js`); swap in embeddings.
