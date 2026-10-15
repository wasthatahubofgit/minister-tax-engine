/* Every number field gets a slider: slide or type, both stay in sync. */
(function(){
'use strict';
const A = window.App, $ = A.$;
const R = (min, max, step) => ({ min, max, step });
const RANGES = {
  minAge: R(22, 80, 1), spAge: R(22, 80, 1), stateRate: R(0, 11, 0.1),
  minComp: R(0, 300000, 500), housingDesignated: R(0, 150000, 500), housingActual: R(0, 150000, 500), housingFRV: R(0, 150000, 500),
  minPreTax: R(0, 35750, 100), minRoth403b: R(0, 35750, 100), minRothIRA: R(0, 8600, 100),
  spGross: R(0, 300000, 500), spPreTax: R(0, 35750, 100), spRoth401k: R(0, 35750, 100), spRothIRA: R(0, 8600, 100),
  yearsToRetire: R(0, 45, 1), accReturn: R(0, 12, 0.1), salaryGrowth: R(0, 6, 0.1),
  minTradBal: R(0, 2000000, 1000), churchPlanPct: R(0, 100, 5), minRothBal: R(0, 1000000, 1000), spTradBal: R(0, 2000000, 1000),
  spRothBal: R(0, 1000000, 1000), miscTradBal: R(0, 1000000, 1000), miscRothBal: R(0, 1000000, 1000), brokerageBal: R(0, 1000000, 1000),
  retSpend: R(0, 300000, 1000), retHousing: R(0, 100000, 500), ssMin: R(0, 60000, 500), ssSp: R(0, 60000, 500), pension: R(0, 100000, 500),
  retYears: R(5, 45, 1), retReturn: R(0, 10, 0.1), retVol: R(0, 25, 0.5), inflation: R(0, 6, 0.1), brokTaxDrag: R(0, 40, 1),
  survivorYear: R(1, 40, 1), survivorSpendPct: R(40, 100, 5),
  cashBal: R(0, 200000, 500), cashContrib: R(0, 30000, 100), cashRate: R(0, 6, 0.1), brokContrib: R(0, 60000, 100),
  whMinFed: R(0, 3000, 25), whMinState: R(0, 1000, 25), whSpFed: R(0, 3000, 25), whSpState: R(0, 1000, 25), estQuarterly: R(0, 10000, 50), lastYearTax: R(0, 80000, 100),
  otherSEIncome: R(0, 100000, 100), otherSEExpenses: R(0, 30000, 100), mortgageInterest: R(0, 40000, 100),
  contrib529: R(0, 40000, 100), bal529: R(0, 300000, 500), kids529: R(0, 8, 1), yrsToCollege: R(0, 25, 1), limit529: R(0, 40000, 100),
  pensionStartAge: R(0, 80, 1), pensionSurvivorPct: R(0, 100, 5)
};
// Annual dollar fields that also show a per-month equivalent
const PER_MONTH = ['minComp', 'spGross', 'minPreTax', 'minRoth403b', 'minRothIRA', 'spPreTax', 'spRoth401k', 'spRothIRA', 'retSpend', 'retHousing', 'ssMin', 'ssSp', 'pension', 'housingDesignated', 'housingActual', 'cashContrib', 'brokContrib', 'otherSEIncome', 'contrib529'];
const sliders = {};

function fill(sl){ const p = (sl.value - sl.min) / (sl.max - sl.min) * 100; sl.style.setProperty('--p', (isFinite(p) ? p : 0) + '%'); }
function perMonth(id){ const el = $('pm-' + id); if (el) el.textContent = '≈ ' + A.fmt((parseFloat($(id).value) || 0) / 12) + ' a month'; }

for (const [id, r] of Object.entries(RANGES)) {
  const num = $(id); if (!num) continue;
  const field = num.closest('.field'); if (!field) continue;
  const row = document.createElement('div'); row.className = 'slide-row';
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = r.min; sl.max = r.max; sl.step = r.step; sl.id = 'sl-' + id; sl.tabIndex = 0;
  const lbl = document.querySelector(`label[for="${id}"]`);
  sl.setAttribute('aria-label', (lbl ? lbl.childNodes[0].textContent.trim() : id) + ' slider');
  row.append(sl);
  if (PER_MONTH.includes(id)) { const pm = document.createElement('span'); pm.className = 'permo num'; pm.id = 'pm-' + id; row.append(pm); }
  field.append(row);
  sliders[id] = sl;
  sl.addEventListener('pointerdown', () => num.dispatchEvent(new Event('focusin', { bubbles: true })));
  sl.addEventListener('focus', () => num.dispatchEvent(new Event('focusin', { bubbles: true })));
  sl.addEventListener('input', () => { num.value = sl.value; fill(sl); perMonth(id); A.schedule(true); });
  sl.addEventListener('change', () => { num.value = sl.value; A.schedule(false); });
  num.addEventListener('input', () => sync(id));
}
function sync(id){
  const sl = sliders[id], num = $(id); if (!sl) return;
  const v = parseFloat(num.value) || 0;
  if (v > +sl.max) sl.max = Math.ceil(v / +sl.step) * +sl.step;
  sl.value = v; fill(sl); perMonth(id); sl.disabled = !!num.readOnly;
}
function syncAll(){ Object.keys(sliders).forEach(sync); }
A.onRender(() => { if (!document.activeElement || document.activeElement.type !== 'range') syncAll(); });
syncAll();
A.syncSliders = syncAll;
})();
