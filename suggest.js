/* "Worth discerning": rule-based prompts that point people toward specific moves
   (or warn them) based on their own numbers. Each one explains why, estimates the
   effect, and offers a next step, a deeper explanation, and an AI conversation. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E;
const SALT_CAP_2026 = 40400;            // OBBBA: $40,000 for 2025, +1% a year; phases down above ~$505,000 MAGI
const LEVEL = { act: ['Act soon', 'bad'], consider: ['Consider', 'warn'], learn: ['Good to know', 'good'] };

function realIncomeFrom(perMo, r){     // $/mo saved now → $/mo of retirement income (today's $)
  const p = r.p, Y = Math.max(0, Math.round(p.yearsToRetire)), n = Math.max(1, Math.round(p.retYears));
  const ra = p.accReturn, fv = ra ? perMo * 12 * ((Math.pow(1 + ra, Y) - 1) / ra) : perMo * 12 * Y;
  const pv = fv / Math.pow(1 + p.inflation, Y), real = (1 + p.retReturn) / (1 + p.inflation) - 1;
  return (Math.abs(real) < 1e-9 ? pv / n : pv * real / (1 - Math.pow(1 + real, -n))) / 12;
}

function rules(r){
  const p = r.p, t = r.today, a = t.setAside, out = [], mfj = p.status === 'MFJ';
  const stRate = E.TAX.state.rate || 0, mr = t.marginalFed + stRate;
  const add = (id, level, title, why, impact, go, term, extra) => out.push(Object.assign({ id, level, title, why, impact, go, term }, extra || {}));
  const budget = A.budgetMo(), avail = t.householdNet / 12;
  const giving = (p.cashGiving || 0);

  // ---- Taxes owed this year
  if (a.gap > 1000) {
    if (!a.safe) add('underwithheld', 'act', "Set aside more for this year's taxes",
      `You're on track to owe about ${fmt(a.gap)} in April, and may owe an underpayment penalty.`,
      `Ask the church for about ${fmt(a.churchFedMonthly)}/mo in voluntary withholding, or pay about ${fmt(a.quarterlyNeeded)} each quarter.`, 'pay', 'setaside', { score: a.gap });
    else add('owesafe', 'consider', `Plan for a ${fmt(a.gap)} tax bill in April`,
      "You're likely past the penalty threshold, but the bill is still coming.",
      `Setting aside ${fmt(a.gap / 12)}/mo in a high-yield savings account keeps it from being a surprise.`, 'pay', 'hysa', { score: a.gap / 2 });
  }
  if (t.otherNet > 0) {
    const t0 = E.computeToday(Object.assign({}, p, { otherSEIncome: 0, otherSEExpenses: 0 }));
    const extra = a.due - t0.setAside.due;
    add('sideincome', a.gap > 0 ? 'act' : 'learn', `Set aside ${Math.round(extra / t.otherNet * 100)}% of each speaking or honorarium payment`,
      `Your expected ${fmt(t.otherNet)} of other income adds about ${fmt(extra)} of tax, and nobody withholds it for you.`,
      'Raise church withholding, hold it in a high-yield savings account, or pay quarterly.', 'pay', 'sideincome', { score: extra / 2 });
    if (t.otherNet >= 5000) add('sep', 'consider', 'Consider a SEP-IRA or solo 401(k) for your side income',
      'Retirement accounts for self-employment income lower the income tax on it.',
      `Up to about ${fmt(Math.max(0, (t.otherNet - t.otherSECA / 2) * 0.2))} could go in, saving roughly ${fmt(Math.max(0, (t.otherNet - t.otherSECA / 2) * 0.2) * mr)} of tax.`, 'pay', 'sep', { score: (t.otherNet - t.otherSECA / 2) * 0.2 * mr });
  }

  // ---- Housing allowance
  const lim = Math.min(p.housingActual, p.housingFRV);
  if (p.minComp > 0 && lim - p.housingDesignated > 1000) {
    const target = Math.min(lim, p.minComp);
    const t2 = E.computeToday(Object.assign({}, p, { housingDesignated: target }));
    const save = t.minScenario.incomeTax - t2.minScenario.incomeTax;
    if (save > 100) add('housingroom', 'act', p.housingDesignated > 0 ? 'Ask for a larger housing allowance designation' : 'Ask your church to designate a housing allowance',
      `Your housing costs and fair rental value support about ${fmt(target)} a year, but only ${fmt(p.housingDesignated)} is designated.`,
      `Designating ${fmt(target)} could save about ${fmt(save)} a year in income tax. It must be set in advance, often at the December board meeting.`, 'pay', 'housing', { score: save });
  }
  if (t.housingExcess > 0) add('housingexcess', 'consider', 'Your housing allowance is more than you can use',
    `${fmt(t.housingExcess)} of the designation is above your actual costs or fair rental value, so it is taxable and must be reported as income.`,
    'Before next year, ask the church to set the designation closer to your expected housing costs. Keep receipts either way.', 'pay', 'housing', { score: t.housingExcess * 0.05 });
  if (t.netAdvantage < 0) add('dualnegative', 'consider', `Minister tax rules are costing you ${fmt(-t.netAdvantage)} a year`,
    "The income tax your housing allowance saves doesn't cover the extra self-employment tax you pay.",
    t.breakEven !== null ? `Break-even is a ${fmt(t.breakEven)} housing allowance. If your real housing costs reach that, a larger designation turns this around.` : 'Talk with a clergy tax professional about the best arrangement.', 'pay', 'netadvantage', { score: -t.netAdvantage });

  // ---- Giving: bunching with a donor-advised fund
  if (giving >= 3000) {
    const std = E.TAX.stdDed[p.status] + [p.minAge].concat(mfj ? [p.spAge] : []).filter(x => x >= 65).length * E.TAX.addl65[p.status];
    const salt = Math.min(SALT_CAP_2026, t.minScenario.stTax + A.budgetSumOf('h_tax') * 12);
    const base = salt + (p.mortgageInterest || 0), floor = 0.005 * t.minScenario.agi;
    const nonItem = Math.min(giving, mfj ? 2000 : 1000);
    const normal = Math.max(base + giving - floor - std, nonItem);           // yearly benefit above the standard deduction
    const bunch = Math.max(0, base + 2 * giving - floor - std);              // bunch year; next year takes the standard deduction
    const save = (bunch - 2 * normal) * t.marginalFed;
    if (save >= 250) add('daf', 'consider', 'Consider bunching your giving with a donor-advised fund',
      `You give about ${fmt(giving)} a year. Putting two years of giving into a donor-advised fund in one year lets you itemize that year and take the standard deduction the next.`,
      `Estimated tax saved: about ${fmt(save)} every two years. Your church keeps receiving regular gifts through grants from the fund.${p.mortgageInterest ? '' : ' Add mortgage interest (Detailed view) for a better estimate.'}`, 'budget', 'daf', { score: save / 2 });
    if (p.brokerageBal > 20000) add('stockgift', 'learn', 'Give appreciated investments instead of cash',
      'Giving stock that has grown in value avoids capital gains tax on the growth. A donor-advised fund makes it easy for a church that cannot accept stock.',
      'Most helpful in years you itemize.', 'grow', 'daf', { score: 50 });
  }

  // ---- Cash and budget
  const moSpend = budget > 0 ? budget : avail, months = moSpend > 0 ? p.cashBal / moSpend : 0;
  if (months < 3) add('emergency', months < 1 ? 'act' : 'consider', 'Build your emergency fund',
    `Your cash covers about ${months.toFixed(1)} months of spending. Three months is a common first goal.`,
    `About ${fmt(Math.max(0, 3 * moSpend - p.cashBal))} more gets you there, or ${fmt(Math.max(0, 3 * moSpend - p.cashBal) / 12)}/mo for a year.`, 'grow', 'emergency', { score: 3 * moSpend - p.cashBal });
  if (months > 6 && p.cashBal > 10000) {
    const extra = p.cashBal - 6 * moSpend;
    add('excesscash', 'consider', 'Cash beyond six months could work harder',
      `You hold about ${fmt(extra)} more than six months of spending in cash.`,
      `At least move it to a high-yield savings account${p.cashRate < 0.035 ? ` (yours is set to ${(p.cashRate * 100).toFixed(1)}%)` : ''}, or consider investing some for long-term goals.`, 'grow', 'hysa', { score: extra * 0.02 });
  }
  if (budget > 0 && budget - avail > 50) add('overbudget', 'act', 'Your budget spends more than you bring home',
    `The budget is ${fmt(budget - avail)} a month over what's left after taxes and saving.`,
    'Use the monthly plan on Home to see where to adjust.', 'home', 'budget', { score: (budget - avail) * 12 });
  if (budget === 0) add('nobudget', 'learn', 'Sketch a rough budget', 'Even three rough numbers (housing, giving, everything else) show whether your plan adds up, and housing lines can sharpen your housing allowance.', 'About five minutes.', 'budget', 'budget', { score: 10 });

  // ---- Retirement saving
  const retSave = (t.minister.preTax + t.minister.roth + t.spouse.preTax + t.spouse.roth) / 12;
  if (retSave < 1 && p.yearsToRetire > 0) add('startsaving', 'act', 'Start saving for retirement, even a little',
    'Nothing is going into retirement accounts right now.', `${fmt(50)}/mo now could become about ${fmt(realIncomeFrom(50, r))}/mo in retirement (today's dollars).`, 'home', 'compound', { score: 2000 });
  if (r.mc.successRate < 0.75 && p.yearsToRetire > 0) add('lowsuccess', 'act', 'Your retirement plan may run short',
    `In ${A.pctf(r.mc.successRate)} of simulated markets the money lasts. Small changes now have the biggest effect.`,
    `Each extra ${fmt(100)}/mo saved adds about ${fmt(realIncomeFrom(100, r))}/mo of retirement income. Retiring a little later or planning to spend a little less also helps.`, 'retire', 'montecarlo', { score: 3000 * (1 - r.mc.successRate) });
  // Pre-tax vs Roth: compares the full tax saved now (incl. self-employment tax on the minister's
  // own 403(b), and credits) with the expected tax rate when the money comes out.
  const rr = A.retRate ? A.retRate(r) : null;
  if (rr) {
    const ms = p.minComp > 0 ? E.bestSplit(p, 'min', rr.minTotal) : null;
    if (ms && ms.pre - ms.cur >= 1000 && ms.gain >= 100) add('minpre', 'consider', `Consider moving ${fmt(ms.pre - ms.cur)} of your 403(b) from Roth to pre-tax`,
      "Pre-tax 403(b) dollars skip self-employment tax as well as income tax; Roth dollars pay both. Church-plan pre-tax money may also come out tax-free later as housing allowance.",
      `Worth about ${fmt(ms.gain)} a year over the long run, compared with your expected tax rate in retirement. See "Pre-tax or Roth?" for the details.`, 'pay', 'pretax', { score: ms.gain });
    else if (ms && ms.cur - ms.pre >= 1000 && ms.gain >= 100) add('minroth', 'learn', `Roth may suit part of your 403(b)`,
      'Even counting the self-employment tax pre-tax saving avoids, your tax rate now is below what you expect in retirement.',
      `Moving ${fmt(ms.cur - ms.pre)} to Roth is worth about ${fmt(ms.gain)} a year over the long run, if that expectation holds.`, 'pay', 'roth', { score: ms.gain / 2 });
    const ss = mfj && p.spGross > 0 ? E.bestSplit(p, 'sp', rr.total) : null;
    if (ss && Math.abs(ss.pre - ss.cur) >= 1000 && ss.gain >= 100) {
      const toRoth = ss.pre < ss.cur;
      add('spsplit', 'consider', toRoth ? `Your spouse could shift ${fmt(ss.cur - ss.pre)} of plan saving to Roth` : `Your spouse could shift ${fmt(ss.pre - ss.cur)} of plan saving to pre-tax`,
        toRoth ? "Past a point, a pre-tax dollar in your spouse's plan saves less tax now than it will likely cost in retirement." : "Pre-tax saving in your spouse's plan comes off income taxed at a higher rate than you expect in retirement.",
        `Suggested: ${fmt(ss.pre)} pre-tax and ${fmt(ss.roth)} Roth, worth about ${fmt(ss.gain)} a year over the long run. Only if the plan offers Roth.`, 'pay', toRoth ? 'roth' : 'pretax', { score: ss.gain });
    }
  }

  // ---- Thresholds near you
  const th = E.thresholds(p).list, qMax = (mfj ? 2 : 1) * E.TAX.credits.saver.maxPer;
  th.forEach(o => {
    if (o.id.startsWith('saver') && o.above && o.back && o.cost >= 100) add('th-saver', 'act', `A little more pre-tax saving could raise your Saver's Credit`,
      `Your adjusted gross income is ${fmt(o.gap)} over a Saver's Credit line, where the credit rate drops all at once.`,
      `About ${fmt(o.back.amount)} more pre-tax saving brings you under it and adds about ${fmt(o.cost)} of credit, on top of the tax the saving itself saves.`, 'pay', 'saverscredit', { score: o.cost });
    if (o.id === 'aca') {
      if (!o.above && o.gap < 5000) add('th-aca', 'act', `You're ${fmt(o.gap)} below the Marketplace subsidy cliff`,
        'Above 400% of the poverty line, help with Marketplace premiums ends completely in 2026. A raise, honoraria or a bonus could push you over.',
        `${o.cost > 0 ? `That would cost your ${fmt(o.cost)} premium tax credit. ` : ''}If extra income comes, more pre-tax saving can keep you under. Report income changes to the Marketplace.`, 'pay', 'aca', { score: 5000 + (o.cost || 0) });
      else if (o.above && o.back) add('th-aca', 'act', 'Pre-tax saving could bring back Marketplace subsidies',
        `Your income is ${fmt(o.gap)} over the 400% poverty-line cliff, so you get no help with Marketplace premiums.`,
        `About ${fmt(o.back.amount)} more pre-tax saving brings you under it. Check the subsidy you would get at healthcare.gov.`, 'pay', 'aca', { score: 4000 });
    }
    if ((o.id === 'ctc' || o.id === 'senior' || o.id === 'rothira') && o.above && o.back && o.back.amount <= 8000)
      add('th-' + o.id, 'consider', `More pre-tax saving would get you under the ${o.id === 'ctc' ? 'child tax credit' : o.id === 'senior' ? 'senior deduction' : 'Roth IRA'} limit`,
        `You're ${fmt(o.gap)} over. ${o.effect}`, `About ${fmt(o.back.amount)} more pre-tax saving gets you back under.`, 'pay', o.term, { score: 150 });
    if (o.id === 'ltcg0') add('ltcg0', 'learn', 'Room to take investment gains at 0%',
      `Your taxable income is ${fmt(o.gap)} below the 0% capital gains ceiling.`, 'Selling investments held over a year with gains up to that amount would owe no federal tax on the gain.', 'pay', 'ltcg0', { score: 60 });
  });
  const sRate = E.saverRate(t.minScenario.agi, p.status), qual = t.minScenario.fed.credits ? t.minScenario.fed.credits.saverQual : 0;
  if (sRate > 0 && qual < qMax) {
    const fill = { minRothIRA: p.minRothIRA + Math.max(0, E.TAX.credits.saver.maxPer - (p.minPreTax + p.minRoth403b + p.minRothIRA)) };
    if (mfj) fill.spRothIRA = p.spRothIRA + Math.max(0, E.TAX.credits.saver.maxPer - (p.spPreTax + p.spRoth401k + p.spRothIRA));
    const t2 = E.computeToday(Object.assign({}, p, fill, { _fast: true })), gain = E.householdTax(t) - E.householdTax(t2);
    const more = (fill.minRothIRA - p.minRothIRA) + ((fill.spRothIRA || p.spRothIRA) - p.spRothIRA);
    if (gain >= 100) add('saveropp', 'consider', "You may qualify for the Saver's Credit",
      `At your income the IRS adds a credit of ${Math.round(sRate * 100)}% of what you save for retirement, up to $2,000 a person. Your housing allowance isn't counted in this income, so many ministers qualify.`,
      `Saving ${fmt(more)} more this year (any 403(b), 401(k) or IRA) could bring about ${fmt(gain)} back as a credit.`, 'pay', 'saverscredit', { score: gain });
  }
  const ages = [p.minAge].concat(mfj ? [p.spAge] : []);
  if (ages.some(x => x >= 50) && p.minPreTax + p.minRoth403b >= E.TAX.limits.deferral) add('catchup', 'consider', 'You can save more with catch-up contributions',
    `From age 50 you may add ${fmt(E.TAX.limits.catch50)} more a year (${fmt(E.TAX.limits.catch6063)} at ages 60–63).`, 'Ask your plan provider to raise your contribution.', 'pay', 'catchup', { score: 500 });
  if (!p.convOn && p.yearsToRetire >= 0) {
    const pre0 = r.acc.end.mChurch + r.acc.end.mTrad + r.acc.end.sTrad;
    if (pre0 > 300000 && r.P.minRmdAge - r.P.minAgeStart >= 3) {
      const P2 = Object.assign({}, r.P, { convOn: true, convBracket: 0.12 });
      const r2 = E.runRetirement(r.acc.end, P2, null);
      const saved = r.ret.totalTax - r2.totalTax;
      if (saved > 2000) add('convert', 'consider', 'Roth conversions in early retirement could lower lifetime taxes',
        `Between retiring and age ${r.P.minRmdAge}, your taxable income may be low. Converting some pre-tax money to Roth then shrinks later required withdrawals.`,
        `Filling the 12% bracket each year is estimated to save about ${fmt(saved)} over retirement. Try it in Retirement (Detailed view).`, 'retire', 'conversion', { score: saved / 10 });
    }
  }

  // ---- Pension
  if (p.pension > 0) {
    if (!p.pensionHousing) add('pensionhousing', 'learn', 'Ask whether your pension can be designated housing allowance',
      'Church-plan pensions can often be paid partly as tax-free housing allowance in retirement, if the plan designates it in advance.', 'Ask your denominational pension board.', 'retire', 'pension', { score: 200 });
    if (mfj && p.pensionSurvivorPct < 0.5) add('pensionsurvivor', 'consider', 'Check the survivor benefit on your pension',
      `Your spouse would keep ${Math.round(p.pensionSurvivorPct * 100)}% of the pension if you die first, and the housing exclusion also ends.`,
      'A joint-and-survivor option lowers the monthly amount but protects your spouse.', 'retire', 'survivor', { score: 300 });
  }
  if (mfj && !p.survivorOn && (p.retHousing > 0 || p.pension > 0)) add('survivor', 'learn', 'See how your spouse would fare',
    'If the minister dies first, the housing exclusion ends and the spouse files as single, which often raises taxes.', 'Turn on the survivor scenario in Retirement (Detailed view).', 'retire', 'survivor', { score: 20 });

  // ---- 529
  const edu = t.edu;
  if (p.contrib529 > 0 && edu.type === 'ded' && isFinite(edu.limit) && edu.limit - p.contrib529 > 200 && stRate > 0)
    add('529room', 'consider', `Your state allows a larger 529 deduction`,
      `${E.TAX.state.name} lets you deduct up to ${fmt(edu.limit)} a year; you're putting in ${fmt(p.contrib529)}.`,
      `Each extra ${fmt(1000)} saves about ${fmt(1000 * stRate)} of state tax, if you're using a qualifying plan.`, 'grow', 'college529', { score: (edu.limit - p.contrib529) * stRate });

  const order = { act: 0, consider: 1, learn: 2 };
  return out.sort((x, y) => order[x.level] - order[y.level] || (y.score || 0) - (x.score || 0));
}

/* ---------- dismissals ---------- */
const DISMISS_DAYS = 60;
let dismissed = A.store.get('mtw.dismissed', {});
const isHidden = id => dismissed[id] && Date.now() - dismissed[id] < DISMISS_DAYS * 864e5;
let showAll = false, showHidden = false;

function itemHtml(s){
  const [lab, tone] = LEVEL[s.level];
  return `<li class="sg-item" data-sid="${s.id}">
    <div class="sg-top"><span class="status-pill ${tone}">${lab}</span><strong>${esc(s.title)}</strong></div>
    <p>${esc(s.why)}</p>${s.impact ? `<p class="sg-impact">${esc(s.impact)}</p>` : ''}
    <div class="row small">
      ${s.go && s.go !== 'home' ? `<button type="button" class="linkish" data-go="${s.go}">Go there</button>` : ''}
      ${s.term ? `<button type="button" class="linkish" data-term="${s.term}">Learn more</button>` : ''}
      <button type="button" class="linkish" data-sg-ask="${s.id}">Talk it through with AI</button>
      ${isHidden(s.id) ? `<button type="button" class="linkish" data-sg-restore="${s.id}">Bring back</button>` : `<button type="button" class="linkish" data-sg-hide="${s.id}">Not now</button>`}
    </div></li>`;
}
let current = [];
function render(el){
  const r = A.getLast(); if (!r || !el) return;
  current = rules(r);
  const visible = current.filter(s => !isHidden(s.id)), hidden = current.filter(s => isHidden(s.id));
  const list = showAll ? visible : visible.slice(0, 3);
  el.innerHTML = (visible.length ? `<ul class="sg-list">${list.map(itemHtml).join('')}</ul>` : '<p class="small muted" style="margin:0">Nothing pressing right now. Keep going.</p>') +
    `<div class="row small">${visible.length > 3 ? `<button type="button" class="linkish" data-sg-all>${showAll ? 'Show fewer' : `Show all ${visible.length}`}</button>` : ''}
     ${hidden.length ? `<button type="button" class="linkish" data-sg-hidden>${showHidden ? 'Hide' : 'Show'} ${hidden.length} set aside for now</button>` : ''}</div>` +
    (showHidden && hidden.length ? `<ul class="sg-list muted">${hidden.map(itemHtml).join('')}</ul>` : '');
}
document.addEventListener('click', e => {
  const t = e.target, card = t.closest('.hc-body');
  if (t.matches('[data-sg-hide]')) { dismissed[t.dataset.sgHide] = Date.now(); A.store.set('mtw.dismissed', dismissed); render(card); }
  else if (t.matches('[data-sg-restore]')) { delete dismissed[t.dataset.sgRestore]; A.store.set('mtw.dismissed', dismissed); render(card); }
  else if (t.matches('[data-sg-all]')) { showAll = !showAll; render(card); }
  else if (t.matches('[data-sg-hidden]')) { showHidden = !showHidden; render(card); }
  else if (t.matches('[data-sg-ask]')) {
    const s = current.find(x => x.id === t.dataset.sgAsk); if (!s || !A.coachCustom) return;
    A.copyText(A.coachCustom(`I'm considering this: "${s.title}." ${s.why} ${s.impact || ''}\nHelp me discern whether this fits my family and calling right now. Explain it simply, tell me what to ask my church or a tax professional, and suggest one small first step.`), t);
  }
});
A.renderSuggestions = render;
A.refreshSuggestions = () => { const el = $('hc-suggest'); if (el) render(el); };
A.suggestions = () => { const r = A.getLast(); return r ? rules(r) : []; };
})();
