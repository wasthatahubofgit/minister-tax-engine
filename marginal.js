/* "Where your next dollar is taxed", "Thresholds near you" and "Pre-tax or Roth?"
   All figures come from the engine by finite differences, so self-employment tax,
   credits, state tax and phase-outs are each counted once. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E;
const T = (id, text) => `<button type="button" class="term" data-term="${id}">${text}</button>`;
const pc = x => `${Math.round(x * 100)}%`;
const pc1 = x => `${(Math.round(x * 1000) / 10).toFixed(Math.abs(x) < 0.1 ? 1 : 0)}%`;

/* ---------- expected tax rate in retirement (federal + state) ---------- */
// For church-plan money: in years with unused housing allowance, one more dollar comes out tax-free.
function retRateAuto(r){
  const rows = (r.ret && r.ret.rows) || [];
  const m = rows.map(x => x.marginal).sort((a, b) => a - b);
  const fed = m.length ? m[Math.floor(m.length / 2)] : 0.12;
  const st = E.TAX.state.mode === 'none' ? 0 : (E.TAX.state.rate || 0);
  const open = rows.length ? rows.filter(x => x.allow > 0 && x.housingExcluded < x.allow - 1).length / rows.length : 0;
  return { fed, st, total: fed + st, shieldShare: open };
}
function retRate(r){
  const auto = retRateAuto(r), pick = A.store.get('mtw.retRateGuess', 'auto'), p = r.p;
  const fed = pick === 'auto' ? auto.fed : +pick, total = fed + auto.st;
  const church = Math.min(1, Math.max(0, p.churchPlanPct || 0));
  return { pick, fed, st: auto.st, total, shieldShare: auto.shieldShare, minTotal: total * (1 - church * auto.shieldShare) };
}

/* ---------- next dollar ---------- */
function rateBar(l, payLabel){
  const seg = (v, c, t) => v > 0.0005 ? `<i style="width:${Math.min(100, v * 100 * 2).toFixed(1)}%;background:var(${c})" title="${esc(t)} ${pc1(v)}"></i>` : '';
  return `<div class="stackbar nd-bar" aria-hidden="true">${seg(l.fed, '--accent', 'Federal')}${seg(l.cred || 0, '--c-church', 'Tax credits')}${seg(l.state, '--c-brok', 'State')}${seg(l.payroll, '--c-rmd', payLabel)}${seg(l.aca || 0, '--warn', 'Marketplace subsidy')}</div>`;
}
function partsText(l, payLabel){
  const bits = [['fed', 'federal'], ['cred', 'tax credits'], ['state', 'state'], ['payroll', payLabel], ['aca', 'Marketplace subsidy']]
    .filter(([k]) => l[k] && Math.abs(l[k]) >= 0.0005);
  if (!bits.length) return 'no tax effect';
  return bits.map(([k, n], i) => `${i ? (l[k] < 0 ? ' − ' : ' + ') : (l[k] < 0 ? '−' : '')}${pc1(Math.abs(l[k]))} ${n}`).join('');
}
function nextDollarHtml(r, compact){
  const p = r.p, nd = E.nextDollar(p), L = k => nd.lines.find(x => x.key === k);
  const payOf = k => (k === 'spouse' || k.startsWith('sp')) ? 'Social Security & Medicare' : 'self-employment tax';
  const row = l => {
    const pay = payOf(l.key), dollars = Math.round(l.rate * 1000), over = l.rate > 1;
    const verb = l.kind === 'earn' ? `costs ${fmt(dollars)} in tax` : `saves ${fmt(Math.max(0, dollars))} now`;
    return `<li class="nd-row"><div class="nd-top"><span>${esc(l.label)}</span><b>${over ? 'over 100%' : pc(l.rate)}</b></div>
      ${rateBar(l, pay)}<div class="small muted">$1,000 ${verb}: ${partsText(l, pay)}${l.kind === 'save' && l.room !== undefined && l.room <= 0 ? ' · <strong>at the limit</strong>' : ''}${over ? ' · a credit cliff is just ahead (see Thresholds near you)' : ''}</div></li>`;
  };
  const earn = nd.lines.filter(l => l.kind === 'earn'), save = nd.lines.filter(l => l.kind === 'save');
  const church = L('church') || L('side'), bi = nd.bracket;
  let head = '';
  if (church) head = `<p class="small" style="margin:0">Your next $1,000 of ${L('church') ? 'church salary' : 'honoraria'} costs about <strong>${fmt(church.rate * 1000)}</strong> in tax (${pc(church.rate)}), not just the ${pc(bi.rate)} ${T('marginal', 'bracket')}, because ministers pay both halves of Social Security and Medicare through ${T('seca', 'self-employment tax')}${church.aca > 0.0005 ? ` and your ${T('aca', 'Marketplace subsidy')} shrinks` : ''}.</p>`;
  let edge = '';
  if (nd.edge && nd.edge.need && nd.edge.need.amount > 0) {
    const n = nd.edge.need;
    edge = `<p class="small" style="margin:0">Your first <strong>${fmt(n.amount)}</strong> of extra pre-tax saving${n.sp > 0 && n.min > 0 ? ` (${fmt(n.min)} in your 403(b), then ${fmt(n.sp)} in your spouse's plan)` : n.sp > 0 ? " in your spouse's plan" : ''} comes off income taxed at ${pc(nd.edge.rate)} federal. After that, it comes off ${pc(nd.edge.rateBelow)} income.</p>`;
  } else if (nd.edge && !nd.edge.need) {
    edge = `<p class="small" style="margin:0">Pre-tax saving alone can't bring you below the ${pc(nd.edge.rate)} bracket this year; it is ${fmt(bi.roomDown)} of taxable income above it.</p>`;
  }
  if (bi.rate > 0 && bi.rateAbove - bi.rate >= 0.05 && bi.roomUp < 15000)
    edge += `<p class="small" style="margin:0">You have <strong>${fmt(bi.roomUp)}</strong> of taxable income left before the ${pc(bi.rateAbove)} federal bracket starts.</p>`;
  if (compact) {
    const pick = ['church', 'spouse', 'minPre', 'spPre'].map(L).filter(Boolean);
    return head + `<ul class="nd-list">${pick.map(row).join('')}</ul><button type="button" class="linkish small" data-go="pay">See every kind of money</button>`;
  }
  return `<div class="setaside">${head}
    <h4 class="nd-h">Earning $1,000 more</h4><ul class="nd-list">${earn.map(row).join('')}</ul>
    <h4 class="nd-h">Saving or shifting $1,000 more</h4><ul class="nd-list">${save.map(row).join('')}</ul>
    ${edge}
    <p class="small muted" style="margin:0">Rates are for the next $1,000 with everything else as entered, and include credits that shrink as income rises. Roth saving only changes this year's tax through the ${T('saverscredit', "Saver's Credit")}.</p></div>`;
}

/* ---------- thresholds ---------- */
const MEASURE = { agi: 'adjusted gross income', taxable: 'taxable income', med: 'wages and self-employment earnings' };
function backText(o){
  if (!o.above) return '';
  if (!o.back) return o.room > 0 ? `<p class="small" style="margin:0">Pre-tax saving room left this year (${fmt(o.room)}) isn't enough to get back under.</p>` : '';
  const where = o.back.min > 0 && o.back.sp > 0 ? `${fmt(o.back.min)} in your 403(b) and ${fmt(o.back.sp)} in your spouse's plan` : o.back.sp > 0 ? "in your spouse's plan" : 'in your 403(b)';
  return `<p class="small" style="margin:0"><strong>About ${fmt(o.back.amount)} more pre-tax saving</strong> (${where}) gets you back under${o.cost > 0 ? `, worth about ${fmt(o.cost)} on top of the tax the saving itself saves` : ''}.</p>`;
}
function thresholdsHtml(r, compact){
  const th = E.thresholds(r.p), list = compact ? th.list.slice(0, 3) : th.list;
  if (!list.length) return `<p class="small" style="margin:0">No major tax lines are within reach of your income right now. An extra dollar earned or saved works the way <strong>Where your next dollar is taxed</strong> shows.</p>${compact ? '<button type="button" class="linkish small" data-go="pay">See the details</button>' : ''}`;
  const item = o => {
    const tone = o.above ? 'warn' : o.gap < 3000 && (o.kind === 'cliff') ? 'bad' : o.kind === 'room' ? 'good' : 'warn';
    const pill = o.kind === 'room' ? `${fmt(o.gap)} of room` : o.above ? `${fmt(o.gap)} above` : `${fmt(o.gap)} below`;
    return `<li class="sg-item"><div class="sg-top"><span class="status-pill ${tone}">${pill}</span><strong>${T(o.term, esc(o.name))}</strong></div>
      <p>${esc(o.effect)}</p>
      ${compact ? '' : `<p class="small muted" style="margin:0">Line: ${fmt(o.at)} of ${MEASURE[o.measure]}. Yours: ${fmt(o.value)}.</p>`}
      ${backText(o)}</li>`;
  };
  return `<ul class="sg-list">${list.map(item).join('')}</ul>` +
    (compact ? `<button type="button" class="linkish small" data-go="pay">${th.list.length > 3 ? `See all ${th.list.length}` : 'See the details'}</button>`
      : `<p class="small muted" style="margin:0">Only lines within reach of your income are shown. Your housing allowance is already left out of adjusted gross income.${r.p.acaMarket ? '' : ' If you buy health insurance on the Marketplace, check that box under Household to see the subsidy cliff.'}</p>`);
}

/* ---------- pre-tax or Roth ---------- */
function splitBlock(r, who, rr){
  const p = r.p, s = E.bestSplit(p, who, who === 'min' ? rr.minTotal : rr.total);
  const nd = E.nextDollar(p), pre = nd.lines.find(l => l.key === (who === 'min' ? 'minPre' : 'spPre'));
  if (!pre) return '';
  const name = who === 'min' ? 'Your 403(b)' : "Your spouse's plan", rate = who === 'min' ? rr.minTotal : rr.total;
  const why = who === 'min'
    ? `A pre-tax dollar saves about <strong>${pc(pre.rate)}</strong> now (${partsText(pre, 'self-employment tax')}). A Roth dollar still pays all of that. ${rr.shieldShare > 0 && p.churchPlanPct > 0 ? 'And church-plan pre-tax money may come out tax-free later as housing allowance, which lowers the retirement rate it is compared with.' : ''}`
    : `A pre-tax dollar saves about <strong>${pc(pre.rate)}</strong> now (${partsText(pre, 'Social Security & Medicare')}). Social Security and Medicare are paid either way, so this is a straight comparison of tax rates now and later.`;
  if (!s) return `<div class="split-block"><h4 class="nd-h">${name}</h4><p class="small" style="margin:0">${why} Nothing is going in yet; once it is, this will suggest a split.</p></div>`;
  const same = Math.abs(s.pre - s.cur) < 500 || s.gain < 50;
  const verdict = s.pre >= s.total - 1 ? 'all pre-tax' : s.pre <= 1 ? 'all Roth' : `${fmt(s.pre)} pre-tax, then ${fmt(s.roth)} Roth`;
  return `<div class="split-block"><h4 class="nd-h">${name}: ${fmt(s.total)} a year</h4>
    <p class="small" style="margin:0">${why}</p>
    <div class="mini-kpis"><div><span class="eyebrow">Now</span><b>${fmt(s.cur)} pre-tax · ${fmt(s.curRoth)} Roth</b></div>
      <div><span class="eyebrow">Suggested</span><b style="color:var(--accent)">${verdict}</b></div>
      <div><span class="eyebrow">Worth</span><b>${same ? (Math.abs(s.pre - s.cur) < 500 ? 'Already close' : 'About even') : `about ${fmt(s.gain)}/yr`}</b></div></div>
    <p class="small" style="margin:0">${s.pre > 1 && s.pre < s.total - 1 ? `Pre-tax wins until your taxable income drops to the next bracket down; beyond that, a dollar saves less now than it is likely to cost in retirement (${pc(rate)}), so Roth wins.` : s.pre >= s.total - 1 ? `Every pre-tax dollar here saves more now than it is likely to cost in retirement (${pc(rate)}).` : `At your income, a pre-tax dollar saves less now than it is likely to cost in retirement (${pc(rate)}).`}</p>
    ${same ? '' : `<div class="row"><button type="button" class="btn" data-split-apply="${who}" data-pre="${s.pre}" data-roth="${s.roth}">Use this split</button><span class="small muted">You can change it back any time.</span></div>`}</div>`;
}
function splitHtml(r){
  const p = r.p, mfj = p.status === 'MFJ', rr = retRate(r);
  const shielded = p.churchPlanPct > 0 && rr.shieldShare > 0;
  const opts = [['auto', `From my plan (${pc(retRateAuto(r).fed)} federal)`], ['0.1', '10% federal'], ['0.12', '12% federal'], ['0.22', '22% federal'], ['0.24', '24% federal'], ['0.32', '32% federal']];
  return `<div class="setaside">
    <p class="small" style="margin:0">Pre-tax saves tax now and is taxed when you take it out; Roth is the reverse. The better choice depends on your tax rate <em>now</em> versus <em>in retirement</em>.</p>
    <div class="field"><label for="retRateGuess">Your expected tax rate in retirement<small>Plus ${pc1(rr.st)} state.${shielded ? ` In ${pc(rr.shieldShare)} of your retirement years, more church-plan money would come out tax-free as housing allowance, so your 403(b) uses about ${pc(rr.minTotal)}.` : ''}</small></label>
      <select id="retRateGuess">${opts.map(([v, l]) => `<option value="${v}" ${rr.pick === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
    ${p.minComp > 0 ? splitBlock(r, 'min', rr) : ''}
    ${mfj && p.spGross > 0 ? splitBlock(r, 'sp', rr) : ''}
    <p class="small muted" style="margin:0">Use a split only if the plan offers a Roth option. Roth money also has no required withdrawals and keeps retirement income (and the tax on Social Security) lower. If you expect higher tax rates later, lean Roth.</p></div>`;
}

/* ---------- mount ---------- */
function render(r){
  if (!r) return;
  const f = $('acaSubsidy'); if (f) f.closest('.field').hidden = !$('acaMarket').checked;
  const nd = $('nextDollarOut'); if (nd) nd.innerHTML = nextDollarHtml(r);
  const th = $('thresholdsOut'); if (th) th.innerHTML = thresholdsHtml(r);
  const sp = $('splitOut'); if (sp) sp.innerHTML = splitHtml(r);
}
document.addEventListener('change', e => {
  if (e.target.id === 'retRateGuess') { A.store.set('mtw.retRateGuess', e.target.value); render(A.getLast()); if (A.refreshSuggestions) A.refreshSuggestions(); }
  if (e.target.id === 'acaMarket') { const f = $('acaSubsidy'); if (f) f.closest('.field').hidden = !e.target.checked; }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-split-apply]'); if (!b) return;
  const who = b.dataset.splitApply, pre = who === 'min' ? 'minPreTax' : 'spPreTax', roth = who === 'min' ? 'minRoth403b' : 'spRoth401k';
  $(pre).value = b.dataset.pre; $(roth).value = b.dataset.roth;
  A.recalc();
});
A.onRender(render);
Object.assign(A, { nextDollarHtml, thresholdsHtml, retRate, retRateAuto });
})();
