// Reference values every implementation must reproduce. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const bank = require('../src/question-bank.json');
const S = require('../src/scoring.js');
const { nuvaris, nuvarisDraft, vcs } = require('../src/examples.js');

test('Nuvaris final: 65.2, Listed, D2 + small molecule', () => {
  const r = S.readiness(bank, nuvaris);
  assert.strictEqual(r.band, 'D2');
  assert.strictEqual(r.score, 65.2);
  assert.strictEqual(r.level, 'Listed');
  assert.ok(r.listed);
});

test('Nuvaris final: dimension points', () => {
  const r = S.readiness(bank, nuvaris);
  const exp = { TM: 13.9, SC: 16.6, PD: 11.1, IP: 5.1, RC: 2.5, CM: 3.1, MK: 7.0, FN: 2.9, EV: 3.0 };
  for (const k of Object.keys(exp)) {
    const pts = r.dims[k].points;
    assert.ok(Math.abs(pts - exp[k]) < 0.051, `${k}: ${pts} vs ${exp[k]}`);
  }
});

test('Nuvaris draft: 61.3, Draft (G3 open)', () => {
  const r = S.readiness(bank, nuvarisDraft);
  assert.strictEqual(r.score, 61.3);
  assert.strictEqual(r.level, 'Draft');
  assert.ok(!r.listed);
});

test('Matching: Rheinland 95, Helvetia 68, Northstar 46, Atlantic filtered', () => {
  const r = S.readiness(bank, nuvaris);
  const st = Object.assign({}, nuvaris, { readiness: r.score, confidence: r.verification.confidence, band: r.band });
  const got = Object.fromEntries(vcs.map(vc => [vc.name, S.match(st, vc)]));
  assert.strictEqual(got['Rheinland Bio Ventures'].score, 95);
  assert.strictEqual(got['Helvetia Life Science Fund'].score, 68);
  assert.strictEqual(got['Northstar Generalist Ventures'].score, 46);
  assert.ok(got['Atlantic Precision Partners'].hardFilterFailures.length > 0);
});
