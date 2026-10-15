/* First-time welcome story + step-by-step setup for people new to all of this.
   Experts can close it at any point; "Guided setup" in the header reopens it. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt, E = A.E, Q = A.QUOTES;

let draft = null, step = 0;
const T = (id, text) => `<button type="button" class="term" data-term="${id}">${text}</button>`;
const money = v => fmt(v);

/* ---------- reusable input: number + slider ---------- */
function wf(key, label, opts){
  const o = Object.assign({ min: 0, max: 100000, step: 100, unit: '$', per: '' }, opts || {});
  const v = o.get ? o.get() : draft[key];
  return `<div class="wz-field">
    <label for="wz-${key}">${label}${o.help ? `<small>${o.help}</small>` : ''}</label>
    <div class="wz-in"><span class="wz-unit">${o.unit === '$' ? '$' : ''}</span><input type="number" id="wz-${key}" data-k="${key}" value="${v}" min="${o.min}" step="${o.step}" inputmode="decimal"><span class="wz-unit">${o.per}${o.unit === '%' ? '%' : ''}</span></div>
    <input type="range" id="wz-sl-${key}" data-k="${key}" min="${o.min}" max="${Math.max(o.max, v)}" step="${o.step}" value="${v}" aria-label="${esc(label.replace(/<[^>]+>/g, ''))} slider">
  </div>`;
}
const num = k => parseFloat(($('wz-' + k) || {}).value) || 0;

/* ---------- little live example for the welcome story ---------- */
function smallExample(perMo, years){
  const r = 0.07 / 12, n = years * 12;
  const fv = perMo * ((Math.pow(1 + r, n) - 1) / r);
  const real = fv / Math.pow(1.025, years);
  const rr = 1.05 / 1.025 - 1, m = 25;
  const inc = real * rr / (1 - Math.pow(1 + rr, -m)) / 12;
  return { put: perMo * n, real, inc };
}

/* ---------- steps ---------- */
const STEPS = [
  { id: 'why', title: "Today's choices shape tomorrow's realities", intro: true, body: () => `
      <blockquote class="wz-quote">${esc(Q[0])}</blockquote>
      <p>Ministers live with money rules most people never meet: a ${T('housing', 'housing allowance')}, ${T('seca', 'self-employment tax')}, and ${T('churchplan', 'church retirement plans')}. Few tools explain them, and fewer connect what you decide this month to life 20 or 30 years from now.</p>
      <p>This app was built to make those connections visible, so you can steward what you've been given with clarity and peace.</p>` },
  { id: 'small', title: 'Small amounts, long roads', intro: true, body: () => `
      <blockquote class="wz-quote">${esc(Q[1])}</blockquote>
      <div class="wz-demo">
        <div class="wz-field"><label for="demoAmt">If you set aside each month</label><div class="wz-in"><span class="wz-unit">$</span><input type="number" id="demoAmt" value="25" min="5" step="5"><span class="wz-unit">/mo</span></div><input type="range" id="demoAmtSl" min="5" max="300" step="5" value="25" aria-label="Monthly amount slider"></div>
        <div class="wz-field"><label for="demoYrs">for this many years</label><div class="wz-in"><span class="wz-unit"></span><input type="number" id="demoYrs" value="25" min="1" step="1"><span class="wz-unit">yrs</span></div><input type="range" id="demoYrsSl" min="1" max="40" step="1" value="25" aria-label="Years slider"></div>
        <p class="wz-result" id="demoOut" aria-live="polite"></p>
        <p class="small muted">Assumes 7% growth a year while saving, then 5% in retirement, with 2.5% inflation. Shown in ${T('todaysdollars', "today's dollars")}.</p>
      </div>`,
    after: () => {
      const upd = () => { const a = +$('demoAmt').value || 0, y = +$('demoYrs').value || 0, x = smallExample(a, y);
        $('demoOut').innerHTML = `${money(a)}/mo for ${y} years is <strong>${money(x.put)}</strong> set aside. It could grow to about <strong>${money(x.real)}</strong> in today's dollars, enough for about <strong>${money(x.inc)} a month for 25 years</strong> of retirement.`; };
      [['demoAmt', 'demoAmtSl'], ['demoYrs', 'demoYrsSl']].forEach(([n, s]) => {
        $(s).addEventListener('input', () => { $(n).value = $(s).value; upd(); });
        $(n).addEventListener('input', () => { $(s).value = $(n).value; upd(); });
      });
      upd();
    } },
  { id: 'called', title: 'What are you called to now?', intro: true, body: () => `
      <blockquote class="wz-quote">${esc(Q[2])}</blockquote>
      <label for="wzCalling" class="wz-label">If you'd like, write a sentence about what you sense you're called to in this season. <small>It stays on this device. The AI coach can use it to keep your conversations anchored.</small></label>
      <textarea id="wzCalling" rows="3" placeholder="e.g. Shepherding our congregation well, raising our kids, and being able to give generously for decades.">${esc(A.store.get('mtw.calling', ''))}</textarea>`,
    save: () => A.store.set('mtw.calling', ($('wzCalling').value || '').trim().slice(0, 400)) },
  { id: 'how', title: 'Here is how this works', intro: true, last: true, body: () => `
      <ul class="wz-list">
        <li>About 5 minutes of simple questions, one at a time. Monthly amounts where that's easier.</li>
        <li>Not sure of a number? Leave the starting value and change it later.</li>
        <li>Tap any underlined term to learn what it means, with articles and videos.</li>
        <li>Everything stays in your browser unless you create an account, and saved data is encrypted.</li>
        <li>These are estimates for learning and planning, not tax or investment advice.</li>
      </ul>
      <div class="wz-choices">
        <button class="btn primary" type="button" data-wz="start">Start setup</button>
        ${A.store.get('mtw.onboarded', 0) ? '' : '<button class="btn" type="button" data-wz="example">Explore with example numbers</button>'}
        <button class="btn" type="button" data-wz="close">Go straight to the dashboard</button>
      </div>` },
  { id: 'household', title: 'Who is in your household?', body: () => `
      <div class="wz-choices" role="group" aria-label="Household">
        <button class="btn ${draft.__status === 'MFJ' ? 'primary' : ''}" type="button" data-status="MFJ" aria-pressed="${draft.__status === 'MFJ'}">Married</button>
        <button class="btn ${draft.__status === 'Single' ? 'primary' : ''}" type="button" data-status="Single" aria-pressed="${draft.__status === 'Single'}">Single</button>
      </div>
      ${wf('minAge', 'Your age (the minister)', { min: 22, max: 80, step: 1, unit: '', per: 'yrs' })}
      ${draft.__status === 'MFJ' ? wf('spAge', "Your spouse's age", { min: 22, max: 80, step: 1, unit: '', per: 'yrs' }) : ''}`,
    save: () => { draft.minAge = num('minAge'); if (draft.__status === 'MFJ') draft.spAge = num('spAge'); } },
  { id: 'state', title: 'Which state do you live in?', body: () => `
      <div class="wz-field"><label for="wzState">State</label><select id="wzState">${E.STATES.map(([c, n]) => `<option value="${c}" ${c === draft.state ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
      <div id="wzStateMore"></div>`,
    after: () => {
      const upd = () => { const c = $('wzState').value; draft.state = c;
        $('wzStateMore').innerHTML = c === 'MA' ? '<p class="small muted">Massachusetts rules are built in.</p>'
          : E.NO_WAGE_TAX.includes(c) ? '<p class="small muted">No state income tax on wages. Nothing else to enter.</p>'
          : wf('stateRate', 'About what percent of income goes to state tax?', { min: 0, max: 11, step: 0.1, unit: '%', help: 'Not sure? Most states fall between 3% and 6%. This is only an estimate.' }) +
            `<label class="check"><input type="checkbox" id="wzSS" ${draft.stateTaxesSS ? 'checked' : ''}><span>My state taxes Social Security benefits</span></label>`;
        bindSliders(); };
      $('wzState').addEventListener('change', upd); upd();
    },
    save: () => { draft.state = $('wzState').value; if ($('wz-stateRate')) { draft.stateRate = num('stateRate'); draft.stateTaxesSS = $('wzSS').checked; } } },
  { id: 'pay', title: 'Your church pay', body: () => `
      ${wf('minComp', `Total yearly pay from the church, <em>including</em> any ${T('housing', 'housing allowance')}`, { max: 250000, step: 500, per: '/yr', help: 'Your full salary package before taxes. Leave out health insurance and retirement contributions the church makes for you.' })}
      ${wf('housingDesignated', 'How much of that the church designates as housing allowance', { max: 120000, step: 500, per: '/yr', help: "Usually written in the church's minutes or your pay letter. Enter 0 if you don't have one." })}` ,
    save: () => { draft.minComp = num('minComp'); draft.housingDesignated = num('housingDesignated'); } },
  { id: 'housing', title: 'What your housing really costs', body: () => `
      <p class="small">Only the smallest of three numbers is tax-free: the designated allowance, your ${T('actual', 'actual housing costs')}, and your home's ${T('frv', 'fair rental value')}.</p>
      ${wf('housingActual', 'Actual housing costs per year', { max: 120000, step: 500, per: '/yr', help: 'Rent or mortgage, utilities, insurance, property tax, furniture, repairs.' })}
      ${wf('housingFRV', 'Fair rental value per year (furnished, plus utilities)', { max: 120000, step: 500, per: '/yr', help: 'What a similar furnished home would rent for, plus utilities.' })}
      <button class="linkish" type="button" id="wzSameHousing">Not sure? Use my allowance for both</button>`,
    after: () => { $('wzSameHousing').onclick = () => { ['housingActual', 'housingFRV'].forEach(k => { $('wz-' + k).value = draft.housingDesignated; $('wz-sl-' + k).value = draft.housingDesignated; }); }; },
    save: () => { draft.housingActual = num('housingActual'); draft.housingFRV = num('housingFRV'); } },
  { id: 'spouse', title: "Your spouse's work", when: () => draft.__status === 'MFJ', body: () => `
      ${wf('spGross', "Your spouse's yearly pay from a regular job", { max: 250000, step: 500, per: '/yr', help: 'Before taxes. Enter 0 if your spouse does not work outside the home.' })}`,
    save: () => { draft.spGross = num('spGross'); } },
  { id: 'saving', title: 'What you save each month', body: () => `
      <p class="small">Check a recent pay stub. If you aren't saving yet, leave these at 0. The dashboard will show what small amounts can do.</p>
      ${wf('m_minPreTax', `Your ${T('b403', '403(b)')}, ${T('pretax', 'pre-tax')}`, { max: 3000, step: 10, per: '/mo', get: () => Math.round(draft.minPreTax / 12) })}
      ${wf('m_minRoth403b', `Your 403(b), ${T('roth', 'Roth')}`, { max: 3000, step: 10, per: '/mo', get: () => Math.round(draft.minRoth403b / 12) })}
      ${wf('m_minRothIRA', `Your ${T('rothira', 'Roth IRA')}`, { max: 700, step: 10, per: '/mo', get: () => Math.round(draft.minRothIRA / 12) })}
      ${draft.__status === 'MFJ' ? wf('m_spPreTax', "Spouse's workplace plan, pre-tax", { max: 3000, step: 10, per: '/mo', get: () => Math.round(draft.spPreTax / 12) }) +
        wf('m_spRoth401k', "Spouse's workplace plan, Roth", { max: 3000, step: 10, per: '/mo', get: () => Math.round(draft.spRoth401k / 12) }) : ''}`,
    save: () => { ['minPreTax', 'minRoth403b', 'minRothIRA'].concat(draft.__status === 'MFJ' ? ['spPreTax', 'spRoth401k'] : []).forEach(k => draft[k] = num('m_' + k) * 12); } },
  { id: 'saved', title: "What you've saved so far", body: () => `
      ${wf('minTradBal', 'Your 403(b), pre-tax balance', { max: 1000000, step: 1000 })}
      <div class="wz-field"><label for="wzChurch">Is your 403(b) a ${T('churchplan', 'church plan')} run by your church or denomination (for example GuideStone)?</label>
        <select id="wzChurch"><option value="100" ${draft.churchPlanPct >= 50 ? 'selected' : ''}>Yes</option><option value="0" ${draft.churchPlanPct < 50 ? 'selected' : ''}>No</option><option value="100">Not sure (assume yes; ask your plan)</option></select></div>
      ${wf('minRothBal', 'Your Roth balances (403(b) Roth and Roth IRA)', { max: 1000000, step: 1000 })}
      ${draft.__status === 'MFJ' ? wf('spTradBal', "Spouse's retirement accounts, pre-tax", { max: 1000000, step: 1000 }) : ''}
      ${wf('miscTradBal', 'Other pre-tax IRAs or old 401(k)s', { max: 1000000, step: 1000 })}
      ${wf('brokerageBal', `Other investments (${T('brokerage', 'brokerage')}), not cash for emergencies`, { max: 1000000, step: 1000 })}`,
    save: () => { ['minTradBal', 'minRothBal', 'miscTradBal', 'brokerageBal'].concat(draft.__status === 'MFJ' ? ['spTradBal'] : []).forEach(k => draft[k] = num(k)); draft.churchPlanPct = +$('wzChurch').value; } },
  { id: 'retire', title: 'Picturing retirement', body: () => {
      const take = suggestTakeHome();
      if (!draft._retTouched) {   // replace untouched example values with ones scaled to this household
        if (draft.retSpend === 120000) draft.retSpend = Math.round(take * 0.8 / 50) * 50 * 12;
        if (draft.retHousing === 40000) draft.retHousing = draft.churchPlanPct > 0 ? Math.min(draft.housingDesignated, draft.housingActual) : 0;
        draft._retTouched = true;
      }
      return `${wf('retireAge', 'Age you hope to retire', { min: Math.max(draft.minAge, 50), max: 75, step: 1, unit: '', per: 'yrs', get: () => draft.minAge + draft.yearsToRetire })}
      ${wf('untilAge', 'Plan for money to last until age', { min: 75, max: 105, step: 1, unit: '', per: 'yrs', get: () => draft.minAge + draft.yearsToRetire + draft.retYears })}
      ${wf('m_retSpend', "Monthly spending you'd like in retirement, in today's dollars", { max: 20000, step: 50, per: '/mo', get: () => Math.round(draft.retSpend / 12), help: `After taxes. Your take-home today is about ${money(take)}/mo; many people plan on 70–90% of that.` })}
      ${wf('m_ssMin', `Your expected ${T('socialsecurity', 'Social Security')}`, { max: 5000, step: 25, per: '/mo', get: () => Math.round(draft.ssMin / 12), help: 'Find it at <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noopener">ssa.gov/myaccount</a>. Enter 0 if you opted out with Form 4361.' })}
      ${draft.__status === 'MFJ' ? wf('m_ssSp', "Your spouse's expected Social Security", { max: 5000, step: 25, per: '/mo', get: () => Math.round(draft.ssSp / 12) }) : ''}
      ${wf('m_retHousing', `Housing allowance you expect to take from your church plan in retirement`, { max: 8000, step: 50, per: '/mo', get: () => Math.round(draft.retHousing / 12), help: 'Roughly your expected housing costs in retirement. 0 if you have no church plan.' })}`; },
    save: () => { const ra = num('retireAge'); draft.yearsToRetire = Math.max(0, ra - draft.minAge); draft.retYears = Math.max(5, num('untilAge') - ra);
      draft.retSpend = num('m_retSpend') * 12; draft.ssMin = num('m_ssMin') * 12; if (draft.__status === 'MFJ') draft.ssSp = num('m_ssSp') * 12;
      draft.retHousing = num('m_retHousing') * 12; draft.todaysDollars = true; } },
  { id: 'watch', title: 'What would you like to keep an eye on?', body: () => `
      <p class="small">These stay at the top of the screen. When you change any number, you'll see how each one moves.</p>
      <div class="wz-checks">${Object.entries(A.FIGURES).map(([k, d]) => `<label class="check"><input type="checkbox" name="wzWatch" value="${k}" ${A.getWatch().includes(k) ? 'checked' : ''}><span>${esc(d.label)} ${T(d.term, '?')}</span></label>`).join('')}</div>
      <p class="small muted" id="wzWatchMsg">Choose up to 4.</p>`,
    after: () => { const box = document.querySelector('.wz-checks'); const lim = () => { const n = box.querySelectorAll('input:checked').length; box.querySelectorAll('input:not(:checked)').forEach(i => i.disabled = n >= 4); }; box.addEventListener('change', lim); lim(); },
    save: () => { const sel = [...document.querySelectorAll('input[name=wzWatch]:checked')].map(i => i.value); if (sel.length) A.setWatch(sel); } },
  { id: 'done', title: "You're set up", final: true, body: () => {
      const r = A.getLast(); const F = A.FIGURES; const calling = A.store.get('mtw.calling', '');
      return `<div class="wz-summary">
        <div><span class="eyebrow">Take-home today</span><b class="num">${money(F.takeHomeMo.v(r))}/mo</b></div>
        <div><span class="eyebrow">Retirement income from savings</span><b class="num">${money(F.retIncomeMo.v(r))}/mo</b></div>
        <div><span class="eyebrow">Chance the money lasts</span><b class="num">${A.pctf(r.mc.successRate)}</b></div>
      </div>
      ${calling ? `<p class="wz-calling">You wrote: "${esc(calling)}"</p>` : ''}
      ${r.mc.successRate < 0.75 ? `<p>If that chance looks low, don't be discouraged. This is a starting point, not a verdict. Small changes add up, and the dashboard will show you exactly what each one does.</p>` : ''}
      <p>Next, try sliding one savings amount up by $20 a month and watch what it does to your take-home today and your income in retirement.</p>
      <blockquote class="wz-quote">${esc(Q[2])}</blockquote>
      <div class="wz-choices">
        <button class="btn primary" type="button" data-wz="close">Go to my dashboard</button>
        <button class="btn" type="button" data-wz="coach">Talk it through with the AI coach</button>
        <button class="btn" type="button" data-wz="learn">Learn the key ideas</button>
      </div>`; } }
];

function suggestTakeHome(){
  try { const p = Object.assign(A.readParams(), toParams(draft)); return A.compute(p, 1).today.householdNet / 12; } catch { return 0; }
}
function toParams(raw){
  const p = { status: raw.__status };
  for (const k of A.fields()) { const s = A.spec(k); p[k] = s.pct ? raw[k] / 100 : raw[k]; }
  p.convBracket = parseFloat(raw.convBracket); p.convStopAge = 0; return p;
}

/* ---------- shell ---------- */
const wrap = document.createElement('div');
wrap.className = 'wizard'; wrap.hidden = true; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'wzTitle');
wrap.innerHTML = `<div class="wz-card">
  <div class="wz-top"><div class="wz-dots" id="wzDots" aria-hidden="true"></div><button class="wz-x" type="button" data-wz="close" aria-label="Close setup and go to the dashboard">×</button></div>
  <h2 id="wzTitle"></h2><div class="wz-body" id="wzBody"></div>
  <div class="wz-nav"><button class="btn" type="button" data-wz="back" id="wzBack">Back</button><span class="small muted" id="wzCount"></span><button class="btn primary" type="button" data-wz="next" id="wzNext">Next</button></div>
</div>`;
document.body.append(wrap);

const visible = () => STEPS.filter(s => !s.when || s.when());
function bindSliders(){
  wrap.querySelectorAll('input[type=range][data-k]').forEach(sl => {
    const n = $('wz-' + sl.dataset.k); if (!n || sl._b) return; sl._b = 1;
    const fill = () => sl.style.setProperty('--p', ((sl.value - sl.min) / (sl.max - sl.min) * 100) + '%');
    sl.addEventListener('input', () => { n.value = sl.value; fill(); });
    n.addEventListener('input', () => { if (+n.value > +sl.max) sl.max = n.value; sl.value = n.value; fill(); });
    fill();
  });
}
function show(i){
  const list = visible(); step = Math.max(0, Math.min(i, list.length - 1));
  const s = list[step];
  $('wzTitle').textContent = s.title;
  $('wzBody').innerHTML = s.body();
  const setup = list.filter(x => !x.intro && !x.final), si = setup.indexOf(s);
  $('wzDots').innerHTML = s.intro ? '<span class="muted small">Welcome</span>' : setup.map((_, j) => `<i class="${j <= si ? 'on' : ''}"></i>`).join('');
  $('wzCount').textContent = s.intro || s.final ? '' : `Step ${si + 1} of ${setup.length}`;
  $('wzBack').hidden = step === 0 || s.final;
  $('wzNext').hidden = !!(s.last || s.final);
  $('wzNext').textContent = s.intro ? 'Next' : (list[step + 1] && list[step + 1].final ? 'Finish' : 'Next');
  if (s.after) s.after();
  bindSliders();
  wrap.querySelector('.wz-card').scrollTop = 0;
  const t = $('wzTitle'); t.tabIndex = -1; t.focus({ preventScroll: true });
}
function commit(){
  A.setInputs(draft); A.recalc(false);
  if (A.syncSliders) A.syncSliders();
}
function open(at){
  draft = A.rawInputs(); wrap.hidden = false; document.body.classList.add('wz-open');
  show(at === 'setup' ? STEPS.findIndex(s => s.id === 'household') : 0);
}
function close(){
  wrap.hidden = true; document.body.classList.remove('wz-open');
  A.store.set('mtw.onboarded', 1);
  const b = $('btnGuide'); if (b) b.focus();
}
wrap.addEventListener('click', e => {
  const st = e.target.closest('[data-status]');
  if (st) { visible()[step].save && visible()[step].save(); draft.__status = st.dataset.status; show(step); return; }
  const a = e.target.closest('[data-wz]'); if (!a) return;
  const s = visible()[step], act = a.dataset.wz;
  if (act === 'next') { if (s.save) s.save(); if (!s.intro) commit();
    const list = visible(); if (list[step + 1] && list[step + 1].final) { commit(); } show(step + 1); }
  else if (act === 'back') { if (s.save) s.save(); show(step - 1); }
  else if (act === 'start') { if (s.save) s.save(); show(visible().findIndex(x => x.id === 'household')); }
  else if (act === 'example') { A.setInputs(null); A.recalc(false); close(); A.showTab('today'); }
  else if (act === 'close') { if (s.save && !s.intro) { s.save(); commit(); } close(); }
  else if (act === 'coach') { close(); A.showTab('audit'); }
  else if (act === 'learn') { close(); A.showTab('learn'); }
});
wrap.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  if (e.key === 'Tab') { const f = [...wrap.querySelectorAll('button:not([hidden]),input,select,textarea,a[href]')].filter(x => x.offsetParent);
    if (!f.length) return; if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
});
// wizard save of the "called" textarea also when leaving via Next
$('btnGuide').onclick = () => open();
$('btnReplay').onclick = () => open();
A.openGuide = open;

if (!A.store.get('mtw.onboarded', 0) && !/[?&]noguide/.test(location.search)) open();
})();
