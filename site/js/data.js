/* SeriesBio demo data layered on top of src/examples.js (all companies and funds are fictional).
   Core fields follow src/README.md; add-on fields follow Addon/BioMatch_Addon_Brief.pdf §2. */
(function (root) {
  // src/examples.js exposes plain globals in the browser and module.exports in Node
  var EX = typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports
    ? require('../../src/examples.js')
    : { nuvaris: root.nuvaris, nuvarisDraft: root.nuvarisDraft, vcs: root.vcs };
  var PROFILE_ALL = ['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13','P14','P15','P16','P17','P18'];

  /* Display-only profile fields (non-confidential tier) */
  var nuvarisProfile = {
    id: 'nuvaris', initials: 'N',
    pitch: 'Oral, brain-penetrant small molecule for glioblastoma',
    overview: 'Nuvaris develops an oral DHODH inhibitor designed to reach the brain at efficacious doses. Glioblastoma tumours depend on de-novo pyrimidine synthesis; the lead candidate starves that pathway while sparing healthy tissue. The company is a university spin-out preparing IND-enabling studies.',
    founded: 2024, employees: 9, website: 'nuvaris.example', origin: 'University spin-out',
    tags: ['Oncology', 'Small molecule', 'CNS-penetrant', 'Biomarker-selected'],
    raiseLabel: '€8–10M seed · lead wanted', runwayAfterClose: '12–18 months',
    ipLabel: 'Priority application filed · option agreement signed',
    teamLabel: 'Two full-time founders · industry R&D executive',
    deckSlides: 14
  };

  /* Add-on entity extensions (team model, market model, IP06, financing check) */
  var nuvarisAddon = {
    id: 'nuvaris', area: 'oncology', country: 'DE', grants: ['EXIST Forschungstransfer'],
    round: { sizeEur: 9000000, nextMilestone: 'ind_enabling_complete', monthsToMilestone: 18, monthlyBurnEur: 250000, runwayMonths: 4, leadSecured: false },
    team: [
      { name: 'Dr. Lena Brandt', role: 'ceo', founder: true, fulltime: true, highestDegree: 'phd', institution: 'Charité', domainMatch: true, hIndex: 18,
        backgroundYears: { academia: 6, industryRnd: 12 }, programsToClinic: 1, seniorRole: true, peopleLed: 12, evidence: ['linkedin'], verified: true,
        bio: 'Led a CNS oncology program to IND at a mid-size pharma before co-founding Nuvaris.', badges: ['Industry R&D executive', 'Program to IND'],
        previously: ['Mid-size pharma, Director Discovery', 'Charité, postdoc'], education: 'PhD Pharmacology, Charité' },
      { name: 'Dr. Tomasz Wierzbicki', role: 'cso', founder: true, fulltime: true, highestDegree: 'phd', institution: 'Max Planck', domainMatch: true, hIndex: 24,
        backgroundYears: { academia: 11 }, evidence: ['cv'],
        bio: 'Discovered the series behind the lead candidate; 30+ papers on tumour metabolism.', badges: ['Inventor', 'Domain expert'],
        previously: ['Max Planck Institute, group leader'], education: 'PhD Biochemistry, LMU Munich' }
    ],
    advisors: [
      { name: 'Prof. A. Example', role: 'Neuro-oncology advisor' },
      { name: 'Dr. B. Example', role: 'CNS drug discovery advisor' }
    ],
    market: { patients: 30000, annualPriceEur: 120000, eligibleSharePct: 40, source: 'SEER, ECIS incidence', firstInClass: false, peakSharePct: 10 },
    ip: { licenceType: 'option', priorityYear: 2025, institutionEquityPct: 8, founderOwnershipRange: '50-75' },
    valueAddTags: ['venture_building', 'pharma_network', 'cro_network']
  };

  /* Funds. Core schema (src/examples.js) plus an `addon` block in the add-on schema for the Syndicate Builder. */
  var addonByName = {
    'Rheinland Bio Ventures': { type: 'vc', roles: ['lead', 'co'], valueAdd: ['venture_building', 'cro_network', 'pharma_network', 'ceo_recruiting'], reserveEur: 40000000 },
    'Helvetia Life Science Fund': { type: 'vc', roles: ['lead', 'co'], valueAdd: ['regulatory_expertise', 'pharma_network'], reserveEur: 25000000 },
    'Atlantic Precision Partners': { type: 'vc', roles: ['lead'], valueAdd: ['regulatory_expertise', 'syndicate_network'], reserveEur: 120000000 },
    'Northstar Generalist Ventures': { type: 'vc', roles: ['lead', 'co'], valueAdd: ['ceo_recruiting'], reserveEur: 3000000 }
  };
  var extraVcs = [
    {
      name: 'Spree Pharma Ventures', type: 'Corporate VC', inbound: true,
      rounds: ['Seed', 'Series A'], bands: ['D2', 'D3'],
      modalities: ['Small molecule', 'Antibody'], areas: ['Oncology', 'Neurology'],
      must: {}, ticket: { min: 1, max: 4 }, roles: ['co-lead', 'follow'],
      geography: { countries: ['Germany'], regions: ['DACH', 'Europe'], global: false },
      assetPref: 'asset', valueAdd: ['Pharma BD network', 'Clinical and regulatory expertise'],
      investmentPeriodEnd: 2030, reserveRatio: 0.5, weeksToTermSheet: 12, minReadiness: 60, portfolio: [],
      thesis: 'Corporate venture arm investing alongside specialist leads in oncology and CNS small molecules with a clear path to pharma partnering',
      addon: { type: 'cvc', roles: ['co'], valueAdd: ['pharma_network', 'regulatory_expertise', 'market_access'], reserveEur: 20000000 }
    },
    {
      name: 'Elbe Life Science Partners', type: 'Specialist biotech VC', inbound: true,
      rounds: ['Pre-seed', 'Seed'], bands: ['D1', 'D2'],
      modalities: ['Small molecule', 'RNA (siRNA, ASO)'], areas: ['Oncology', 'Neurology'],
      must: {}, ticket: { min: 0.5, max: 3 }, roles: ['lead', 'co-lead', 'follow'],
      geography: { countries: ['Germany'], regions: ['DACH', 'Europe'], global: false },
      assetPref: 'asset', valueAdd: ['Company building', 'Recruiting'],
      investmentPeriodEnd: 2031, reserveRatio: 0.45, weeksToTermSheet: 8, minReadiness: 60, portfolio: [],
      thesis: 'Early oncology and neurology spin-outs from German universities; we build the commercial team around strong science and negotiate licences with tech transfer offices',
      addon: { type: 'vc', roles: ['lead', 'co'], valueAdd: ['venture_building', 'ceo_recruiting', 'tto_negotiation', 'ip_expertise'], reserveEur: 6000000 }
    },
    {
      name: 'Nordic Translational Capital', type: 'Specialist biotech VC', inbound: true,
      rounds: ['Seed', 'Series A'], bands: ['D2', 'D3'],
      modalities: ['Small molecule', 'RNA (siRNA, ASO)'], areas: ['Oncology', 'Rare and genetic disease'],
      must: {}, ticket: { min: 2, max: 6 }, roles: ['lead', 'co-lead', 'follow'],
      geography: { countries: ['Sweden', 'Denmark'], regions: ['Europe'], global: false },
      assetPref: 'neutral', valueAdd: ['CMC network', 'Follow-on capacity'],
      investmentPeriodEnd: 2030, reserveRatio: 0.5, weeksToTermSheet: 12, minReadiness: 60, portfolio: [],
      thesis: 'Translational oncology and rare disease small molecules in Europe, syndicating seed and Series A rounds with capital-efficient milestones',
      addon: { type: 'vc', roles: ['lead', 'co'], valueAdd: ['syndicate_network', 'cro_network', 'grant_expertise'], reserveEur: 12000000 }
    }
  ];

  var vcs = EX.vcs.map(function (v) { return Object.assign({}, v, { addon: addonByName[v.name] }); }).concat(extraVcs)
    .map(function (v) { return Object.assign({ id: 'vc_' + v.name.toLowerCase().replace(/[^a-z]+/g, '_').replace(/_+$/, '') }, v); });

  /* More listed startups for the investor deal flow. Answers start from Nuvaris and are completed
     per band by store.js (fillAnswers), so every score still comes from scoring.js. */
  var others = [
    {
      name: 'Synaptra Therapeutics', initials: 'S', country: 'Austria', region: 'DACH', city: 'Vienna',
      trl: 'TRL 4: candidate proof of concept and early safety in a defined model',
      modalities: ['RNA (siRNA, ASO)'], companyType: 'Platform with lead asset',
      areas: ['Neurology'], indicationCategory: "Parkinson's disease", target: 'SNCA',
      round: 'Seed', raise: { min: 5, max: 7 }, leadNeeded: true,
      investorTypes: ['Specialist biotech VC', 'Corporate VC', 'Generalist VC'],
      valueAdd: ['Company building', 'Recruiting'], monthsToClose: 6,
      thesisText: 'Antisense oligonucleotide platform for neurodegeneration; lead ASO lowers alpha-synuclein in the brain; neurology seed company in Vienna',
      pitch: 'Brain-delivered antisense platform for Parkinson’s disease', founded: 2023, employees: 12, website: 'synaptra.example',
      tags: ['Neurology', 'RNA', 'Platform'], raiseLabel: '€5–7M seed · lead wanted', origin: 'Research institute spin-out',
      tweak: { SC03: { option: 2 }, TM03: { option: 1 } }
    },
    {
      name: 'Ostara Bio', initials: 'O', country: 'Switzerland', region: 'DACH', city: 'Basel',
      trl: 'TRL 5: preclinical studies, IND/IMPD in preparation',
      modalities: ['Small molecule'], companyType: 'Asset-centric',
      areas: ['Rare and genetic disease'], indicationCategory: 'Gaucher disease type 3', target: 'GBA1',
      round: 'Series A', raise: { min: 18, max: 25 }, leadNeeded: true,
      investorTypes: ['Specialist biotech VC', 'Corporate VC'],
      valueAdd: ['Clinical and regulatory expertise', 'CMC network'], monthsToClose: 9,
      thesisText: 'Brain-penetrant small molecule chaperone for neuronopathic Gaucher disease; orphan designation; rare disease Series A company in Basel',
      pitch: 'Oral chaperone for neuronopathic Gaucher disease', founded: 2021, employees: 21, website: 'ostara.example',
      tags: ['Rare disease', 'Small molecule', 'Orphan'], raiseLabel: '€18–25M Series A · lead wanted', origin: 'Independent',
      tweak: { RC01: { option: 2 }, SC03: { option: 2 } }
    },
    {
      name: 'Corvane Immunotherapeutics', initials: 'C', country: 'Germany', region: 'DACH', city: 'Munich',
      trl: 'TRL 4: candidate proof of concept and early safety in a defined model',
      modalities: ['Antibody'], companyType: 'Asset-centric',
      areas: ['Immunology and inflammation'], indicationCategory: 'Atopic dermatitis', target: 'OX40L',
      round: 'Seed', raise: { min: 4, max: 6 }, leadNeeded: true,
      investorTypes: ['Specialist biotech VC', 'Corporate VC', 'Generalist VC'],
      valueAdd: ['Pharma BD network'], monthsToClose: 6,
      thesisText: 'Long-acting antibody for atopic dermatitis with quarterly dosing; immunology seed company in Munich',
      pitch: 'Quarterly-dosed antibody for atopic dermatitis', founded: 2024, employees: 7, website: 'corvane.example',
      tags: ['Immunology', 'Antibody'], raiseLabel: '€4–6M seed · lead wanted', origin: 'University spin-out',
      tweak: {}
    }
  ].map(function (s) {
    return Object.assign({
      id: s.name.toLowerCase().split(' ')[0], deck: { uploaded: true, attested: true, openFindings: 0 },
      profileDone: PROFILE_ALL, monthsSinceUpdate: 1
    }, s);
  });

  var api = { PROFILE_ALL: PROFILE_ALL, nuvarisProfile: nuvarisProfile, nuvarisAddon: nuvarisAddon, vcs: vcs, others: others };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SBData = api;
})(typeof window !== 'undefined' ? window : this);
