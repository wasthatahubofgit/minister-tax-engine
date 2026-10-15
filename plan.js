/* Monthly plan: linked sliders over one fixed pie (gross pay). Moving one slider takes money
   from (or gives it to) the others, flexible bucket first, using the real after-tax cost:
   $100 more pre-tax saving only costs about $78 of spending money because taxes drop too. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E;
const mfj = () => A.rawInputs().__status === 'MFJ';
const field = (id, mo) => { const el = $(id); el.value = Math.max(0, Math.round(mo * 12)); };
const fieldMo = id => (parseFloat($(id).value) || 0) / 12;

const BUCKETS = [
  { id: 'minPre', label: 'Your 403(b), pre-tax', color: '--c-church', term: 'pretax', get: () => fieldMo('minPreTax'), set: v => field('minPreTax', v), f: 'minPreTax', pre: true,
    max: () => Math.max(0, A.getLast().today.limits.minDeferral - (+$('minRoth403b').value || 0)) / 12 },
  { id: 'minRoth', label: 'Your 403(b), Roth', color: '--c-conv', term: 'roth', adv: true, get: () => fieldMo('minRoth403b'), set: v => field('minRoth403b', v), f: 'minRoth403b',
    max: () => Math.max(0, A.getLast().today.limits.minDeferral - (+$('minPreTax').value || 0)) / 12 },
  { id: 'minIRA', label: 'Your Roth IRA', color: '--c-conv', term: 'rothira', get: () => fieldMo('minRothIRA'), set: v => field('minRothIRA', v), f: 'minRothIRA', max: () => E.iraLimit(+$('minAge').value) / 12 },
  { id: 'spPre', label: "Spouse's plan, pre-tax", color: '--c-spouse', term: 'pretax', spouse: true, get: () => fieldMo('spPreTax'), set: v => field('spPreTax', v), f: 'spPreTax', pre: true,
    max: () => Math.max(0, A.getLast().today.limits.spDeferral - (+$('spRoth401k').value || 0)) / 12 },
  { id: 'spRoth', label: "Spouse's plan, Roth", color: '--c-conv', term: 'roth', spouse: true, adv: true, get: () => fieldMo('spRoth401k'), set: v => field('spRoth401k', v), f: 'spRoth401k',
    max: () => Math.max(0, A.getLast().today.limits.spDeferral - (+$('spPreTax').value || 0)) / 12 },
  { id: 'spIRA', label: "Spouse's Roth IRA", color: '--c-conv', term: 'rothira', spouse: true, adv: true, get: () => fieldMo('spRothIRA'), set: v => field('spRothIRA', v), f: 'spRothIRA', max: () => E.iraLimit(+$('spAge').value) / 12 },
  { id: 'cash', label: 'Cash savings', color: '--c-fixed', term: 'emergency', get: () => fieldMo('cashContrib'), set: v => field('cashContrib', v), f: 'cashContrib', max: () => A.getLast().today.takeHome / 12 },
  { id: 'brok', label: 'Investing (brokerage)', color: '--c-brok', term: 'brokerage', get: () => fieldMo('brokContrib'), set: v => field('brokContrib', v), f: 'brokContrib', max: () => A.getLast().today.takeHome / 12 },
  { id: 'giving', label: 'Giving', color: '--c-roth', term: 'budget', budget: 'giving', get: () => A.budgetSumOf('giving'), set: v => A.budgetSetTotal('giving', v), max: () => A.getLast().today.takeHome / 12 },
  { id: 'housing', label: 'Housing', color: '--c-house', term: 'housing', budget: 'housing', get: () => A.budgetSumOf('housing'), set: v => A.budgetSetTotal('housing', v), max: () => A.getLast().today.takeHome / 12 },
  { id: 'everyday', label: 'Everyday spending', color: '--c-trad', term: 'budget', budget: 'everyday', get: () => A.budgetSumOf('everyday'), set: v => A.budgetSetTotal('everyday', v), max: () => A.getLast().today.takeHome / 12 }
];
// Where money comes from when something grows: flexible bucket first.
// Retirement accounts are never drained to fund other choices (including each other).
const TAKE_ORDER = ['everyday', 'cash', 'brok', 'giving', 'housing'];
let locks = A.store.get('mtw.locks', { giving: true, housing: true });
let leftoverTo = A.store.get('mtw.leftoverTo', 'none');
// 'linked': other sliders adjust. 'free': like assigning skill points, each slider only draws from what's unassigned.
let mode = A.store.get('mtw.planMode', 'linked');
const undo = [];
const active = () => BUCKETS.filter(b => !b.spouse || mfj());

function leftover(){   // monthly money not assigned anywhere (negative = overspent)
  const t = E.computeToday(A.readParams());
  return t.householdNet / 12 - A.budgetMo();
}
function grossMo(){ const p = A.readParams(); return (p.minComp + (p.status === 'MFJ' ? p.spGross : 0)) / 12; }

function move(b, target){
  if (b.budget) A.VS.budgetExample = false;
  const before = b.get();
  target = Math.max(0, Math.min(target, b.max()));
  b.set(target);
  let U = leftover();
  if (U < -0.5 && mode === 'linked') {
    for (const id of TAKE_ORDER) {
      if (U >= -0.5) break;
      const o = BUCKETS.find(x => x.id === id);
      if (!o || o === b || locks[id] || (o.spouse && !mfj())) continue;
      for (let k = 0; k < 6 && U < -0.5; k++) {
        const have = o.get(); if (have <= 0.5) break;
        o.set(Math.max(0, have + U * (o.pre ? 1.3 : 1)));
        U = leftover();
      }
    }
  }
  if (U < -0.5) {     // nothing left to take from: limit this slider instead
    let lo = Math.min(before, target), hi = target;
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; b.set(mid); if (leftover() >= -0.5) lo = mid; else hi = mid; }
    b.set(lo); U = leftover();
    note(mode === 'free' ? `Stopped at ${fmt(lo)}/mo: nothing left to assign. Lower something else first to free up money.`
      : `Stopped at ${fmt(lo)}/mo: everyday spending, cash, investing, giving and housing are locked or at zero, and retirement saving is never cut to fund other choices.`);
  } else if (U > 0.5 && leftoverTo !== 'none' && mode === 'linked') {
    const dest = BUCKETS.find(x => x.id === leftoverTo);
    if (dest && dest !== b && !locks[dest.id]) dest.set(dest.get() + U);
  }
  if (b.budget || BUCKETS.some(x => x.budget)) A.renderBudget();
}

function note(t){ const el = $('planNote'); if (el) el.textContent = t || ''; }
const LOCK = on => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 ${on ? '5 0v2' : '5 0'}"/></svg>`;

function build(mount){
  const free = mode === 'free', isLocked = id => !free && locks[id];
  mount.innerHTML = `<div class="plan ${free ? 'free' : ''}">
    <div class="row" style="justify-content:space-between"><div class="seg" role="group" aria-label="How sliders behave">
      <button type="button" data-pmode="linked" aria-pressed="${!free}">Linked</button><button type="button" data-pmode="free" aria-pressed="${free}">Assign freely</button></div>
      <span class="small muted">${free ? 'Each slider spends only what is left to assign, like skill points.' : 'Move one and the others adjust to keep the plan balanced.'}</span></div>
    <div class="plan-bar" id="planBar" role="img" aria-label="Where each month's pay goes"></div>
    <div class="legend2" id="planLegend"></div>
    <div id="planRows" style="display:grid;gap:10px"></div>
    <div class="plan-left" id="planLeft"></div>
    <div class="row small" ${free ? 'hidden' : ''}><label for="pl-leftover">Leftover money goes to</label>
      <select id="pl-leftover" class="text-in" style="width:auto;padding:4px 8px">
        <option value="none">Stays unassigned</option><option value="cash">Cash savings</option><option value="brok">Investing</option><option value="everyday">Everyday spending</option><option value="giving">Giving</option>
      </select></div>
    <p class="plan-note" id="planNote" aria-live="polite"></p>
    <div class="row"><button class="btn" type="button" id="pl-undo" disabled>Undo</button><span class="small muted">${free ? 'Lower any slider to free up money, then assign it elsewhere.' : 'Lock a slider to keep it fixed. Others adjust, starting with everyday spending. Retirement saving is never cut automatically.'}</span></div>
  </div>`;
  mount.querySelectorAll('[data-pmode]').forEach(btn => btn.onclick = () => { mode = btn.dataset.pmode; A.store.set('mtw.planMode', mode); build(mount); note(''); });
  $('pl-leftover').value = leftoverTo;
  $('pl-leftover').onchange = e => { leftoverTo = e.target.value; A.store.set('mtw.leftoverTo', leftoverTo); };
  $('pl-undo').onclick = () => { const s = undo.pop(); if (s) { A.setInputs(s); A.recalc(false); A.syncSliders && A.syncSliders(); } $('pl-undo').disabled = !undo.length; note(''); };
  $('planRows').innerHTML = active().map(b => `<div class="plan-row ${b.adv ? 'adv' : ''} ${isLocked(b.id) ? 'locked' : ''}" data-b="${b.id}">
      ${free ? '<span></span>' : `<button type="button" class="lock" data-lock="${b.id}" aria-pressed="${!!locks[b.id]}" aria-label="${locks[b.id] ? 'Unlock' : 'Lock'} ${esc(b.label)}">${LOCK(!!locks[b.id])}</button>`}
      <span class="pr-name"><i style="background:var(${b.color})"></i><span>${esc(b.label)}</span><button type="button" class="term-q" data-term="${b.term}" aria-label="What is ${esc(b.label)}?">?</button></span>
      <input type="number" id="pl-n-${b.id}" min="0" step="10" inputmode="decimal" aria-label="${esc(b.label)} per month">
      <input type="range" id="pl-s-${b.id}" min="0" step="5" aria-label="${esc(b.label)} per month slider" ${isLocked(b.id) ? 'disabled' : ''}>
    </div>`).join('');
  mount.querySelectorAll('[data-lock]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.lock; locks[id] = !locks[id]; A.store.set('mtw.locks', locks);
    const row = btn.closest('.plan-row'); row.classList.toggle('locked', locks[id]);
    btn.setAttribute('aria-pressed', !!locks[id]); btn.innerHTML = LOCK(!!locks[id]);
    $('pl-s-' + id).disabled = !!locks[id];
  });
  active().forEach(b => {
    const sl = $('pl-s-' + b.id), num = $('pl-n-' + b.id);
    const start = () => { if (!sl._drag) { sl._drag = 1; undo.push(A.rawInputs()); if (undo.length > 20) undo.shift(); $('pl-undo').disabled = false; note('');
      if (b.f) $(b.f).dispatchEvent(new Event('focusin', { bubbles: true })); } };
    const end = () => { sl._drag = 0; A.schedule(false); A.syncSliders && A.syncSliders(); };
    sl.addEventListener('pointerdown', start); sl.addEventListener('keydown', start);
    sl.addEventListener('input', () => { start(); move(b, +sl.value); num.value = Math.round(b.get()); A.schedule(true); });
    sl.addEventListener('change', end);
    num.addEventListener('focus', start);
    num.addEventListener('change', () => { if (mode === 'linked' && locks[b.id]) { num.value = Math.round(b.get()); note('Unlock this one to change it.'); return; } start(); move(b, parseFloat(num.value) || 0); end(); });
  });
  update();
}

function update(){
  const r = A.getLast(); if (!r || !$('planRows')) return;
  const gross = grossMo(), t = r.today;
  const taxes = gross - (t.takeHome / 12) - (t.minister.preTax + t.minister.roth + t.spouse.preTax + t.spouse.roth) / 12;
  const segs = [['Taxes', taxes, '--muted']].concat(active().map(b => [b.label, b.get(), b.color]));
  let U = t.householdNet / 12 - A.budgetMo(); if (Math.abs(U) < 0.5) U = 0;
  if (U > 0) segs.push(['Unassigned', U, '--line']);
  const total = Math.max(gross, segs.reduce((a, s) => a + Math.max(0, s[1]), 0)) || 1;
  $('planBar').innerHTML = segs.filter(s => s[1] > 0.5).map(([l, v, c]) => `<i style="width:${(v / total * 100).toFixed(2)}%;background:var(${c})" title="${esc(l)} ${fmt(v)}/mo"></i>`).join('');
  $('planLegend').innerHTML = `<span style="--c:var(--muted)">Taxes ${fmt(taxes)}</span><span>of ${fmt(gross)}/mo gross pay</span>`;
  active().forEach(b => {
    const sl = $('pl-s-' + b.id), num = $('pl-n-' + b.id); if (!sl) return;
    const v = b.get(), mx = Math.max(b.max(), v, 10);
    sl.max = Math.ceil(mx / 5) * 5;
    if (document.activeElement !== num) num.value = Math.round(v);
    if (!sl._drag) sl.value = v;
    sl.style.setProperty('--p', (v / sl.max * 100) + '%');
  });
  const el = $('planLeft');
  el.className = 'plan-left' + (U < -0.5 ? ' bad' : '');
  el.innerHTML = A.budgetMo() === 0
    ? `<span>Add a budget to see spending here.</span><button class="linkish" type="button">Open Budget</button>`
    : U < -0.5 ? `<span>Overspent each month</span><b class="num">${fmt(-U)}</b>`
    : mode === 'free' ? `<span><strong>Left to assign</strong> each month</span><b class="num big" style="font-size:1.25rem">${fmt(U)}</b>` : `<span>Unassigned each month</span><b class="num">${fmt(U)}</b>`;
  const ob = el.querySelector("button"); if (ob) ob.onclick = () => A.showTab("budget");
}

A.mountPlan = el => { build(el); };
A.onRender(update);
})();
