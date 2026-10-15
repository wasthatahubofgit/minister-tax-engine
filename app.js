(function(){
'use strict';

const E = window.Engine;
const $ = id => document.getElementById(id);
const fmt = E.fmt;
const pctf = x => (x * 100).toFixed(0) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- Inputs ---------- */
// pct: shown as %, stored as fraction
const FIELDS = {
  minAge:45, spAge:45, state:{v:'MA',sel:1}, stateRate:{v:4.5,pct:1}, stateTaxesSS:{v:false,bool:1}, minComp:109295, housingDesignated:40032, housingActual:40032, housingFRV:40032,
  minPreTax:0, minRoth403b:0, minRothIRA:0, spGross:66039, spPreTax:0, spRoth401k:0, spRothIRA:0,
  yearsToRetire:20, accReturn:{v:7,pct:1}, salaryGrowth:{v:0,pct:1},
  minTradBal:50000, churchPlanPct:{v:100,pct:1}, minRothBal:10000, spTradBal:25000, spRothBal:5000,
  miscTradBal:15000, miscRothBal:0, brokerageBal:0, brokContrib:0, cashBal:5000, cashContrib:0, cashRate:{v:3,pct:1},
  whMinFed:0, whMinState:0, whSpFed:0, whSpState:0, estQuarterly:0, lastYearTax:0,
  otherSEIncome:0, otherSEExpenses:0, mortgageInterest:0, bal529:0, contrib529:0, kids529:1, yrsToCollege:10, limit529:0,
  pensionStartAge:0, pensionSurvivorPct:{v:50,pct:1}, pensionHousing:{v:true,bool:1},
  todaysDollars:{v:true,bool:1}, retSpend:120000, retHousing:40000, ssMin:27000, ssSp:18000, pension:0,
  pensionCOLA:{v:false,bool:1}, retYears:30, retReturn:{v:5,pct:1}, retVol:{v:12,pct:1}, inflation:{v:2.5,pct:1},
  dist:{v:'normal',sel:1}, brokTaxDrag:{v:15,pct:1}, drawOrder:{v:'roth-first',sel:1},
  convOn:{v:false,bool:1}, convBracket:{v:'0.22',sel:1}, survivorOn:{v:false,bool:1}, survivorYear:15,
  survivorSpendPct:{v:80,pct:1}, seniorExtended:{v:false,bool:1}
};
const spec = k => (typeof FIELDS[k] === 'object' ? FIELDS[k] : { v: FIELDS[k] });
let status = 'MFJ';
// Values that live outside ordinary inputs (budget lines, budget level, housing link)
const VS = { budget: {}, budgetMode: 'standard', linkHousing: true, budgetExample: false };
// Example monthly budget that goes with the example numbers (replaced as soon as someone enters their own)
const EXAMPLE_BUDGET = { h_rent: 2600, h_util: 350, h_ins: 120, h_tax: 450, h_furn: 100, h_repair: 150, g_church: 1500, g_other: 200,
  f_groc: 1100, f_dine: 300, t_car: 400, t_fuel: 200, t_ins: 150, t_maint: 80, k_care: 800, k_act: 150, m_prem: 500, m_oop: 150, m_life: 60,
  d_student: 300, p_phone: 150, p_subs: 60, p_cloth: 150, p_care: 60, p_house: 120, o_gifts: 100, o_travel: 250, o_ministry: 50, o_misc: 200 };
const housingBudgetMo = () => Object.entries(VS.budget).filter(([k]) => k.startsWith('h_')).reduce((a, [, v]) => a + (+v || 0), 0);
const budgetMo = () => Object.values(VS.budget).reduce((a, v) => a + (+v || 0), 0);

function setInputs(vals){
  for (const k of Object.keys(FIELDS)) {
    const el = $(k); if (!el) continue;
    const s = spec(k); const v = (vals && k in vals) ? vals[k] : s.v;
    if (s.bool) el.checked = !!v; else el.value = v;
  }
  setStatus(vals && vals.__status ? vals.__status : 'MFJ', true);
  VS.budget = JSON.parse(JSON.stringify(vals && vals.budget ? vals.budget : (vals ? {} : EXAMPLE_BUDGET)));
  VS.budgetMode = vals && vals.budgetMode || 'standard';
  VS.budgetExample = !vals ? true : !!vals.budgetExample;
  VS.linkHousing = vals && 'linkHousing' in vals ? !!vals.linkHousing : true;
  if ($('linkHousing')) $('linkHousing').checked = VS.linkHousing;
  if (window.App && App.renderBudget) App.renderBudget();
}
function rawInputs(){
  const o = { __status: status, budget: JSON.parse(JSON.stringify(VS.budget)), budgetMode: VS.budgetMode, linkHousing: VS.linkHousing, budgetExample: VS.budgetExample };
  for (const k of Object.keys(FIELDS)) { const el = $(k); const s = spec(k);
    o[k] = s.bool ? el.checked : (s.sel ? el.value : (parseFloat(el.value) || 0)); }
  return o;
}
function readParams(){
  const raw = rawInputs(); const p = { status };
  for (const k of Object.keys(FIELDS)) { const s = spec(k); p[k] = s.pct ? raw[k] / 100 : raw[k]; }
  p.convBracket = parseFloat(raw.convBracket);
  p.convStopAge = 0;
  applyHousingLink(p);
  p.cashGiving = Object.entries(VS.budget).filter(([k]) => k.startsWith('g_')).reduce((a, [, v]) => a + (+v || 0), 0) * 12;
  return p;
}
function applyHousingLink(p){
  const h = housingBudgetMo(), on = VS.linkHousing && h > 0, el = $('housingActual');
  if (on) { p.housingActual = h * 12; if (el) { el.value = Math.round(h * 12); } }
  if (el) { el.readOnly = on; el.closest('.field').classList.toggle('linked', on);
    const sm = el.closest('.field').querySelector('small'); if (sm) sm.textContent = on ? "From your budget's housing lines" : 'Mortgage/rent, utilities, furnishings'; }
  return p;
}
function setStatus(s, silent){
  status = s;
  $('stMFJ').setAttribute('aria-pressed', s === 'MFJ'); $('stSingle').setAttribute('aria-pressed', s === 'Single');
  document.querySelectorAll('.spouse-only').forEach(el => el.hidden = s !== 'MFJ');
  if (!silent) schedule();
}
$('stMFJ').onclick = () => setStatus('MFJ');
$('stSingle').onclick = () => setStatus('Single');

/* ---------- Tabs ---------- */
function showTab(name){
  if (name === 'today') name = 'home';
  if (document.body.classList.contains('simple') && (name === 'years' || name === 'rules')) name = 'home';
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === name));
  document.querySelectorAll('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== name);
  store.set('mtw.tab', name);
  if (last) requestAnimationFrame(() => drawCharts(last));
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));

/* ---------- Tax law editor ---------- */
const TAXDEF = JSON.parse(JSON.stringify(E.TAX, (k, v) => v === Infinity ? 'INF' : v));
const TAXFIELDS = [
  ['Standard deduction (MFJ)', t => t.stdDed.MFJ, (t,v) => t.stdDed.MFJ = v],
  ['Standard deduction (Single)', t => t.stdDed.Single, (t,v) => t.stdDed.Single = v],
  ['Top of 10% bracket (MFJ)', t => t.brackets.MFJ[0][0], (t,v) => t.brackets.MFJ[0][0] = v],
  ['Top of 12% bracket (MFJ)', t => t.brackets.MFJ[1][0], (t,v) => t.brackets.MFJ[1][0] = v],
  ['Top of 22% bracket (MFJ)', t => t.brackets.MFJ[2][0], (t,v) => t.brackets.MFJ[2][0] = v],
  ['Top of 24% bracket (MFJ)', t => t.brackets.MFJ[3][0], (t,v) => t.brackets.MFJ[3][0] = v],
  ['Social Security wage base', t => t.ssWageBase, (t,v) => t.ssWageBase = v],
  ['403(b)/401(k) deferral limit', t => t.limits.deferral, (t,v) => t.limits.deferral = v],
  ['IRA limit', t => t.limits.ira, (t,v) => t.limits.ira = v]
];
function buildTaxFields(){
  $('taxFields').innerHTML = TAXFIELDS.map(([l, g, , st], i) =>
    `<div class="field"><label for="tx${i}">${esc(l)}</label><input type="number" id="tx${i}" step="${st||100}" value="${g(E.TAX)}"></div>`).join('');
  TAXFIELDS.forEach(([, , s], i) => $('tx' + i).addEventListener('change', e => { s(E.TAX, parseFloat(e.target.value) || 0); saveTax(); schedule(); }));
}
function saveTax(){ store.set('mtw.tax', TAXFIELDS.map(([, g]) => g(E.TAX))); }
function loadTax(){ const v = store.get('mtw.tax', null); if (Array.isArray(v)) TAXFIELDS.forEach(([, , s], i) => { if (typeof v[i] === 'number') s(E.TAX, v[i]); }); }
$('btnTaxReset').onclick = () => {
  const d = JSON.parse(JSON.stringify(TAXDEF), (k, v) => v === 'INF' ? Infinity : v);
  Object.keys(d).forEach(k => E.TAX[k] = d[k]); store.set('mtw.tax', null); buildTaxFields(); schedule();
};

/* ---------- Compute ---------- */
let last = null, timer = null;
let pendingFast = false;
function schedule(fast){ clearTimeout(timer); pendingFast = !!fast; timer = setTimeout(() => recalc(pendingFast), fast ? 40 : 200); }
const NOCALC = /^(tx\d+|scenName|aiKey|chatInput|learnSearch|wz|demo|sl-|aEmail|aPass|vP|nPw|nVp|b_|pl-|linkHousing)/;
document.addEventListener('input', e => { const t = e.target; if (t.matches('input,select') && t.type !== 'range' && !NOCALC.test(t.id || 'x') && !t.closest('.wizard')) schedule(); });
document.addEventListener('change', e => { const t = e.target; if (t.matches('input[type=checkbox],select') && A_FIELD(t.id)) schedule(); });
function A_FIELD(id){ return Object.prototype.hasOwnProperty.call(FIELDS, id); }

function compute(p, trials = 1000){
  E.TAX.state = E.stateConfig(p.state, p.stateRate, p.stateTaxesSS);
  const today = E.computeToday(p);
  const acc = E.accumulate(p);
  const P = E.buildRetParams(p);
  const ret = E.runRetirement(acc.end, P, null);
  const mc = E.monteCarlo(acc.end, P, { trials, vol: p.retVol, dist: p.dist, seed: 20261013 });
  return { p, today, acc, P, ret, mc };
}
const renderHooks = [];
function recalc(fast){
  const p = readParams();
  store.set('mtw.inputs', rawInputs());
  syncStateUI();
  try { last = compute(p, fast ? 250 : 1000); } catch (err) { console.error(err); return; }
  last.fast = !!fast;
  renderAll(last);
  renderScen();
  renderHooks.forEach(f => { try { f(last); } catch (e) { console.error(e); } });
}
function syncStateUI(){
  const code = $('state').value, mode = code === 'MA' ? 'full' : E.NO_WAGE_TAX.includes(code) ? 'none' : 'flat';
  document.querySelectorAll('.state-flat').forEach(el => el.hidden = mode !== 'flat');
  $('stateNote').textContent = mode === 'full' ? 'Full Massachusetts rules: 5% flat, 4% surtax, Social Security exempt.'
    : mode === 'none' ? 'No state tax on wages or retirement income.' : 'Enter your state\'s approximate income tax rate.';
}

/* ---------- Render ---------- */
const kpi = (label, value, sub, tone) => `<div class="kpi ${tone||''}"><span class="l">${label}</span><span class="v">${value}</span>${sub?`<span class="s">${sub}</span>`:''}</div>`;
const lastsText = r => r.ret.depletedYear === -1 ? `${r.P.years}+ yrs` : `${r.ret.depletedYear} yrs`;

function renderAll(r){
  const t = r.today, ret = r.ret, mc = r.mc;
  const succ = mc.successRate;
  const tone = succ >= .9 ? 'good' : succ >= .75 ? 'warn' : 'bad';

  // Warnings
  document.querySelectorAll('.field.flag').forEach(f => f.classList.remove('flag'));
  t.warnings.forEach(w => { const el = $(w.field); if (el) el.closest('.field').classList.add('flag'); });
  $('warnings').innerHTML = t.warnings.map(w => `<div class="warn-item">${esc(w.msg)}</div>`).join('');

  renderToday(r); renderGrow(r); renderRetire(r); renderYears(r); renderAssumptions(r);
  drawCharts(r);
}

function renderToday(r){
  const t = r.today, p = r.p;
  const be = t.breakEven;
  $('todayKpis').innerHTML =
    kpi('Net advantage vs W-2', (t.netAdvantage >= 0 ? '+' : '') + fmt(t.netAdvantage), 'Income-tax shield minus extra payroll tax', t.netAdvantage >= 0 ? 'good' : 'bad') +
    kpi('Excludable housing', fmt(t.excludable), t.housingExcess > 0 ? `${fmt(t.housingExcess)} of designation is taxable` : 'Lesser of designated, actual, fair rental', t.housingExcess > 0 ? 'warn' : '') +
    kpi('Break-even housing', be === null ? 'N/A' : fmt(be), be === null ? 'SECA exceeds any shield' : (t.excludable >= be ? 'You are above it' : 'You are below it'), be !== null && t.excludable >= be ? 'good' : 'warn') +
    kpi('Marginal bracket', `${Math.round(t.marginalFed * 100)}% + ${(E.TAX.state.rate * 100).toFixed(1)}%`, 'Federal + ' + esc(E.TAX.state.name));

  const w2 = t.w2, m = t.minScenario;
  $('dualTable').innerHTML = `
    <tr><th>Item</th><th class="r">Minister</th><th class="r">W-2 baseline</th></tr>
    <tr><td>Federal income tax</td><td class="r">${fmt(m.fed.tax)}</td><td class="r">${fmt(w2.fed.tax)}</td></tr>
    <tr><td>${esc(E.TAX.state.name)} income tax</td><td class="r">${fmt(m.stTax)}</td><td class="r">${fmt(w2.stTax)}</td></tr>
    <tr><td>Minister payroll tax <span class="cite">SECA vs FICA</span></td><td class="r">${fmt(t.seca.total)}</td><td class="r">${fmt(w2.minFICA)}</td></tr>
    <tr><td>Additional Medicare 0.9%</td><td class="r">${fmt(m.addlMed)}</td><td class="r">${fmt(w2.addlMed)}</td></tr>
    <tr><td>Shield from housing exclusion</td><td class="r pos">${fmt(t.shieldHousing)}</td><td class="r muted">–</td></tr>
    <tr><td>Shield from ½-SECA deduction</td><td class="r pos">${fmt(t.shieldSEDed)}</td><td class="r muted">–</td></tr>
    <tr><td>Extra payroll tax</td><td class="r neg">−${fmt(t.extraPayroll)}</td><td class="r muted">–</td></tr>
    <tr class="total"><td>Net advantage</td><td class="r ${t.netAdvantage>=0?'pos':'neg'}">${t.netAdvantage>=0?'+':''}${fmt(t.netAdvantage)}</td><td></td></tr>`;
  $('breakEvenNote').textContent = be === null
    ? 'Even excluding all compensation, the income-tax shield would not cover the extra self-employment tax.'
    : `Excluding at least ${fmt(be)} of housing covers the extra self-employment tax. Your excludable amount is ${fmt(t.excludable)}.`;

  const s = t.seca;
  $('secaTable').innerHTML = `
    <tr><td>Compensation incl. housing, less pre-tax 403(b)</td><td class="r">${fmt(p.minComp - p.minPreTax)}</td></tr>
    <tr><td>Net SE earnings × 92.35%</td><td class="r">${fmt(s.seEarn)}</td></tr>
    <tr><td>Social Security 12.4% (to ${fmt(E.TAX.ssWageBase)})</td><td class="r">${fmt(s.ss)}</td></tr>
    <tr><td>Medicare 2.9% (no cap)</td><td class="r">${fmt(s.med)}</td></tr>
    <tr class="total"><td>SECA total</td><td class="r">${fmt(s.total)}</td></tr>
    <tr><td>Deductible half (above the line)</td><td class="r">${fmt(t.seDeduction)}</td></tr>`;

  const mi = t.minister, sp = t.spouse, mfj = r.p.status === 'MFJ';
  const row = (l, a, b, neg0) => { const neg = neg0 && (a + b) >= 0.5; return `<tr><td>${l}</td><td class="r ${neg?'neg':''}">${neg?'−':''}${fmt(a)}</td>${mfj?`<td class="r ${neg?'neg':''}">${neg?'−':''}${fmt(b)}</td>`:''}<td class="r ${neg?'neg':''}">${neg?'−':''}${fmt(a+b)}</td></tr>`; };
  $('cashTable').innerHTML = `<tr><th></th><th class="r">Minister</th>${mfj?'<th class="r">Spouse</th>':''}<th class="r">Total</th></tr>` +
    row('Gross pay', mi.gross, sp.gross) + row('Payroll tax (SECA / FICA)', mi.payroll, sp.payroll, 1) +
    row('Income tax (fed + MA)', mi.incomeTax, sp.incomeTax, 1) + row('Pre-tax savings', mi.preTax, sp.preTax, 1) +
    row('Roth savings', mi.roth, sp.roth, 1) +
    `<tr class="total"><td>Take-home</td><td class="r">${fmt(mi.net)}</td>${mfj?`<td class="r">${fmt(sp.net)}</td>`:''}<td class="r">${fmt(t.takeHome)}</td></tr>` +
    `<tr><td>Cash &amp; brokerage saving</td>${mfj?'<td></td>':''}<td></td><td class="r ${t.otherSaving>=0.5?'neg':''}">${t.otherSaving>=0.5?'−':''}${fmt(t.otherSaving)}</td></tr>` +
    `<tr class="total"><td>Left for spending &amp; giving</td>${mfj?'<td></td>':''}<td></td><td class="r">${fmt(t.householdNet)}</td></tr>` +
    `<tr><td class="muted">Per month</td>${mfj?'<td></td>':''}<td></td><td class="r">${fmt(t.householdNet/12)}</td></tr>`;
  renderSetAside(r); renderOtherIncome(r);
}

function renderOtherIncome(r){
  const el = $('otherIncomeOut'); if (!el) return;
  const t = r.today, net = t.otherNet;
  if (!(net > 0)) { el.innerHTML = '<p class="small muted" style="margin:0">Add expected speaking, wedding, funeral or writing income on the left to see what to set aside from it.</p>'; return; }
  const p0 = Object.assign({}, r.p, { otherSEIncome: 0, otherSEExpenses: 0 });
  const t0 = E.computeToday(p0);
  const extra = t.setAside.due - t0.setAside.due, pct = extra / net;
  const sepMax = Math.max(0, (net - t.otherSECA / 2) * 0.2);
  const today = new Date().toISOString().slice(0, 10), next = t.setAside.dueDates.find(d => d >= today);
  const d = s => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  el.innerHTML = `<div class="setaside">
    ${'<div class="mini-kpis"><div><span class="eyebrow">Expected this year</span><b>' + fmt(net) + '</b></div><div><span class="eyebrow">Tax on it</span><b>' + fmt(extra) + '</b></div><div><span class="eyebrow">Set aside from each payment</span><b style="color:var(--accent)">' + Math.round(pct * 100) + '%</b></div></div>'}
    <p class="small" style="margin:0">That includes ${fmt(t.otherSECA)} of self-employment tax plus income tax. Pick one way to handle it:</p>
    <ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
      <li><strong>Raise church withholding</strong> by about ${fmt(extra / 12)}/mo. Withholding counts as paid evenly through the year, so it covers irregular income without quarterly deadlines.</li>
      <li><strong>Hold it in a high-yield savings account.</strong> Move ${Math.round(pct * 100)}% of each payment into a separate "tax" account, earn interest, and pay from it.</li>
      <li><strong>Send quarterly payments</strong> of about ${fmt(extra / 4)} with Form 1040-ES${next ? `; next due ${d(next)}` : ''}.</li>
      ${net >= 5000 ? `<li><strong>Consider a SEP-IRA or solo 401(k)</strong> for this income. Saving up to about ${fmt(sepMax)} there lowers income tax (not self-employment tax).</li>` : ''}
    </ol>
    <p class="small muted" style="margin:0">Keep receipts for travel and costs; only income after expenses is taxed.</p></div>`;
}
function renderSetAside(r){
  const a = r.today.setAside, owe = a.gap > 0;
  const today = new Date().toISOString().slice(0, 10);
  const next = a.dueDates.find(d => d >= today);
  const dateTxt = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  $('setAsideOut').innerHTML = `<div class="setaside">
    <div class="mini-kpis"><div><span class="eyebrow">Tax for the year</span><b>${fmt(a.due)}</b></div><div><span class="eyebrow">Set aside</span><b>${fmt(a.set)}</b></div>
      <div><span class="eyebrow">${owe ? 'Likely owed in April' : 'Likely refund'}</span><b style="color:var(--${owe ? 'bad' : 'good'})">${fmt(Math.abs(a.gap))}</b></div></div>
    <p class="small" style="margin:0">${owe ? (a.safe ? '<span class="status-pill warn">Owe, but likely no penalty</span>' : '<span class="status-pill bad">Under-withheld</span>') : '<span class="status-pill good">Covered</span>'}
      Includes federal income tax, ${fmt(r.today.seca.total)} self-employment tax and ${esc(E.TAX.state.name)} tax.</p>
    ${owe ? `<p class="small" style="margin:0">To cover it, ask the church for about <strong>${fmt(a.churchFedMonthly)}/mo</strong> in voluntary federal withholding${a.churchStateMonthly >= 1 ? ` and <strong>${fmt(a.churchStateMonthly)}/mo</strong> state` : ''}, or pay about <strong>${fmt(a.quarterlyNeeded)}</strong> each quarter.</p>` : ''}
    <div class="duedates">${a.dueDates.map((d, i) => `<div class="${d < today ? 'past' : ''}"><span class="muted">Q${i + 1}${d === next ? ' · next' : ''}</span><b>${dateTxt(d)}</b></div>`).join('')}</div>
    <p class="small muted" style="margin:0">Estimate only. Underpayment penalties are generally avoided if you owe less than $1,000, or set aside at least 90% of this year's tax or 100% of last year's (110% above $150,000 of income).</p></div>`;
}
function renderGrow(r){
  { const e = r.today.edu, code = E.TAX.state.code, rule = E.S529[code] || {}, nm = E.TAX.state.name;
    $('note529').textContent = r.p.limit529 > 0 ? `Using your limit of ${fmt(r.p.limit529)} a year.`
      : rule.x ? `${nm} gives no state tax break for 529 contributions.` : rule.u ? `${nm}'s 529 rules aren't built in yet. Enter your state's deduction limit to include it.`
      : rule.full ? `${nm} lets you deduct all 529 contributions (estimate; check your state's plan rules).`
      : rule.c ? `${nm} gives a tax credit, up to ${fmt(e.limit)} a year at your filing status (estimate; often only for the in-state plan).`
      : `${nm} lets you deduct up to ${fmt(e.limit)} a year${rule.pb ? ` (${fmt(e.limit / Math.max(1, Math.round(r.p.kids529 || 1)))} per child)` : ''}. Estimate: many states require their own plan, and some have income limits.`; }
  const e = r.acc.end, total = E.sumB(e), Y = Math.round(r.p.yearsToRetire);
  const real = total / Math.pow(1 + r.p.inflation, Y);
  $('growKpis').innerHTML =
    kpi('At retirement', fmt(total), `${fmt(real)} in today's dollars`) +
    kpi('Traditional', fmt(e.mChurch + e.mTrad + e.sTrad), `${fmt(e.mChurch)} housing-eligible`) +
    kpi('Roth', fmt(e.roth), 'Tax-free, no RMDs') +
    kpi('Contributed', fmt(r.acc.contributed.pre + r.acc.contributed.roth + (r.acc.contributed.brok || 0)), `${fmt(r.acc.contributed.pre)} pre-tax`) +
    (() => { const mo = budgetMo() > 0 ? budgetMo() : r.today.householdNet / 12; const m = mo > 0 ? r.p.cashBal / mo : 0;
      const edu = r.today.edu, yc = Math.round(r.p.yrsToCollege);
      const k529 = (r.p.contrib529 > 0 || r.p.bal529 > 0) ? kpi('College (529)', fmt(r.acc.edu529End / Math.pow(1 + r.p.inflation, yc)), `in ${yc} yrs, today's dollars · state tax saved ${fmt(edu.saved)}/yr`, '') : '';
      return k529 + kpi('Emergency fund', `${m.toFixed(1)} mo`, `${fmt(r.p.cashBal)} covers ${m.toFixed(1)} months of ${budgetMo() > 0 ? 'budgeted spending' : 'spending'}`, m >= 3 ? 'good' : m >= 1 ? 'warn' : 'bad'); })();
  $('growTable').innerHTML = `<tr><th>Bucket</th><th class="r">Today</th><th class="r">At retirement</th></tr>` +
    [['Minister church plan (housing-eligible)','mChurch'],['Other Traditional','mTrad'],['Spouse Traditional','sTrad'],['Roth (all)','roth'],['Taxable brokerage','brok']]
      .map(([l,k]) => `<tr><td>${l}</td><td class="r">${fmt(r.acc.path[0][k])}</td><td class="r">${fmt(e[k])}</td></tr>`).join('') +
    `<tr class="total"><td>Total</td><td class="r">${fmt(r.acc.path[0].total)}</td><td class="r">${fmt(total)}</td></tr>`;
}

function renderRetire(r){
  const ret = r.ret, mc = r.mc, P = r.P;
  const nowF = 1 / P.scale0;
  const lastRow = ret.rows[ret.rows.length - 1];
  const legacyReal = ret.finalBal * (lastRow ? lastRow.realFactor : 1);
  const succ = mc.successRate;
  $('retKpis').innerHTML =
    kpi('Static plan lasts', lastsText(r), ret.depletedYear === -1 ? 'Flat returns, full horizon' : `Short in year ${ret.depletedYear} (age ${P.minAgeStart + ret.depletedYear - 1})`, ret.depletedYear === -1 ? 'good' : 'bad') +
    kpi('Monte Carlo success', pctf(succ), `Median ending ${fmt(mc.final.p50)}`, succ >= .9 ? 'good' : succ >= .75 ? 'warn' : 'bad') +
    kpi('Lifetime retirement taxes', fmt(ret.totalTax), `RMDs ${fmt(ret.taxBy.rmd)} · conversions ${fmt(ret.taxBy.conversion)}`, 'bad') +
    kpi('Legacy', fmt(ret.finalBal), `${fmt(legacyReal)} in today's dollars`);
  $('taxTotalLbl').textContent = `${fmt(ret.totalTax)} total` + (ret.totalConverted ? ` · ${fmt(ret.totalConverted)} converted` : '');

  const y = ret.rows[0];
  if (!y) { $('y1Flow').innerHTML = ''; return; }
  $('y1Label').textContent = `${y.calYear} · age ${y.mAge}${r.p.status==='MFJ'?' / '+y.sAge:''} · nominal`;
  const exclPension = Math.min(y.allow || 0, y.pensElig || 0), exclChurch = Math.max(0, y.housingExcluded - exclPension);
  const taxableTrad = y.churchDist - exclChurch + y.otherTradDist;
  const items = [
    ['Social Security & pension', y.ss + y.pension, 'var(--c-fixed)'],
    ['Church plan, housing-excluded (tax-free)', exclChurch, 'var(--c-church)'],
    ['Roth withdrawals (tax-free)', y.rothDist, 'var(--c-roth)'],
    ['Brokerage withdrawals', y.brokDist, 'var(--c-brok)'],
    ['Taxable Traditional (incl. RMD ' + fmt(y.rmd) + ')', taxableTrad, 'var(--c-draw)'],
  ];
  const gross = items.reduce((a, [, v]) => a + v, 0) || 1;
  $('y1Flow').innerHTML = items.map(([l, v, c]) => `<div class="flow-row"><span>${l}</span><span class="num">${fmt(v)}</span><div class="meter"><i style="width:${(v/gross*100).toFixed(1)}%;background:${c}"></i></div></div>`).join('') +
    `<table class="ledger" style="margin-top:6px">
      ${exclPension > 0 ? `<tr><td class="muted">Of the pension, tax-free as housing allowance</td><td class="r muted">${fmt(exclPension)}</td></tr>` : ''}
      <tr><td>Gross cash in</td><td class="r">${fmt(gross)}</td></tr>
      <tr><td>Federal tax (taxable SS ${fmt(y.taxableSS)})</td><td class="r neg">${y.fedTax>=0.5?'−':''}${fmt(y.fedTax)}</td></tr>
      <tr><td>${esc(E.TAX.state.name)} tax</td><td class="r neg">${y.stateTax>=0.5?'−':''}${fmt(y.stateTax)}</td></tr>
      ${y.conv ? `<tr><td>Roth conversion (taxed, stays invested)</td><td class="r">${fmt(y.conv)}</td></tr>` : ''}
      ${y.surplus > 1 ? `<tr><td>Surplus reinvested in brokerage</td><td class="r">${fmt(y.surplus)}</td></tr>` : ''}
      <tr class="total"><td>Spending target</td><td class="r">${fmt(y.spend)}</td></tr>
      <tr><td class="muted">Same target in today's dollars</td><td class="r muted">${fmt(y.spend * nowF)}</td></tr>
    </table>`;
}

function renderYears(r){
  const mfj = r.p.status === 'MFJ';
  const head = ['Yr','Year','Age','Spend','SS + pension','RMD','Housing-free','Taxable trad','Roth draw','Brokerage','Conversion','Fed tax','State tax','End balance',"End (today's $)"];
  const rows = r.ret.rows.map(y => [
    y.i, y.calYear, mfj ? `${y.mAge}/${y.sAge}` : y.mAge, fmt(y.spend), fmt(y.ss + y.pension), fmt(y.rmd), fmt(y.housingExcluded),
    fmt(y.churchDist - Math.max(0, y.housingExcluded - Math.min(y.allow || 0, y.pensElig || 0)) + y.otherTradDist), fmt(y.rothDist), fmt(y.brokDist), fmt(y.conv), fmt(y.fedTax), fmt(y.stateTax),
    y.shortfall ? `<span class="neg">Short ${fmt(y.shortfall)}</span>` : fmt(y.endTotal), fmt(y.endTotal * y.realFactor)]);
  $('yearTable').innerHTML = `<tr>${head.map((h,i)=>`<th class="${i>2?'r':''}">${h}</th>`).join('')}</tr>` +
    rows.map(c => `<tr>${c.map((v,i)=>`<td class="${i>2?'r':''}">${v}</td>`).join('')}</tr>`).join('');
}

function renderAssumptions(r){
  const P = r.P;
  const list = [
    `Retirement starts in ${P.startCalYear}. Minister RMDs begin at ${P.minRmdAge}${r.p.status==='MFJ' ? `, spouse at ${P.spRmdAge}` : ''} (SECURE 2.0: 75 if born 1960 or later).`,
    r.p.todaysDollars ? `Spending, Social Security, pension and housing inputs are in today's dollars, inflated ${(r.p.inflation*100).toFixed(1)}% a year to ${P.startCalYear}.` : 'Retirement inputs are taken as first-year (nominal) dollars.',
    'Federal brackets and standard deductions are indexed by your inflation input from 2026 values. Social Security taxability thresholds and the 0.9% Medicare thresholds are fixed by statute and not indexed.',
    `The $6,000 per-person senior deduction applies only through 2028${r.p.seniorExtended ? ' (you chose to assume an extension)' : ''}.`,
    'The housing exclusion in retirement applies only to distributions from the church-plan share of the minister’s 403(b), up to the allowance each year. It ends when the minister dies.',
    'Pre-tax 403(b) deferrals are excluded from the minister’s SE earnings (Pub. 517); Roth 403(b) deferrals and the housing allowance are included. Unreimbursed ministry expenses and the Deason allocation are not modeled.',
    'The W-2 baseline is the same pay with employee FICA and no housing exclusion. Ministers cannot elect this; it measures the dual-status trade-off.',
    E.TAX.state.mode === 'full' ? 'Massachusetts: 5% flat, 4% surtax over the threshold, Social Security exempt, payroll/SE tax deduction capped at $2,000 per person, personal exemptions, $700 per person 65+. Plan deferrals excluded, distributions taxed.'
      : E.TAX.state.mode === 'none' ? `${E.TAX.state.name} has no state income tax on wages or retirement income.`
      : `${E.TAX.state.name}: modeled as a flat ${(E.TAX.state.rate*100).toFixed(1)}% on income after the housing exclusion and plan deferrals; Social Security ${E.TAX.state.ssExempt ? 'not taxed' : 'taxed'}. Real state rules (brackets, exemptions, retirement-income breaks) differ, so treat state tax as an estimate.`,
    'Draws happen at the start of each year, then all buckets grow. Brokerage withdrawals are treated as return of basis; brokerage gains lose the tax-drag share each year.',
    'Roth conversions draw from non-church Traditional money, fill the chosen bracket each year until RMD age, and are paid for from spending cash.',
    'Monte Carlo uses independent annual returns with a fixed seed so results are repeatable; RMDs, taxes and conversions run inside every trial.',
    'Other Traditional and Roth IRAs are treated as the minister’s. Spouse contributions continue until the same retirement year.'
  ];
  $('assumptions').innerHTML = list.map(s => `<li>${esc(s)}</li>`).join('');
}

/* ---------- Charts ---------- */
const charts = {};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function moneyTick(v){ const a = Math.abs(v); return a >= 1e6 ? '$' + (v/1e6).toFixed(1) + 'M' : a >= 1e3 ? '$' + Math.round(v/1e3) + 'k' : '$' + v; }
function baseOpts(stacked){
  const grid = css('--line'), tick = css('--muted');
  return { responsive:true, maintainAspectRatio:false, animation:false, interaction:{mode:'index',intersect:false},
    plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: c => `${c.dataset.label}: ${fmt(c.parsed.y)}` } } },
    scales:{ x:{ stacked, grid:{display:false}, ticks:{color:tick, maxRotation:0, autoSkipPadding:12, font:{family:'IBM Plex Mono', size:11}} },
             y:{ stacked, grid:{color:grid}, border:{display:false}, ticks:{color:tick, callback:moneyTick, font:{family:'IBM Plex Mono', size:11}}, beginAtZero:true } } };
}
function legend(id, items){ $(id).innerHTML = items.map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join(''); }
function mkChart(id, cfg){
  if (!window.Chart) return;
  const canvas = $(id); if (!canvas || canvas.closest('[hidden]')) return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(canvas, cfg);
}
const BUCKETS = [['Church plan (housing-eligible)','mChurch','--c-church'],['Other Traditional','mTrad','--c-trad'],['Spouse Traditional','sTrad','--c-spouse'],['Roth','roth','--c-roth'],['Brokerage','brok','--c-brok']];
function drawCharts(r){
  // Accumulation
  const ap = r.acc.path;
  mkChart('chGrow', { type:'line', data:{ labels: ap.map(x => 'Y' + x.year),
    datasets: BUCKETS.map(([l,k,c]) => ({ label:l, data: ap.map(x => x[k]), borderColor: css(c), backgroundColor: css(c) + '55', fill:true, pointRadius:0, borderWidth:1.5 })) }, options: baseOpts(true) });
  legend('lgGrow', BUCKETS.map(([l,,c]) => [l, css(c)]));
  // Retirement balances
  const rows = r.ret.rows;
  const labels = rows.map(y => String(y.mAge));
  mkChart('chRet', { type:'line', data:{ labels,
    datasets: BUCKETS.map(([l,k,c]) => ({ label:l, data: rows.map(y => y.end[k]), borderColor: css(c), backgroundColor: css(c) + '55', fill:true, pointRadius:0, borderWidth:1.5 })) },
    options: baseOpts(true) });
  legend('lgRet', BUCKETS.map(([l,,c]) => [l, css(c)]).concat([['x-axis: minister age', 'transparent']]));
  // Taxes by source
  const T = [['Social Security & pension', '--c-fixed'], ['RMD', '--c-rmd'], ['Conversions', '--c-conv'], ['Other withdrawals', '--c-draw'], ['Brokerage drag', '--c-brok']];
  const split = rows.map(y => taxSplit(y, r));
  mkChart('chTax', { type:'bar', data:{ labels,
    datasets: T.map(([l,c], i) => ({ label:l, data: split.map(s => s[i]), backgroundColor: css(c), borderWidth:0, barPercentage:.9, categoryPercentage:.9 })) }, options: baseOpts(true) });
  legend('lgTax', T.map(([l,c]) => [l, css(c)]));
  // Fan
  const f = r.mc.fan;
  const fl = f.p50.map((_, i) => String(r.P.minAgeStart + i));
  mkChart('chFan', { type:'line', data:{ labels: fl, datasets:[
    { label:'90th percentile', data:f.p90, borderColor: css('--c-roth'), backgroundColor: css('--accent') + '22', fill:'+2', pointRadius:0, borderWidth:1.2 },
    { label:'Median', data:f.p50, borderColor: css('--accent'), pointRadius:0, borderWidth:2.2, fill:false },
    { label:'10th percentile', data:f.p10, borderColor: css('--c-rmd'), pointRadius:0, borderWidth:1.2, fill:false } ] }, options: baseOpts(false) });
  legend('lgFan', [['90th percentile', css('--c-roth')], ['Median', css('--accent')], ['10th percentile', css('--c-rmd')]]);
}
// Per-year tax attribution (same incremental method the engine uses for totals)
function taxSplit(y, r){
  const ctx = { ss: y.ss, pension: y.pension, allow: y.allow || 0, pensElig: y.pensElig || 0,
    status: y.status, ages: y.status === 'MFJ' ? [y.mAge, y.sAge] : [y.ministerAlive ? y.mAge : y.sAge], calYear: y.calYear,
    scale: r.P.scale0 * Math.pow(1 + r.P.inflation, y.i - 1), seniorExt: r.P.seniorExtended };
  const t = pl => E.yearTax(Object.assign({ churchDist:0, otherTradDist:0, conv:0, rothDist:0, brokDist:0 }, pl), ctx).total;
  const rmdChurch = Math.min(y.rmd, y.churchDist);
  const t0 = t({}), t1 = t({ churchDist: rmdChurch, otherTradDist: y.rmd - rmdChurch }), t2 = t({ churchDist: rmdChurch, otherTradDist: y.rmd - rmdChurch, conv: y.conv });
  const tot = y.fedTax + y.stateTax;
  return [t0, t1 - t0, t2 - t1, Math.max(0, tot - t2), y.brokTax];
}
// Redraw charts when the theme changes
const mq = matchMedia('(prefers-color-scheme: dark)');
const redraw = () => last && drawCharts(last);
mq.addEventListener ? mq.addEventListener('change', redraw) : mq.addListener(redraw);
new MutationObserver(redraw).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

/* ---------- Downloads (plain browser) ---------- */
function save(filename, data){
  const type = filename.endsWith('.csv') ? 'text/csv' : 'application/json';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type })); a.download = filename;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
$('btnCsv').onclick = () => {
  if (!last) return;
  const head = ['year','calendar_year','minister_age','spouse_age','spend','social_security','pension','rmd','housing_excluded','church_dist','other_trad_dist','roth_dist','brokerage_dist','roth_conversion','taxable_ss','fed_agi','fed_tax','state_tax','brokerage_tax','end_total','end_total_todays_dollars'];
  const lines = [head.join(',')].concat(last.ret.rows.map(y => [y.i,y.calYear,y.mAge,y.sAge,y.spend,y.ss,y.pension,y.rmd,y.housingExcluded,y.churchDist,y.otherTradDist,y.rothDist,y.brokDist,y.conv,y.taxableSS,y.fedAGI,y.fedTax,y.stateTax,y.brokTax,y.endTotal,y.endTotal*y.realFactor].map(v => typeof v === 'number' ? Math.round(v) : v).join(',')));
  save('minister-retirement-years.csv', lines.join('\n'));
};

/* ---------- AI prompt (used by ai.js) ---------- */
function mdToHtml(md){
  const lines = esc(md).split('\n'); let html = '', inList = false;
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  for (const raw of lines) {
    const l = raw.trim();
    if (/^#{1,4}\s/.test(l)) { if (inList) { html += '</ul>'; inList = false; } html += `<h4>${inline(l.replace(/^#+\s/, ''))}</h4>`; }
    else if (/^[-*•]\s/.test(l) || /^\d+\.\s/.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(l.replace(/^([-*•]|\d+\.)\s/, ''))}</li>`; }
    else if (!l) { if (inList) { html += '</ul>'; inList = false; } }
    else { if (inList) { html += '</ul>'; inList = false; } html += `<p>${inline(l)}</p>`; }
  }
  if (inList) html += '</ul>';
  return html;
}
function auditPrompt(r){
  const p = r.p, t = r.today, ret = r.ret, mc = r.mc, P = r.P;
  return `You are a fee-only financial planner who specializes in clergy taxes (IRC §107 housing allowance, dual-status SECA, 403(b)(9) church plans). Review this household's planning model and write a candid, numbers-specific audit.

HOUSEHOLD (tax year 2026, ${E.TAX.state.name}, ${p.status})
- Minister age ${p.minAge}${p.status==='MFJ'?`, spouse age ${p.spAge}`:''}
- Minister total comp ${fmt(p.minComp)} incl. housing designation ${fmt(p.housingDesignated)}; excludable housing ${fmt(t.excludable)} (actual ${fmt(p.housingActual)}, FRV ${fmt(p.housingFRV)})
- Minister 403(b) pre-tax ${fmt(p.minPreTax)}, Roth 403(b) ${fmt(p.minRoth403b)}, Roth IRA ${fmt(p.minRothIRA)} (deferral limit ${fmt(t.limits.minDeferral)})
${p.status==='MFJ'?`- Spouse W-2 ${fmt(p.spGross)}; plan pre-tax ${fmt(p.spPreTax)}, Roth ${fmt(p.spRoth401k)}, Roth IRA ${fmt(p.spRothIRA)}\n`:''}
TODAY
- SECA ${fmt(t.seca.total)}; half deductible ${fmt(t.seDeduction)}
- Income-tax shield ${fmt(t.shield)} (housing ${fmt(t.shieldHousing)}, SE deduction ${fmt(t.shieldSEDed)}); extra payroll vs W-2 ${fmt(t.extraPayroll)}; net advantage ${fmt(t.netAdvantage)}
- Break-even housing ${t.breakEven===null?'n/a':fmt(t.breakEven)}; marginal federal bracket ${Math.round(t.marginalFed*100)}%
- Household take-home ${fmt(t.householdNet)}/yr
- Warnings: ${t.warnings.map(w=>w.msg).join(' | ') || 'none'}

ACCUMULATION (${p.yearsToRetire} yrs at ${(p.accReturn*100).toFixed(1)}%)
- At retirement: church-plan Traditional ${fmt(r.acc.end.mChurch)}, other Traditional ${fmt(r.acc.end.mTrad + r.acc.end.sTrad)}, Roth ${fmt(r.acc.end.roth)}, brokerage ${fmt(r.acc.end.brok)}

RETIREMENT (starts ${P.startCalYear}, ${P.years} yrs, ${(p.retReturn*100).toFixed(1)}% mean, ${(p.retVol*100).toFixed(0)}% vol, ${(p.inflation*100).toFixed(1)}% inflation; RMDs from age ${P.minRmdAge})
- Spending ${fmt(p.retSpend)}${p.todaysDollars?' in today\'s dollars':''}; first-year nominal ${fmt(P.spend0)}
- Social Security ${fmt(p.ssMin + (p.status==='MFJ'?p.ssSp:0))}, pension ${fmt(p.pension)}, retirement housing allowance ${fmt(p.retHousing)}
- Draw order: ${p.drawOrder}; Roth conversions ${p.convOn?`on, filling ${Math.round(p.convBracket*100)}% bracket (${fmt(ret.totalConverted)} converted)`:'off'}; survivor scenario ${p.survivorOn?'on':'off'}
- Static plan lasts: ${lastsText(r)}; Monte Carlo success ${pctf(mc.successRate)}; median ending ${fmt(mc.final.p50)}, 10th pct ${fmt(mc.final.p10)}
- Lifetime retirement taxes ${fmt(ret.totalTax)} (Social Security/pension ${fmt(ret.taxBy.fixed)}, RMDs ${fmt(ret.taxBy.rmd)}, conversions ${fmt(ret.taxBy.conversion)}, other withdrawals ${fmt(ret.taxBy.withdrawals)}, brokerage ${fmt(ret.taxBy.brokerage)})
- Legacy ${fmt(ret.finalBal)}

Write exactly three sections in Markdown, using "### " headings:
### Honest scorecard
2–4 sentences on whether this household is on track and what the Monte Carlo and lifetime-tax figures say about savings rate and tax efficiency.
### The Traditional-account tax trap
2–4 sentences on the Roth/Traditional mix, RMD exposure, and how the retirement housing exclusion changes the answer for church-plan money versus other Traditional money.
### Two priority actions
Two bullet points, each with specific dollar amounts from this scenario (housing designation sizing, deferral changes, Roth conversion window, contribution split).
Keep it under 350 words. Do not invent figures that are not derivable from the data above. End with one sentence noting this is educational, not personal tax advice.`;
}

/* ---------- Scenarios: local by default, encrypted cloud when signed in ---------- */
const localBackend = {
  label: 'Saved in this browser only',
  async list(){ return store.get('mtw.scenarios', []).map((s, i) => Object.assign({ id: s.id || 'local-' + i }, s)); },
  async add(s){ const l = store.get('mtw.scenarios', []); l.push(Object.assign({ id: 'local-' + Date.now() }, s)); store.set('mtw.scenarios', l.slice(-12)); },
  async remove(id){ store.set('mtw.scenarios', (await this.list()).filter(s => s.id !== id)); }
};
let backend = localBackend, scenCache = [];
async function reloadScen(){
  try { scenCache = await backend.list(); } catch (e) { scenCache = []; $('scenMsg').textContent = 'Could not load saved scenarios: ' + (e.message || e); }
  $('scenWhere').textContent = backend.label;
  renderScen();
}
function summarize(r){ return { net: r.today.netAdvantage, lasts: r.ret.depletedYear, years: r.P.years, mc: r.mc.successRate,
  taxes: r.ret.totalTax, legacy: r.ret.finalBal, atRet: E.sumB(r.acc.end), take: r.today.householdNet }; }
function renderScen(){
  const list = scenCache, cur = last ? summarize(last) : null;
  if (!list.length) { $('scenGrid').innerHTML = '<div class="card muted small">No saved scenarios yet. Save the current inputs, change something (for example, move $10,000 from pre-tax to Roth), and save again to compare side by side.</div>'; return; }
  const d = (a, b, money, higherGood = true) => { if (b == null) return ''; const diff = a - b; if (Math.abs(diff) < (money ? 1 : 0.005)) return '';
    const good = higherGood ? diff > 0 : diff < 0; return ` <span class="small ${good?'delta-up':'delta-down'}">${diff>0?'+':''}${money?fmt(diff):Math.round(diff*100)+' pts'}</span>`; };
  $('scenGrid').innerHTML = list.map(s => { const m = s.summary || {}; return `<div class="card">
    <div class="card-h" style="margin:0"><h3>${esc(s.name)}</h3><span class="muted small">${esc(new Date(s.at).toLocaleDateString())}</span></div>
    <table class="ledger">
      <tr><td>Net vs W-2</td><td class="r">${fmt(m.net)}</td></tr>
      <tr><td>Take-home</td><td class="r">${fmt(m.take)}</td></tr>
      <tr><td>At retirement</td><td class="r">${fmt(m.atRet)}</td></tr>
      <tr><td>Static plan lasts</td><td class="r">${m.lasts === -1 ? m.years + '+ yrs' : m.lasts + ' yrs'}</td></tr>
      <tr><td>Monte Carlo</td><td class="r">${pctf(m.mc || 0)}</td></tr>
      <tr><td>Lifetime taxes</td><td class="r">${fmt(m.taxes)}</td></tr>
      <tr><td>Legacy</td><td class="r">${fmt(m.legacy)}</td></tr>
    </table>
    ${cur ? `<p class="small muted" style="margin:0">Current vs this: MC${d(cur.mc, m.mc, false)} · taxes${d(cur.taxes, m.taxes, true, false)} · legacy${d(cur.legacy, m.legacy, true)}</p>` : ''}
    <div class="row"><button class="btn" data-load="${esc(s.id)}">Load</button><button class="btn" data-del="${esc(s.id)}">Delete</button></div></div>`; }).join('');
}
$('scenGrid').addEventListener('click', async e => {
  const L = e.target.dataset.load, D = e.target.dataset.del;
  if (L != null) { const s = scenCache.find(x => x.id === L); if (!s) return; setInputs(s.inputs); recalc(); showTab('today'); $('scenMsg').textContent = `Loaded “${s.name}”.`; }
  if (D != null) { const s = scenCache.find(x => x.id === D); e.target.disabled = true;
    try { await backend.remove(D); $('scenMsg').textContent = `Deleted “${s ? s.name : 'scenario'}”.`; } catch (err) { $('scenMsg').textContent = 'Delete failed: ' + (err.message || err); }
    reloadScen(); }
});
$('btnSave').onclick = async () => {
  if (!last) return;
  const name = $('scenName').value.trim() || `Scenario ${scenCache.length + 1}`;
  $('btnSave').disabled = true;
  try { await backend.add({ name, at: Date.now(), inputs: rawInputs(), summary: summarize(last) }); $('scenName').value = ''; $('scenMsg').textContent = `Saved “${name}”.`; }
  catch (err) { $('scenMsg').textContent = 'Save failed: ' + (err.message || err); }
  $('btnSave').disabled = false; reloadScen();
};
$('btnExport').onclick = () => save('minister-scenarios.json', JSON.stringify({ version: 14, scenarios: scenCache.map(({ id, ...s }) => s), current: rawInputs() }, null, 2));
$('btnImport').onclick = () => $('fileImport').click();
$('fileImport').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = async () => { try { const j = JSON.parse(fr.result);
      const imported = Array.isArray(j.scenarios) ? j.scenarios.filter(s => s && s.name && s.inputs) : [];
      for (const s of imported) await backend.add({ name: String(s.name), at: s.at || Date.now(), inputs: s.inputs, summary: s.summary || {} });
      if (j.current) { setInputs(j.current); recalc(); }
      $('scenMsg').textContent = `Imported ${imported.length} scenario${imported.length===1?'':'s'}.`; reloadScen();
    } catch { $('scenMsg').textContent = 'That file is not a scenarios export from this app.'; } };
  fr.readAsText(f); e.target.value = '';
};

/* ---------- Self-tests ---------- */
$('btnTests').onclick = () => {
  const saved = JSON.stringify(E.TAX, (k, v) => v === Infinity ? 'INF' : v);
  const d = JSON.parse(JSON.stringify(TAXDEF), (k, v) => v === 'INF' ? Infinity : v); Object.keys(d).forEach(k => E.TAX[k] = d[k]);
  const T = E.selfTests();
  const back = JSON.parse(saved, (k, v) => v === 'INF' ? Infinity : v); Object.keys(back).forEach(k => E.TAX[k] = back[k]);
  const ok = T.filter(t => t.pass).length;
  $('testOut').innerHTML = `<strong class="${ok===T.length?'pass':'fail'}">${ok} / ${T.length} passed</strong>` +
    T.map(t => `<div class="${t.pass?'pass':'fail'}">${t.pass?'✓':'✗'} ${esc(t.name)}${t.pass?'':` — got ${(+t.got).toFixed(2)}, want ${(+t.want).toFixed(2)}`}</div>`).join('');
};

/* ---------- Shared API for account.js and ai.js ---------- */
window.App = {
  E, $, esc, fmt, pctf, store, showTab, mdToHtml, compute, readParams, rawInputs, setInputs, setStatus, schedule,
  recalc: fast => recalc(fast), getLast: () => last, VS, budgetMo, housingBudgetMo, setView, onRender: f => renderHooks.push(f), fields: () => Object.keys(FIELDS), spec,
  auditPrompt: () => last ? auditPrompt(last) : '',
  localScenarios: () => localBackend.list(),
  clearLocal(){ try { Object.keys(localStorage).filter(k => k.startsWith('mtw.')).forEach(k => localStorage.removeItem(k)); } catch {} },
  useBackend(b){ backend = b || localBackend; reloadScen(); },
  resetInputs(){ setInputs(null); recalc(); }
};

/* ---------- Boot ---------- */
$('state').innerHTML = E.STATES.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('');
loadTax(); buildTaxFields();
setInputs(store.get('mtw.inputs', null));
const TABS = ['home','budget','pay','grow','retire','years','scen','audit','learn','account','rules','today'];
function setView(v){
  document.body.classList.toggle('simple', v === 'simple');
  $('viewSimple').setAttribute('aria-pressed', v === 'simple'); $('viewDetailed').setAttribute('aria-pressed', v !== 'simple');
  store.set('mtw.view', v);
  const cur = store.get('mtw.tab', 'home'); if (v === 'simple' && (cur === 'years' || cur === 'rules')) showTab('home');
  if (last) requestAnimationFrame(() => drawCharts(last));
}
$('viewSimple').onclick = () => setView('simple'); $('viewDetailed').onclick = () => setView('detailed');
setView(store.get('mtw.view', 'simple'));
$('linkHousing').addEventListener('change', e => { VS.linkHousing = e.target.checked; schedule(); });
const tab = (location.hash || '').slice(1) || store.get('mtw.tab', 'home');
showTab(TABS.includes(tab) ? tab : 'home');
recalc();
reloadScen();
window.addEventListener('load', () => last && drawCharts(last));

})();
