// Builds minister-tax-engine-offline.html: the whole app in ONE file that works without internet.
// Run:  node scripts/build-offline.mjs      (re-run after any change; commit the result)
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const built = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
let html = read('index.html');

// 1. Remove everything that only makes sense online (accounts download card, fonts, CDN scripts)
html = html.replace(/<!--online-only-->[\s\S]*?<!--\/online-only-->/g, '');
html = html.replace(/<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<!--CSP-->');

// 2. Inline every script (libraries from /vendor, the app's own files, and an offline flag in place of config.js)
const inline = src => {
  if (/cdnjs\.cloudflare\.com\/.*[Cc]hart/.test(src)) return read('vendor/chart.umd.min.js');
  if (/jsdelivr\.net\/.*supabase/.test(src)) return '';
  if (src === 'config.js') return `window.APP_CONFIG = {}; window.MTW_OFFLINE = { built: ${JSON.stringify(built)} };`;
  if (/^https?:/.test(src)) throw new Error('Unexpected external script: ' + src);
  return read(src);
};
html = html.replace(/<script src="([^"]+)"><\/script>\s*/g, (m, src) => {
  const code = inline(src).replace(/<\/script/gi, '<\\/script');
  return code.trim() ? `<script>${code}</script>\n` : '';
});

// 3. A strict policy: only these exact scripts may run; the only network calls allowed are the AI providers
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
const csp = `default-src 'none'; script-src ${hashes.join(' ')}; style-src 'unsafe-inline'; img-src data: blob:; ` +
  `connect-src https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com; base-uri 'none'; form-action 'none'; object-src 'none'`;
html = html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);

// 4. Label it
html = html.replace(/<title>[^<]*<\/title>/, '<title>Minister Tax &amp; Wealth Engine (offline copy)</title>');
html = html.replace('</footer>', ` This is the offline copy, built ${built} with 2026 tax law. Everything stays on this computer. Download a fresh copy each January.</footer>`);
html = html.replace('</style>', '#btnAccount{display:none}\n</style>');
html = html.replace('>My account</button>', '>My data</button>');

if (/https?:\/\/(?:cdn|fonts)\./.test(html.replace(/<footer[\s\S]*?<\/footer>/, ''))) throw new Error('Still references an external asset');
const out = path.join(root, 'minister-tax-engine-offline.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${path.basename(out)} (${(html.length / 1024).toFixed(0)} KB, ${hashes.length} scripts, built ${built})`);
