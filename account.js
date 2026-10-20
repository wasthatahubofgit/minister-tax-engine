/* Accounts (Supabase email + password) and an end-to-end encrypted scenario vault.
   The server stores only AES-GCM ciphertext; the key is derived in this browser
   from the person's vault passphrase (PBKDF2-SHA256, 600k iterations) and never leaves it. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc;
const cfg = window.APP_CONFIG || {};
const configured = cfg.supabaseUrl && !/YOUR_/.test(cfg.supabaseUrl) && cfg.supabaseKey && !/YOUR_/.test(cfg.supabaseKey);
const ITER = 600000, CHECK = 'minister-vault-v1';
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

let sb = null, session = null, vault = undefined, key = null;

/* ---------- crypto ---------- */
async function deriveKey(pass, salt){
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(k, obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, te.encode(JSON.stringify(obj))));
  return { iv: b64(iv), ct: b64(ct) };
}
async function unseal(k, iv, ct){
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(ct));
  return JSON.parse(td.decode(pt));
}

/* ---------- cloud backend for scenarios ---------- */
const cloudBackend = {
  label: 'Saved to your account, encrypted',
  async list(){
    const { data, error } = await sb.from('scenarios').select('id, iv, ct, created_at').order('created_at');
    if (error) throw error;
    const out = [];
    for (const row of data) { try { out.push(Object.assign(await unseal(key, row.iv, row.ct), { id: row.id })); } catch { /* unreadable row: skip */ } }
    return out;
  },
  async add(s){ const { error } = await sb.from('scenarios').insert(await seal(key, s)); if (error) throw error; },
  async remove(id){ const { error } = await sb.from('scenarios').delete().eq('id', id); if (error) throw error; }
};

/* ---------- UI ---------- */
const msg = (t, bad) => { $('acctMsg').textContent = t || ''; $('acctMsg').style.color = bad ? 'var(--bad)' : ''; };
const inputCss = 'font:inherit;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);width:100%';
const field = (id, label, type, extra = '') => `<label style="display:grid;gap:4px;font-size:.88rem" for="${id}">${label}<input id="${id}" type="${type}" style="${inputCss}" ${extra}></label>`;
function setTop(){
  const b = $('btnAccount');
  b.textContent = !session ? 'Sign in' : key ? 'Account · unlocked' : 'Unlock vault';
  $('acctState').textContent = !configured ? '' : !session ? 'Signed out' : key ? 'Signed in · vault unlocked' : 'Signed in · vault locked';
}
$('btnAccount').onclick = () => A.showTab('account');

function confirmButton(btn, label, action){
  let armed = false, t;
  btn.onclick = async () => {
    if (!armed) { armed = true; btn.textContent = label; btn.style.borderColor = 'var(--bad)'; t = setTimeout(() => { armed = false; render(); }, 5000); return; }
    clearTimeout(t); btn.disabled = true; await action();
  };
}
function localClearButton(){
  return '<button class="btn" id="btnClearLocal" type="button">Clear this device</button>';
}
function wireClear(){
  const b = $('btnClearLocal'); if (!b) return;
  confirmButton(b, 'Click again to clear', async () => {
    A.clearLocal(); try { Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k)); } catch {}
    if (sb && session) await sb.auth.signOut();
    key = null; A.useBackend(null); A.resetInputs(); msg('Cleared everything this app saved in this browser.'); render();
  });
}

function render(){
  setTop();
  const body = $('acctBody');
  if (window.MTW_OFFLINE) {
    body.innerHTML = `<p class="note">This is the offline copy, built ${esc(window.MTW_OFFLINE.built)}. Everything you enter is saved on this computer, in this browser, and nothing is sent anywhere. The only exception is the AI coach, if you choose to add your own key.</p>
      <p class="note">To back up or move your numbers, use <strong>Export</strong> on the Scenarios tab. Clearing browser data erases them.</p><div class="row">${localClearButton()}</div>`;
    const pc = $('protectCard'); if (pc) pc.hidden = true;
    wireClear(); return;
  }
  if (!configured) {
    body.innerHTML = `<p class="note">Accounts aren't switched on for this site yet, so everything is saved in this browser only. You can still export your scenarios as a file from the Scenarios tab.</p><div class="row">${localClearButton()}</div>`;
    wireClear(); return;
  }
  if (!session) {
    body.innerHTML = `<form id="fAuth" style="display:grid;gap:10px" novalidate>
        ${field('aEmail', 'Email', 'email', 'autocomplete="email" required')}
        ${field('aPass', 'Password', 'password', 'autocomplete="current-password" minlength="8" required')}
        <div class="row"><button class="btn primary" type="submit" data-mode="in">Sign in</button><button class="btn" type="submit" data-mode="up">Create account</button></div>
      </form>
      <p class="small muted" style="margin:8px 0 0">An account lets you reach your saved scenarios from any device. Forgot your password? Ask the site administrator to reset it; your vault passphrase is separate and only you know it.</p>
      <div class="row" style="margin-top:10px">${localClearButton()}</div>`;
    let mode = 'in';
    body.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; }));
    $('fAuth').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('aEmail').value.trim(), password = $('aPass').value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Enter a valid email address.', 1);
      if (password.length < 8) return msg('Use a password of at least 8 characters.', 1);
      msg(mode === 'up' ? 'Creating your account…' : 'Signing in…');
      const fn = mode === 'up' ? sb.auth.signUp({ email, password }) : sb.auth.signInWithPassword({ email, password });
      const { data, error } = await fn;
      if (error) return msg(error.message, 1);
      if (mode === 'up' && !data.session) return msg('Account created. Check your email to confirm it, then sign in.');
      msg('');
    });
    wireClear(); return;
  }
  const email = esc(session.user.email || '');
  if (vault === undefined) { body.innerHTML = '<p class="muted">Checking your vault…</p>'; return; }
  if (vault === null) {
    body.innerHTML = `<p class="note">Signed in as <strong>${email}</strong>. Create a vault passphrase. It encrypts your scenarios before they leave this browser.</p>
      <form id="fNew" style="display:grid;gap:10px">
        ${field('vP1', 'Vault passphrase (at least 10 characters)', 'password', 'autocomplete="new-password" minlength="10"')}
        ${field('vP2', 'Type it again', 'password', 'autocomplete="new-password"')}
        <p class="warn-item" style="margin:0">Write this down somewhere safe. If you lose it, nobody can recover your saved scenarios, including the site administrator.</p>
        <div class="row"><button class="btn primary" type="submit">Create vault</button><button class="btn" type="button" id="btnOut">Sign out</button></div>
      </form>`;
    $('btnOut').onclick = signOut;
    $('fNew').addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = $('vP1').value, p2 = $('vP2').value;
      if (p1.length < 10) return msg('Use at least 10 characters.', 1);
      if (p1 !== p2) return msg('The two passphrases do not match.', 1);
      msg('Creating vault…');
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const k = await deriveKey(p1, salt); const chk = await seal(k, CHECK);
      const { error } = await sb.from('vaults').insert({ salt: b64(salt), check_iv: chk.iv, check_ct: chk.ct });
      if (error) return msg(error.message, 1);
      vault = { salt: b64(salt), check_iv: chk.iv, check_ct: chk.ct }; await unlocked(k); msg('Vault created and unlocked.');
    });
    return;
  }
  if (!key) {
    body.innerHTML = `<p class="note">Signed in as <strong>${email}</strong>. Enter your vault passphrase to open your saved scenarios.</p>
      <form id="fUnlock" style="display:grid;gap:10px">
        ${field('vP', 'Vault passphrase', 'password', 'autocomplete="current-password"')}
        <div class="row"><button class="btn primary" type="submit">Unlock</button><button class="btn" type="button" id="btnOut">Sign out</button></div>
      </form>`;
    $('btnOut').onclick = signOut;
    $('fUnlock').addEventListener('submit', async e => {
      e.preventDefault(); msg('Unlocking…');
      try { const k = await deriveKey($('vP').value, unb64(vault.salt));
        if ((await unseal(k, vault.check_iv, vault.check_ct)) !== CHECK) throw 0;
        await unlocked(k); msg('Unlocked.'); }
      catch { msg('That passphrase did not open the vault.', 1); }
    });
    return;
  }
  body.innerHTML = `<p class="note">Signed in as <strong>${email}</strong>. Scenarios you save now are encrypted and stored in your account.</p>
    <div id="migrate"></div>
    <div class="row"><button class="btn" type="button" id="btnLock">Lock vault</button><button class="btn" type="button" id="btnOut">Sign out</button>${localClearButton()}</div>
    <details><summary class="small">Change password or vault passphrase</summary>
      <form id="fPw" style="display:grid;gap:8px;margin-top:10px">${field('nPw', 'New account password', 'password', 'autocomplete="new-password" minlength="8"')}<div><button class="btn" type="submit">Change password</button></div></form>
      <form id="fVp" style="display:grid;gap:8px;margin-top:14px">${field('nVp1', 'New vault passphrase', 'password', 'autocomplete="new-password"')}${field('nVp2', 'Type it again', 'password', 'autocomplete="new-password"')}<div><button class="btn" type="submit">Re-encrypt with new passphrase</button></div></form>
    </details>
    <details><summary class="small">Delete my account</summary>
      <p class="small muted">Deletes your login and every saved scenario from the server. This cannot be undone.</p>
      <button class="btn" type="button" id="btnDel">Delete my account</button>
    </details>`;
  $('btnLock').onclick = () => { key = null; A.useBackend(null); msg('Vault locked.'); render(); };
  $('btnOut').onclick = signOut;
  wireClear();
  confirmButton($('btnDel'), 'Click again to delete everything', async () => {
    const { error } = await sb.rpc('delete_my_account');
    if (error) { msg(error.message, 1); render(); return; }
    await sb.auth.signOut(); key = null; A.useBackend(null); msg('Your account and saved scenarios were deleted.');
  });
  $('fPw').addEventListener('submit', async e => { e.preventDefault();
    const pw = $('nPw').value; if (pw.length < 8) return msg('Use at least 8 characters.', 1);
    const { error } = await sb.auth.updateUser({ password: pw }); msg(error ? error.message : 'Password changed.', !!error); $('nPw').value = ''; });
  $('fVp').addEventListener('submit', async e => { e.preventDefault();
    const p1 = $('nVp1').value, p2 = $('nVp2').value;
    if (p1.length < 10) return msg('Use at least 10 characters.', 1);
    if (p1 !== p2) return msg('The two passphrases do not match.', 1);
    msg('Re-encrypting…');
    try {
      const items = await cloudBackend.list();
      const salt = crypto.getRandomValues(new Uint8Array(16)); const k2 = await deriveKey(p1, salt); const chk = await seal(k2, CHECK);
      for (const it of items) { const { id, ...s } = it; const sealed = await seal(k2, s);
        const { error } = await sb.from('scenarios').update(sealed).eq('id', id); if (error) throw error; }
      const { error } = await sb.from('vaults').update({ salt: b64(salt), check_iv: chk.iv, check_ct: chk.ct }).eq('user_id', session.user.id);
      if (error) throw error;
      vault = { salt: b64(salt), check_iv: chk.iv, check_ct: chk.ct }; key = k2; msg('Vault passphrase changed.'); render();
    } catch (err) { msg('Could not change the passphrase: ' + (err.message || err), 1); }
  });
  showMigrate();
}

async function showMigrate(){
  const local = await A.localScenarios(); const box = $('migrate'); if (!box || !local.length) return;
  box.innerHTML = `<div class="row" style="margin-bottom:10px"><span class="small">${local.length} scenario${local.length === 1 ? ' is' : 's are'} saved only in this browser.</span><button class="btn" type="button" id="btnMigrate">Move to my account</button></div>`;
  $('btnMigrate').onclick = async () => {
    $('btnMigrate').disabled = true;
    try { for (const s of local) { const { id, ...rest } = s; await cloudBackend.add(rest); }
      A.store.set('mtw.scenarios', []); msg(`Moved ${local.length} scenario${local.length === 1 ? '' : 's'} into your encrypted account.`); A.useBackend(cloudBackend); render(); }
    catch (err) { msg('Move failed: ' + (err.message || err), 1); $('btnMigrate').disabled = false; }
  };
}

async function unlocked(k){ key = k; A.useBackend(cloudBackend); render(); }
async function signOut(){ await sb.auth.signOut(); key = null; A.useBackend(null); msg('Signed out.'); }

async function loadVault(){
  vault = undefined; render();
  const { data, error } = await sb.from('vaults').select('salt, check_iv, check_ct').maybeSingle();
  if (error) { msg('Could not reach your vault: ' + error.message, 1); vault = undefined; return; }
  vault = data || null; render();
}

if (!configured) { render(); return; }
if (!window.supabase || !window.crypto?.subtle) { $('acctBody').innerHTML = '<p class="note">Accounts could not load in this browser. Your work is still saved on this device.</p>'; return; }
sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
sb.auth.onAuthStateChange((event, s) => {
  const was = session?.user?.id; session = s;
  if (!s) { key = null; vault = undefined; A.useBackend(null); render(); return; }
  if (s.user.id !== was) { key = null; A.useBackend(null); setTimeout(loadVault, 0); }
  else render();
});
render();
})();
