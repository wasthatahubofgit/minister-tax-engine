/* Monthly budget at three levels of detail. All levels share one set of detailed lines,
   so switching levels never loses numbers: a category total is the sum of its lines, and
   editing a category spreads the change across its lines in proportion. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt;

const GROUPS = {
  h_rent: { label: 'Rent or mortgage payment', color: '--c-house', housing: true },
  h_util: { label: 'Utilities', hint: 'Electric, gas, water, trash', color: '--c-house', housing: true },
  h_ins: { label: "Home or renter's insurance", color: '--c-house', housing: true },
  h_tax: { label: 'Property tax', color: '--c-house', housing: true },
  h_furn: { label: 'Furnishings and appliances', color: '--c-house', housing: true },
  h_repair: { label: 'Repairs and upkeep', color: '--c-house', housing: true },
  h_hoa: { label: 'HOA fees and other housing', color: '--c-house', housing: true },
  giving: { label: 'Giving', color: '--c-roth' },
  food: { label: 'Groceries and dining', color: '--c-trad' },
  transport: { label: 'Transportation', color: '--c-spouse' },
  kids: { label: 'Kids, childcare and education', color: '--c-conv' },
  health: { label: 'Health and insurance', color: '--c-rmd' },
  debt: { label: 'Debt payments', color: '--bad' },
  personal: { label: 'Personal and household', color: '--c-brok' },
  other: { label: 'Other', color: '--c-fixed' }
};
// Detailed lines → standard group → simple group
const LINES = [
  ['h_rent', 'h_rent'], ['h_util', 'h_util'], ['h_ins', 'h_ins'], ['h_tax', 'h_tax'], ['h_furn', 'h_furn'], ['h_repair', 'h_repair'], ['h_hoa', 'h_hoa'],
  ['g_church', 'giving', 'Church giving or tithe'], ['g_other', 'giving', 'Other charitable giving'],
  ['f_groc', 'food', 'Groceries'], ['f_dine', 'food', 'Dining out'],
  ['t_car', 'transport', 'Car payments'], ['t_fuel', 'transport', 'Fuel'], ['t_ins', 'transport', 'Auto insurance'], ['t_maint', 'transport', 'Car maintenance'], ['t_transit', 'transport', 'Transit and rideshare'],
  ['k_care', 'kids', 'Childcare'], ['k_school', 'kids', 'School and tuition'], ['k_act', 'kids', "Kids' activities"],
  ['m_prem', 'health', 'Health insurance premiums'], ['m_oop', 'health', 'Medical and dental costs'], ['m_life', 'health', 'Life and disability insurance'],
  ['d_cc', 'debt', 'Credit cards'], ['d_student', 'debt', 'Student loans'], ['d_other', 'debt', 'Other loans'],
  ['p_phone', 'personal', 'Phone and internet'], ['p_subs', 'personal', 'Subscriptions'], ['p_cloth', 'personal', 'Clothing'], ['p_care', 'personal', 'Personal care'], ['p_house', 'personal', 'Household supplies'],
  ['o_gifts', 'other', 'Gifts'], ['o_travel', 'other', 'Travel and vacation'], ['o_ministry', 'other', 'Unreimbursed ministry expenses'], ['o_misc', 'other', 'Everything else']
];
const SIMPLE_OF = g => GROUPS[g].housing ? g : g === 'giving' ? 'giving' : 'rest';
const SIMPLE_LABEL = { giving: 'Giving', rest: 'Everything else', hint: 'Food, transportation, kids, health, debt, personal and other' };
const lineGroup = Object.fromEntries(LINES.map(([id, g]) => [id, g]));
const lineLabel = Object.fromEntries(LINES.map(([id, g, l]) => [id, l || GROUPS[g].label]));

const B = () => A.VS.budget;
const val = id => +B()[id] || 0;
const linesOf = key => LINES.filter(([id, g]) => (key === 'rest' ? SIMPLE_OF(g) === 'rest' : key === 'everyday' ? !GROUPS[g].housing && g !== 'giving' : key === 'housing' ? GROUPS[g].housing : g === key || id === key)).map(([id]) => id);
const sumOf = key => linesOf(key).reduce((a, id) => a + val(id), 0);
function setTotal(key, amount){
  const ids = linesOf(key), cur = ids.reduce((a, id) => a + val(id), 0);
  amount = Math.max(0, Math.round(amount));
  if (cur > 0) { let left = amount; ids.forEach((id, i) => { const v = i === ids.length - 1 ? left : Math.round(val(id) * amount / cur); B()[id] = Math.max(0, v); left -= Math.max(0, v); }); }
  else { ids.forEach(id => { B()[id] = 0; }); B()[key === 'housing' ? 'h_rent' : ids[ids.length - 1]] = amount; }
}

/* ---------- render inputs (only when the level changes or data is loaded) ---------- */
function rowHtml(key, label, hint, value, cls){
  return `<div class="bl ${cls || ''}"><label for="b_${key}">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</label><input type="number" id="b_${key}" data-bkey="${key}" min="0" step="10" inputmode="decimal" value="${Math.round(value) || ''}" placeholder="0"></div>`;
}
function renderInputs(){
  const mode = A.VS.budgetMode;
  document.querySelectorAll('[data-bmode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.bmode === mode));
  $('bHousing').innerHTML = LINES.filter(([id, g]) => GROUPS[g].housing).map(([id, g]) => rowHtml(id, GROUPS[g].label, GROUPS[g].hint, val(id))).join('');
  let html = '';
  if (mode === 'simple') html = rowHtml('giving', 'Giving', 'Church and other charitable giving', sumOf('giving')) + rowHtml('rest', SIMPLE_LABEL.rest, SIMPLE_LABEL.hint, sumOf('rest'));
  else if (mode === 'standard') html = Object.keys(GROUPS).filter(g => !GROUPS[g].housing).map(g => rowHtml(g, GROUPS[g].label, '', sumOf(g))).join('');
  else html = Object.keys(GROUPS).filter(g => !GROUPS[g].housing).map(g => `<div class="bl group"><label>${esc(GROUPS[g].label)}</label><span class="num small muted" id="bg_${g}">${fmt(sumOf(g))}</span></div>` +
      linesOf(g).map(id => rowHtml(id, lineLabel[id], '', val(id), 'child')).join('')).join('');
  $('bOther').innerHTML = html;
  $('linkHousing').checked = A.VS.linkHousing;
  renderSummary();
}
A.renderBudget = renderInputs;

/* ---------- live totals and summary ---------- */
function renderSummary(){
  const r = A.getLast(); if (!r) return;
  const left = r.today.householdNet / 12, total = A.budgetMo(), housing = sumOf('housing'), surplus = left - total;
  $('bHousingTotal').textContent = fmt(housing) + '/mo · ' + fmt(housing * 12) + '/yr';
  $('bOtherTotal').textContent = fmt(total - housing) + '/mo';
  document.querySelectorAll('[id^=bg_]').forEach(el => { el.textContent = fmt(sumOf(el.id.slice(3))); });
  const groups = [['housing', 'Housing', '--c-house']].concat(Object.keys(GROUPS).filter(g => !GROUPS[g].housing).map(g => [g, GROUPS[g].label, GROUPS[g].color]));
  const parts = groups.map(([k, l, c]) => [l, sumOf(k), c]).filter(p => p[1] > 0);
  const scale = Math.max(left, total) || 1;
  const giving = sumOf('giving'), gross = (r.p.minComp + (r.p.status === 'MFJ' ? r.p.spGross : 0)) / 12;
  const allowance = r.p.housingDesignated / 12;
  $('budgetSum').innerHTML = total === 0
    ? `<p class="small muted" style="margin:0">Start with housing, giving, and one total for everything else. You can add detail later. You have <strong>${fmt(left)}/mo</strong> to plan after taxes and saving.</p>`
    : `<div class="mini-kpis">
        <div><span class="eyebrow">Available after taxes &amp; saving</span><b>${fmt(left)}</b></div>
        <div><span class="eyebrow">Budgeted</span><b>${fmt(total)}</b></div>
        <div><span class="eyebrow">${surplus >= 0 ? 'Surplus' : 'Shortfall'}</span><b style="color:var(--${surplus >= 0 ? 'good' : 'bad'})">${fmt(Math.abs(surplus))}</b></div>
        <div><span class="eyebrow">Giving</span><b>${gross > 0 ? (giving / gross * 100).toFixed(1) + '%' : '–'}</b><span class="small muted">of gross income</span></div>
      </div>
      <div class="stackbar" role="img" aria-label="Budget by category">${parts.map(([l, v, c]) => `<i style="width:${(v / scale * 100).toFixed(2)}%;background:var(${c})" title="${esc(l)}: ${fmt(v)}"></i>`).join('')}</div>
      <div class="legend2">${parts.map(([l, v, c]) => `<span style="--c:var(${c})">${esc(l)} ${fmt(v)}</span>`).join('')}</div>
      ${allowance > 0 && housing > 0 ? `<p class="small" style="margin:0">Housing costs ${fmt(housing)}/mo vs. a designated allowance of ${fmt(allowance)}/mo. ${housing < allowance ? `<span class="status-pill warn">${fmt(allowance - housing)}/mo of the allowance would be taxable</span>` : '<span class="status-pill good">Allowance is fully used</span>'}</p>` : ''}
      ${surplus < 0 ? `<p class="small" style="margin:0;color:var(--bad)">This plan spends ${fmt(-surplus)}/mo more than you bring home. The monthly plan on Home can help you find room.</p>` : ''}`;
}
A.budgetSumOf = sumOf; A.budgetSetTotal = setTotal; A.BUDGET_GROUPS = GROUPS;

/* ---------- events ---------- */
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.bkey; if (!k) return;
  const v = Math.max(0, parseFloat(e.target.value) || 0);
  if (lineGroup[k]) B()[k] = v; else setTotal(k, v);
  if (A.VS.budgetMode === 'detailed') document.querySelectorAll('[id^=bg_]').forEach(el => { el.textContent = fmt(sumOf(el.id.slice(3))); });
  A.VS.budgetExample = false;
  A.schedule(true);
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.bkey) A.schedule(false); });
document.querySelectorAll('[data-bmode]').forEach(b => b.addEventListener('click', () => { A.VS.budgetMode = b.dataset.bmode; renderInputs(); A.store.set('mtw.inputs', A.rawInputs()); }));
A.onRender(renderSummary);
renderInputs();
})();
