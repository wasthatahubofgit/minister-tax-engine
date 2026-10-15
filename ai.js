/* Bring-your-own AI. Keys go only from this browser to the chosen provider. */
(function(){
'use strict';
const A = window.App, $ = A.$;
const KEYSTORE = 'mtw.aikey.';
let memKeys = {}, ctl = null;

const PROVIDERS = {
  anthropic: {
    headers: k => ({ 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' }),
    async models(k){
      const r = await call('https://api.anthropic.com/v1/models?limit=100', { headers: this.headers(k) });
      return r.data.map(m => m.id);
    },
    async run(k, model, prompt, signal){
      const r = await call('https://api.anthropic.com/v1/messages', { method: 'POST', signal, headers: this.headers(k),
        body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }) });
      return (r.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    }
  },
  openai: {
    headers: k => ({ authorization: 'Bearer ' + k, 'content-type': 'application/json' }),
    async models(k){
      const r = await call('https://api.openai.com/v1/models', { headers: this.headers(k) });
      return r.data.map(m => m.id)
        .filter(id => /^(gpt-|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|embedding|search|moderation|instruct)/.test(id))
        .sort().reverse();
    },
    async run(k, model, prompt, signal){
      const r = await call('https://api.openai.com/v1/chat/completions', { method: 'POST', signal, headers: this.headers(k),
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }) });
      return r.choices?.[0]?.message?.content || '';
    }
  },
  gemini: {
    url: (k, path) => `https://generativelanguage.googleapis.com/v1beta/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(k)}`,
    async models(k){
      const r = await call(this.url(k, 'models?pageSize=200'), {});
      return (r.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name))
        .map(m => m.name.replace(/^models\//, '')).sort().reverse();
    },
    async run(k, model, prompt, signal){
      const r = await call(this.url(k, `models/${encodeURIComponent(model)}:generateContent`), { method: 'POST', signal,
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }) });
      return (r.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    }
  }
};

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

const prov = () => $('aiProvider').value;
function getKey(){
  const p = prov(); const typed = $('aiKey').value.trim();
  if (typed) return typed;
  return memKeys[p] || '';
}
function persistKey(){
  const p = prov(), k = $('aiKey').value.trim();
  memKeys[p] = k;
  try { if ($('aiRemember').checked && k) localStorage.setItem(KEYSTORE + p, k); else localStorage.removeItem(KEYSTORE + p); } catch {}
}
function loadKey(){
  const p = prov(); let k = memKeys[p] || '';
  try { const s = localStorage.getItem(KEYSTORE + p); if (s) { k = s; $('aiRemember').checked = true; } else $('aiRemember').checked = false; } catch {}
  $('aiKey').value = k;
  const savedModel = A.store.get('mtw.aimodel.' + p, '');
  $('aiModel').innerHTML = savedModel ? `<option>${A.esc(savedModel)}</option>` : '<option value="">Load models first</option>';
  $('btnRunAI').disabled = !savedModel || !k;
}

$('aiProvider').addEventListener('change', () => { A.store.set('mtw.aiprovider', prov()); loadKey(); $('aiMsg').textContent = ''; });
$('aiKey').addEventListener('change', () => { persistKey(); $('btnRunAI').disabled = !$('aiModel').value || !getKey(); });
$('aiRemember').addEventListener('change', persistKey);
$('aiModel').addEventListener('change', () => { A.store.set('mtw.aimodel.' + prov(), $('aiModel').value); $('btnRunAI').disabled = !$('aiModel').value || !getKey(); });

$('btnModels').onclick = async () => {
  const k = getKey(); if (!k) { $('aiMsg').textContent = 'Paste your API key first.'; return; }
  persistKey(); $('btnModels').disabled = true; $('aiMsg').textContent = 'Loading models…';
  try {
    const list = await PROVIDERS[prov()].models(k);
    if (!list.length) throw new Error('No chat models are available for this key.');
    const prev = A.store.get('mtw.aimodel.' + prov(), '');
    $('aiModel').innerHTML = list.map(m => `<option ${m === prev ? 'selected' : ''}>${A.esc(m)}</option>`).join('');
    A.store.set('mtw.aimodel.' + prov(), $('aiModel').value);
    $('aiMsg').textContent = `${list.length} models available. Pick one and run the audit.`;
    $('btnRunAI').disabled = false;
  } catch (e) { $('aiMsg').textContent = 'Could not load models: ' + e.message; }
  $('btnModels').disabled = false;
};

$('btnRunAI').onclick = async () => {
  const k = getKey(), model = $('aiModel').value, prompt = A.auditPrompt();
  if (!k || !model || !prompt) return;
  ctl = new AbortController();
  $('btnRunAI').disabled = true; $('btnStopAI').hidden = false;
  $('auditOut').innerHTML = `<p class="muted">Asking ${A.esc(model)}… this usually takes 10–60 seconds.</p>`;
  try {
    const text = await PROVIDERS[prov()].run(k, model, prompt, ctl.signal);
    $('auditOut').innerHTML = text ? A.mdToHtml(text) : '<p class="muted">The model returned an empty answer. Try another model.</p>';
  } catch (e) {
    $('auditOut').innerHTML = e.name === 'AbortError' ? '<p class="muted">Stopped.</p>' : `<p class="warn-item">${A.esc(e.message || 'The request failed.')}</p>`;
  }
  $('btnRunAI').disabled = false; $('btnStopAI').hidden = true;
};
$('btnStopAI').onclick = () => ctl && ctl.abort();

$('btnCopyPrompt').onclick = async () => {
  const p = A.auditPrompt(); $('promptBox').value = p;
  try { await navigator.clipboard.writeText(p); $('copyMsg').textContent = 'Copied. Paste it into a new chat.'; }
  catch { const t = $('promptBox'); t.closest('details').open = true; t.focus(); t.select(); $('copyMsg').textContent = 'Press Ctrl/Cmd+C to copy the selected prompt.'; }
};
document.querySelector('[data-tab="audit"]').addEventListener('click', () => { $('promptBox').value = A.auditPrompt(); });

const savedProv = A.store.get('mtw.aiprovider', 'anthropic');
if (PROVIDERS[savedProv]) $('aiProvider').value = savedProv;
loadKey();
$('promptBox').value = A.auditPrompt();
})();
