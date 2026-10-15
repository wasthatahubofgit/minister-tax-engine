/* Key figures you choose to watch, with before→after changes and a plain-language
   "today → retirement" translation whenever you change a number. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E;

const QUOTES = [
  "People don't always understand how today's stewardship choices affect tomorrow's realities, whether it be next month, next year, or 20–30 years from now. This app was designed to help you make those connections.",
  "$10 a month leads to hundreds available in later years, opening doors for years of generosity toward others and the ability to have undistracted focus on what matters in later years.",
  "Decimal places get rounded away when $100 is gaining interest. But at $100,000, a lot more decimal places can make the difference in taking care of those the Lord loves, including you. What are you called to now?"
];
A.QUOTES = QUOTES;

function retIncomeMo(r){
  const p = r.p, Y = Math.round(p.yearsToRetire), n = Math.max(1, Math.round(p.retYears));
  const pv = E.sumB(r.acc.end) / Math.pow(1 + p.inflation, Y);
  const real = (1 + p.retReturn) / (1 + p.inflation) - 1;
  const pmt = Math.abs(real) < 1e-9 ? pv / n : pv * real / (1 - Math.pow(1 + real, -n));
  return pmt / 12;
}
A.retIncomeMo = retIncomeMo;
const lastRow = r => r.ret.rows[r.ret.rows.length - 1];
const pct = x => Math.round(x * 100) + '%';
const yrs = x => Math.round(x) + ' yrs';
const FIG = {
  takeHomeMo: { label: 'Take-home / month', term: 'takehome', up: true, f: fmt, v: r => r.today.takeHome / 12 },
  leftMo: { label: 'Left for spending & giving / month', short: 'Left to spend / mo', term: 'takehome', up: true, f: fmt, v: r => r.today.householdNet / 12 },
  budgetLeft: { label: 'Budget surplus / month', short: 'Budget surplus', term: 'budget', up: true, f: v => Math.abs(v) < 0.5 ? '$0' : (v >= 0 ? '+' : '−') + fmt(Math.abs(v)), v: r => r.today.householdNet / 12 - A.budgetMo() },
  taxGap: { label: 'Tax likely owed in April', short: 'Owed in April', term: 'setaside', up: false, f: fmt, v: r => Math.max(0, r.today.setAside.gap) },
  emergency: { label: 'Emergency fund (months)', short: 'Emergency fund', term: 'emergency', up: true, f: v => v.toFixed(1) + ' mo', v: r => { const mo = A.budgetMo() > 0 ? A.budgetMo() : r.today.householdNet / 12; return mo > 0 ? r.p.cashBal / mo : 0; } },
  retIncomeMo: { label: 'Retirement income from savings / month', short: 'Retirement income / mo', term: 'retincome', up: true, f: fmt, v: retIncomeMo },
  atRet: { label: "Savings at retirement (today's $)", short: 'At retirement', term: 'todaysdollars', up: true, f: fmt, v: r => E.sumB(r.acc.end) / Math.pow(1 + r.p.inflation, Math.round(r.p.yearsToRetire)) },
  mc: { label: 'Monte Carlo success', short: 'Success rate', term: 'montecarlo', up: true, f: pct, v: r => r.mc.successRate },
  lasts: { label: 'Plan lasts (steady returns)', short: 'Plan lasts', term: 'sequence', up: true, f: yrs, v: r => r.ret.depletedYear === -1 ? r.P.years : r.ret.depletedYear },
  lifeTax: { label: 'Lifetime retirement taxes', short: 'Retirement taxes', term: 'rmd', up: false, f: fmt, v: r => r.ret.totalTax },
  legacy: { label: "Legacy (today's $)", short: 'Legacy', term: 'legacy', up: true, f: fmt, v: r => r.ret.finalBal * (lastRow(r) ? lastRow(r).realFactor : 1) },
  netAdv: { label: 'Net advantage vs W-2', short: 'Net vs W-2', term: 'netadvantage', up: true, f: v => (v >= 0 ? '+' : '') + fmt(v), v: r => r.today.netAdvantage }
};
A.FIGURES = FIG;
const DEFAULT_WATCH = ['takeHomeMo', 'budgetLeft', 'retIncomeMo', 'mc'];
let watch = (A.store.get('mtw.watch', DEFAULT_WATCH) || DEFAULT_WATCH).filter(k => FIG[k]).slice(0, 4);
if (!watch.length) watch = DEFAULT_WATCH.slice();
A.getWatch = () => watch.slice();
A.setWatch = list => { watch = list.filter(k => FIG[k]).slice(0, 4); A.store.set('mtw.watch', watch); render(A.getLast()); };

const values = r => Object.fromEntries(Object.keys(FIG).map(k => [k, FIG[k].v(r)]));
let base = null, baseInputs = null, field = null, pinned = false;

const SAVE_FIELDS = { minPreTax: 'your 403(b) pre-tax', minRoth403b: 'your Roth 403(b)', minRothIRA: 'your Roth IRA',
  spPreTax: "your spouse's pre-tax plan", spRoth401k: "your spouse's Roth plan", spRothIRA: "your spouse's Roth IRA",
  cashContrib: 'cash savings', brokContrib: 'your brokerage account', contrib529: 'college savings (529)' };
const SKIP = /^(tx\d+|scenName|aiKey|aiModel|aiProvider|chatInput|learnSearch|wz-|sl-|a[A-Z]|v[P]|n[VP])/;
function labelFor(id){
  const l = document.querySelector(`label[for="${id}"]`);
  return l ? l.childNodes[0].textContent.trim() : id;
}

document.addEventListener('focusin', e => {
  const el = e.target;
  if (!el.id || !el.matches('input,select') || SKIP.test(el.id) || el.closest('.wizard,.gloss-pop,#acctCard')) return;
  if (!A.fields().includes(el.id)) return;
  if (pinned || el.id === field) return;
  const r = A.getLast(); if (!r) return;
  base = values(r); baseInputs = A.rawInputs(); field = el.id;
  render(r);
});

function render(r){
  if (!r) return;
  const now = values(r);
  $('chips').innerHTML = watch.map(k => {
    const d = FIG[k], v = now[k];
    let delta = '';
    if (base) {
      const diff = v - base[k];
      const tiny = k === 'mc' ? Math.abs(diff) < 0.005 : Math.abs(diff) < 1;
      if (!tiny) { const good = d.up ? diff > 0 : diff < 0;
        delta = `<i class="${good ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${k === 'mc' ? Math.abs(Math.round(diff * 100)) + ' pts' : k === 'lasts' ? Math.abs(Math.round(diff)) + ' yrs' : fmt(Math.abs(diff))}</i>`; }
    }
    return `<button type="button" class="chip" data-term="${d.term}" title="${esc(d.label)}"><span>${esc(d.short || d.label)}</span><b>${d.f(v)}</b>${delta}</button>`;
  }).join('') + '<button type="button" class="chip chip-edit" id="btnWatch" aria-label="Choose which figures to watch">Choose…</button>';
  renderStory(r, now);
}

function renderStory(r, now){
  const box = $('impact');
  if (!base || !field) { box.hidden = true; return; }
  const cur = A.rawInputs(), was = baseInputs[field], is = cur[field];
  const p = r.p, Y = Math.round(p.yearsToRetire), n = Math.round(p.retYears);
  let html = '';
  if (SAVE_FIELDS[field] && was !== is) {
    const dSave = (is - was) / 12, dTake = now.leftMo - base.leftMo, dRet = now.retIncomeMo - base.retIncomeMo;
    const more = dSave > 0;
    html = `<p><strong>${more ? 'Saving' : 'Saving'} ${fmt(Math.abs(dSave))} ${more ? 'more' : 'less'} a month</strong> in ${SAVE_FIELDS[field]} changes your monthly spending money by <strong>${dTake >= 0 ? '+' : '−'}${fmt(Math.abs(dTake))}/mo</strong> today`;
    if (field === 'cashContrib') html += `. Cash savings isn't counted as retirement income, but it protects you from surprises.`;
    else if (field === 'contrib529') html += `. It isn't retirement money, but your state may give a tax break: about ${fmt(r.today.edu.saved)}/yr at this level.`;
    else if (Y > 0) {
      html += ` and retirement income by <strong>${dRet >= 0 ? '+' : '−'}${fmt(Math.abs(dRet))}/mo</strong> for ${n} years <span class="muted">(today's dollars, before tax)</span>.`;
      const putIn = Math.abs(dSave) * 12 * Y, getOut = Math.abs(dRet) * 12 * n;
      if (putIn > 0 && getOut > 0) html += ` ${fmt(putIn)} set aside over ${Y} years becomes about <strong>${fmt(getOut)}</strong> to live on and give from later.`;
    } else html += '.';
    html += '</p>';
    if (more && Y > 0) html += `<p class="impact-quote">${esc(QUOTES[1])}</p>`;
  } else if (was !== is) {
    const fmtv = v => typeof v === 'number' ? (/Pct|Rate|Return|Vol|inflation|Growth|Drag/i.test(field) ? v + '%' : (/Age|Year|years/i.test(field) ? v : fmt(v))) : (v === true ? 'on' : v === false ? 'off' : v);
    html = `<p>You changed <strong>${esc(labelFor(field))}</strong> from ${esc(fmtv(was))} to ${esc(fmtv(is))}. The figures above show what moved.</p>`;
  } else {
    html = `<p class="muted">Comparing to your numbers before you changed <strong>${esc(labelFor(field))}</strong>. Slide or type to see what moves.</p>`;
  }
  box.innerHTML = `<div class="impact-in">${html}<div class="row small"><button type="button" class="linkish" id="btnPin">${pinned ? 'Unpin baseline' : 'Pin this as my baseline'}</button><button type="button" class="linkish" id="btnClearCmp">Clear comparison</button></div></div>`;
  box.hidden = false;
}

document.addEventListener('click', e => {
  if (e.target.id === 'btnClearCmp') { base = baseInputs = field = null; pinned = false; render(A.getLast()); }
  if (e.target.id === 'btnPin') { pinned = !pinned; if (pinned) { base = values(A.getLast()); baseInputs = A.rawInputs(); } render(A.getLast()); }
  if (e.target.id === 'btnWatch') { e.stopPropagation(); openPicker(e.target); }
}, true);

function openPicker(btn){
  let menu = $('watchMenu');
  if (!menu) { menu = document.createElement('div'); menu.id = 'watchMenu'; menu.className = 'watch-menu'; document.body.append(menu); }
  menu.innerHTML = `<p class="small" style="margin:0 0 6px"><strong>Watch up to 4 figures</strong></p>` +
    Object.entries(FIG).map(([k, d]) => `<label class="check"><input type="checkbox" value="${k}" ${watch.includes(k) ? 'checked' : ''}><span>${esc(d.label)}</span></label>`).join('') +
    '<div class="row" style="margin-top:8px"><button class="btn primary" type="button" id="watchDone">Done</button></div>';
  const rr = btn.getBoundingClientRect();
  menu.style.top = Math.min(innerHeight - 340, rr.bottom + 6) + 'px';
  menu.style.left = Math.max(12, Math.min(innerWidth - 292, rr.right - 280)) + 'px';
  menu.hidden = false;
  menu.onchange = () => { const sel = [...menu.querySelectorAll('input:checked')].map(i => i.value);
    menu.querySelectorAll('input:not(:checked)').forEach(i => i.disabled = sel.length >= 4); };
  menu.onchange();
  $('watchDone').onclick = () => { A.setWatch([...menu.querySelectorAll('input:checked')].map(i => i.value)); menu.hidden = true; };
}
document.addEventListener('click', e => { const m = $('watchMenu'); if (m && !m.hidden && !m.contains(e.target) && e.target.id !== 'btnWatch') m.hidden = true; });

A.onRender(render);
render(A.getLast());
})();
