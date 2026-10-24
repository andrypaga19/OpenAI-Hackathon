/* Fictional demo data for BioMatch: one startup in two states and four VCs. */
var PROFILE_ALL = ['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13','P14','P15','P16','P17','P18'];

var nuvarisAnswers = {
  TM01: { option: 2 },
  TM02: { option: 3 },
  TM03: { option: 0 },
  TM04: { option: 1 },
  TM05: { option: 1 },
  TM06: { option: 2, proof: { value: 'Prof. A. Example (neuro-oncology); Dr. B. Example (CNS drug discovery)' } },
  TM07: { option: 0 },
  SC01: { option: 2 },
  SC02: { items: ['ivpoc', 'te', 'ive', 'ngtox'] },
  SC03: { option: 1 },
  SC04: { option: 2 },
  SC05: { option: 1 },
  SC06: { option: 1 },
  SC07: { option: 1, bullets: ['Brain exposure at efficacious dose in mice', 'Oral once-daily dosing', 'Selective over related enzymes'] },
  SC08: { option: 1 },
  SM01: { option: 1 },
  SM02: { option: 1 },
  SM03: { option: 1 },
  SM04: { option: 1 },
  PD01: { option: 1 },
  PD02: { option: 1 },
  PD03: { option: 1 },
  PD04: { option: 1 },
  PD05: { value: 18 },
  IP01: { option: 2 },
  IP02: { option: 1 },
  IP03: { option: 1 },
  RC01: { option: 1 },
  RC02: { option: 0 },
  RC03: { option: 0 },
  CM01: { option: 2 },
  MK01: { option: 2, proof: { value: 'https://seer.cancer.gov/statfacts/html/brain.html' } },
  MK02: { option: 1 },
  MK03: { option: 1 },
  MK04: { option: 1 },
  FN01: { option: 1 },
  FN02: { option: 1 },
  FN03: { option: 0 },
  EV01: { option: 1, proof: { value: '10.1101/2026.01.01.000000', verified: true } },
  EV02: { option: 1 },
  EV03: { option: 0 },
  EV04: { option: 0 }
};

var nuvaris = {
  name: 'Nuvaris Therapeutics', country: 'Germany', region: 'DACH', city: 'Berlin',
  trl: 'TRL 4: candidate proof of concept and early safety in a defined model',
  modalities: ['Small molecule'], companyType: 'Asset-centric',
  areas: ['Oncology'], indicationCategory: 'Glioblastoma', target: 'DHODH',
  round: 'Seed', raise: { min: 8, max: 10 }, leadNeeded: true,
  investorTypes: ['Specialist biotech VC', 'Corporate VC', 'Generalist VC'],
  valueAdd: ['Company building', 'Pharma BD network', 'CMC network'],
  monthsToClose: 6,
  thesisText: 'Oral brain-penetrant small molecule inhibitor for glioblastoma; best-in-class CNS exposure; oncology seed company in Berlin; patient selection by metabolic biomarker',
  deck: { uploaded: true, attested: true, openFindings: 0 },
  profileDone: PROFILE_ALL,
  monthsSinceUpdate: 0,
  answers: nuvarisAnswers
};

/* The same startup earlier in the builder: some answers still open. */
var nuvarisDraftAnswers = Object.assign({}, nuvarisAnswers);
delete nuvarisDraftAnswers.PD02;
delete nuvarisDraftAnswers.MK04;
nuvarisDraftAnswers.MK01 = { option: 2 }; // sourced, but link not added yet
nuvarisDraftAnswers.SC02 = { items: ['ivpoc', 'te', 'ive'] };
var nuvarisDraft = Object.assign({}, nuvaris, { answers: nuvarisDraftAnswers });

var vcs = [
  {
    name: 'Rheinland Bio Ventures', type: 'Specialist biotech VC', inbound: true,
    rounds: ['Seed', 'Series A'], bands: ['D1', 'D2', 'D3'],
    modalities: ['Small molecule', 'RNA (siRNA, ASO)', 'Antibody'], areas: ['Oncology', 'Neurology', 'Rare and genetic disease'],
    must: { bands: true, areas: true }, ticket: { min: 1, max: 8 }, roles: ['lead', 'co-lead'],
    geography: { countries: ['Germany', 'Austria', 'Switzerland'], regions: ['DACH', 'Europe'], global: false },
    assetPref: 'asset', valueAdd: ['Company building', 'CMC network', 'Pharma BD network', 'Recruiting'],
    investmentPeriodEnd: 2029, reserveRatio: 0.55, weeksToTermSheet: 10, minReadiness: 60,
    portfolio: [{ target: 'KRAS', indication: 'Pancreatic cancer' }],
    thesis: 'We lead seed and Series A rounds for European oncology and neurology companies with small molecule or RNA drugs, building teams around validated targets, brain-penetrant chemistry and capital-efficient milestones'
  },
  {
    name: 'Helvetia Life Science Fund', type: 'Specialist biotech VC', inbound: true,
    rounds: ['Seed', 'Series A', 'Series B'], bands: ['D2', 'D3', 'D4'],
    modalities: ['Small molecule', 'Antibody', 'Other protein or peptide'], areas: ['Oncology', 'Immunology and inflammation'],
    must: {}, ticket: { min: 3, max: 15 }, roles: ['lead', 'co-lead', 'follow'],
    geography: { countries: ['Switzerland'], regions: ['DACH', 'Europe'], global: false },
    assetPref: 'neutral', valueAdd: ['Clinical and regulatory expertise', 'Pharma BD network'],
    investmentPeriodEnd: 2028, reserveRatio: 0.35, weeksToTermSheet: 14, minReadiness: 60,
    portfolio: [{ target: 'DHODH', indication: 'Glioblastoma' }],
    thesis: 'Clinical-stage and late preclinical oncology and immunology therapeutics in Europe with a clear path to proof of concept in patients'
  },
  {
    name: 'Atlantic Precision Partners', type: 'Specialist biotech VC', inbound: true,
    rounds: ['Series A', 'Series B'], bands: ['D2', 'D3', 'D4'],
    modalities: ['Antibody', 'Antibody-drug conjugate', 'Cell therapy'], areas: ['Oncology', 'Immunology and inflammation'],
    must: { modalities: true }, ticket: { min: 10, max: 30 }, roles: ['lead'],
    geography: { countries: ['United States'], regions: ['North America', 'Europe'], global: true },
    assetPref: 'platform', valueAdd: ['Clinical and regulatory expertise', 'Follow-on capacity'],
    investmentPeriodEnd: 2030, reserveRatio: 0.6, weeksToTermSheet: 8, minReadiness: 70,
    portfolio: [],
    thesis: 'Engineered biologics and cell therapies for solid tumours'
  },
  {
    name: 'Northstar Generalist Ventures', type: 'Generalist VC', inbound: true,
    rounds: ['Pre-seed', 'Seed'], bands: ['D1'],
    modalities: ['mRNA', 'Gene editing', 'Microbiome'], areas: ['Infectious disease', 'Cardiometabolic', 'Dermatology'],
    must: {}, ticket: { min: 0.5, max: 2 }, roles: ['lead', 'co-lead', 'follow'],
    geography: { countries: ['United Kingdom'], regions: ['Europe'], global: true },
    assetPref: 'platform', valueAdd: ['Recruiting'],
    investmentPeriodEnd: 2027, reserveRatio: 0.3, weeksToTermSheet: 6, minReadiness: 60,
    portfolio: [],
    thesis: 'Founder-first deep tech and software-enabled platforms across health and climate'
  }
];

if (typeof module !== 'undefined') module.exports = { nuvaris: nuvaris, nuvarisDraft: nuvarisDraft, vcs: vcs };
