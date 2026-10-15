/* =====================================================================
   Minister Tax & Wealth Engine — V14 calculation core
   Pure functions only (no DOM). Every tax rule cites its source.
   ===================================================================== */
(function (root) {
'use strict';

/* ---------------------------------------------------------------------
   TAX CONFIG — tax year 2026. Edit here (or in the Tax Law Editor).
   Sources:
   - Brackets / std deduction / 65+ add-on: IRS Rev. Proc. 2025-32 (TY2026)
   - Senior deduction: OBBBA §70103 ($6,000/person 65+, 2025–2028,
     reduced 6% of MAGI over $150k MFJ / $75k single; not indexed)
   - SS wage base: SSA, $184,500 for 2026
   - SE tax: IRC §1401, §1402(a)(12) (92.35% factor), §164(f) (½ deduction)
   - Addl Medicare: IRC §1401(b)(2) / §3101(b)(2), 0.9%, thresholds not indexed
   - SS taxability: IRC §86 (thresholds not indexed)
   - Deferral limits: IRS Notice 2025-67 (402(g) $24,500; 50+ $8,000;
     60–63 $11,250; IRA $7,500 + $1,100 catch-up)
   - Roth IRA phase-out 2026: MFJ $242k–$252k, Single $153k–$168k
   - RMD age: SECURE 2.0 §107 — 73 if born 1951–1959, 75 if born 1960+
   - RMD divisors: Treas. Reg. §1.401(a)(9)-9(c) Uniform Lifetime Table
   - Massachusetts: 5% flat (M.G.L. c.62 §4); 4% surtax over $1,107,750
     (2026, Art. XLIV); conforms to IRC §107; SS exempt; payroll/SE tax
     deduction capped at $2,000 per person; personal exemption $4,400/
     person + $700 age 65+; retirement plan deferrals excluded, plan
     distributions taxable.
   --------------------------------------------------------------------- */
const TAX = {
  year: 2026,
  brackets: {
    MFJ:    [[24800,.10],[100800,.12],[211400,.22],[403550,.24],[512450,.32],[768700,.35],[Infinity,.37]],
    Single: [[12400,.10],[50400,.12],[105700,.22],[201775,.24],[256225,.32],[640600,.35],[Infinity,.37]]
  },
  stdDed:      { MFJ: 32200, Single: 16100 },
  addl65:      { MFJ: 1650,  Single: 2050 },
  senior:      { amount: 6000, phaseStart: { MFJ: 150000, Single: 75000 }, rate: 0.06, lastYear: 2028 },
  ssWageBase:  184500,
  seFactor:    0.9235,
  addlMed:     { rate: 0.009, thresh: { MFJ: 250000, Single: 200000 } },
  ssProv:      { MFJ: [32000, 44000], Single: [25000, 34000] },
  limits:      { deferral: 24500, catch50: 8000, catch6063: 11250, ira: 7500, iraCatch: 1100,
                 rothIraPhase: { MFJ: [242000, 252000], Single: [153000, 168000] },
                 rothCatchupFicaWages: 150000 },
  state: {
    name: 'Massachusetts', rate: 0.05, surtaxRate: 0.04, surtaxThresh: 1107750,
    persExempt: { MFJ: 8800, Single: 4400 }, age65Exempt: 700, payrollDedCap: 2000,
    ssExempt: true, conformsTo107: true, code: 'MA', mode: 'full'
  },
  // Credits. Saver's Credit (§25B) AGI tiers for 2026: IRS Notice 2025-67 (replaced by the Saver's Match from 2027).
  // Child tax credit (§24, OBBBA): $2,200/child under 17, $1,700 refundable, $500 other dependents,
  // reduced $50 per $1,000 (or part) of MAGI over $400k MFJ / $200k other.
  credits: {
    saver: { maxPer: 2000, tiers: { MFJ: [[48000, .5], [52000, .2], [80500, .1]], Single: [[24250, .5], [26250, .2], [40250, .1]] } },
    ctc: { perChild: 2200, refundMax: 1700, otherDep: 500, phaseStart: { MFJ: 400000, Single: 200000 } }
  },
  // Other thresholds shown in "Thresholds near you" (2026)
  ltcg0Top: { MFJ: 98900, Single: 49450 },                 // 0% long-term capital gains ceiling (taxable income)
  niit: { rate: 0.038, thresh: { MFJ: 250000, Single: 200000 } },   // §1411, not indexed
  aca: { fpl: 15650, fplAdd: 5500, fplAK: [19550, 6880], fplHI: [17990, 6330], cliff: 4,  // 2025 FPL, used for 2026 coverage
         // 2026 applicable percentages (Rev. Proc. 2025-25), [FPL multiple, % of income], linear between points
         ap: [[0, 0.021], [1.33, 0.021], [1.33, 0.0314], [1.5, 0.0419], [2, 0.066], [2.5, 0.0844], [3, 0.0996], [4, 0.0996]] },
  rmd: {
    72:27.4,73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,80:20.2,
    81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,88:13.7,89:12.9,
    90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,96:8.4,97:7.8,98:7.3,99:6.8,
    100:6.4,101:6.0,102:5.6,103:5.2,104:4.9,105:4.6,106:4.3,107:4.1,108:3.9,
    109:3.7,110:3.5,111:3.4,112:3.3,113:3.1,114:3.0,115:2.9,116:2.8,117:2.7,
    118:2.5,119:2.3,120:2.0
  }
};

/* ---------------------------------------------------------------------
   STATE INCOME TAX presets.
   - MA: full rules above (5% + 4% surtax, SS exempt, conforms to §107).
   - No wage income tax (2026): AK, FL, NV, NH, SD, TN, TX, WA, WY.
   - Any other state: a flat effective rate the user enters, with a toggle for
     whether the state taxes Social Security. All modeled states are assumed to
     follow the federal §107 housing exclusion and retirement-plan deferrals.
   --------------------------------------------------------------------- */
const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],['CO','Colorado'],['CT','Connecticut'],
  ['DE','Delaware'],['DC','District of Columbia'],['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],
  ['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],
  ['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],
  ['VT','Vermont'],['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming']
];
const NO_WAGE_TAX = ['AK','FL','NV','NH','SD','TN','TX','WA','WY'];
const MA_STATE = JSON.parse(JSON.stringify(TAX.state));
function stateConfig(code, flatRate, taxesSS){
  const name = (STATES.find(s => s[0] === code) || [code, code])[1];
  if (code === 'MA') return Object.assign(JSON.parse(JSON.stringify(MA_STATE)), { code });
  const base = { code, name, rate: 0, surtaxRate: 0, surtaxThresh: Infinity, persExempt: { MFJ: 0, Single: 0 },
                 age65Exempt: 0, payrollDedCap: 0, ssExempt: true, conformsTo107: true, mode: 'flat' };
  if (NO_WAGE_TAX.includes(code)) return Object.assign(base, { mode: 'none' });
  return Object.assign(base, { rate: Math.max(0, flatRate || 0), ssExempt: !taxesSS });
}

const clamp0 = x => (x > 0 ? x : 0);

/* ---------------------------------------------------------------------
   529 college savings: state income tax benefit for contributions (2026).
   Sources: taxpayers.net 2026 state registry; educationdata.org (Jul 2026).
   d = deduction limit [single, MFJ]; pb = per beneficiary; full = all
   contributions deductible; c = credit {rate, max:[single, MFJ]};
   x = no benefit (no plan, no deduction, or no income tax).
   Many states require their own plan and some have income limits, so the
   app labels this an estimate and lets people override the limit.
   --------------------------------------------------------------------- */
const S529 = {
  AL:{d:[5000,10000],pb:1}, AK:{x:1}, AZ:{d:[2000,4000],pb:1}, AR:{d:[5000,10000]}, CA:{x:1}, CO:{d:[26200,39200],pb:1},
  CT:{d:[5000,10000]}, DE:{d:[1000,2000]}, DC:{u:1}, FL:{x:1}, GA:{d:[4000,8000],pb:1}, HI:{x:1}, ID:{d:[6000,12000]},
  IL:{d:[10000,20000]}, IN:{c:{rate:0.2,max:[1500,1500]}}, IA:{d:[6100,6100],pb:1}, KS:{d:[3000,6000],pb:1}, KY:{x:1},
  LA:{d:[2400,4800],pb:1}, ME:{d:[1000,1000],pb:1}, MD:{d:[2500,5000],pb:1}, MA:{d:[1000,2000]}, MI:{d:[5000,10000]},
  MN:{d:[1500,3000]}, MS:{d:[10000,20000]}, MO:{d:[8000,16000]}, MT:{d:[3000,6000]}, NE:{d:[5000,10000]}, NV:{x:1},
  NH:{x:1}, NJ:{d:[10000,10000]}, NM:{full:1}, NY:{d:[5000,10000]}, NC:{x:1}, ND:{d:[5000,10000]}, OH:{d:[4000,4000],pb:1},
  OK:{d:[10000,20000]}, OR:{c:{rate:1,max:[190,380]}}, PA:{d:[19000,38000],pb:1}, RI:{d:[500,1000]}, SC:{full:1}, SD:{x:1},
  TN:{x:1}, TX:{x:1}, UT:{c:{rate:0.0445,max:[113.92,227.84]},pb:1}, VT:{c:{rate:0.1,max:[250,500]},pb:1}, VA:{d:[4000,4000]},
  WA:{x:1}, WV:{full:1}, WI:{d:[5280,5280],pb:1}, WY:{x:1}
};
function state529(code, status, contrib, kids, override){
  const r = S529[code] || { u: 1 }, i = status === 'MFJ' ? 1 : 0, k = Math.max(1, Math.round(kids || 1));
  const out = { type: 'none', limit: 0, ded: 0, credit: 0, known: !r.u };
  if (override > 0) { out.type = 'ded'; out.limit = override; out.ded = Math.min(contrib, override); return out; }
  if (r.full) { out.type = 'ded'; out.limit = Infinity; out.ded = contrib; }
  else if (r.d) { out.type = 'ded'; out.limit = r.d[i] * (r.pb ? k : 1); out.ded = Math.min(contrib, out.limit); }
  else if (r.c) { out.type = 'credit'; const max = r.c.max[i] * (r.pb ? k : 1); out.limit = max; out.credit = Math.min(contrib * r.c.rate, max); }
  return out;
}

/* ---------------- Federal pieces ---------------- */

// Progressive bracket tax; `scale` inflates bracket tops for future years.
function bracketTax(taxable, status, scale = 1, cfg = TAX) {
  const b = cfg.brackets[status];
  let tax = 0, prev = 0, marginal = b[0][1];
  for (const [top, rate] of b) {
    const t = top * scale;
    if (taxable > prev) { tax += (Math.min(taxable, t) - prev) * rate; marginal = rate; }
    if (taxable <= t) break;
    prev = t;
  }
  return { tax, marginal: taxable > 0 ? marginal : 0 };
}

// Top of the bracket whose rate == r (scaled). Used by the Roth conversion planner.
function bracketTop(rate, status, scale = 1, cfg = TAX) {
  const row = cfg.brackets[status].find(([, r]) => Math.abs(r - rate) < 1e-9);
  return row ? row[0] * scale : 0;
}

// OBBBA §70103 senior deduction — per qualifying person, each reduced by 6% of MAGI excess.
function seniorDeduction(magi, status, count65, calYear, extended, cfg = TAX) {
  if (!count65) return 0;
  if (calYear > cfg.senior.lastYear && !extended) return 0;
  const per = clamp0(cfg.senior.amount - cfg.senior.rate * clamp0(magi - cfg.senior.phaseStart[status]));
  return per * count65;
}

// Federal income tax on AGI. ages = array of ages of filers (1 or 2).
function fedIncomeTax(agi, status, ages, calYear, scale = 1, seniorExtended = false, cfg = TAX, extraDed = 0) {
  const count65 = ages.filter(a => a >= 65).length;
  const ded = cfg.stdDed[status] * scale + count65 * cfg.addl65[status] * scale
            + seniorDeduction(agi, status, count65, calYear, seniorExtended, cfg) + extraDed;
  const taxable = clamp0(agi - ded);
  const { tax, marginal } = bracketTax(taxable, status, scale, cfg);
  return { tax, taxable, deduction: ded, marginal };
}

// IRC §86 taxable Social Security. otherIncome = AGI before SS (excl. §107 amounts).
function taxableSS(ss, otherIncome, status, cfg = TAX) {
  if (ss <= 0) return 0;
  const [b1, b2] = cfg.ssProv[status];
  const pi = otherIncome + 0.5 * ss;
  if (pi <= b1) return 0;
  if (pi <= b2) return Math.min(0.5 * (pi - b1), 0.5 * ss);
  return Math.min(0.85 * ss, 0.85 * (pi - b2) + Math.min(0.5 * ss, 0.5 * (b2 - b1)));
}

// Federal credits applied in the "today" calculation. Saver's Credit first, then the child
// tax credit (nonrefundable up to remaining tax, then refundable up to $1,700/child and 15% of
// earned income over $2,500). Returns the total that reduces federal income tax (may exceed it).
function saverRate(agi, status, cfg = TAX) {
  const t = cfg.credits.saver.tiers[status];
  for (const [top, rate] of t) if (agi <= top) return rate;
  return 0;
}
function fedCredits(agi, taxBefore, p, earned, cfg = TAX) {
  const mfj = p.status === 'MFJ', C = cfg.credits;
  const n = v => (+v || 0);
  const qMin = n(p.minPreTax) + n(p.minRoth403b) + n(p.minRothIRA);
  const qSp = mfj ? n(p.spPreTax) + n(p.spRoth401k) + n(p.spRothIRA) : 0;
  const sRate = saverRate(agi, p.status, cfg);
  const saverQual = Math.min(qMin, C.saver.maxPer) + Math.min(qSp, C.saver.maxPer);
  const saver = Math.min(sRate * saverQual, clamp0(taxBefore));
  const kids = Math.max(0, Math.round(n(p.kidsUnder17))), deps = Math.max(0, Math.round(n(p.otherDeps)));
  const ctcFull = kids * C.ctc.perChild + deps * C.ctc.otherDep;
  const ctcAfter = clamp0(ctcFull - 50 * Math.ceil(clamp0(agi - C.ctc.phaseStart[p.status]) / 1000));
  const ctcNonref = Math.min(ctcAfter, clamp0(taxBefore - saver));
  const refundable = Math.min(ctcAfter - ctcNonref, kids * C.ctc.refundMax, 0.15 * clamp0(earned - 2500));
  return { saver, saverRate: sRate, saverQual, ctc: ctcNonref + clamp0(refundable), refundable: clamp0(refundable), ctcFull, total: saver + ctcNonref + clamp0(refundable) };
}

/* ---------------- Payroll / SE ---------------- */

// Minister SECA (IRC §1401/§1402). Housing allowance IS in the SE base (§1402(a)(8));
// pre-tax 403(b) deferrals are NOT (Pub. 517); Roth 403(b) deferrals ARE.
function ministerSECA(totalComp, preTax403b, cfg = TAX) {
  const seEarn = clamp0(totalComp - preTax403b) * cfg.seFactor;
  const ss = Math.min(seEarn, cfg.ssWageBase) * 0.124;
  const med = seEarn * 0.029;
  return { seEarn, ss, med, total: ss + med };
}

// W-2 employee FICA (employee half). Elective deferrals remain FICA wages (§3121(v)).
function employeeFICA(wages, cfg = TAX) {
  return Math.min(wages, cfg.ssWageBase) * 0.062 + wages * 0.0145;
}

// 0.9% Additional Medicare on combined wages + SE earnings over threshold.
function additionalMedicare(medicareEarnings, status, cfg = TAX) {
  return cfg.addlMed.rate * clamp0(medicareEarnings - cfg.addlMed.thresh[status]);
}

/* ---------------- State (Massachusetts model) ---------------- */
// income: state gross after §107 exclusion & plan deferrals (MA conforms); SS excluded upstream.
function stateTax(income, status, ages, payrollDed, scale = 1, cfg = TAX) {
  const s = cfg.state;
  const count65 = ages.filter(a => a >= 65).length;
  const taxable = clamp0(income - payrollDed - s.persExempt[status] - count65 * s.age65Exempt);
  return s.rate * taxable + s.surtaxRate * clamp0(taxable - s.surtaxThresh * scale);
}

/* ---------------- RMDs ---------------- */
function rmdStartAge(birthYear) { return birthYear >= 1960 ? 75 : 73; }        // SECURE 2.0 §107
function rmdFactor(age, startAge, cfg = TAX) {
  if (age < startAge) return null;
  return cfg.rmd[Math.min(Math.max(Math.floor(age), 72), 120)];
}

/* ---------------- Contribution limits ---------------- */
function deferralLimit(age, cfg = TAX) {
  const L = cfg.limits;
  if (age >= 60 && age <= 63) return L.deferral + L.catch6063;               // SECURE 2.0 §109
  if (age >= 50) return L.deferral + L.catch50;
  return L.deferral;
}
function iraLimit(age, cfg = TAX) { return cfg.limits.ira + (age >= 50 ? cfg.limits.iraCatch : 0); }

// Roth IRA direct-contribution limit after MAGI phase-out (§408A(c)(3)).
function rothIraAllowed(magi, status, age, cfg = TAX) {
  const [lo, hi] = cfg.limits.rothIraPhase[status];
  const full = iraLimit(age, cfg);
  if (magi <= lo) return full;
  if (magi >= hi) return 0;
  return Math.ceil(full * (hi - magi) / (hi - lo) / 10) * 10;
}

/* =====================================================================
   PHASE 1 — TODAY
   ===================================================================== */
function computeToday(p, cfg = TAX) {
  const st = p.status;
  const mfj = st === 'MFJ';
  const ages = mfj ? [p.minAge, p.spAge] : [p.minAge];
  const spGross = mfj ? p.spGross : 0, spPre = mfj ? p.spPreTax : 0;

  // §107: excludable = lesser of designated, actual expenses, fair rental value
  const excludable = Math.min(p.housingDesignated, p.housingActual, p.housingFRV);
  const housingExcess = clamp0(p.housingDesignated - excludable);

  // Other self-employment income (honoraria, speaking, weddings, writing): net of expenses.
  // It is subject to SE tax and income tax under either pay arrangement, so it is added to both
  // the minister and W-2 comparison scenarios.
  const otherNet = clamp0((p.otherSEIncome || 0) - (p.otherSEExpenses || 0));
  const seca = ministerSECA(p.minComp + otherNet, p.minPreTax, cfg);
  const secaSalary = ministerSECA(p.minComp, p.minPreTax, cfg);
  const otherSECA = seca.total - secaSalary.total;
  const spFICA = employeeFICA(spGross, cfg);
  // Non-itemizer cash gifts to charity: up to $1,000 single / $2,000 joint, from 2026 (OBBBA §170(p))
  const giveDed = cfg.year >= 2026 ? Math.min(p.cashGiving || 0, mfj ? 2000 : 1000) : 0;
  // 529 contributions: state deduction or credit only
  const c529 = p.contrib529 || 0;
  const edu = state529(cfg.state.code, st, c529, p.kids529, p.limit529);
  const st529 = (inc, payDed) => clamp0(stateTax(clamp0(inc - edu.ded), st, ages, payDed, 1, cfg) - edu.credit);
  const earned = p.minComp + otherNet + spGross;
  // Federal income tax after the Saver's Credit and child tax credit
  const fedAfter = agi => {
    const f = fedIncomeTax(agi, st, ages, cfg.year, 1, false, cfg, giveDed);
    const cr = fedCredits(agi, f.tax, p, earned, cfg);
    return Object.assign(f, { beforeCredits: f.tax, credits: cr, tax: f.tax - cr.total });
  };

  function ministerScenario(excl) {
    const addlMed = additionalMedicare(seca.seEarn + spGross, st, cfg);
    const seDed = seca.total / 2;                                         // §164(f)
    const minAGIpart = clamp0(p.minComp - excl - p.minPreTax - seDed + otherNet);
    const spAGIpart = clamp0(spGross - spPre);
    const agi = minAGIpart + spAGIpart;
    const fed = fedAfter(agi);
    const stInc = clamp0(p.minComp - (cfg.state.conformsTo107 ? excl : 0) - p.minPreTax + otherNet) + spAGIpart;
    const stPayroll = Math.min(cfg.state.payrollDedCap, seca.total) + (mfj ? Math.min(cfg.state.payrollDedCap, spFICA) : 0);
    const stTax = st529(stInc, stPayroll);
    return { agi, minAGIpart, spAGIpart, fed, stTax, addlMed, seDed, incomeTax: fed.tax + stTax };
  }
  function w2Scenario() {
    const minFICA = employeeFICA(p.minComp, cfg);
    const addlMed = additionalMedicare(p.minComp + otherNet * cfg.seFactor + spGross, st, cfg);
    const agi = clamp0(p.minComp - p.minPreTax) + clamp0(otherNet - otherSECA / 2) + clamp0(spGross - spPre);
    const fed = fedAfter(agi);
    const stPayroll = Math.min(cfg.state.payrollDedCap, minFICA + otherSECA) + (mfj ? Math.min(cfg.state.payrollDedCap, spFICA) : 0);
    const stTax = st529(agi, stPayroll);
    return { minFICA, addlMed, agi, fed, stTax, incomeTax: fed.tax + stTax };
  }

  const w2 = w2Scenario();
  const net = excl => {
    const m = ministerScenario(excl);
    const shield = w2.incomeTax - m.incomeTax;
    const extraPayroll = (seca.total + m.addlMed) - (w2.minFICA + otherSECA + w2.addlMed);
    return { m, shield, extraPayroll, net: shield - extraPayroll };
  };

  const cur = net(excludable);
  // Split shield: housing exclusion vs SE-tax deduction
  const noSEDed = (() => {
    const m = cur.m;
    const agi = m.agi + m.seDed;
    const fed = fedAfter(agi);
    return fed.tax + m.stTax;
  })();
  const shieldSEDed = noSEDed - cur.m.incomeTax;
  const shieldHousing = cur.shield - shieldSEDed;

  // Break-even housing — binary search (net is monotonic in excl)
  let breakEven;
  if (p._fast) breakEven = null;                       // what-if runs skip the search
  else if (net(0).net >= 0) breakEven = 0;
  else if (net(p.minComp).net < 0) breakEven = null;
  else {
    let lo = 0, hi = p.minComp;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (net(mid).net >= 0) hi = mid; else lo = mid; }
    breakEven = Math.ceil(hi / 10) * 10;
  }

  // Cash flow — joint income tax allocated by each person's share of AGI (approximation)
  const m = cur.m;
  const shareMin = m.agi > 0 ? m.minAGIpart / m.agi : 1;
  const addlMedMinShare = (seca.seEarn + spGross) > 0 ? m.addlMed * seca.seEarn / (seca.seEarn + spGross) : 0;
  const minister = {
    gross: p.minComp + otherNet,
    payroll: seca.total + addlMedMinShare,
    incomeTax: m.incomeTax * shareMin,
    preTax: p.minPreTax,
    roth: p.minRoth403b + p.minRothIRA
  };
  minister.net = minister.gross - minister.payroll - minister.incomeTax - minister.preTax - minister.roth;
  const spouse = {
    gross: spGross,
    payroll: spFICA + (m.addlMed - addlMedMinShare),
    incomeTax: m.incomeTax * (1 - shareMin),
    preTax: spPre,
    roth: mfj ? (p.spRoth401k + p.spRothIRA) : 0
  };
  spouse.net = spouse.gross - spouse.payroll - spouse.incomeTax - spouse.preTax - spouse.roth;
  // After-tax saving outside retirement plans (cash reserve, brokerage) comes out of take-home
  const otherSaving = (p.cashContrib || 0) + (p.brokContrib || 0) + c529;
  const takeHome = minister.net + spouse.net;          // after taxes and retirement saving

  // Warnings
  const warnings = [];
  const minDefLim = deferralLimit(p.minAge, cfg);
  if (p.minPreTax + p.minRoth403b > minDefLim)
    warnings.push({ field: 'minPreTax', msg: `Minister 403(b) pre-tax + Roth = ${fmt(p.minPreTax + p.minRoth403b)} exceeds the ${fmt(minDefLim)} limit at age ${p.minAge}.` });
  const magi = m.agi;
  const minRothIraMax = rothIraAllowed(magi, st, p.minAge, cfg);
  if (p.minRothIRA > minRothIraMax)
    warnings.push({ field: 'minRothIRA', msg: `Minister Roth IRA allowed: ${fmt(minRothIraMax)} (age/MAGI limit). Consider a backdoor Roth.` });
  if (mfj) {
    const spDefLim = deferralLimit(p.spAge, cfg);
    if (p.spPreTax + p.spRoth401k > spDefLim)
      warnings.push({ field: 'spPreTax', msg: `Spouse plan pre-tax + Roth = ${fmt(p.spPreTax + p.spRoth401k)} exceeds the ${fmt(spDefLim)} limit at age ${p.spAge}.` });
    const spRothIraMax = rothIraAllowed(magi, st, p.spAge, cfg);
    if (p.spRothIRA > spRothIraMax)
      warnings.push({ field: 'spRothIRA', msg: `Spouse Roth IRA allowed: ${fmt(spRothIraMax)} (age/MAGI limit).` });
    if (p.spAge >= 50 && spGross > cfg.limits.rothCatchupFicaWages && p.spPreTax > cfg.limits.deferral)
      warnings.push({ field: 'spPreTax', msg: `Spouse earns > $150k FICA wages: catch-up contributions must be Roth (SECURE 2.0 §603).` });
  }
  if (housingExcess > 0)
    warnings.push({ field: 'housingDesignated', msg: `${fmt(housingExcess)} of the designated allowance exceeds actual expenses / fair rental value and is taxable income (§107).` });

  // Marketplace subsidy: anchored on the credit entered at the household's own income (p._acaMagi0 in what-ifs)
  let aca = null;
  if (p.acaMarket && p.acaSubsidy > 0) {
    const magi0 = p._acaMagi0 !== undefined ? p._acaMagi0 : m.agi, c = acaCredit(m.agi, magi0, p.acaSubsidy, p, cfg);
    aca = { ptc: c.ptc, lost: p.acaSubsidy - c.ptc, cliff: c.cliff, magi0 };
  }

  return {
    aca, excludable, housingExcess, seca, spFICA, w2, minScenario: m,
    shield: cur.shield, shieldHousing, shieldSEDed, extraPayroll: cur.extraPayroll, netAdvantage: cur.net,
    seDeduction: m.seDed, breakEven, marginalFed: m.fed.marginal, minister, spouse,
    takeHome, otherSaving, householdNet: takeHome - otherSaving, warnings,
    setAside: taxSetAside(m, seca, p, mfj),
    otherNet, otherSECA, giveDed,
    edu: Object.assign(edu, { contrib: c529, saved: clamp0(stateTax(clamp0(m.agi), st, ages, 0, 1, cfg) - st529(clamp0(m.agi), 0)) }),
    limits: { minDeferral: minDefLim, spDeferral: mfj ? deferralLimit(p.spAge, cfg) : 0 }
  };
}

/* =====================================================================
   TAX SET-ASIDE CHECK (Pub. 517: ministers have no mandatory withholding;
   they cover income tax + SE tax with voluntary withholding and/or
   quarterly estimated payments, Form 1040-ES).
   ===================================================================== */
const EST_DUE_2026 = ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'];
function taxSetAside(m, seca, p, mfj){
  const n = v => (+v || 0);
  const fedDue = m.fed.tax + seca.total + m.addlMed, stateDue = m.stTax;
  const est = n(p.estQuarterly) * 4;
  const fedSet = 12 * (n(p.whMinFed) + (mfj ? n(p.whSpFed) : 0)) + est;
  const stateSet = 12 * (n(p.whMinState) + (mfj ? n(p.whSpState) : 0));
  const due = fedDue + stateDue, set = fedSet + stateSet, gap = due - set;
  const lastYear = n(p.lastYearTax), hi = m.agi > 150000;
  const safeHarbor = Math.min(0.9 * due, lastYear > 0 ? lastYear * (hi ? 1.1 : 1) : Infinity);
  return {
    fedDue, stateDue, due, fedSet, stateSet, set, gap,
    safeHarbor, safe: set >= safeHarbor || gap < 1000,
    // To cover the gap from the church paycheck alone (voluntary withholding, Form W-4)
    churchFedMonthly: Math.max(0, (fedDue - 12 * (mfj ? n(p.whSpFed) : 0) - est) / 12),
    churchStateMonthly: Math.max(0, (stateDue - 12 * (mfj ? n(p.whSpState) : 0)) / 12),
    // Or with quarterly estimated payments
    quarterlyNeeded: Math.max(0, (fedDue - 12 * (n(p.whMinFed) + (mfj ? n(p.whSpFed) : 0))) / 4),
    dueDates: EST_DUE_2026
  };
}

/* =====================================================================
   MARGINAL VIEW — "Where your next dollar is taxed", "Thresholds near
   you", and the pre-tax/Roth split. All by finite differences of
   computeToday, so every rule above (SECA, credits, state, phase-outs)
   is counted exactly once.
   ===================================================================== */
// Every tax the household pays this year (federal after credits, state, SECA, FICA, 0.9%)
// A smaller Marketplace premium credit counts as tax here (it is settled on the tax return).
function householdTax(t) {
  const m = t.minScenario;
  return m.fed.tax + m.stTax + t.seca.total + m.addlMed + t.spFICA + (t.aca ? t.aca.lost : 0);
}
function parts(t) {
  const m = t.minScenario;
  const cr = m.fed.credits ? m.fed.credits.total : 0;
  return { fed: m.fed.tax + cr, cred: -cr, state: m.stTax, payroll: t.seca.total + m.addlMed + t.spFICA, aca: t.aca ? t.aca.lost : 0 };
}
// What-if inputs: skip the break-even search and keep the subsidy anchored on today's income.
function fastP(p, d) {
  const q = Object.assign({}, p, d || {}, { _fast: true });
  if (p.acaMarket && p.acaSubsidy > 0 && p._acaMagi0 === undefined) q._acaMagi0 = computeToday(Object.assign({}, p, { _fast: true, acaSubsidy: 0 })).minScenario.agi;
  return q;
}

// Tax change per dollar for a change `d` of size `step`, split into federal/state/payroll.
function deltaRate(p, d, step, cfg = TAX) {
  const a = computeToday(fastP(p), cfg), b = computeToday(fastP(p, d), cfg);
  const pa = parts(a), pb = parts(b);
  const D = k => (pb[k] - pa[k]) / step, fed = D('fed'), cred = D('cred'), state = D('state'), payroll = D('payroll'), aca = D('aca');
  return { rate: fed + cred + state + payroll + aca, fed, cred, state, payroll, aca };
}

// Where the household sits in the federal brackets (taxable income).
function bracketInfo(p, cfg = TAX) {
  const t = computeToday(fastP(p), cfg), taxable = t.minScenario.fed.taxable, b = cfg.brackets[p.status];
  let i = 0; while (i < b.length - 1 && taxable > b[i][0]) i++;
  const lower = i > 0 ? b[i - 1][0] : 0, upper = b[i][0];
  return { taxable, rate: taxable > 0 ? b[i][1] : 0, lower, upper, roomUp: upper - taxable, roomDown: taxable - lower,
           rateBelow: i > 0 ? b[i - 1][1] : 0, rateAbove: i < b.length - 1 ? b[i + 1][1] : b[i][1] };
}

// Room left under the elective-deferral limit (Roth deferrals could be switched to pre-tax).
function preTaxRoom(p, cfg = TAX) {
  const mfj = p.status === 'MFJ';
  return { min: p.minComp > 0 ? clamp0(deferralLimit(p.minAge, cfg) - p.minPreTax) : 0,
           sp: mfj && p.spGross > 0 ? clamp0(Math.min(deferralLimit(p.spAge, cfg), p.spGross) - p.spPreTax) : 0 };
}
// Extra pre-tax saving (minister's plan first, since it also skips SE tax; then spouse's)
// needed so that measure(t) <= target. Returns { amount, min, sp } or null if out of reach.
function preTaxToReach(p, measure, target, cfg = TAX) {
  const room = preTaxRoom(p, cfg), at = (x) => {
    const xm = Math.min(x, room.min), xs = x - xm;
    const q = { minPreTax: p.minPreTax + xm, minRoth403b: clamp0(p.minRoth403b - Math.max(0, p.minPreTax + xm + p.minRoth403b - deferralLimit(p.minAge, cfg))),
                spPreTax: p.spPreTax + xs, spRoth401k: clamp0(p.spRoth401k - Math.max(0, p.spPreTax + xs + p.spRoth401k - deferralLimit(p.spAge, cfg))) };
    return { v: measure(computeToday(fastP(p, q), cfg)), xm, xs };
  };
  if (at(0).v <= target) return { amount: 0, min: 0, sp: 0 };
  const max = room.min + room.sp;
  if (max <= 0 || at(max).v > target) return null;
  let lo = 0, hi = max;
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (at(mid).v <= target) hi = mid; else lo = mid; }
  const r = at(Math.ceil(hi / 10) * 10 > max ? max : Math.ceil(hi / 10) * 10);
  return { amount: r.xm + r.xs, min: r.xm, sp: r.xs };
}

// One line per kind of money: what the next $1,000 earned costs, or saved/shifted saves.
function nextDollar(p, cfg = TAX) {
  const mfj = p.status === 'MFJ', step = 1000, out = [];
  const room = preTaxRoom(p, cfg);
  if (p.minComp > 0) out.push(Object.assign({ key: 'church', label: 'Church salary', kind: 'earn' }, deltaRate(p, { minComp: p.minComp + step }, step, cfg)));
  out.push(Object.assign({ key: 'side', label: 'Speaking and honoraria', kind: 'earn' },
    deltaRate(p, { otherSEIncome: (p.otherSEIncome || 0) + step }, step, cfg)));
  if (mfj && p.spGross > 0) out.push(Object.assign({ key: 'spouse', label: "Spouse's wages", kind: 'earn' }, deltaRate(p, { spGross: p.spGross + step }, step, cfg)));
  const hRoom = clamp0(Math.min(p.housingActual, p.housingFRV, p.minComp) - p.housingDesignated);
  if (p.minComp > 0 && hRoom >= 100) { const s = Math.min(step, hRoom);
    const d = deltaRate(p, { housingDesignated: p.housingDesignated + s }, s, cfg);
    out.push({ key: 'housing', label: 'Moving salary into housing allowance', kind: 'save', room: hRoom, rate: -d.rate, fed: -d.fed, cred: -d.cred, state: -d.state, payroll: -d.payroll, aca: -d.aca }); }
  const sv = (key, label, d, roomLeft) => { const r = deltaRate(p, d, step, cfg);
    out.push({ key, label, kind: 'save', room: roomLeft, rate: -r.rate, fed: -r.fed, cred: -r.cred, state: -r.state, payroll: -r.payroll, aca: -r.aca }); };
  if (p.minComp > 0) {
    sv('minPre', 'Your 403(b), pre-tax', { minPreTax: p.minPreTax + step }, room.min);
    sv('minRoth', 'Your 403(b), Roth', { minRoth403b: p.minRoth403b + step }, clamp0(deferralLimit(p.minAge, cfg) - p.minPreTax - p.minRoth403b));
  }
  if (mfj && p.spGross > 0) {
    sv('spPre', "Spouse's plan, pre-tax", { spPreTax: p.spPreTax + step }, room.sp);
    sv('spRoth', "Spouse's plan, Roth", { spRoth401k: p.spRoth401k + step }, clamp0(deferralLimit(p.spAge, cfg) - p.spPreTax - p.spRoth401k));
  }
  // How far the next pre-tax dollars go before the rate drops a bracket
  const bi = bracketInfo(p, cfg);
  let edge = null;
  if (bi.rate > 0.1 && bi.rate - bi.rateBelow >= 0.05) {
    const need = preTaxToReach(p, t => t.minScenario.fed.taxable, bi.lower, cfg);
    edge = { lower: bi.lower, rate: bi.rate, rateBelow: bi.rateBelow, need };
  }
  return { lines: out, bracket: bi, edge };
}

// Thresholds within reach of this household, each with what crossing it costs and the
// pre-tax saving that would get back under it.
function fpl(size, code, cfg = TAX) {
  const a = cfg.aca, [b, add] = code === 'AK' ? a.fplAK : code === 'HI' ? a.fplHI : [a.fpl, a.fplAdd];
  return b + add * Math.max(0, size - 1);
}
// Marketplace premium tax credit (§36B) as income changes, anchored on the credit the person
// receives now: benchmark = credit + expected contribution at today's income. No credit above 400% FPL (2026).
function acaApplicable(x, cfg = TAX) {
  const t = cfg.aca.ap; if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [a, ra] = t[i - 1], [b, rb] = t[i]; return b === a ? rb : ra + (rb - ra) * (x - a) / (b - a); }
  return t[t.length - 1][1];
}
function acaHousehold(p, cfg = TAX) { return (p.status === 'MFJ' ? 2 : 1) + Math.max(0, Math.round(+p.kidsUnder17 || 0)) + Math.max(0, Math.round(+p.otherDeps || 0)); }
function acaCredit(magi, magi0, credit0, p, cfg = TAX) {
  const line = fpl(acaHousehold(p, cfg), cfg.state.code, cfg);
  if (!(credit0 > 0) || magi0 > cfg.aca.cliff * line) return { ptc: 0, cliff: cfg.aca.cliff * line, bench: 0 };
  const bench = credit0 + acaApplicable(magi0 / line, cfg) * magi0;
  const ptc = magi > cfg.aca.cliff * line ? 0 : clamp0(bench - acaApplicable(magi / line, cfg) * magi);
  return { ptc, cliff: cfg.aca.cliff * line, bench };
}
function thresholds(p, cfg = TAX) {
  const mfj = p.status === 'MFJ', st = p.status, t = computeToday(fastP(p), cfg), m = t.minScenario;
  const agi = m.agi, taxable = m.fed.taxable, medEarn = t.seca.seEarn + (mfj ? p.spGross : 0);
  const room = preTaxRoom(p, cfg), reach = Math.max(10000, 0.12 * agi);
  const T0 = householdTax(t), out = [];
  const M = { agi: x => x.minScenario.agi, taxable: x => x.minScenario.fed.taxable, med: x => x.seca.seEarn + (mfj ? p.spGross : 0) };
  const add = (o) => {
    const v = o.measure === 'taxable' ? taxable : o.measure === 'med' ? medEarn : agi;
    const above = v > o.at, gap = Math.abs(v - o.at);
    if (gap > (o.reach || reach) && !(above && o.backAlways)) return;
    let back = null;
    if (above && o.canGoBack !== false) back = preTaxToReach(p, M[o.measure], o.at - (o.cliff ? 1 : 0), cfg);
    if (above && !o.showAbove && !back) return;
    if (o.id.startsWith('saver') && !(o.cost >= 25)) return;            // no real credit at stake
    out.push(Object.assign(o, { value: v, above, gap, back, room: room.min + room.sp }));
  };

  // Federal bracket edges with a real jump in rate (12→22, 24→32)
  const b = cfg.brackets[st];
  for (let i = 0; i < b.length - 1; i++) {
    const jump = b[i + 1][1] - b[i][1]; if (jump < 0.05) continue;
    add({ id: 'bracket' + Math.round(b[i][1] * 100), kind: 'bracket', measure: 'taxable', at: b[i][0], term: 'bracket',
      name: `${Math.round(b[i][1] * 100)}% → ${Math.round(b[i + 1][1] * 100)}% federal bracket`,
      effect: `Each $1,000 of taxable income above it costs ${fmt(jump * 1000)} more in federal tax than the same $1,000 below it.`, rateJump: jump });
  }
  // Saver's Credit tiers (AGI) — cliffs: $1 over drops the credit rate for every dollar saved
  const qual = fedCredits(agi, 1e9, p, 0, cfg).saverQual;
  const tiers = cfg.credits.saver.tiers[st];
  // Federal tax after credits at a given AGI (to price a cliff exactly, incl. the credit's tax limit)
  const ages = mfj ? [p.minAge, p.spAge] : [p.minAge], earned = p.minComp + t.otherNet + (mfj ? p.spGross : 0);
  const fedAt = x => { const f = fedIncomeTax(x, st, ages, cfg.year, 1, false, cfg, t.giveDed); return f.tax - fedCredits(x, f.tax, p, earned, cfg).total; };
  const cliffCost = at => Math.max(0, fedAt(at + 1) - fedAt(at) - 1);
  tiers.forEach(([top, rate], i) => {
    const next = i < tiers.length - 1 ? tiers[i + 1][1] : 0;
    const maxQual = (mfj ? 2 : 1) * cfg.credits.saver.maxPer;
    add({ id: 'saver' + i, kind: 'cliff', measure: 'agi', at: top, cliff: true, term: 'saverscredit', showAbove: false,
      name: `Saver's Credit: ${Math.round(rate * 100)}% → ${next ? Math.round(next * 100) + '%' : 'none'}`,
      cost: cliffCost(top), costMax: (rate - next) * maxQual, rate, next, qual,
      effect: qual > 0 ? `Crossing it lowers your Saver's Credit by about ${fmt(cliffCost(top))} a year, all at once.`
                       : `Up to $2,000 a person of retirement saving earns a ${Math.round(rate * 100)}% credit below this line.` });
  });
  // Roth IRA eligibility
  const [rlo, rhi] = cfg.limits.rothIraPhase[st], rothIra = p.minRothIRA + (mfj ? p.spRothIRA : 0);
  if (rothIra > 0 || Math.abs(agi - rlo) < reach) {
    add({ id: 'rothira', kind: 'phaseout', measure: 'agi', at: rlo, term: 'roth', showAbove: true,
      name: 'Roth IRA contributions phase out', effect: `Direct Roth IRA contributions shrink above it and stop at ${fmt(rhi)}. A "backdoor" Roth still works.` });
  }
  // Child tax credit phase-out
  const kids = (+p.kidsUnder17 || 0) + (+p.otherDeps || 0);
  if (kids > 0) add({ id: 'ctc', kind: 'phaseout', measure: 'agi', at: cfg.credits.ctc.phaseStart[st], term: 'ctc', showAbove: true,
    name: 'Child tax credit begins to shrink', effect: 'The credit drops $50 for each $1,000 of income above it (5%), on top of your bracket.' });
  // Senior deduction phase-out (65+, through 2028)
  const n65 = [p.minAge].concat(mfj ? [p.spAge] : []).filter(a => a >= 65).length;
  if (n65 && cfg.year <= cfg.senior.lastYear) add({ id: 'senior', kind: 'phaseout', measure: 'agi', at: cfg.senior.phaseStart[st], term: 'seniorded', showAbove: true,
    name: 'Senior deduction begins to shrink', effect: `The $6,000-per-person deduction drops 6% of income above it${n65 > 1 ? ' for each of you' : ''}, which adds about ${Math.round(n65 * 6 * m.fed.marginal)}% to your tax rate.` });
  // Additional Medicare tax (wages + SE earnings)
  add({ id: 'addlmed', kind: 'surtax', measure: 'med', at: cfg.addlMed.thresh[st], term: 'seca', showAbove: true, reach: Math.min(reach, 15000),
    name: 'Additional Medicare tax (0.9%)', effect: 'Earnings above it pay an extra 0.9% Medicare tax.' });
  // Investment-income thresholds, only with taxable investments
  if (p.brokerageBal > 0) {
    add({ id: 'niit', kind: 'surtax', measure: 'agi', at: cfg.niit.thresh[st], term: 'niit', showAbove: true, canGoBack: true,
      name: 'Net investment income tax (3.8%)', effect: 'Above it, dividends, interest and capital gains pay an extra 3.8%.' });
    if (taxable < cfg.ltcg0Top[st]) add({ id: 'ltcg0', kind: 'room', measure: 'taxable', at: cfg.ltcg0Top[st], term: 'ltcg0', canGoBack: false,
      name: '0% capital gains ceiling', effect: `Long-term gains that fit under it are taxed at 0% federally. You have about ${fmt(cfg.ltcg0Top[st] - taxable)} of room.` });
  }
  // ACA premium tax credit cliff (2026: no subsidy above 400% of the poverty line)
  if (p.acaMarket) {
    const size = acaHousehold(p, cfg);
    const at = Math.round(cfg.aca.cliff * fpl(size, cfg.state.code, cfg));
    const atCliff = p.acaSubsidy > 0 && agi <= at ? acaCredit(at, agi, p.acaSubsidy, p, cfg).ptc : (p.acaSubsidy || 0);
    add({ id: 'aca', kind: 'cliff', measure: 'agi', at, cliff: true, term: 'aca', showAbove: true, backAlways: true, reach: Math.max(reach, 15000),
      name: 'Marketplace insurance subsidy cliff', cost: atCliff, size,
      effect: (p.acaSubsidy > 0 ? `Crossing it ends your premium tax credit (about ${fmt(atCliff)} a year by then), all at once. Below it, the credit also shrinks a little as income rises.` : 'Above it there is no help paying Marketplace premiums in 2026.') +
        ' Your housing allowance does not count toward this income.' });
  }
  out.sort((x, y) => x.gap - y.gap);
  return { list: out, agi, taxable, medEarn, T0 };
}

// Best split of a fixed yearly amount between pre-tax and Roth in one person's plan.
// Pre-tax wins on each dollar whose tax saved now beats the tax its withdrawal will owe later
// (retRate); same growth either way. Evaluated on a $250 grid so credit cliffs are handled.
function bestSplit(p, who, retRate, cfg = TAX) {
  const pre = who === 'sp' ? 'spPreTax' : 'minPreTax', roth = who === 'sp' ? 'spRoth401k' : 'minRoth403b';
  const total = (p[pre] || 0) + (p[roth] || 0);
  if (total <= 0) return null;
  const T = x => householdTax(computeToday(fastP(p, { [pre]: x, [roth]: total - x }), cfg));
  const T0 = T(0), val = x => (T0 - T(x)) - x * retRate;
  let best = 0, bestV = 0;
  const steps = Math.min(200, Math.ceil(total / 250));
  for (let k = 1; k <= steps; k++) { const x = Math.min(total, k * total / steps), v = val(x); if (v > bestV + 1) { best = x; bestV = v; } }
  best = Math.round(best / 50) * 50;
  const cur = p[pre] || 0;
  return { total, pre: best, roth: total - best, cur, curRoth: total - cur, gain: val(best) - val(cur),
           taxNowBest: T(best), taxNowCur: T(cur), retRate };
}

/* =====================================================================
   PHASE 2 — ACCUMULATION (year-by-year so salary growth works)
   Contributions at year-end (matches V13's FV-annuity convention).
   ===================================================================== */
function accumulate(p) {
  const Y = Math.max(0, Math.round(p.yearsToRetire));
  const r = p.accReturn, g = p.salaryGrowth;
  const mfj = p.status === 'MFJ';
  const elig = Math.min(1, Math.max(0, p.churchPlanPct));
  let b = {
    mChurch: p.minTradBal * elig,
    mTrad:   p.minTradBal * (1 - elig) + p.miscTradBal,
    sTrad:   mfj ? p.spTradBal : 0,
    roth:    p.minRothBal + (mfj ? p.spRothBal : 0) + p.miscRothBal,
    brok:    p.brokerageBal
  };
  let cash = p.cashBal || 0, b529 = p.bal529 || 0, edu529End = b529;
  const Yc = Math.max(0, Math.round(p.yrsToCollege || 0));
  const path = [{ year: 0, ...b, total: sumB(b) }];
  let contributed = { pre: 0, roth: 0 };
  for (let y = 1; y <= Y; y++) {
    const f = Math.pow(1 + g, y - 1);
    const minPre = p.minPreTax * f, spPre = mfj ? p.spPreTax * f : 0;
    const rothC = (p.minRoth403b + p.minRothIRA + (mfj ? p.spRoth401k + p.spRothIRA : 0)) * f;
    b.mChurch = b.mChurch * (1 + r) + minPre * elig;
    b.mTrad   = b.mTrad   * (1 + r) + minPre * (1 - elig);
    b.sTrad   = b.sTrad   * (1 + r) + spPre;
    b.roth    = b.roth    * (1 + r) + rothC;
    b.brok    = b.brok    * (1 + r * (1 - p.brokTaxDrag)) + (p.brokContrib || 0) * f;
    cash      = cash * (1 + (p.cashRate || 0)) + (p.cashContrib || 0) * f;
    if (y <= Yc) { b529 = b529 * (1 + r) + (p.contrib529 || 0) * f; if (y === Yc) edu529End = b529; }
    contributed.pre += minPre + spPre; contributed.roth += rothC; contributed.brok = (contributed.brok || 0) + (p.brokContrib || 0) * f;
    path.push({ year: y, ...b, total: sumB(b) });
  }
  if (Yc > Y) { for (let y = Y + 1; y <= Yc; y++) b529 = b529 * (1 + r) + (p.contrib529 || 0); edu529End = b529; }
  if (Yc === 0) edu529End = b529;
  return { end: { ...b }, path, contributed, cashEnd: cash, edu529End };
}
function sumB(b) { return b.mChurch + b.mTrad + b.sTrad + b.roth + b.brok; }

/* =====================================================================
   PHASE 3 — RETIREMENT ENGINE
   Order each year:
     1. Fixed income (SS w/ COLA, pension)
     2. Forced RMDs (start-of-year balances, per-owner start age)
     3. Housing-shielded church-plan draw (tax-free up to allowance, §107)
     4. Optional Roth conversion ("fill to bracket")
     5. Remaining need: brokerage → [Roth ↔ taxable trad per draw order]
        Taxable draws solved by binary search so taxes are exact.
     6. Surplus → taxable brokerage; growth; inflate.
   ===================================================================== */
function runRetirement(start, P, returns, cfg = TAX) {
  let b = { ...start };
  const rows = [];
  const taxBy = { fixed: 0, rmd: 0, conversion: 0, withdrawals: 0, brokerage: 0 };
  let totalTax = 0, depletedYear = -1, totalConverted = 0;

  let spend = P.spend0, ssMin = P.ssMin0, ssSp = P.ssSp0, pension = P.pension0, hAllow = P.housing0;
  let status = P.status, ministerAlive = true;

  for (let i = 0; i < P.years; i++) {
    const calYear = P.startCalYear + i;
    const scale = P.scale0 * Math.pow(1 + P.inflation, i);
    const mAge = P.minAgeStart + i, sAge = P.spAgeStart + i;

    // Survivor transition: minister dies at start of year `survivorYear`
    if (P.survivorOn && status === 'MFJ' && ministerAlive && i >= P.survivorYear) {
      ministerAlive = false;
      b.sTrad += b.mChurch + b.mTrad; b.mChurch = 0; b.mTrad = 0;   // spousal rollover
      status = 'Single';
      ssSp = Math.max(ssMin, ssSp); ssMin = 0;                       // survivor keeps larger benefit
      spend *= P.survivorSpendPct;
      pension *= (P.pensionSurvivorPct ?? 1);                       // joint-and-survivor election
      hAllow = 0;                                                   // §107 ends with the minister
    }
    const ages = status === 'MFJ' ? [mAge, sAge] : [ministerAlive ? mAge : sAge];
    const housingOn = ministerAlive && P.housingOn;
    const allow = housingOn ? hAllow : 0;

    const ss = ssMin + ssSp;
    const pensionPaid = (!ministerAlive || mAge >= (P.pensionStartAge || 0)) ? pension : 0;
    // Church-plan pension designated as housing allowance uses the allowance first (Pub. 517)
    const pensElig = ministerAlive && P.pensionHousing ? pensionPaid : 0;
    const startBal = { ...b };

    // 2. RMDs
    let rmdC = 0, rmdM = 0, rmdS = 0;
    if (ministerAlive) {
      const fM = rmdFactor(mAge, P.minRmdAge, cfg);
      if (fM) { rmdC = startBal.mChurch / fM; rmdM = startBal.mTrad / fM; }
    }
    const fS = rmdFactor(ministerAlive ? sAge : sAge, P.spRmdAge, cfg);
    if (fS && (status === 'MFJ' || !ministerAlive)) rmdS = startBal.sTrad / fS;
    b.mChurch -= rmdC; b.mTrad -= rmdM; b.sTrad -= rmdS;

    // plan accumulator
    const plan = { churchDist: rmdC, otherTradDist: rmdM + rmdS, conv: 0, rothDist: 0, brokDist: 0 };
    const taxOf = pl => yearTax(pl, { ss, pension: pensionPaid, pensElig, allow, status, ages, calYear, scale, seniorExt: P.seniorExtended }, cfg);
    const cashOf = pl => ss + pensionPaid + pl.churchDist + pl.otherTradDist + pl.rothDist + pl.brokDist;
    const needOf = pl => spend + taxOf(pl).total - cashOf(pl);

    // 3. Housing-shielded church draw (tax-free portion), limited to need
    let need = needOf(plan);
    if (need > 0 && allow - pensElig > plan.churchDist) {
      const h = Math.min(need, allow - pensElig - plan.churchDist, b.mChurch);
      b.mChurch -= h; plan.churchDist += h; need = needOf(plan);
    }

    // 4. Roth conversion planner
    const convAge = ministerAlive ? mAge : sAge;
    if (P.convOn && convAge < P.convStopAge) {
      const topTaxable = bracketTop(P.convBracket, status, scale, cfg);
      let conv = 0;
      for (let k = 0; k < 3; k++) {
        const t = taxOf({ ...plan, conv }).fedTaxable;
        conv = clamp0(conv + (topTaxable - t));
      }
      const avail = b.mTrad + b.sTrad + (P.convFromChurch ? b.mChurch : 0);
      conv = Math.min(conv, avail);
      let rem = conv;
      const takeM = Math.min(rem, b.mTrad); b.mTrad -= takeM; rem -= takeM;
      const takeS = Math.min(rem, b.sTrad); b.sTrad -= takeS; rem -= takeS;
      if (P.convFromChurch) { const takeC = Math.min(rem, b.mChurch); b.mChurch -= takeC; rem -= takeC; }
      plan.conv = conv; b.roth += conv; totalConverted += conv;
      need = needOf(plan);
    }

    // 5. Fill remaining need
    const drawTaxFree = (key, bal) => {
      if (need <= 0.005) return;
      const amt = Math.min(need, b[bal]);
      b[bal] -= amt; plan[key] += amt; need = needOf(plan);
    };
    const drawTaxable = () => {
      if (need <= 0.005) return;
      const avail = b.mChurch + b.mTrad + b.sTrad;
      if (avail <= 0) return;
      // find D: needOf(plan + D) <= 0
      const withD = D => {
        const fromC = Math.min(D, b.mChurch);
        return { ...plan, churchDist: plan.churchDist + fromC, otherTradDist: plan.otherTradDist + (D - fromC) };
      };
      let D;
      if (needOf(withD(avail)) > 0) D = avail;
      else {
        let lo = 0, hi = avail;
        for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (needOf(withD(mid)) > 0) lo = mid; else hi = mid; }
        D = hi;
      }
      const fromC = Math.min(D, b.mChurch); b.mChurch -= fromC;
      let rem = D - fromC;
      const fromM = Math.min(rem, b.mTrad); b.mTrad -= fromM; rem -= fromM;
      const fromS = Math.min(rem, b.sTrad); b.sTrad -= fromS;
      plan.churchDist += fromC; plan.otherTradDist += D - fromC;
      need = needOf(plan);
    };
    drawTaxFree('brokDist', 'brok');
    if (P.drawOrder === 'roth-first') { drawTaxFree('rothDist', 'roth'); drawTaxable(); }
    else { drawTaxable(); drawTaxFree('rothDist', 'roth'); }

    const t = taxOf(plan);
    let surplus = 0;
    if (need > 0.5) { depletedYear = i + 1; }
    else if (need < 0) { surplus = -need; b.brok += surplus; }

    // Tax attribution (incremental)
    const tFixed = taxOf({ churchDist: 0, otherTradDist: 0, conv: 0, rothDist: 0, brokDist: 0 }).total;
    const exclTotal = Math.min(allow, plan.churchDist + pensElig);
    const tRmd = taxOf({ churchDist: rmdC, otherTradDist: rmdM + rmdS, conv: 0, rothDist: 0, brokDist: 0 }).total;
    const tConv = taxOf({ churchDist: rmdC, otherTradDist: rmdM + rmdS, conv: plan.conv, rothDist: 0, brokDist: 0 }).total;
    taxBy.fixed += tFixed; taxBy.rmd += tRmd - tFixed; taxBy.conversion += tConv - tRmd; taxBy.withdrawals += t.total - tConv;

    // Growth
    const r = returns ? returns[i] : P.ret;
    const brokGrowth = b.brok * r;
    const brokTax = clamp0(brokGrowth) * P.brokTaxDrag;
    b.mChurch = clamp0(b.mChurch) * (1 + r);
    b.mTrad   = clamp0(b.mTrad)   * (1 + r);
    b.sTrad   = clamp0(b.sTrad)   * (1 + r);
    b.roth    = clamp0(b.roth)    * (1 + r);
    b.brok    = clamp0(b.brok + brokGrowth - brokTax);
    taxBy.brokerage += brokTax;
    const yearTotalTax = t.total + brokTax;
    totalTax += yearTotalTax;

    rows.push({
      i: i + 1, calYear, mAge, sAge, status, ministerAlive,
      spend, ss, pension: pensionPaid, pensElig, allow,
      rmd: rmdC + rmdM + rmdS, housingExcluded: exclTotal,
      churchDist: plan.churchDist, otherTradDist: plan.otherTradDist,
      rothDist: plan.rothDist, brokDist: plan.brokDist, conv: plan.conv,
      taxableSS: t.taxableSS, fedAGI: t.agi, fedTaxable: t.fedTaxable,
      fedTax: t.fed, stateTax: t.state, brokTax, totalTax: yearTotalTax, marginal: t.marginal,
      surplus, shortfall: depletedYear === i + 1 ? need : 0,
      end: { ...b }, endTotal: sumB(b), realFactor: 1 / (P.scale0 * Math.pow(1 + P.inflation, i + 1))
    });

    if (depletedYear !== -1) break;

    spend *= 1 + P.inflation;
    ssMin *= 1 + P.inflation; ssSp *= 1 + P.inflation;
    if (P.pensionCOLA) pension *= 1 + P.inflation;
    hAllow *= 1 + P.inflation;
  }
  return { rows, depletedYear, totalTax, taxBy, totalConverted, finalBal: depletedYear === -1 ? sumB(b) : 0, endBal: { ...b } };
}

// One retirement year's federal + state tax for a draw plan.
function yearTax(pl, ctx, cfg = TAX) {
  const elig = ctx.pensElig || 0;
  const excluded = Math.min(ctx.allow, pl.churchDist + elig);              // §107 parsonage exclusion
  const ordinary = pl.churchDist + ctx.pension - excluded + pl.otherTradDist + pl.conv;
  const tSS = taxableSS(ctx.ss, ordinary, ctx.status, cfg);
  const agi = ordinary + tSS;
  const fed = fedIncomeTax(agi, ctx.status, ctx.ages, ctx.calYear, ctx.scale, ctx.seniorExt, cfg);
  const stIncome = ordinary + (cfg.state.ssExempt ? 0 : ctx.ss) + (cfg.state.conformsTo107 ? 0 : excluded);
  const st = stateTax(stIncome, ctx.status, ctx.ages, 0, ctx.scale, cfg);
  return { total: fed.tax + st, fed: fed.tax, state: st, agi, taxableSS: tSS, fedTaxable: fed.taxable, marginal: fed.marginal };
}

/* =====================================================================
   Build retirement params from user inputs
   ===================================================================== */
function buildRetParams(p) {
  const Y = Math.max(0, Math.round(p.yearsToRetire));
  const toNominal = p.todaysDollars ? Math.pow(1 + p.inflation, Y) : 1;
  const mfj = p.status === 'MFJ';
  return {
    years: Math.max(1, Math.round(p.retYears)),
    status: p.status,
    startCalYear: TAX.year + Y,
    scale0: Math.pow(1 + p.inflation, Y),                  // brackets indexed from 2026
    inflation: p.inflation,
    ret: p.retReturn,
    spend0: p.retSpend * toNominal,
    ssMin0: p.ssMin * toNominal,
    ssSp0: mfj ? p.ssSp * toNominal : 0,
    pension0: p.pension * toNominal,
    pensionCOLA: p.pensionCOLA,
    pensionStartAge: p.pensionStartAge > 0 ? p.pensionStartAge : 0,
    pensionSurvivorPct: p.pensionSurvivorPct ?? 1,
    pensionHousing: !!p.pensionHousing,
    housing0: p.retHousing * toNominal,
    housingOn: p.retHousing > 0,
    minAgeStart: p.minAge + Y,
    spAgeStart: (mfj ? p.spAge : p.minAge) + Y,
    minRmdAge: rmdStartAge(TAX.year - p.minAge),
    spRmdAge: rmdStartAge(TAX.year - (mfj ? p.spAge : p.minAge)),
    drawOrder: p.drawOrder,
    convOn: p.convOn, convBracket: p.convBracket,
    convStopAge: p.convStopAge || rmdStartAge(TAX.year - p.minAge),
    convFromChurch: false,
    survivorOn: mfj && p.survivorOn, survivorYear: Math.max(0, Math.round(p.survivorYear) - 1),
    survivorSpendPct: p.survivorSpendPct,
    seniorExtended: p.seniorExtended,
    brokTaxDrag: p.brokTaxDrag
  };
}

/* =====================================================================
   MONTE CARLO
   ===================================================================== */
function makeRng(seed) {           // mulberry32 — deterministic for reproducible runs
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function normal(rng) { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function drawReturns(n, mean, vol, dist, rng) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    if (dist === 't5') {     // Student-t, 5 df, rescaled to unit variance → fatter tails
      const z = normal(rng); let chi = 0; for (let k = 0; k < 5; k++) { const x = normal(rng); chi += x * x; }
      out[i] = mean + vol * (z / Math.sqrt(chi / 5)) * Math.sqrt(3 / 5);
    } else out[i] = mean + vol * normal(rng);
    if (out[i] < -0.95) out[i] = -0.95;
  }
  return out;
}
function monteCarlo(start, P, opts, cfg = TAX) {
  const { trials = 1000, vol, dist = 'normal', seed = 12345 } = opts;
  const rng = makeRng(seed);
  const paths = [], finals = [], taxes = [];
  let ok = 0;
  for (let t = 0; t < trials; t++) {
    const rets = drawReturns(P.years, P.ret, vol, dist, rng);
    const res = runRetirement(start, P, rets, cfg);
    if (res.depletedYear === -1) ok++;
    const path = new Array(P.years).fill(0);
    res.rows.forEach((r, k) => { path[k] = r.endTotal; });
    if (res.depletedYear !== -1) path[res.rows.length - 1] = 0;
    paths.push(path); finals.push(res.finalBal); taxes.push(res.totalTax);
  }
  const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  const fan = { p10: [], p50: [], p90: [] };
  for (let y = 0; y < P.years; y++) {
    const col = paths.map(p => p[y]);
    fan.p10.push(pct(col, .10)); fan.p50.push(pct(col, .50)); fan.p90.push(pct(col, .90));
  }
  return {
    successRate: ok / trials,
    final: { p10: pct(finals, .10), p50: pct(finals, .50), p90: pct(finals, .90) },
    taxes: { p10: pct(taxes, .10), p50: pct(taxes, .50), p90: pct(taxes, .90) },
    fan
  };
}

/* =====================================================================
   Helpers + self-tests
   ===================================================================== */
function fmt(n) {
  if (!isFinite(n)) return '$0';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
  return s + '$' + Math.round(a).toLocaleString('en-US');
}

function cfg_state_swap(st){ const old = TAX.state; TAX.state = st; return old; }
function selfTests() {
  const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
  const T = [];
  const add = (name, got, want, tol) => T.push({ name, got, want, pass: near(got, want, tol) });

  add('SECA $100k, no deferral', ministerSECA(100000, 0).total, 100000 * .9235 * .153);
  add('SECA $300k hits SS cap', ministerSECA(300000, 0).total, 184500 * .124 + 277050 * .029);
  add('SECA excludes pre-tax 403(b)', ministerSECA(100000, 20000).seEarn, 80000 * .9235);
  add('Employee FICA $200k', employeeFICA(200000), 184500 * .062 + 200000 * .0145);
  add('Addl Medicare MFJ $300k', additionalMedicare(300000, 'MFJ'), 450);
  add('Fed bracket tax MFJ $100k taxable', bracketTax(100000, 'MFJ').tax, 2480 + 75200 * .12);
  add('Fed bracket tax Single $60k', bracketTax(60000, 'Single').tax, 1240 + 38000 * .12 + 9600 * .22);
  add('Fed tax MFJ AGI $132,200 (std ded)', fedIncomeTax(132200, 'MFJ', [45, 45], 2026).tax, 2480 + 75200 * .12);
  add('SS taxable: tier 2', taxableSS(40000, 30000, 'MFJ'), 11100);
  add('SS taxable: below base', taxableSS(30000, 10000, 'MFJ'), 0);
  add('SS taxable: capped at 85%', taxableSS(40000, 200000, 'MFJ'), 34000);
  add('Senior ded MFJ both 65, MAGI $180k (2026)', seniorDeduction(180000, 'MFJ', 2, 2026, false), 8400);
  add('Senior ded expired in 2029', seniorDeduction(100000, 'MFJ', 2, 2029, false), 0);
  add('RMD start age born 1959', rmdStartAge(1959), 73);
  add('RMD start age born 1981', rmdStartAge(1981), 75);
  add('RMD factor age 75', rmdFactor(75, 75), 24.6);
  add('No RMD before start age', rmdFactor(74, 75) === null ? 1 : 0, 1);
  add('Deferral limit age 61', deferralLimit(61), 35750);
  add('Deferral limit age 55', deferralLimit(55), 32500);
  add('Roth IRA allowed MFJ MAGI $247k age 40', rothIraAllowed(247000, 'MFJ', 40), 3750);
  add('MA tax MFJ $100k, $2k+$2k payroll ded', stateTax(100000, 'MFJ', [45, 45], 4000), (100000 - 4000 - 8800) * .05);
  add('Bracket top 22% MFJ ×1.1', bracketTop(.22, 'MFJ', 1.1), 211400 * 1.1);
  { const saved = cfg_state_swap(stateConfig('TX'));
    add('No-income-tax state (TX) → $0', stateTax(100000, 'MFJ', [45, 45], 4000), 0);
    cfg_state_swap(stateConfig('OH', 0.035, false));
    add('Flat-rate state 3.5% on $100k', stateTax(100000, 'MFJ', [45, 45], 0), 3500);
    cfg_state_swap(saved); }

  { const base = { status: 'MFJ', minAge: 45, spAge: 45, minComp: 80000, housingDesignated: 20000, housingActual: 20000, housingFRV: 20000,
      minPreTax: 0, minRoth403b: 0, minRothIRA: 0, spGross: 0, spPreTax: 0, spRoth401k: 0, spRothIRA: 0 };
    const t0 = computeToday(base), t1 = computeToday(Object.assign({}, base, { cashContrib: 1200, brokContrib: 2400 }));
    add('Cash + brokerage saving lowers take-home 1:1', t0.householdNet - t1.householdNet, 3600);
    const t2 = computeToday(Object.assign({}, base, { whMinFed: 500, estQuarterly: 0 }));
    add('Set-aside gap = tax due − 12 × withholding', t2.setAside.gap, t2.setAside.due - 6000); }
  { cfg_state_swap(stateConfig('MA'));
    add('529 MA joint deduction capped at $2,000', state529('MA', 'MFJ', 5000, 2, 0).ded, 2000);
    add('529 PA per-beneficiary ×2 kids', state529('PA', 'MFJ', 100000, 2, 0).ded, 76000);
    add('529 Indiana 20% credit, $1,500 max', state529('IN', 'MFJ', 10000, 1, 0).credit, 1500);
    const b = { status: 'MFJ', minAge: 45, spAge: 45, minComp: 80000, housingDesignated: 20000, housingActual: 20000, housingFRV: 20000,
      minPreTax: 0, minRoth403b: 0, minRothIRA: 0, spGross: 0, spPreTax: 0, spRoth401k: 0, spRothIRA: 0 };
    const a0 = computeToday(b), a1 = computeToday(Object.assign({}, b, { otherSEIncome: 10000 }));
    add('$10k honoraria adds SE tax of 15.3% × 92.35%', a1.seca.total - a0.seca.total, 10000 * 0.9235 * 0.153);
    add('Honoraria leave net advantage about the same (bracket effects only)', a1.netAdvantage - a0.netAdvantage, 0, 50);
    const g1 = computeToday(Object.assign({}, b, { cashGiving: 5000 }));
    add('Non-itemizer giving deduction $2,000 MFJ at 10%', a0.minScenario.fed.tax - g1.minScenario.fed.tax, 200);
    const e1 = computeToday(Object.assign({}, b, { contrib529: 3000, kids529: 1 }));
    add('MA 529: $2,000 deduction saves $100', e1.edu.saved, 100); }
  // Credits (2026)
  add("Saver's Credit 50% tier, $2,000 + $1,000 saved", fedCredits(40000, 5000, { status: 'MFJ', minPreTax: 3000, spPreTax: 1000 }, 50000).saver, 1500);
  add("Saver's Credit limited to tax owed", fedCredits(40000, 900, { status: 'MFJ', minPreTax: 3000, spPreTax: 1000 }, 50000).saver, 900);
  add("Saver's Credit 0% above $80,500 MFJ", fedCredits(80501, 5000, { status: 'MFJ', minPreTax: 3000 }, 90000).saver, 0);
  add('Child tax credit phase-out: $10,500 over → −$550', fedCredits(410500, 50000, { status: 'MFJ', kidsUnder17: 2 }, 400000).ctc, 3850);
  add('Refundable child credit capped at $1,700/child', fedCredits(30000, 0, { status: 'MFJ', kidsUnder17: 2 }, 30000).refundable, 3400);
  { const saved = cfg_state_swap(stateConfig('TX'));
    const b = { status: 'MFJ', minAge: 45, spAge: 45, minComp: 80000, housingDesignated: 20000, housingActual: 20000, housingFRV: 20000,
      minPreTax: 0, minRoth403b: 0, minRothIRA: 0, spGross: 40000, spPreTax: 2000, spRoth401k: 3000, spRothIRA: 0 };
    const nd = nextDollar(b), L = k => nd.lines.find(x => x.key === k);
    add('Minister pre-tax $1,000 also saves SE tax (14.13%)', L('minPre').payroll, 0.9235 * 0.153, 0.0005);
    add("Spouse pre-tax $1,000 saves no payroll tax", L('spPre').payroll, 0, 1e-9);
    add('Church salary rate = fed + SE tax', L('church').rate, L('church').fed + L('church').cred + 0.9235 * 0.153, 0.0005);
    add('Split at 12% bracket, 22% later → all Roth', bestSplit(b, 'sp', 0.22).pre, 0);
    add('Split at 12% bracket, 5% later → all pre-tax', bestSplit(b, 'sp', 0.05).pre, 5000);
    const hi = Object.assign({}, b, { minComp: 200000, spGross: 100000 });
    const need = preTaxToReach(hi, x => x.minScenario.fed.taxable, 211400);
    const after = computeToday(Object.assign({}, hi, { minPreTax: need.min, spPreTax: hi.spPreTax + need.sp, _fast: true })).minScenario.fed.taxable;
    { const pa = { status: 'MFJ', kidsUnder17: 2 }, line = fpl(4);   // $32,150 → cliff $128,600
      add('ACA: 400% FPL for 4 people (2026 coverage)', 4 * line, 128600);
      add('ACA: same income keeps the same credit', acaCredit(110000, 110000, 9000, pa).ptc, 9000, 0.01);
      add('ACA: +$1,000 at 300–400% FPL costs 9.96%', 9000 - acaCredit(111000, 110000, 9000, pa).ptc, 99.6, 0.01);
      add('ACA: $1 over the cliff ends the credit', acaCredit(128601, 110000, 9000, pa).ptc, 0); }
    add('Pre-tax solver lands at the bracket edge', after <= 211400 && after > 211300 ? 1 : 0, 1);
    cfg_state_swap(saved); }
  { const Pp = { years: 1, status: 'MFJ', startCalYear: 2046, scale0: 1, inflation: 0, ret: 0, spend0: 30000, ssMin0: 0, ssSp0: 0,
      pension0: 30000, pensionCOLA: false, pensionHousing: true, pensionStartAge: 0, housing0: 30000, housingOn: true,
      minAgeStart: 65, spAgeStart: 65, minRmdAge: 75, spRmdAge: 75, drawOrder: 'roth-first', convOn: false, survivorOn: false, survivorSpendPct: 1, seniorExtended: false, brokTaxDrag: 0 };
    const rp = runRetirement({ mChurch: 0, mTrad: 0, sTrad: 0, roth: 0, brok: 0 }, Pp, null);
    add('Church pension designated as housing → $0 tax', rp.totalTax, 0, 0.5);
    const rq = runRetirement({ mChurch: 0, mTrad: 0, sTrad: 0, roth: 0, brok: 0 }, Object.assign({}, Pp, { pensionStartAge: 70 }), null);
    add('Pension not paid before its start age → short', rq.depletedYear, 1); }
  // Engine: zero-return, no-tax sanity — Roth only, spend exactly drains balance
  const P0 = { years: 10, status: 'MFJ', startCalYear: 2046, scale0: 1, inflation: 0, ret: 0,
    spend0: 10000, ssMin0: 0, ssSp0: 0, pension0: 0, pensionCOLA: false, housing0: 0, housingOn: false,
    minAgeStart: 65, spAgeStart: 65, minRmdAge: 75, spRmdAge: 75, drawOrder: 'roth-first',
    convOn: false, convBracket: .12, convStopAge: 75, survivorOn: false, survivorYear: 0, survivorSpendPct: 1,
    seniorExtended: false, brokTaxDrag: 0 };
  const r0 = runRetirement({ mChurch: 0, mTrad: 0, sTrad: 0, roth: 100000, brok: 0 }, P0, null);
  add('Engine: $100k Roth, $10k/yr, 0% → lasts 10 yrs', r0.depletedYear, -1);
  add('Engine: …and ends at $0', r0.finalBal, 0, 0.5);
  const r1 = runRetirement({ mChurch: 0, mTrad: 0, sTrad: 0, roth: 99000, brok: 0 }, P0, null);
  add('Engine: $99k Roth depletes in yr 10', r1.depletedYear, 10);
  // Housing shield: church draw within allowance is tax-free
  const P1 = { ...P0, years: 1, housing0: 50000, housingOn: true, spend0: 40000 };
  const r2 = runRetirement({ mChurch: 100000, mTrad: 0, sTrad: 0, roth: 0, brok: 0 }, P1, null);
  add('Engine: $40k church draw under $50k allowance → $0 tax', r2.totalTax, 0);
  // Taxable draw solver: MFJ, both 65 in 2046 (senior ded expired), trad only, need $60k net
  const P2 = { ...P0, years: 1, spend0: 60000 };
  const r3 = runRetirement({ mChurch: 0, mTrad: 500000, sTrad: 0, roth: 0, brok: 0 }, P2, null);
  const row = r3.rows[0];
  add('Engine: gross draw − tax = net spend', row.otherTradDist - row.fedTax - row.stateTax, 60000, 0.5);
  add('FV zero-return guard (accumulate)', accumulate({ status: 'MFJ', yearsToRetire: 10, accReturn: 0, salaryGrowth: 0, churchPlanPct: 1,
    minTradBal: 1000, miscTradBal: 0, spTradBal: 0, minRothBal: 0, spRothBal: 0, miscRothBal: 0, brokerageBal: 0,
    minPreTax: 500, spPreTax: 0, minRoth403b: 0, minRothIRA: 0, spRoth401k: 0, spRothIRA: 0, brokTaxDrag: 0 }).end.mChurch, 6000);
  return T;
}

const API = { TAX, STATES, NO_WAGE_TAX, stateConfig, S529, state529, bracketTax, bracketTop, seniorDeduction, fedIncomeTax, taxableSS, ministerSECA, employeeFICA,
  additionalMedicare, stateTax, rmdStartAge, rmdFactor, deferralLimit, iraLimit, rothIraAllowed,
  computeToday, accumulate, runRetirement, yearTax, buildRetParams, monteCarlo, fmt, selfTests, sumB,
  fedCredits, saverRate, householdTax, deltaRate, bracketInfo, preTaxRoom, preTaxToReach, nextDollar, thresholds, bestSplit, fpl, acaCredit, acaApplicable };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
