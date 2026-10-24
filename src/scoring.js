/*
 * BioMatch scoring engine v2.0
 * Readiness Score (stage-fair, 0-100) and reciprocal Matching Score (0-100).
 * Works in the browser (window.BioMatchScoring) and in Node (module.exports).
 * Input data model: see question-bank.json and the example objects in examples.js.
 */
(function (root) {
  'use strict';

  var BANDS = ['D1', 'D2', 'D3', 'D4'];
  var ROUNDS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
  var PLATFORM_TYPES = ['Platform with lead asset', 'Platform only'];

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mean(a) { return a.length ? a.reduce(function (s, x) { return s + x; }, 0) / a.length : 0; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function hasProof(p) { return !!(p && p.value && String(p.value).trim()); }

  /* ---------- template selection ---------- */

  function bandOf(bank, startup) {
    if (startup.band) return startup.band;
    var opt = bank.trlOptions.find(function (o) { return o.label === startup.trl; });
    return opt ? opt.band : 'D1';
  }

  function activeModules(bank, startup) {
    var mods = new Set();
    (startup.modalities || []).forEach(function (m) {
      var opt = bank.modalityOptions.find(function (o) { return o.label === m; });
      if (opt && opt.module) mods.add(opt.module);
    });
    if (PLATFORM_TYPES.indexOf(startup.companyType) >= 0) mods.add('PL');
    return mods;
  }

  function weightsFor(bank, band, mods) {
    var w = Object.assign({}, bank.weights[band]);
    if (mods.has('CT') || mods.has('GT')) {
      var shift = Math.min(5, w.SC);
      w.SC -= shift; w.CM += shift;
    }
    return w;
  }

  function reqLevel(q, band) { return q.req[BANDS.indexOf(band)]; }

  function visibleQuestions(bank, band, mods) {
    return bank.questions.filter(function (q) {
      var inModule = q.module === 'core' || mods.has(q.module);
      return inModule && reqLevel(q, band) !== '-';
    });
  }

  /* ---------- one answer -> points ---------- */

  function proofFallback(q, opt) {
    // Proof rule: an answer that needs a public identifier but has none
    // scores as the best lower option that needs no proof.
    var lower = q.options.filter(function (o) { return o.points < opt.points && !o.proof; });
    return lower.length ? Math.max.apply(null, lower.map(function (o) { return o.points; })) : 0;
  }

  function answerScore(q, ans, band) {
    var r = { answered: false, points: 0, capped: false, proofEligible: 0, proofProvided: 0, proofVerified: 0 };
    if (q.scored === false) { r.answered = !!ans; r.points = null; return r; }
    if (!ans) return r;

    if (q.type === 'checklist') {
      var expected = q.expected[band] || [];
      var counted = [];
      (ans.items || []).forEach(function (key) {
        var item = q.items.find(function (i) { return i.key === key; });
        if (!item) return;
        if (item.proof) {
          r.proofEligible++;
          var p = ans.proofs && ans.proofs[key];
          if (hasProof(p)) { r.proofProvided++; if (p.verified) r.proofVerified++; counted.push(key); }
          else r.capped = true;
        } else counted.push(key);
      });
      var hits = counted.filter(function (k) { return expected.indexOf(k) >= 0; }).length;
      var extras = counted.length - hits;
      r.answered = (ans.items || []).length > 0;
      r.points = expected.length ? clamp(hits / expected.length + 0.05 * extras, 0, 1) : clamp(0.05 * extras, 0, 1);
      return r;
    }

    if (q.type === 'number') {
      if (ans.value === undefined || ans.value === null || ans.value === '') return r;
      var v = Number(ans.value);
      var bin = q.bins.find(function (b) { return v <= b.max; });
      r.answered = true; r.points = bin ? bin.points : 0;
      return r;
    }

    if (q.type === 'multi') {
      var idx = ans.options || [];
      if (!idx.length) return r;
      r.answered = true;
      r.points = Math.max.apply(null, idx.map(function (i) { return q.options[i].points || 0; }));
      return r;
    }

    // single choice
    if (ans.option === undefined || ans.option === null) return r;
    var opt = q.options[ans.option];
    r.answered = true;
    r.points = opt.points;
    if (opt.proof || opt.proofOptional) {
      r.proofEligible = 1;
      if (hasProof(ans.proof)) { r.proofProvided = 1; if (ans.proof.verified) r.proofVerified = 1; }
      else if (opt.proof) { r.points = proofFallback(q, opt); r.capped = true; }
    }
    if (q.scoring === 'withBullets') {
      var bullets = (ans.bullets || []).filter(function (b) { return b && b.trim(); });
      if (bullets.length < 3) r.points = r.points * 0.7;
    }
    return r;
  }

  /* ---------- consistency checks ---------- */

  function optionLabel(q, ans) {
    return ans && ans.option !== undefined && ans.option !== null ? q.options[ans.option].label : null;
  }

  function runChecks(bank, startup, band) {
    var A = startup.answers || {};
    var Q = function (id) { return bank.questions.find(function (q) { return q.id === id; }); };
    var lbl = function (id) { return optionLabel(Q(id), A[id]); };
    var bi = BANDS.indexOf(band);
    var flags = [];
    var add = function (id) {
      var c = bank.checks.find(function (x) { return x.id === id; });
      flags.push({ id: id, severity: c.severity, message: c.message, confirmed: (startup.confirmedWarnings || []).indexOf(id) >= 0 });
    };
    var r = startup.round;
    if ((r === 'Series A' && band === 'D1') || ((r === 'Series B' || r === 'Series C+') && bi <= 1)) add('F1');
    if (band === 'D4') {
      var rc5 = A.RC05;
      if (!rc5 || !(rc5.proof && rc5.proof.verified)) add('F2');
    }
    if (lbl('IP02') === 'University or institute, no agreement yet' && bi >= 2) add('F3');
    var sc2 = (A.SC02 && A.SC02.items) || [];
    if (bi < 3 && (sc2.indexOf('hsafe') >= 0 || sc2.indexOf('heff') >= 0)) add('F4');
    if (A.PD05 && A.PD05.value !== undefined && Number(A.PD05.value) < 6) add('F5');
    if (lbl('FN02') === 'Under 12 months') add('F6');
    if (lbl('PD01') === 'Several candidates, undecided' && bi >= 2) add('F7');
    if (lbl('SC03') === 'Single lab, single series of experiments' && bi >= 1) add('F8');
    if (lbl('TM02') === 'None' && lbl('TM06') === 'No advisors yet' && bi >= 1) add('F9');
    if (lbl('RC01') === 'Not yet defined' && bi >= 1) add('F10');
    return flags;
  }

  /* ---------- readiness ---------- */

  function dimensionScores(bank, band, mods, answers, flags) {
    var visible = visibleQuestions(bank, band, mods);
    var out = {};
    bank.dimensions.forEach(function (d) {
      var qs = visible.filter(function (q) { return q.dim === d.id && q.scored !== false; });
      var R = qs.filter(function (q) { return reqLevel(q, band) === 'R'; });
      var O = qs.filter(function (q) { return reqLevel(q, band) === 'O'; });
      var pts = function (q) { var s = answerScore(q, answers[q.id], band); return s.points || 0; };
      var s;
      if (d.id === 'EV' || R.length === 0) {
        s = O.length ? Math.max.apply(null, O.map(pts)) : 0;
      } else {
        s = clamp(mean(R.map(pts)) + 0.1 * (O.length ? mean(O.map(pts)) : 0), 0, 1);
      }
      if (d.id === 'IP' && flags.some(function (f) { return f.id === 'F3'; })) s = Math.min(s, 0.5);
      out[d.id] = { name: d.name, score: s, required: R.length, optional: O.length };
    });
    return out;
  }

  function scoreOnly(bank, startup) {
    var band = bandOf(bank, startup);
    var mods = activeModules(bank, startup);
    var w = weightsFor(bank, band, mods);
    var flags = runChecks(bank, startup, band);
    var dims = dimensionScores(bank, band, mods, startup.answers || {}, flags);
    var total = 0;
    Object.keys(dims).forEach(function (k) { dims[k].weight = w[k]; dims[k].points = w[k] * dims[k].score; total += dims[k].points; });
    return { band: band, modules: mods, weights: w, dims: dims, score: total, flags: flags };
  }

  function readiness(bank, startup, opts) {
    opts = opts || {};
    var base = scoreOnly(bank, startup);
    var band = base.band, mods = base.modules;
    var A = startup.answers || {};
    var visible = visibleQuestions(bank, band, mods);

    // evidence confidence: registry-verified proofs count 1, linked (unverified) proofs 0.5,
    // claims without proof 0; a profile with no proof-eligible claims is neutral (0.5)
    var elig = 0, prov = 0, ver = 0;
    visible.forEach(function (q) {
      var s = answerScore(q, A[q.id], band);
      elig += s.proofEligible; prov += s.proofProvided; ver += s.proofVerified;
    });
    var confidence = elig ? (ver + 0.5 * (prov - ver)) / elig : 0.5;

    // gates
    var missing = visible.filter(function (q) { return reqLevel(q, band) === 'R' && !answerScore(q, A[q.id], band).answered; });
    var profileMissing = (bank.profile || []).filter(function (p) { return !(startup.profileDone || []).includes(p.id); });
    var tm01 = A.TM01 && A.TM01.option;
    var gates = [
      { id: 'G1', pass: !!(startup.deck && startup.deck.uploaded && startup.deck.attested && !startup.deck.openFindings), label: 'Non-confidential deck uploaded and checked' },
      { id: 'G2', pass: tm01 !== undefined && tm01 !== null && tm01 >= 1, label: 'At least one full-time founder or executive' },
      { id: 'G3', pass: missing.length === 0 && profileMissing.length === 0, label: 'All required fields answered', missing: missing.map(function (q) { return q.id; }).concat(profileMissing.map(function (p) { return p.id; })) },
      { id: 'G4', pass: base.flags.filter(function (f) { return f.severity === 'warning' && !f.confirmed; }).length === 0, label: 'No unconfirmed warnings' },
      { id: 'G5', pass: startup.monthsSinceUpdate === undefined || startup.monthsSinceUpdate <= 6, label: 'Updated within 6 months' }
    ];
    var allGates = gates.every(function (g) { return g.pass; });
    var score = round1(base.score);
    var level = bank.levels.find(function (l) { return score >= l.min && score <= l.max; }) || bank.levels[0];
    var listed = allGates && score >= 60;

    // actions: quick wins (answer an open question, add a missing identifier or text)
    // come first; next milestones (real progress) fill the list. Each is ranked by score gain.
    var quick = [], milestones = [];
    if (!opts.skipActions) {
      visible.forEach(function (q) {
        if (q.scored === false) return;
        var cur = A[q.id];
        var candidates = [];
        var bestIdx = q.options ? q.options.reduce(function (b, o, i, arr) { return (o.points || 0) > (arr[b].points || 0) ? i : b; }, 0) : 0;
        if (q.type === 'checklist') {
          var have = (cur && cur.items) || [];
          if (!have.length) {
            candidates.push({ kind: 'quick', ans: { items: (q.expected[band] || []).slice() }, text: 'Answer: ' + q.prompt, upTo: true });
          } else {
            (q.expected[band] || []).forEach(function (k) {
              if (have.indexOf(k) < 0) {
                var item = q.items.find(function (i) { return i.key === k; });
                var next = { items: have.concat([k]), proofs: Object.assign({}, cur && cur.proofs) };
                if (item.proof) next.proofs[k] = { value: 'ID', verified: true };
                candidates.push({ kind: 'milestone', ans: next, text: 'Add evidence: ' + item.label.toLowerCase() });
              }
            });
          }
        } else if (q.type === 'number') {
          if (!cur || cur.value === undefined || cur.value === '') candidates.push({ kind: 'quick', ans: { value: 12 }, text: 'Answer: ' + q.prompt, upTo: true });
        } else if (q.type === 'multi') {
          if (!cur || !(cur.options || []).length) candidates.push({ kind: 'quick', ans: { options: [bestIdx] }, text: 'Answer: ' + q.prompt, upTo: true });
        } else {
          var s = answerScore(q, cur, band);
          if (!s.answered) {
            candidates.push({ kind: 'quick', ans: { option: bestIdx, proof: { value: 'ID', verified: true }, bullets: ['a', 'b', 'c'] }, text: 'Answer: ' + q.prompt, upTo: true });
          } else if (s.capped) {
            var o = q.options[cur.option];
            var need = o.proof && bank.proofTypes[o.proof] ? bank.proofTypes[o.proof].label.toLowerCase() : 'three differentiation points';
            candidates.push({ kind: 'quick', ans: Object.assign({}, cur, { proof: { value: 'ID', verified: true }, bullets: ['a', 'b', 'c'] }), text: 'Add ' + need + ' (' + q.criterion.toLowerCase() + ')' });
          } else if (q.actionable !== false && q.scoring !== 'withBullets') {
            var curPts = q.options[cur.option].points;
            var higher = q.options.map(function (op, i) { return { op: op, i: i }; })
              .filter(function (x) { return x.op.points > curPts; })
              .sort(function (a, b) { return a.op.points - b.op.points; });
            if (higher.length) {
              var nx = higher[0];
              candidates.push({ kind: 'milestone', ans: { option: nx.i, proof: { value: 'ID', verified: true } }, text: q.criterion + ': ' + (/^[A-Z][a-z]/.test(nx.op.label) ? nx.op.label.charAt(0).toLowerCase() + nx.op.label.slice(1) : nx.op.label) });
            }
          }
        }
        candidates.forEach(function (c) {
          var trial = Object.assign({}, startup, { answers: Object.assign({}, A) });
          trial.answers[q.id] = c.ans;
          var gain = scoreOnly(bank, trial).score - base.score;
          if (gain > 0.05) (c.kind === 'quick' ? quick : milestones).push({ question: q.id, dim: q.dim, kind: c.kind, text: c.text, gain: round1(gain), upTo: !!c.upTo });
        });
      });
      var byGain = function (a, b) { return b.gain - a.gain; };
      quick.sort(byGain); milestones.sort(byGain);
    }
    var actions = quick.concat(milestones).sort(function (a, b) {
      return b.gain - a.gain || (a.kind === 'quick' ? -1 : 1);
    });

    return {
      band: band, modules: Array.from(mods), weights: base.weights,
      dims: base.dims, score: score, level: listed ? level.name : 'Draft',
      listed: listed, gates: gates, flags: base.flags,
      verification: { eligible: elig, provided: prov, verified: ver, linked: prov - ver, confidence: confidence },
      actions: actions.slice(0, opts.maxActions || 3),
      quickWins: quick, milestones: milestones
    };
  }

  /* ---------- matching ---------- */

  var STOP = new Set('a an and the of for to in on with by from at as is are be we our that this their into via new first best class drug drugs therapy therapies company companies patients disease diseases'.split(' '));
  function terms(text) {
    return new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/).filter(function (t) { return t.length > 2 && !STOP.has(t); }));
  }
  function jaccard(a, b) {
    var A = terms(a), B = terms(b), inter = 0;
    A.forEach(function (t) { if (B.has(t)) inter++; });
    var uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  }
  function shareCovered(wanted, offered) {
    if (!wanted || !wanted.length) return null;
    var hit = wanted.filter(function (x) { return (offered || []).indexOf(x) >= 0; }).length;
    return hit / wanted.length;
  }
  function stepFit(list, value, order) {
    if (!list || !list.length) return 0.7;
    if (list.indexOf(value) >= 0) return 1;
    var i = order.indexOf(value);
    var near = list.some(function (x) { return Math.abs(order.indexOf(x) - i) === 1; });
    return near ? 0.5 : 0;
  }

  function match(startup, vc, ctx) {
    ctx = ctx || {};
    var nowYear = ctx.year || 2026;
    var R = startup.readiness;                                                  // 0-100
    var vshare = startup.confidence === undefined ? 0.5 : startup.confidence;  // 0-1
    var fails = [];
    var must = vc.must || {};

    // hard filters (both sides)
    if (vc.inbound === false) fails.push('Fund does not take inbound startups');
    if ((vc.rounds || []).indexOf(startup.round) < 0) fails.push('Round ' + startup.round + ' outside the fund\'s rounds');
    if (vc.ticket && vc.ticket.min > startup.raise.max) fails.push('Minimum cheque above the whole round');
    if (startup.leadNeeded && (vc.roles || []).indexOf('lead') < 0) fails.push('Startup needs a lead; fund does not lead');
    if (must.bands && (vc.bands || []).indexOf(startup.band) < 0) fails.push('Development stage outside the fund\'s must-have');
    if (must.modalities && !(startup.modalities || []).some(function (m) { return (vc.modalities || []).indexOf(m) >= 0; })) fails.push('Modality outside the fund\'s must-have');
    if (must.areas && !(startup.areas || []).some(function (a) { return (vc.areas || []).indexOf(a) >= 0; })) fails.push('Therapeutic area outside the fund\'s must-have');
    if (must.geography && !(vc.geography.global || (vc.geography.countries || []).indexOf(startup.country) >= 0 || (vc.geography.regions || []).indexOf(startup.region) >= 0)) fails.push('Geography outside the fund\'s must-have');
    if (must.humanData && startup.band !== 'D4') fails.push('Fund requires human data');
    if (vc.minReadiness && R < vc.minReadiness) fails.push('Readiness below the fund\'s minimum');
    if ((startup.investorTypes || []).length && startup.investorTypes.indexOf(vc.type) < 0) fails.push('Investor type not sought by the startup');
    if (vc.investmentPeriodEnd && vc.investmentPeriodEnd <= nowYear) fails.push('Fund past its investment period');
    if ((vc.exclusions || []).indexOf(startup.companyType) >= 0) fails.push('Company type excluded by the fund');

    // VC-side fit (how well the startup fits the thesis)
    var geo = (vc.geography.countries || []).indexOf(startup.country) >= 0 ? 1
      : (vc.geography.regions || []).indexOf(startup.region) >= 0 ? 0.7
      : vc.geography.global ? 0.6 : 0;
    var isPlatform = PLATFORM_TYPES.indexOf(startup.companyType) >= 0;
    var ap = vc.assetPref === 'neutral' || !vc.assetPref ? 0.7 : ((vc.assetPref === 'platform') === isPlatform ? 1 : 0);
    var thesisJ = jaccard(vc.thesis, startup.thesisText);
    var vcSide = [
      { id: 'areas', label: 'Therapeutic area', w: 20, f: shareCovered(startup.areas, vc.areas) || 0 },
      { id: 'modality', label: 'Modality', w: 15, f: shareCovered(startup.modalities, vc.modalities) || 0 },
      { id: 'band', label: 'Development stage', w: 15, f: stepFit(vc.bands, startup.band, BANDS) },
      { id: 'round', label: 'Round', w: 15, f: stepFit(vc.rounds, startup.round, ROUNDS) },
      { id: 'geo', label: 'Geography', w: 10, f: geo },
      { id: 'assetPlatform', label: 'Asset vs. platform', w: 5, f: ap },
      { id: 'thesis', label: 'Thesis similarity', w: 10, f: clamp(thesisJ / 0.25, 0, 1) },
      { id: 'readiness', label: 'Readiness and verification', w: 10, f: clamp(0.7 * (R - 60) / 40 + 0.3 * vshare, 0, 1) }
    ];

    // Startup-side fit (how well the VC fits the startup's needs)
    var mid = (startup.raise.min + startup.raise.max) / 2;
    var roleOK = !startup.leadNeeded || (vc.roles || []).indexOf('lead') >= 0;
    var share = vc.ticket ? vc.ticket.max / mid : 0;
    var ticketF = !roleOK ? 0 : share >= 0.2 ? 1 : share >= 0.1 ? 0.6 : 0.3;
    var va = shareCovered(startup.valueAdd, vc.valueAdd);
    var typeF = (startup.investorTypes || []).length ? ((startup.investorTypes.indexOf(vc.type) >= 0) ? 1 : 0) : 0.7;
    var inPeriod = !vc.investmentPeriodEnd || vc.investmentPeriodEnd > nowYear;
    var capF = !inPeriod ? 0 : (vc.reserveRatio === undefined ? 0.8 : vc.reserveRatio >= 0.4 ? 1 : 0.6);
    var speedF = (vc.weeksToTermSheet && startup.monthsToClose) ? (vc.weeksToTermSheet <= startup.monthsToClose * 4.3 ? 1 : 0.4) : 0.7;
    var suSide = [
      { id: 'ticket', label: 'Ticket and role', w: 30, f: ticketF },
      { id: 'valueAdd', label: 'Value-add', w: 25, f: va === null ? 0.7 : va },
      { id: 'type', label: 'Investor type', w: 15, f: typeF },
      { id: 'capacity', label: 'Fund capacity', w: 20, f: capF },
      { id: 'speed', label: 'Decision speed', w: 10, f: speedF }
    ];

    var sum = function (arr) { return arr.reduce(function (s, c) { return s + c.w * c.f; }, 0); };
    var Fvc = sum(vcSide), Fsu = sum(suSide);
    var conflict = (vc.portfolio || []).some(function (p) {
      return p.target && startup.target && p.target.toLowerCase() === startup.target.toLowerCase() &&
        p.indication && startup.indicationCategory && p.indication.toLowerCase() === startup.indicationCategory.toLowerCase();
    });
    var raw = Math.sqrt(Fvc * Fsu) - (conflict ? 10 : 0);
    var score = fails.length ? 0 : Math.max(0, Math.round(raw));
    var label = fails.length ? 'Filtered out' : score >= 75 ? 'Strong match' : score >= 50 ? 'Good match' : 'Weak match';

    var all = vcSide.concat(suSide).map(function (c) { return Object.assign({ contrib: c.w * c.f }, c); });
    var strengths = all.filter(function (c) { return c.f >= 0.7; }).sort(function (a, b) { return b.contrib - a.contrib; }).slice(0, 3);
    var gaps = all.filter(function (c) { return c.f < 0.5; }).sort(function (a, b) { return b.w * (1 - b.f) - a.w * (1 - a.f); }).slice(0, 1);

    return {
      vc: vc.name, startup: startup.name, score: score, label: label,
      vcFit: round1(Fvc), startupFit: round1(Fsu), conflict: conflict, hardFilterFailures: fails,
      components: { vcSide: vcSide, startupSide: suSide },
      strengths: strengths.map(function (c) { return c.label; }),
      gap: gaps.length ? gaps[0].label : null
    };
  }

  var api = {
    BANDS: BANDS, ROUNDS: ROUNDS,
    bandOf: bandOf, activeModules: activeModules, weightsFor: weightsFor,
    visibleQuestions: visibleQuestions, answerScore: answerScore,
    readiness: readiness, match: match, jaccard: jaccard
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BioMatchScoring = api;
})(typeof window !== 'undefined' ? window : this);
