/* SeriesBio app glue: state, engine calls and shared UI helpers.
   Every score comes from src/scoring.js (window.BioMatchScoring) and Addon/addons.js – nothing is re-implemented here. */
(function () {
  var S = window.BioMatchScoring;
  var D = window.SBData;
  var ROOT = new URL('../../', document.currentScript.src);   // handover root: src/, Addon/, site/
  var KEY = 'seriesbio.state.v1';

  var SB = window.SB = { S: S, D: D, bank: null, cfg: null, A: null, state: null };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---------- state ---------- */

  function defaultState() {
    var d = window.nuvarisDraft;
    return {
      trl: d.trl, modalities: d.modalities.slice(), companyType: d.companyType, round: d.round,
      raise: clone(d.raise), answers: clone(d.answers), confirmed: [],
      fin: clone(D.nuvarisAddon.round),
      deck: { file: 'Nuvaris_NonConfidential_Deck_v2.pdf', slides: 14, uploaded: true, attested: true, findings: [], allowDownload: false, source: 'demo', checklist: null },
      intros: []
    };
  }

  SB.load = function () {
    try { var raw = localStorage.getItem(KEY); if (raw) return Object.assign(defaultState(), JSON.parse(raw)); } catch (e) {}
    return defaultState();
  };
  SB.save = function () { try { localStorage.setItem(KEY, JSON.stringify(SB.state)); } catch (e) {} };
  SB.reset = function () { try { localStorage.removeItem(KEY); } catch (e) {} SB.state = defaultState(); };

  SB.init = async function () {
    var res = await Promise.all([
      fetch(new URL('src/question-bank.json', ROOT)).then(function (r) { return r.json(); }),
      fetch(new URL('Addon/addons-config.json', ROOT)).then(function (r) { return r.json(); }),
      import(new URL('Addon/addons.js', ROOT).href)
    ]);
    SB.bank = res[0]; SB.cfg = res[1]; SB.A = res[2];
    SB.state = SB.load();
    return SB;
  };

  /* ---------- startup objects ---------- */

  // The founder's own startup (Nuvaris), built from the saved builder state
  SB.startup = function () {
    var st = SB.state;
    var open = (st.deck.findings || []).filter(function (f) { return !f.resolved; }).length;
    return Object.assign({}, window.nuvaris, D.nuvarisProfile, {
      trl: st.trl, modalities: st.modalities, companyType: st.companyType, round: st.round, raise: st.raise,
      answers: st.answers, confirmedWarnings: st.confirmed,
      deck: { uploaded: st.deck.uploaded, attested: st.deck.attested, openFindings: open }
    });
  };

  SB.withScore = function (s, r) {
    return Object.assign({}, s, { readiness: r.score, confidence: r.verification.confidence, band: r.band });
  };

  SB.evaluate = function (s) {
    var r = S.readiness(SB.bank, s, { maxActions: 3 });
    return { s: s, r: r, full: SB.withScore(s, r) };
  };

  // Complete a demo startup's answers for its band so the engine can score it
  SB.fillAnswers = function (s) {
    var band = S.bandOf(SB.bank, s), mods = S.activeModules(SB.bank, s);
    var A = Object.assign(clone(window.nuvaris.answers), clone(s.tweak || {}));
    S.visibleQuestions(SB.bank, band, mods).forEach(function (q) {
      if (A[q.id]) return;
      if (q.type === 'checklist') A[q.id] = { items: (q.expected[band] || []).slice() };
      else if (q.type === 'number') A[q.id] = { value: 20 };
      else if (q.type === 'multi') A[q.id] = { options: [0] };
      else if (q.scored === false) A[q.id] = { option: 0 };
      else {
        var best = 0, bestD = 9;
        q.options.forEach(function (o, i) { var dd = Math.abs((o.points || 0) - 0.7); if (!o.proof && dd < bestD) { bestD = dd; best = i; } });
        A[q.id] = { option: best };
      }
    });
    return Object.assign({}, s, { answers: A, confirmedWarnings: SB.bank.checks.map(function (c) { return c.id; }) });
  };

  SB.others = function () {
    return D.others.map(function (s) { return SB.evaluate(SB.fillAnswers(s)); });
  };

  SB.allStartups = function () {
    var own = SB.evaluate(SB.startup());
    return [own].concat(SB.others());
  };

  /* ---------- matching, add-on, syndicates ---------- */

  SB.matchAll = function (full, opts) {
    opts = opts || {};
    var s = opts.ignoreLeadFilter ? Object.assign({}, full, { leadNeeded: false }) : full;
    return D.vcs.map(function (vc) { return Object.assign({ vcId: vc.id, vcRef: vc }, S.match(s, vc)); })
      .sort(function (a, b) { return b.score - a.score; });
  };

  function addonVcs() {
    return D.vcs.filter(function (v) { return v.addon; }).map(function (v) {
      return Object.assign({ id: v.id, name: v.name }, v.addon, { ticket: { min: v.ticket.min * 1e6, max: v.ticket.max * 1e6 } });
    });
  }

  // Add-on checks (F11–F18), gaps, wanted value-add and syndicates for the founder's startup
  SB.addon = function (ev) {
    var A = SB.A, cfg = SB.cfg;
    var as = Object.assign({}, D.nuvarisAddon, { name: ev.s.name, band: ev.r.band, modules: ev.r.modules, round: clone(SB.state.fin) });
    var a = A.addonChecks(as, cfg);
    var gaps = A.deriveGaps(a.findings, ev.r.flags.map(function (f) { return f.id; }), as);
    var synMatches = SB.matchAll(ev.full, { ignoreLeadFilter: true }).map(function (m) { return { vcId: m.vcId, score: m.score }; });
    var vcs = addonVcs();
    var syn = A.buildSyndicates(as, vcs, synMatches, gaps, cfg);
    var f11 = a.findings.find(function (f) { return f.checkId === 'F11'; });
    var synTarget = f11 ? A.buildSyndicates(as, vcs, synMatches, gaps, cfg, { roundSizeEur: f11.evidence.targetRoundEur }) : null;
    return { as: as, a: a, gaps: gaps, wanted: A.wantedValueAdd(as.valueAddTags, gaps, cfg), syn: syn, synTarget: synTarget, f11: f11 };
  };

  /* ---------- proof verification (demo) ----------
     Production calls Crossref / ClinicalTrials.gov / EPO OPS / NIH RePORTER (see dev brief §3).
     Here a well-formed identifier counts as registry-verified; anything else is stored as "linked". */
  var ID_RX = { doi: /^10\.\d{4,9}\/\S+$/i, trial: /^(NCT\d{8}|\d{4}-\d{6}-\d{2}(-\d{2})?)$/i, patent: /^[A-Z]{2}\s?\d{4,}[A-Z0-9]*$/i, grant: /^[A-Z0-9][A-Z0-9-]{4,}$/i };
  SB.verify = function (type, value) {
    value = (value || '').trim();
    if (!value) return null;
    var rx = ID_RX[type];
    return { value: value, verified: !!(rx && rx.test(value)) };
  };

  /* ---------- formatting + UI helpers ---------- */

  SB.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  SB.eurM = function (n) { return '€' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M'; };
  SB.eurBig = function (n) { return n >= 1e9 ? '€' + (n / 1e9).toFixed(1) + 'B' : SB.eurM(n); };
  SB.pct = function (x) { return Math.round(x * 100); };
  SB.quality = function (x) { return x >= 0.85 ? 'Excellent' : x >= 0.7 ? 'Strong' : x >= 0.5 ? 'Fair' : 'Building'; };
  SB.levelBadge = function (level) {
    var cls = level === 'Draft' ? '' : 'ok';
    return '<span class="badge ' + cls + '">' + SB.esc(level) + '</span>';
  };
  SB.q = function (id) { return SB.bank.questions.find(function (q) { return q.id === id; }); };
  SB.optLabel = function (id, answers) {
    var q = SB.q(id), a = answers[id];
    if (!q || !a) return null;
    if (q.type === 'number') return a.value + ' months';
    if (q.type === 'checklist') return (a.items || []).length + ' items';
    if (q.type === 'multi') return (a.options || []).map(function (i) { return q.options[i].label; }).join(', ');
    return q.options[a.option] ? q.options[a.option].label : null;
  };
  SB.proofStatus = function (id, answers) {
    var a = answers[id];
    if (!a || !a.proof || !a.proof.value) return 'self';
    return a.proof.verified ? 'verified' : 'linked';
  };

  // Circular gauge; `mark` draws the listing tick (e.g. 60)
  SB.ring = function (value, max, opts) {
    opts = opts || {};
    var r = 52, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / max));
    var mark = '';
    if (opts.mark) {
      var a = (opts.mark / max) * 2 * Math.PI;
      var x1 = 60 + 44 * Math.cos(a), y1 = 60 + 44 * Math.sin(a), x2 = 60 + 61 * Math.cos(a), y2 = 60 + 61 * Math.sin(a);
      mark = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="' + (opts.w || 10) + '"/>' +
      '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + (opts.color || '#fff') + '" stroke-width="' + (opts.w || 10) + '" stroke-linecap="round" stroke-dasharray="' + (c * f) + ' ' + c + '" style="transition:stroke-dasharray .6s cubic-bezier(.22,1,.36,1)"/>' + mark + '</svg>';
  };

  // Radar of dimension scores (0–1), labels around
  SB.radar = function (items, size) {
    size = size || 320;
    var cx = size / 2, cy = size / 2, R = size * 0.32, n = items.length;
    var pt = function (i, v) { var a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]; };
    var rings = [0.25, 0.5, 0.75, 1].map(function (v) {
      return '<polygon points="' + items.map(function (_, i) { return pt(i, v).join(','); }).join(' ') + '" fill="none" stroke="rgba(255,255,255,' + (v === 1 ? 0.16 : 0.07) + ')"/>';
    }).join('');
    var spokes = items.map(function (_, i) { var p = pt(i, 1); return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0] + '" y2="' + p[1] + '" stroke="rgba(255,255,255,0.06)"/>'; }).join('');
    var poly = items.map(function (it, i) { return pt(i, Math.max(0.04, it.v)).join(','); }).join(' ');
    var dots = items.map(function (it, i) { var p = pt(i, Math.max(0.04, it.v)); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="#000" stroke="#fff" stroke-width="1.5"/>'; }).join('');
    var labels = items.map(function (it, i) {
      var p = pt(i, 1.28), anchor = Math.abs(p[0] - cx) < 8 ? 'middle' : p[0] < cx ? 'end' : 'start';
      return '<text x="' + p[0] + '" y="' + p[1] + '" text-anchor="' + anchor + '" font-size="10" fill="rgba(255,255,255,0.55)">' + SB.esc(it.label) +
        '<tspan x="' + p[0] + '" dy="12" fill="#fff" font-weight="600">' + Math.round(it.v * 100) + '%</tspan></text>';
    }).join('');
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%;height:auto;overflow:visible">' + rings + spokes +
      '<polygon points="' + poly + '" fill="rgba(255,255,255,0.12)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>' + dots + labels + '</svg>';
  };

  SB.toast = function (msg) {
    var t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2600);
  };

  /* ---------- app bar ---------- */

  SB.shell = function (side, active, extra) {
    var links = side === 'startup'
      ? [['onboarding', 'onboarding.html', 'Stage and template'], ['cv', 'cv.html', 'Startup CV'], ['deck', 'deck.html', 'Pitch deck'], ['profile', 'profile.html', 'What investors see']]
      : [['dealflow', 'investor.html' + (extra && extra.vc ? '?vc=' + extra.vc : ''), 'Deal flow'], ['profile', '#', 'Startup profile']];
    var nav = links.map(function (l, i) {
      if (l[1] === '#' && active !== l[0]) return '';
      return '<a href="' + l[1] + '" class="' + (active === l[0] ? 'on' : '') + '">' + (side === 'startup' ? '<span class="n">' + (i + 1) + '</span>' : '') + l[2] + '</a>';
    }).join('');
    var right = side === 'startup'
      ? '<button class="btn sm" id="sb-reset" title="Restore the demo state">Reset demo</button><span>Nuvaris Therapeutics</span><span class="avatar">NT</span>'
      : '<span>' + SB.esc((extra && extra.vcName) || 'Investor') + '</span><span class="avatar">' + SB.esc(((extra && extra.vcName) || 'VC').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('')) + '</span>';
    var bar = document.createElement('header');
    bar.className = 'appbar';
    bar.innerHTML = '<a class="logo" href="index.html">SeriesBio</a><nav>' + nav + '</nav><div class="right">' + right + '</div>';
    document.body.prepend(bar);
    var rs = bar.querySelector('#sb-reset');
    if (rs) rs.addEventListener('click', function () { SB.reset(); location.reload(); });
  };
})();
