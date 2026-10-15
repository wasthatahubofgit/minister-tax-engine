// Runs the engine's hand-computed tax and drawdown tests. Fails the build if any fail.
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../engine.js');
const T = E.selfTests(); let bad = 0;
for (const t of T) { if (!t.pass) bad++; console.log(`${t.pass ? 'PASS' : 'FAIL'} ${t.name}${t.pass ? '' : ` (got ${t.got}, want ${t.want})`}`); }
console.log(`${T.length - bad}/${T.length} passed`); process.exit(bad ? 1 : 0);
