// Called weekly by GitHub Actions so the free Supabase project is never paused for inactivity.
import { readFileSync } from 'node:fs';
const window = {};
new Function('window', readFileSync(new URL('../config.js', import.meta.url), 'utf8'))(window);
const { supabaseUrl, supabaseKey } = window.APP_CONFIG || {};
if (!supabaseUrl || supabaseUrl.includes('YOUR_')) { console.log('Supabase not configured yet; skipping.'); process.exit(0); }
const res = await fetch(`${supabaseUrl}/rest/v1/rpc/ping`, { method: 'POST', headers: { apikey: supabaseKey, 'content-type': 'application/json' }, body: '{}' });
console.log('ping', res.status, await res.text());
if (!res.ok) process.exit(1);
