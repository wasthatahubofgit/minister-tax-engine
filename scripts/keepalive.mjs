// Run daily by GitHub Actions so the free Supabase project is not paused for inactivity.
// Touches the three parts of Supabase a visitor would use: the database function, a table read, and sign-in service.
import { readFileSync } from 'node:fs';
const window = {};
new Function('window', readFileSync(new URL('../config.js', import.meta.url), 'utf8'))(window);
const { supabaseUrl, supabaseKey } = window.APP_CONFIG || {};
if (!supabaseUrl || supabaseUrl.includes('YOUR_')) { console.log('Supabase not configured yet; skipping.'); process.exit(0); }
const h = { apikey: supabaseKey, 'content-type': 'application/json' };
const calls = [
  ['database function', `${supabaseUrl}/rest/v1/rpc/ping`, { method: 'POST', headers: h, body: '{}' }],
  ['table read', `${supabaseUrl}/rest/v1/vaults?select=user_id&limit=1`, { headers: h }, true],   // 401 is expected (visitors who are not signed in cannot read it); it still reached the database
  ['sign-in service', `${supabaseUrl}/auth/v1/settings`, { headers: h }]
];
let failed = false;
for (const [name, url, opt, blockedIsFine] of calls) {
  try { const r = await fetch(url, opt); console.log(name, r.status); if (!(r.ok || (blockedIsFine && (r.status === 401 || r.status === 403)))) failed = true; }
  catch (e) { console.log(name, 'FAILED:', e.cause?.code || e.message, '(the project may be paused; restore it in the Supabase dashboard)'); failed = true; }
}
if (failed) process.exit(1);
