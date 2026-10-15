/* Home: cards the person chooses, reorders and hides. A strong default, a short menu. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt;
const T = (id, text) => `<button type="button" class="term" data-term="${id}">${text}</button>`;
const go = (tab, label) => `<button type="button" class="linkish small" data-go="${tab}">${label}</button>`;
const mini = items => `<div class="mini-kpis">${items.map(([l, v, c]) => `<div><span class="eyebrow">${l}</span><b ${c ? `style="color:var(--${c})"` : ''}>${v}</b></div>`).join('')}</div>`;

const CARDS = {
  suggest: { title: 'Worth discerning', wide: true, intro: 'Specific moves your numbers point toward. Each one explains why, so you can weigh it, pray it through, and decide.',
    mount: el => A.renderSuggestions(el), render: () => { A.renderSuggestions($('hc-suggest')); return null; } },
  plan: { title: 'Your monthly plan', wide: true, intro: 'Slide or type any amount to see how saving, giving and spending fit together each month.',
    mount: el => A.mountPlan(el) },
  paycheck: { title: 'Where your paycheck goes', render: r => {
    const t = r.today, mfj = r.p.status === 'MFJ', gross = (r.p.minComp + (mfj ? r.p.spGross : 0)) / 12;
    const payroll = (t.minister.payroll + t.spouse.payroll) / 12, inc = (t.minister.incomeTax + t.spouse.incomeTax) / 12;
    const ret = (t.minister.preTax + t.minister.roth + t.spouse.preTax + t.spouse.roth) / 12, other = t.otherSaving / 12, left = t.householdNet / 12;
    const parts = [['Social Security & Medicare', payroll, '--c-rmd'], ['Income tax', inc, '--muted'], ['Retirement saving', ret, '--c-church'], ['Cash & investing', other, '--c-brok'], ['Left to spend & give', left, '--c-roth']];
    return `<div class="big">${fmt(gross)}<span class="small muted"> /mo gross</span></div>
      <div class="stackbar">${parts.map(([l, v, c]) => `<i style="width:${Math.max(0, v / gross * 100).toFixed(2)}%;background:var(${c})" title="${esc(l)}"></i>`).join('')}</div>
      <table class="ledger">${parts.map(([l, v, c]) => `<tr><td><span class="legend2"><span style="--c:var(${c})">${esc(l)}</span></span></td><td class="r">${fmt(v)}</td></tr>`).join('')}</table>
      ${go('pay', 'See the tax details')}`; } },
  budget: { title: 'Budget at a glance', render: r => {
    const total = A.budgetMo(), left = r.today.householdNet / 12, s = left - total;
    if (!total) return `<p class="note" style="margin:0">No budget yet. A rough one takes about five minutes and shows whether your plan adds up.</p>${go('budget', 'Start a budget')}`;
    const giving = A.budgetSumOf('giving'), gross = (r.p.minComp + (r.p.status === 'MFJ' ? r.p.spGross : 0)) / 12;
    return mini([['Available', fmt(left)], ['Budgeted', fmt(total)], [s >= 0 ? 'Surplus' : 'Shortfall', fmt(Math.abs(s)), s >= 0 ? 'good' : 'bad']]) +
      `<p class="small" style="margin:0">Housing ${fmt(A.budgetSumOf('housing'))}/mo · Giving ${fmt(giving)}/mo (${gross ? (giving / gross * 100).toFixed(1) : 0}% of gross) · Everything else ${fmt(A.budgetSumOf('everyday'))}/mo</p>${go('budget', 'Edit budget')}`; } },
  taxset: { title: 'Tax set-aside check', render: r => {
    const a = r.today.setAside, owe = a.gap > 0, today = new Date().toISOString().slice(0, 10), next = a.dueDates.find(d => d >= today);
    return mini([['Tax for the year', fmt(a.due)], ['Set aside', fmt(a.set)], [owe ? 'Likely owed' : 'Likely refund', fmt(Math.abs(a.gap)), owe ? 'bad' : 'good']]) +
      `<p class="small" style="margin:0">${owe ? `Ask the church for about <strong>${fmt(a.churchFedMonthly)}/mo</strong> in voluntary withholding, or pay <strong>${fmt(a.quarterlyNeeded)}</strong> a quarter.` : 'What you set aside covers this year\'s estimate.'}
      ${next ? ` Next quarterly due date: ${new Date(next + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.` : ''} ${T('setaside', 'Why this matters')}</p>${go('pay', 'Update what you set aside')}`; } },
  outlook: { title: 'Retirement outlook', render: r => {
    const inc = A.retIncomeMo(r), ss = (r.p.ssMin + (r.p.status === 'MFJ' ? r.p.ssSp : 0)) / 12, want = r.p.retSpend / 12, s = r.mc.successRate;
    return mini([['From savings', fmt(inc) + '/mo'], ['Social Security', fmt(ss) + '/mo'], ['Hoped-for spending', fmt(want) + '/mo']]) +
      `<p class="small" style="margin:0"><span class="status-pill ${s >= .85 ? 'good' : s >= .6 ? 'warn' : 'bad'}">${A.pctf(s)} chance the money lasts</span> In today's dollars, before tax, retiring in ${Math.round(r.p.yearsToRetire)} years. ${T('montecarlo', 'What this means')}</p>${go('retire', 'See retirement details')}`; } },
  housing: { title: 'Housing allowance check', render: r => {
    const t = r.today, p = r.p, be = t.breakEven;
    const pill = t.housingExcess > 0 ? `<span class="status-pill warn">${fmt(t.housingExcess)}/yr of the designation is taxable</span>` : '<span class="status-pill good">Fully excludable</span>';
    return mini([['Designated', fmt(p.housingDesignated)], ['Tax-free', fmt(t.excludable)], ['Break-even', be === null ? 'n/a' : fmt(be)]]) +
      `<p class="small" style="margin:0">${pill} Tax-free is the smallest of designated (${fmt(p.housingDesignated)}), actual costs (${fmt(p.housingActual)}) and fair rental value (${fmt(p.housingFRV)}). ${T('housing', 'Learn more')}</p>`; } },
  emergency: { title: 'Emergency fund', render: r => {
    const mo = A.budgetMo() > 0 ? A.budgetMo() : r.today.householdNet / 12, m = mo > 0 ? r.p.cashBal / mo : 0, need3 = Math.max(0, 3 * mo - r.p.cashBal);
    return mini([['Cash saved', fmt(r.p.cashBal)], ['Covers', m.toFixed(1) + ' months', m >= 3 ? 'good' : m >= 1 ? 'warn' : 'bad'], ['Adding', fmt(r.p.cashContrib / 12) + '/mo']]) +
      `<p class="small" style="margin:0">${need3 > 0 ? `Reaching 3 months takes about ${fmt(need3 / 12)}/mo for a year.` : 'You have at least 3 months covered.'} ${T('emergency', 'Why it matters')}</p>`; } },
  dual: { title: 'Minister tax rules: net effect', render: r => {
    const t = r.today;
    return mini([['Income tax saved', fmt(t.shield), 'good'], ['Extra payroll tax', fmt(t.extraPayroll), 'bad'], ['Net per year', (t.netAdvantage >= 0 ? '+' : '−') + fmt(Math.abs(t.netAdvantage)), t.netAdvantage >= 0 ? 'good' : 'bad']]) +
      `<p class="small" style="margin:0">Compared with the same pay as an ordinary employee. ${T('dualstatus', 'Dual tax status')} · ${T('seca', 'Self-employment tax')}</p>`; } },
  reflect: { title: 'Reflection', render: () => {
    const q = A.QUOTES[Math.floor(Date.now() / 86400000) % A.QUOTES.length], calling = A.store.get('mtw.calling', '');
    return `<blockquote class="wz-quote" style="font-size:1rem">${esc(q)}</blockquote>${calling ? `<p class="small muted" style="margin:0">You wrote: "${esc(calling)}"</p>` : ''}
      <div class="row">${go('audit', 'Talk it through with the AI coach')}</div>`; } },
  learn: { title: 'Keep learning', render: () => {
    const ids = ['compound', 'housing', 'setaside', 'roth', 'montecarlo'];
    return `<ul class="start-list" style="margin:0">${ids.map(id => `<li>${T(id, esc(A.TERMS[id].term))}</li>`).join('')}</ul>${go('learn', 'All terms')}`; } }
};
const DEFAULT = ['suggest', 'plan', 'paycheck', 'budget', 'taxset', 'outlook', 'housing', 'reflect'];
let order = (A.store.get('mtw.home', DEFAULT) || DEFAULT).filter(k => CARDS[k]);
// Introduce cards added in later versions once, without overriding a person's own arrangement
const known = A.store.get('mtw.homeKnown', null) || ['plan', 'paycheck', 'budget', 'taxset', 'outlook', 'housing', 'reflect', 'emergency', 'dual', 'learn'];
if (!known.includes('suggest') && !order.includes('suggest')) order.unshift('suggest');
A.store.set('mtw.homeKnown', Object.keys(CARDS)); A.store.set('mtw.home', order);
let editing = false, lastMfj = null;

function build(){
  const grid = $('homeGrid');
  grid.innerHTML = order.map((k, i) => { const c = CARDS[k]; return `<section class="home-card ${c.wide ? 'wide' : ''}" data-card="${k}" aria-label="${esc(c.title)}">
    <div class="hc-head"><h3>${esc(c.title)}</h3>${editing ? `<div class="hc-tools"><button type="button" data-mv="-1" data-k="${k}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(c.title)} up">↑</button><button type="button" data-mv="1" data-k="${k}" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(c.title)} down">↓</button><button type="button" data-hide="${k}">Hide</button></div>` : ''}</div>
    ${c.intro ? `<p class="small muted" style="margin:0">${esc(c.intro)}</p>` : ''}<div class="hc-body" id="hc-${k}"></div></section>`; }).join('') ||
    '<div class="card muted">Nothing on Home yet. Tap Customize to add cards.</div>';
  const hidden = Object.keys(CARDS).filter(k => !order.includes(k));
  $('homeAdd').hidden = !editing;
  $('homeAdd').innerHTML = `<span class="small"><strong>Add a card:</strong></span>${hidden.map(k => `<button class="btn" type="button" data-add="${k}">+ ${esc(CARDS[k].title)}</button>`).join('') || '<span class="small muted">All cards are showing.</span>'}
    <button class="linkish small" type="button" id="homeReset">Reset to default</button>`;
  order.forEach(k => { if (CARDS[k].mount) CARDS[k].mount($('hc-' + k)); });
  fill(A.getLast());
}
function fill(r){
  if (!r) return;
  const m = r.p.status === 'MFJ';
  if (lastMfj !== null && m !== lastMfj && order.includes('plan')) { lastMfj = m; return build(); }
  lastMfj = m;
  order.forEach(k => { const c = CARDS[k], el = $('hc-' + k); if (c.render && el) { const html = c.render(r); if (html !== null) el.innerHTML = html; } });
}
function save(){ A.store.set('mtw.home', order); build(); }

$('homeGrid').addEventListener('click', e => {
  const mv = e.target.closest('[data-mv]'); if (mv) { const k = mv.dataset.k, i = order.indexOf(k), j = i + +mv.dataset.mv; [order[i], order[j]] = [order[j], order[i]]; save(); const b = document.querySelector(`[data-card="${k}"] [data-mv="${mv.dataset.mv}"]`); if (b && !b.disabled) b.focus(); return; }
  const h = e.target.closest('[data-hide]'); if (h) { order = order.filter(k => k !== h.dataset.hide); save(); return; }
});
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { A.showTab(g.dataset.go); scrollTo(0, 0); } });
$('homeAdd').addEventListener('click', e => {
  const a = e.target.closest('[data-add]'); if (a) { order.push(a.dataset.add); save(); return; }
  if (e.target.id === 'homeReset') { order = DEFAULT.slice(); save(); }
});
$('btnHomeEdit').onclick = () => { editing = !editing; $('btnHomeEdit').textContent = editing ? 'Done' : 'Customize'; $('btnHomeEdit').setAttribute('aria-pressed', editing); build(); };
A.onRender(fill);
build();
})();
