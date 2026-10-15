/* "How to use this page" at the top of every tab. Open the first time you visit a tab;
   once you close it, it stays closed on this device (reopen it any time). */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc;

const HELP = {
  home: { what: 'Your household at a glance. Everything here updates as you change numbers anywhere in the app.',
    steps: ['Read the cards. Tap any underlined word or <b>?</b> for a plain explanation.',
      'Use <b>Your monthly plan</b> to try changes. In <b>Linked</b> mode, other amounts adjust for you (padlocks keep items fixed). In <b>Assign freely</b> mode, you spend only from "Left to assign," like skill points.',
      'Watch the figures pinned at the top. After each change they show what went up or down.',
      'Tap <b>Customize</b> to add, hide or reorder cards.'],
    tip: 'Plan moves can be reversed with Undo. Try one small change at a time.' },
  budget: { what: "A rough monthly picture of where money goes. It's a reference, not a precise tracker.",
    steps: ['Pick a level: <b>Simple</b>, <b>Standard</b> or <b>Detailed</b>. Switching keeps your numbers.',
      'Fill in the housing lines. These are the costs a housing allowance can cover. Leave the box checked to use their total as your actual housing expenses for taxes.',
      'Add giving and everything else, using round numbers from a typical month.',
      'Check the summary. A shortfall means the plan spends more than you bring home; the monthly plan on Home can help you find room.'],
    tip: 'Last month\'s bank and card statements are the quickest source. Close enough is good enough here.' },
  pay: { what: 'What your pay looks like after minister tax rules, and whether enough tax is being set aside.',
    steps: ['Enter your household, pay and housing allowance on the left, or use <b>Guided setup</b> at the top.',
      'Read <b>Dual-status math</b> to see whether the housing allowance outweighs the extra self-employment tax you pay.',
      'Fill in the <b>Tax set-aside check</b> with what is withheld from each paycheck and any quarterly payments.',
      'If it says under-withheld, follow the suggestion: more voluntary withholding from church pay, or quarterly payments.'],
    tip: 'You can show the suggested monthly withholding to your church treasurer. Ministers can ask for extra federal withholding to cover self-employment tax.' },
  grow: { what: "How today's balances and savings grow until you retire.",
    steps: ['Enter what you have saved, keeping pre-tax and Roth money separate.',
      'Add cash savings and any regular investing outside retirement accounts.',
      'Set the years until retirement.',
      'Check the chart and the emergency fund figure (three to six months of spending is a common goal).'],
    tip: 'The share of your 403(b) in a church plan matters: only that money can come out tax-free as housing allowance in retirement.' },
  retire: { what: 'Whether your savings and Social Security can cover your spending for all of retirement, and what taxes look like along the way.',
    steps: ['Enter the spending you hope for (in today\'s dollars), your Social Security estimates and any retirement housing allowance.',
      'Read <b>Static plan lasts</b> (steady returns) and <b>Monte Carlo success</b> (1,000 ups-and-downs markets).',
      'See where money comes from in <b>Year 1 of retirement</b>.',
      'In Detailed view, try Roth conversions, a different withdrawal order, or the survivor scenario.'],
    tip: 'A success rate around 85–95% is usually considered solid. Small changes years ahead move it more than big changes late.' },
  years: { what: 'Every year of retirement in one table, for people who like to see the details.',
    steps: ['Scroll sideways to see all columns: spending, income, withdrawals by account, taxes and balances.',
      '"Housing-free" is church-plan money taken tax-free as housing allowance.',
      'Use <b>Download CSV</b> to open it in a spreadsheet.'],
    tip: "The last column shows each year's balance in today's dollars, which is easier to picture." },
  scen: { what: 'Save versions of your plan and compare them side by side.',
    steps: ['Name and save your current numbers (for example "Today").',
      'Change something, like moving $100 a month from pre-tax to Roth, then save again with a new name.',
      'Compare the cards. Green and red show what is better or worse than your current numbers.',
      'Tap <b>Load</b> to go back to any version. Export to a file to share with a spouse or adviser.'],
    tip: 'When signed in, saved scenarios are encrypted and follow you to other devices.' },
  audit: { what: 'An AI coach that helps you understand your numbers and think about what you are called to now.',
    steps: ['Pick a prompt card that fits your question.',
      'Tap <b>Copy prompt</b> and paste it into ChatGPT, Claude, Gemini or Copilot. It already includes your numbers, but not your name.',
      'Or, if you have your own API key, add it on this page and chat here.',
      'Bring what you learn back to the dashboard and try it.'],
    tip: 'The coach is for learning and reflection. For tax decisions, confirm with a clergy tax professional.' },
  learn: { what: 'Plain-language explanations of every term in the app, with articles, videos and AI prompts for going deeper.',
    steps: ['New to this? Start with the suggested terms, in order.',
      'Search for any word you see elsewhere in the app.',
      'Open a term for a short explanation, then Read, Watch, or copy an "explain this" prompt for any AI.'],
    tip: 'You can replay the welcome and guided setup from here at any time.' },
  account: { what: 'Optional. An account lets you reach your saved scenarios from any device.',
    steps: ['Create an account with your email and a password.',
      'Choose a vault passphrase. It encrypts your scenarios before they leave this browser.',
      'Save scenarios as usual; they are stored encrypted in your account.'],
    tip: 'Nobody can recover a lost vault passphrase, not even the site administrator. Write it down. On a shared computer, use "Clear this device" when done.' },
  rules: { what: 'The tax-law numbers and assumptions behind every calculation.',
    steps: ['Review the 2026 figures (brackets, limits, wage base). Change them only if the law changes.',
      'Read the assumptions list to understand what the model simplifies.',
      'Run the self-tests to confirm the math is working.'],
    tip: 'These figures are updated each January.' }
};

const closed = new Set(A.store.get('mtw.helpClosed', []));
document.querySelectorAll('[data-panel]').forEach(panel => {
  const id = panel.dataset.panel, h = HELP[id]; if (!h) return;
  const d = document.createElement('details');
  d.className = 'tabhelp'; d.open = !closed.has(id);
  d.innerHTML = `<summary><span class="th-icon" aria-hidden="true">?</span> How to use this page</summary>
    <div class="th-body"><p>${esc(h.what)}</p><ol>${h.steps.map(s => `<li>${s}</li>`).join('')}</ol>${h.tip ? `<p class="th-tip"><strong>Tip:</strong> ${esc(h.tip)}</p>` : ''}</div>`;
  d.addEventListener('toggle', () => { d.open ? closed.delete(id) : closed.add(id); A.store.set('mtw.helpClosed', [...closed]); });
  panel.prepend(d);
});
})();
