/* Expected income outside the church paycheck: one-off gigs (weddings, funerals, speaking) and contract pay.
   The list is saved with everything else; its totals feed side income, so tax and set-aside advice follow. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E;
const FREQ = [['once', 'One time'], ['monthly', 'Every month'], ['biweekly', 'Every 2 weeks'], ['weekly', 'Every week'], ['quarterly', 'Every 3 months']];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const KINDS = [['Wedding', 'once'], ['Funeral', 'once'], ['Conference talk', 'once'], ['Guest preaching', 'once'], ['Contract (monthly)', 'monthly'], ['Writing or royalties', 'quarterly'], ['Other', 'once']];
const box = $('gigsBox'); if (!box) return;
const thisMonth = () => new Date().getMonth() + 1;
const gigs = () => A.VS.gigs;
const total = g => E.gigSummary([g]).income;

function line(g, i) {
  const rec = g.freq && g.freq !== 'once';
  return `<li class="gig" data-i="${i}">
    <input class="gig-name" data-f="name" value="${esc(g.name || '')}" placeholder="What is it? (for example, Smith wedding)" aria-label="Description">
    <label>${rec ? 'Amount each payment' : 'Amount'}<input type="number" inputmode="decimal" data-f="amount" value="${g.amount || ''}" step="50" min="0"></label>
    <label>How often<select data-f="freq">${FREQ.map(([v, l]) => `<option value="${v}" ${g.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>${rec ? 'First payment' : 'Month'}<select data-f="month">${MONTHS.map((m, k) => `<option value="${k + 1}" ${+g.month === k + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    ${rec ? `<label>Payments this year<input type="number" inputmode="numeric" data-f="count" value="${g.count === undefined || g.count === '' ? E.gigDefaultCount(g.freq, g.month) : g.count}" step="1" min="0"></label>` : '<span></span>'}
    <label style="grid-column:1 / -1">Costs of earning it (travel, supplies), total<input type="number" inputmode="decimal" data-f="cost" value="${g.cost || ''}" step="25" min="0"></label>
    <div class="gig-foot"><span data-total>${total(g) > 0 ? `${fmt(total(g))} this year` : ''}</span><button type="button" data-del>Remove</button></div></li>`;
}
function render() {
  const sum = E.gigSummary(gigs());
  box.innerHTML = `<div class="gig-chips"><span class="small muted">Add:</span>${KINDS.map(([k]) => `<button type="button" class="btn" data-add="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    ${gigs().length ? `<ul class="gig-list">${gigs().map(line).join('')}</ul>
      <p class="small" style="margin:6px 0 0" data-sum>${sum.income > 0 ? `<strong>${fmt(sum.income)}</strong> expected${sum.cost > 0 ? `, ${fmt(sum.cost)} in costs` : ''}.` : ''}</p>` : ''}`;
}
function updateSum() {
  const sum = E.gigSummary(gigs()), s = box.querySelector('[data-sum]');
  if (s) s.innerHTML = sum.income > 0 ? `<strong>${fmt(sum.income)}</strong> expected${sum.cost > 0 ? `, ${fmt(sum.cost)} in costs` : ''}.` : '';
  box.querySelectorAll('.gig').forEach(li => { const t = li.querySelector('[data-total]'), v = total(gigs()[+li.dataset.i] || {}); if (t) t.textContent = v > 0 ? `${fmt(v)} this year` : ''; });
}
box.addEventListener('click', e => {
  const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]');
  if (add) {
    const kind = KINDS.find(k => k[0] === add.dataset.add), freq = kind[1], month = thisMonth();
    gigs().push({ name: add.dataset.add === 'Other' ? '' : add.dataset.add, amount: 0, freq, month, ...(freq !== 'once' ? { count: E.gigDefaultCount(freq, month) } : {}), cost: 0 });
    render(); A.schedule(); const last = box.querySelectorAll('.gig'); const f = last[last.length - 1]; if (f) f.querySelector('[data-f="amount"]').focus();
  } else if (del) { gigs().splice(+del.closest('.gig').dataset.i, 1); render(); A.schedule(); }
});
box.addEventListener('input', e => {
  const el = e.target, li = el.closest('.gig'); if (!li || !el.dataset.f || el.tagName === 'SELECT') return;
  const g = gigs()[+li.dataset.i]; if (!g) return;
  g[el.dataset.f] = el.dataset.f === 'name' ? el.value : (parseFloat(el.value) || 0);
  if (el.dataset.f === 'count') g.countSet = true;
  updateSum();
});
box.addEventListener('change', e => {
  const el = e.target, li = el.closest('.gig'); if (!li || el.tagName !== 'SELECT') return;
  const g = gigs()[+li.dataset.i]; if (!g) return;
  g[el.dataset.f] = el.dataset.f === 'month' ? +el.value : el.value;
  if (g.freq === 'once') delete g.count;
  else if (el.dataset.f === 'freq' || (el.dataset.f === 'month' && !g.countSet)) { g.count = E.gigDefaultCount(g.freq, g.month); delete g.countSet; }
  render(); A.schedule();
});
A.renderGigs = render;
render();
})();
