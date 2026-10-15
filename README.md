# Minister Tax & Wealth Engine

A free planner for ministers: housing allowance (IRC §107), dual-status SECA, 403(b) and Roth choices, RMDs, Roth conversions, survivor scenarios and Monte Carlo, on 2026 federal and Massachusetts tax law.

- Runs entirely in the browser. No server code.
- Optional accounts (Supabase). Saved scenarios are encrypted in the browser with a vault passphrase before upload; the database stores only ciphertext and row-level security limits each person to their own rows.
- AI audit uses the visitor's own AI: copy the prompt into any chat app, or paste their own Anthropic / OpenAI / Gemini API key (sent only to that provider, never to this site).
- Worth discerning: rule-based prompts toward specific moves (housing allowance designation, donor-advised fund bunching, tax set-aside, emergency fund, Roth vs pre-tax, conversions, SEP-IRA for side income, 529 deductions, pension survivor choices), each with why, estimated effect, next step and an AI prompt.
- Pension with start age, survivor %, COLA, and church-plan housing allowance designation; 529 plans with a 2026 state deduction/credit table; speaking and honoraria income with a set-aside recommendation; the 2026 non-itemizer charitable deduction.
- Home you arrange yourself: choose, reorder and hide cards (monthly plan, paycheck, budget, tax set-aside, retirement outlook, housing check, emergency fund and more).
- Monthly plan with linked sliders: lock what must stay fixed; the rest adjust, everyday spending first, using the real after-tax cost of pre-tax saving.
- Budget in three levels (simple, standard 15 categories, detailed) sharing one set of numbers; housing lines can feed the housing allowance calculation.
- Paycheck & taxes: tax set-aside check (voluntary withholding vs. quarterly payments) with 2026 due dates.
- Simple / Detailed switch hides advanced settings for beginners.
- First-visit welcome story and a 9-step guided setup for newcomers (experts can close it; "Guided setup" reopens it).
- Every number has a slider; the figures you choose to watch show before→after changes, with a plain-language "today → retirement" translation for savings changes.
- Tap any term (or the ? next to a field) for a plain explanation with articles, videos and an "explain this" AI prompt. The Learn tab lists them all.
- AI coach: prompts written in a stewardship lens, ready to paste into any AI, or chat in-app with your own key.
- State tax: full Massachusetts rules, the nine states with no wage tax, or a flat rate for any other state.
- `engine.js` holds all tax math and 41 hand-computed tests (`node scripts/test.mjs`, also run by GitHub Actions on every push).

## One-time setup

1. **Supabase** (free): create a project at supabase.com.
   - SQL Editor → New query → paste `supabase/setup.sql` → Run.
   - Authentication → Sign In / Providers → Email: turn **off** "Confirm email". (The free built-in email service only sends to your own team, so confirmation emails would not reach other people.)
   - Authentication → URL Configuration: set Site URL to `https://wasthatahubofgit.github.io/minister-tax-engine/`.
   - Project Settings → API Keys: copy the Project URL and the publishable (or legacy anon) key into `config.js`.
2. **GitHub Pages**: repo Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)` → Save.
3. **Keep-awake**: the "Keep Supabase awake" workflow pings the database twice a week so the free project is not paused. It starts automatically once `config.js` is filled in.

## Each January

Update the `TAX` block at the top of `engine.js` (brackets, standard deduction, wage base, contribution limits, Massachusetts surtax threshold), then adjust the matching expected values in `selfTests()`.

## Password resets

Supabase's free email service can't send reset emails to other people. To reset someone's login, open Supabase → Authentication → Users and update or delete the user. Their vault passphrase is separate: nobody, including the administrator, can recover scenarios if that is lost.

Educational planning model, not tax or investment advice.
