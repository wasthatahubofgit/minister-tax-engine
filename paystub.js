/* "Enter from a pay stub": type what one paycheck shows, say how often you are paid, and the app converts
   it to yearly pay and monthly withholding. Works for weekly, every-two-weeks, twice-a-month and monthly pay. */
(function(){
'use strict';
const A = window.App, $ = A.$, fmt = A.fmt;
const body = $('stubBody'); if (!body) return;
const FREQ = [['12', 'Monthly (12 a year)'], ['24', 'Twice a month (24)'], ['26', 'Every two weeks (26)'], ['52', 'Weekly (52)'], ['4', 'Quarterly (4)'], ['1', 'Once a year']];
const WHO = { church: { gross: 'minComp', fed: 'whMinFed', state: 'whMinState', pre: 'minPreTax', roth: 'minRoth403b' },
              spouse: { gross: 'spGross', fed: 'whSpFed', state: 'whSpState', pre: 'spPreTax', roth: 'spRoth401k' } };
const saved = A.store.get('mtw.stub', {}) || {};
const state = { who: 'church', freq: saved.freq || '12', noHousing: !!saved.noHousing };
const val = id => parseFloat(($(id) || {}).value) || 0;
const mfj = () => A.rawInputs().__status === 'MFJ';

function field(id, label, small) {
  return `<div class="field"><label for="${id}">${label}${small ? `<small>${small}</small>` : ''}</label><input type="number" inputmode="decimal" id="${id}" step="1" min="0"></div>`;
}
function draw() {
  const keep = {}; ['stubGross', 'stubFed', 'stubState', 'stubPre', 'stubRoth'].forEach(id => { if ($(id)) keep[id] = $(id).value; });
  const church = state.who === 'church';
  body.innerHTML = `<p class="small muted" style="margin:0">Use one paycheck. Leave blank anything you don't want to change.</p>
    ${mfj() ? `<div class="field"><label for="stubWho">Whose pay stub?</label><select id="stubWho"><option value="church" ${church ? 'selected' : ''}>Your church pay</option><option value="spouse" ${church ? '' : 'selected'}>Your spouse's pay</option></select></div>` : ''}
    <div class="field"><label for="stubFreq">How often are you paid?</label><select id="stubFreq">${FREQ.map(([v, l]) => `<option value="${v}" ${state.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${field('stubGross', 'Gross pay, one paycheck', 'Before anything is taken out')}
    ${church ? `<label class="check"><input type="checkbox" id="stubNoHousing" ${state.noHousing ? 'checked' : ''}><span>My housing allowance is paid separately and is not in this gross pay</span></label>` : ''}
    ${field('stubFed', 'Federal tax withheld', 'Often "Fed WH" or "FIT"')}
    ${field('stubState', 'State tax withheld', 'Often "SIT" or "State WH"')}
    ${field('stubPre', 'Pre-tax retirement', '403(b), 401(k), TSA')}
    ${field('stubRoth', 'Roth retirement')}
    <div id="stubOut" class="small"></div>
    <div class="row"><button type="button" class="btn primary" id="stubApply">Use these numbers</button></div>`;
  Object.entries(keep).forEach(([id, v]) => { if ($(id)) $(id).value = v; });
  preview();
}
function preview() {
  const n = +state.freq, out = $('stubOut'); if (!out) return;
  const g = val('stubGross'), f = val('stubFed'), s = val('stubState');
  const bits = [];
  if (g > 0) bits.push(`Gross pay is about <strong>${fmt(g * n)}</strong> a year (${fmt(g * n / 12)} a month).`);
  if (f > 0 || s > 0) bits.push(`Withholding comes to <strong>${fmt(f * n / 12)}</strong> a month federal${s > 0 ? ` and <strong>${fmt(s * n / 12)}</strong> state` : ''}.`);
  if (n === 26) bits.push('Twice a year you get three paychecks in a month. Treat those as bonus months for savings rather than spending.');
  if (n === 52) bits.push('Four times a year you get five paychecks in a month. Treat those as bonus months for savings rather than spending.');
  out.innerHTML = bits.join(' ');
}
function apply() {
  const n = +state.freq, m = WHO[state.who], set = (id, v) => { const el = $(id); if (el && isFinite(v)) { el.value = Math.round(v); } };
  const g = val('stubGross'), f = val('stubFed'), s = val('stubState'), pre = val('stubPre'), roth = val('stubRoth');
  if (g > 0) set(m.gross, g * n + (state.who === 'church' && state.noHousing ? val('housingDesignated') : 0));
  if (f > 0) set(m.fed, f * n / 12);
  if (s > 0) set(m.state, s * n / 12);
  if (pre > 0) set(m.pre, pre * n);
  if (roth > 0) set(m.roth, roth * n);
  A.store.set('mtw.stub', { freq: state.freq, noHousing: state.noHousing });
  A.recalc();
  const out = $('stubOut'); if (out) out.innerHTML += ' <span class="status-pill good">Applied</span>';
}
body.addEventListener('change', e => {
  if (e.target.id === 'stubWho') { state.who = e.target.value; draw(); }
  else if (e.target.id === 'stubFreq') { state.freq = e.target.value; A.store.set('mtw.stub', { freq: state.freq, noHousing: state.noHousing }); preview(); }
  else if (e.target.id === 'stubNoHousing') { state.noHousing = e.target.checked; }
});
body.addEventListener('input', preview);
body.addEventListener('click', e => { if (e.target.id === 'stubApply') apply(); });
$('stubBox').addEventListener('toggle', () => { if ($('stubBox').open) draw(); });
document.addEventListener('click', e => { if (e.target.id === 'stMFJ' || e.target.id === 'stSingle') setTimeout(() => { if ($('stubBox').open) { state.who = 'church'; draw(); } }, 0); });
draw();
})();
