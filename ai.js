/* Stewardship AI coach: ready-made prompts for any AI, plus an in-app chat that uses the
   visitor's own API key (sent only from this browser to the provider they choose). */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc, fmt = A.fmt;
const KEYSTORE = 'mtw.aikey.';
let memKeys = {}, ctl = null, chat = [];

/* ---------- the coach's lens ---------- */
const LENS = `You are a warm, wise stewardship coach for ministers and their families. You help people see how today's stewardship choices shape tomorrow's realities: next month, next year, and 20 to 30 years from now.

Hold this lens:
- People don't always understand how today's choices affect tomorrow. Your job is to help them connect those dots, gently and concretely.
- Small, faithful amounts compound. $10 a month can become hundreds a month in later years, opening doors for years of generosity toward others and for undistracted focus on what matters in later life.
- As sums grow, details matter more. Decimal places get rounded away at $100, but at $100,000 they can make the difference in taking care of those the Lord loves, including the person you're talking with.
- Keep returning to the question: "What are you called to now?" Money serves calling, family, generosity and rest. It is never the point.

How to talk:
- Be grace-filled and encouraging. Never shame anyone for where they are.
- Use plain language. When a term comes up (housing allowance, self-employment tax, Roth, RMD), explain it in a sentence with a round-number example.
- Translate choices into monthly amounts today and monthly amounts in retirement, in today's dollars.
- Use only the numbers given. If something is missing, ask for it instead of guessing.
- Ask one question at a time, and keep replies short unless asked for detail.
- Where it fits, invite reflection or prayer, and suggest talking decisions over with a spouse or a trusted pastor.
- You are not a tax professional or financial advisor. For decisions with legal or tax consequences (housing allowance designations, opting out of Social Security, Roth conversions, choosing investments), encourage confirming with a qualified clergy tax professional and their church benefits provider.`;

function situation(){
  const r = A.getLast(); if (!r) return '';
  const p = r.p, t = r.today, mfj = p.status === 'MFJ', E = A.E;
  const calling = A.store.get('mtw.calling', '');
  const Y = Math.round(p.yearsToRetire);
  return `MY SITUATION (from my planning app, tax year 2026, ${E.TAX.state.name})
- ${mfj ? `Married. Minister age ${p.minAge}, spouse age ${p.spAge}` : `Single. Minister age ${p.minAge}`}
- Church pay ${fmt(p.minComp)}/yr including a ${fmt(p.housingDesignated)} housing allowance (tax-free portion ${fmt(t.excludable)})${mfj ? `; spouse earns ${fmt(p.spGross)}/yr` : ''}
- Saving now: ${fmt((p.minPreTax + p.minRoth403b + p.minRothIRA + (mfj ? p.spPreTax + p.spRoth401k + p.spRothIRA : 0)) / 12)}/mo in total (pre-tax ${fmt((p.minPreTax + (mfj ? p.spPreTax : 0)) / 12)}/mo, Roth ${fmt((p.minRoth403b + p.minRothIRA + (mfj ? p.spRoth401k + p.spRothIRA : 0)) / 12)}/mo)
- Take-home pay about ${fmt(t.householdNet / 12)}/mo. Self-employment tax ${fmt(t.seca.total)}/yr. Net effect of minister tax rules vs an ordinary employee: ${fmt(t.netAdvantage)}/yr
- Retirement in ${Y} years; savings then about ${fmt(A.FIGURES.atRet.v(r))} in today's dollars, enough for about ${fmt(A.retIncomeMo(r))}/mo for ${Math.round(p.retYears)} years (today's dollars, before tax), plus Social Security of about ${fmt((p.ssMin + (mfj ? p.ssSp : 0)) / 12)}/mo
- Hoped-for retirement spending ${fmt(p.retSpend / 12)}/mo${p.todaysDollars ? " in today's dollars" : ''}${p.pension > 0 ? `\n- Expected pension ${fmt(p.pension / 12)}/mo${p.pensionHousing ? ' (church plan; can be designated housing allowance)' : ''}` : ''}${t.otherNet > 0 ? `\n- Other income (speaking, honoraria) about ${fmt(t.otherNet)}/yr` : ''}${p.contrib529 > 0 ? `\n- Saving ${fmt(p.contrib529 / 12)}/mo for children's college (529)` : ''}${A.budgetSumOf ? `\n- Giving about ${fmt(A.budgetSumOf('giving'))}/mo` : ''}
- ${(() => { try { const nd = E.nextDollar(p), L = k => nd.lines.find(x => x.key === k), c = L('church'), mp = L('minPre'), sp = L('spPre');
    const th = E.thresholds(p).list.slice(0, 3).map(o => `${o.name} (${o.above ? fmt(o.gap) + ' above' : fmt(o.gap) + ' below'})`);
    return `True tax rate on the next $1,000: church salary ${A.pctf(c ? c.rate : 0)} (bracket ${A.pctf(t.marginalFed)}, plus state and self-employment tax)${mp ? `; a pre-tax 403(b) dollar saves ${A.pctf(mp.rate)}` : ''}${sp ? `; a spouse pre-tax dollar saves ${A.pctf(sp.rate)}` : ''}${(p.kidsUnder17 || 0) > 0 ? `. ${p.kidsUnder17} child(ren) under 17` : ''}${p.acaMarket ? `. Buys Marketplace health insurance${p.acaSubsidy > 0 ? ` with a ${fmt(p.acaSubsidy)}/yr premium tax credit` : ''}` : ''}${th.length ? `
- Tax thresholds near us: ${th.join('; ')}` : ''}`; } catch (e) { return ''; } })()}
- Chance the money lasts (1,000 simulated markets): ${A.pctf(r.mc.successRate)}. Lifetime retirement taxes ${fmt(r.ret.totalTax)}. Expected legacy ${fmt(A.FIGURES.legacy.v(r))} in today's dollars${calling ? `\n- What I sense I'm called to now: "${calling}"` : ''}`;
}

const PROMPTS = [
  { id: 'understand', title: 'Help me understand my numbers', desc: 'A gentle walk-through of what the dashboard is saying, one idea at a time.',
    ask: 'Walk me through what these numbers mean for my family, starting with the one that matters most. Explain any terms simply, then ask me one question to help me reflect.' },
  { id: 'calling', title: 'What am I called to now?', desc: 'A reflective conversation that starts with calling, then connects it to money.',
    ask: "Help me think through what I'm called to in this season (family, ministry, generosity, rest) and how my money choices today could serve that, both now and in 20 to 30 years. Start by asking me one open question." },
  { id: 'small', title: 'What could a small change do?', desc: 'See how $10, $25 or $50 a month now could look in retirement.',
    ask: 'Show me, in a short table, what saving an extra $10, $25, $50 and $100 a month from now until retirement could turn into as monthly retirement income in today\'s dollars, assuming about a 4% return after inflation. Then tell me what each would cost my take-home pay if saved pre-tax, and help me pick a first step.' },
  { id: 'generosity', title: 'Generosity and saving together', desc: "Think through giving now and giving later without guilt either way.",
    ask: "I want to be generous now and also be able to give and serve freely later. Help me think through a healthy balance between giving and saving at my stage of life. Don't prescribe percentages; ask me questions and offer a couple of frameworks." },
  { id: 'spouse', title: 'Prepare a conversation with my spouse', desc: 'A short, warm summary and three questions to talk through together.',
    ask: 'Help me prepare a 15-minute conversation with my spouse about our retirement and stewardship. Give me a short, warm summary of where we are in plain language, three questions to discuss together, and one small decision we could make this month.' },
  { id: 'taxes', title: 'Explain my minister taxes simply', desc: 'Housing allowance, self-employment tax and what they mean for you.',
    ask: 'Explain my minister tax situation simply: the housing allowance, self-employment tax, and whether the rules are helping or costing me. Then list three questions to ask my tax preparer this year.' },
  { id: 'audit', title: 'Strategic audit (detailed)', desc: 'A candid, numbers-heavy review with two priority actions.', full: true }
];
function buildPrompt(pr){
  if (pr.full) return LENS + '\n\n' + A.auditPrompt();
  return `${LENS}\n\n${situation()}\n\nWHAT I'D LIKE\n${pr.ask}`;
}

/* ---------- providers ---------- */
async function call(url, opts){
  const res = await fetch(url, Object.assign({ referrerPolicy: 'no-referrer' }, opts));
  let body = null; try { body = await res.json(); } catch {}
  if (!res.ok) {
    const msg = body?.error?.message || body?.error?.type || body?.message || res.statusText;
    const hint = res.status === 401 || res.status === 403 ? ' Check that the key is correct and active.' : res.status === 429 ? ' The provider is rate-limiting this key or it has no credit left.' : '';
    throw new Error(`${res.status} ${msg}.${hint}`);
  }
  return body;
}
const PROVIDERS = {
  anthropic: {
    headers: k => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' }),
    async models(k){ const r = await call('https://api.anthropic.com/v1/models?limit=100', { headers: this.headers(k) }); return r.data.map(m => m.id); },
    async chat(k, model, system, msgs, signal){
      const r = await call('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: this.headers(k),
        body: JSON.stringify({ model, max_tokens: 1500, system, messages: msgs }) });
      return (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
  },
  openai: {
    headers: k => ({ authorization: 'Bearer ' + k, 'content-type': 'application/json' }),
    async models(k){ const r = await call('https://api.openai.com/v1/models', { headers: this.headers(k) });
      return r.data.map(m => m.id).filter(id => /^(gpt-|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|embedding|search|moderation|instruct)/.test(id)).sort().reverse(); },
    async chat(k, model, system, msgs, signal){
      const r = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', signal, headers: this.headers(k),
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...msgs] }) });
      return r.choices?.[0]?.message?.content || '';
    }
  },
  gemini: {
    url: (k, path) => `https://generativelanguage.googleapis.com/v1beta/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(k)}`,
    async models(k){ const r = await call(this.url(k, 'models?pageSize=200'), {});
      return (r.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name)).map(m => m.name.replace(/^models\//, '')).sort().reverse(); },
    async chat(k, model, system, msgs, signal){
      const r = await call(this.url(k, `models/${encodeURIComponent(model)}:generateContent`), { method: 'POST', signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: msgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }) });
      return (r.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    }
  }
};

/* ---------- prompt cards ---------- */
$('promptCards').innerHTML = PROMPTS.map(p => `<div class="prompt-card">
  <h3>${esc(p.title)}</h3><p class="small muted">${esc(p.desc)}</p>
  <div class="row"><button class="btn" type="button" data-copyprompt="${p.id}">Copy prompt</button><button class="btn" type="button" data-chatprompt="${p.id}">Ask here</button></div></div>`).join('');
document.addEventListener('click', e => {
  const c = e.target.closest('[data-copyprompt]');
  if (c) { const pr = PROMPTS.find(x => x.id === c.dataset.copyprompt); A.copyText(buildPrompt(pr), c); setTimeout(() => { c.textContent = 'Copy prompt'; }, 4000); }
  const q = e.target.closest('[data-chatprompt]');
  if (q) { const pr = PROMPTS.find(x => x.id === q.dataset.chatprompt);
    $('chatInput').value = pr.full ? 'Please give me the detailed strategic audit of my numbers.' : pr.ask; $('chatCard').scrollIntoView({ block: 'start', behavior: 'smooth' }); $('chatInput').focus(); }
});

/* ---------- key + model ---------- */
const prov = () => $('aiProvider').value;
const getKey = () => $('aiKey').value.trim() || memKeys[prov()] || '';
function persistKey(){
  const p = prov(), k = $('aiKey').value.trim(); memKeys[p] = k;
  try { if ($('aiRemember').checked && k) localStorage.setItem(KEYSTORE + p, k); else localStorage.removeItem(KEYSTORE + p); } catch {}
}
function ready(){ const ok = !!(getKey() && $('aiModel').value); $('btnSend').disabled = !ok; $('chatHint').hidden = ok; }
function loadKey(){
  const p = prov(); let k = memKeys[p] || '';
  try { const s = localStorage.getItem(KEYSTORE + p); if (s) { k = s; $('aiRemember').checked = true; } else $('aiRemember').checked = false; } catch {}
  $('aiKey').value = k;
  const saved = A.store.get('mtw.aimodel.' + p, '');
  $('aiModel').innerHTML = saved ? `<option>${esc(saved)}</option>` : '<option value="">Load models first</option>';
  ready();
}
$('aiProvider').addEventListener('change', () => { A.store.set('mtw.aiprovider', prov()); loadKey(); $('aiMsg').textContent = ''; });
$('aiKey').addEventListener('change', () => { persistKey(); ready(); });
$('aiRemember').addEventListener('change', persistKey);
$('aiModel').addEventListener('change', () => { A.store.set('mtw.aimodel.' + prov(), $('aiModel').value); ready(); });
$('btnModels').onclick = async () => {
  const k = getKey(); if (!k) { $('aiMsg').textContent = 'Paste your API key first.'; return; }
  persistKey(); $('btnModels').disabled = true; $('aiMsg').textContent = 'Loading models…';
  try {
    const list = await PROVIDERS[prov()].models(k);
    if (!list.length) throw new Error('No chat models are available for this key.');
    const prev = A.store.get('mtw.aimodel.' + prov(), '');
    $('aiModel').innerHTML = list.map(m => `<option ${m === prev ? 'selected' : ''}>${esc(m)}</option>`).join('');
    A.store.set('mtw.aimodel.' + prov(), $('aiModel').value);
    $('aiMsg').textContent = `${list.length} models available.`;
  } catch (err) { $('aiMsg').textContent = 'Could not load models: ' + err.message; }
  $('btnModels').disabled = false; ready();
};

/* ---------- chat ---------- */
function renderChat(pending){
  $('chatLog').innerHTML = (chat.length ? chat : [{ role: 'assistant', content: `Hi. I can help you understand your numbers and think through what you're called to in this season. Pick a prompt above or ask anything.` }])
    .map(m => `<div class="msg ${m.role}">${m.role === 'assistant' ? A.mdToHtml(m.content) : `<p>${esc(m.content)}</p>`}</div>`).join('') +
    (pending ? '<div class="msg assistant"><p class="muted">Thinking…</p></div>' : '');
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}
$('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const text = $('chatInput').value.trim(); if (!text || $('btnSend').disabled) return;
  chat.push({ role: 'user', content: text }); $('chatInput').value = ''; renderChat(true);
  ctl = new AbortController(); $('btnSend').disabled = true; $('btnStopChat').hidden = false;
  try {
    const system = LENS + '\n\n' + situation() + '\n\nThe person is chatting with you inside their planning app. Answer their latest message.';
    const reply = await PROVIDERS[prov()].chat(getKey(), $('aiModel').value, system, chat.slice(-16), ctl.signal);
    chat.push({ role: 'assistant', content: reply || '(The model returned an empty answer. Try another model.)' });
  } catch (err) {
    chat.pop(); $('chatInput').value = text;
    $('aiMsg').textContent = err.name === 'AbortError' ? 'Stopped.' : err.message;
  }
  $('btnStopChat').hidden = true; ready(); renderChat(false);
});
$('btnStopChat').onclick = () => ctl && ctl.abort();
$('btnClearChat').onclick = () => { chat = []; renderChat(false); };
$('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chatForm').requestSubmit(); } });

const savedProv = A.store.get('mtw.aiprovider', 'anthropic');
if (PROVIDERS[savedProv]) $('aiProvider').value = savedProv;
loadKey(); renderChat(false);
A.coachPrompt = id => buildPrompt(PROMPTS.find(p => p.id === id));
A.coachCustom = ask => `${LENS}\n\n${situation()}\n\nWHAT I'D LIKE\n${ask}`;
})();
