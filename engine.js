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
function fedIncomeTax(agi, status, ages, calYear, scale = 1, seniorExtended = false, cfg = TAX) {
  const count65 = ages.filter(a => a >= 65).length;
  const ded = cfg.stdDed[status] * scale + count65 * cfg.addl65[status] * scale
            + seniorDeduction(agi, status, count65, calYear, seniorExtended, cfg);
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

  const seca = ministerSECA(p.minComp, p.minPreTax, cfg);
  const spFICA = employeeFICA(spGross, cfg);

  function ministerScenario(excl) {
    const addlMed = additionalMedicare(seca.seEarn + spGross, st, cfg);
    const seDed = seca.total / 2;                                         // §164(f)
    const minAGIpart = clamp0(p.minComp - excl - p.minPreTax - seDed);
    const spAGIpart = clamp0(spGross - spPre);
    const agi = minAGIpart + spAGIpart;
    const fed = fedIncomeTax(agi, st, ages, cfg.year, 1, false, cfg);
    const stInc = clamp0(p.minComp - (cfg.state.conformsTo107 ? excl : 0) - p.minPreTax) + spAGIpart;
    const stPayroll = Math.min(cfg.state.payrollDedCap, seca.total) + (mfj ? Math.min(cfg.state.payrollDedCap, spFICA) : 0);
    const stTax = stateTax(stInc, st, ages, stPayroll, 1, cfg);
    return { agi, minAGIpart, spAGIpart, fed, stTax, addlMed, seDed, incomeTax: fed.tax + stTax };
  }
  function w2Scenario() {
    const minFICA = employeeFICA(p.minComp, cfg);
    const addlMed = additionalMedicare(p.minComp + spGross, st, cfg);
    const agi = clamp0(p.minComp - p.minPreTax) + clamp0(spGross - spPre);
    const fed = fedIncomeTax(agi, st, ages, cfg.year, 1, false, cfg);
    const stPayroll = Math.min(cfg.state.payrollDedCap, minFICA) + (mfj ? Math.min(cfg.state.payrollDedCap, spFICA) : 0);
    const stTax = stateTax(agi, st, ages, stPayroll, 1, cfg);
    return { minFICA, addlMed, agi, fed, stTax, incomeTax: fed.tax + stTax };
  }

  const w2 = w2Scenario();
  const net = excl => {
    const m = ministerScenario(excl);
    const shield = w2.incomeTax - m.incomeTax;
    const extraPayroll = (seca.total + m.addlMed) - (w2.minFICA + w2.addlMed);
    return { m, shield, extraPayroll, net: shield - extraPayroll };
  };

  const cur = net(excludable);
  // Split shield: housing exclusion vs SE-tax deduction
  const noSEDed = (() => {
    const m = cur.m;
    const agi = m.agi + m.seDed;
    const fed = fedIncomeTax(agi, st, ages, cfg.year, 1, false, cfg);
    return fed.tax + m.stTax;
  })();
  const shieldSEDed = noSEDed - cur.m.incomeTax;
  const shieldHousing = cur.shield - shieldSEDed;

  // Break-even housing — binary search (net is monotonic in excl)
  let breakEven;
  if (net(0).net >= 0) breakEven = 0;
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
    gross: p.minComp,
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

  return {
    excludable, housingExcess, seca, spFICA, w2, minScenario: m,
    shield: cur.shield, shieldHousing, shieldSEDed, extraPayroll: cur.extraPayroll, netAdvantage: cur.net,
    seDeduction: m.seDed, breakEven, marginalFed: m.fed.marginal, minister, spouse,
    householdNet: minister.net + spouse.net, warnings,
    limits: { minDeferral: minDefLim, spDeferral: mfj ? deferralLimit(p.spAge, cfg) : 0 }
  };
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
    b.brok    = b.brok    * (1 + r * (1 - p.brokTaxDrag));
    contributed.pre += minPre + spPre; contributed.roth += rothC;
    path.push({ year: y, ...b, total: sumB(b) });
  }
  return { end: { ...b }, path, contributed };
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
      hAllow = 0;                                                   // §107 ends with the minister
    }
    const ages = status === 'MFJ' ? [mAge, sAge] : [ministerAlive ? mAge : sAge];
    const housingOn = ministerAlive && P.housingOn;
    const allow = housingOn ? hAllow : 0;

    const ss = ssMin + ssSp;
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
    const taxOf = pl => yearTax(pl, { ss, pension, allow, status, ages, calYear, scale, seniorExt: P.seniorExtended }, cfg);
    const cashOf = pl => ss + pension + pl.churchDist + pl.otherTradDist + pl.rothDist + pl.brokDist;
    const needOf = pl => spend + taxOf(pl).total - cashOf(pl);

    // 3. Housing-shielded church draw (tax-free portion), limited to need
    let need = needOf(plan);
    if (need > 0 && allow > plan.churchDist) {
      const h = Math.min(need, allow - plan.churchDist, b.mChurch);
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
      spend, ss, pension,
      rmd: rmdC + rmdM + rmdS, housingExcluded: Math.min(allow, plan.churchDist),
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
  const excluded = Math.min(ctx.allow, pl.churchDist);                     // §107 parsonage exclusion
  const ordinary = pl.churchDist - excluded + pl.otherTradDist + pl.conv + ctx.pension;
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

const API = { TAX, STATES, NO_WAGE_TAX, stateConfig, bracketTax, bracketTop, seniorDeduction, fedIncomeTax, taxableSS, ministerSECA, employeeFICA,
  additionalMedicare, stateTax, rmdStartAge, rmdFactor, deferralLimit, iraLimit, rothIraAllowed,
  computeToday, accumulate, runRetirement, yearTax, buildRetParams, monteCarlo, fmt, selfTests, sumB };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.Engine = API;
})(typeof window !== 'undefined' ? window : globalThis);
