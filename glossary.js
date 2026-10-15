/* Plain-language glossary: clickable terms, learn-more links (written + video), and ask-an-AI prompts. */
(function(){
'use strict';
const A = window.App, $ = A.$, esc = A.esc;

const yt = q => ({ label: `Videos: "${q}"`, url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) });
const PUB517 = { label: 'IRS Publication 517: Social Security and other information for clergy', url: 'https://www.irs.gov/publications/p517' };
const PUB571 = { label: 'IRS Publication 571: 403(b) plans', url: 'https://www.irs.gov/publications/p571' };

const TERMS = {
  compound: { term: 'Compound growth', group: 'Big ideas',
    short: 'Your savings earn growth, and then that growth earns growth too. Over decades, most of the money comes from growth rather than from what you put in.',
    more: 'At 6% a year, $10 a month saved for 30 years adds up to $3,600 of deposits but grows to about $10,000. Time does most of the work, which is why small amounts started early matter so much.',
    reflect: 'Small, faithful amounts over a long road become real capacity to give and to rest.',
    read: [{ label: 'Investor.gov compound interest calculator', url: 'https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator' },
           { label: 'Khan Academy: interest basics', url: 'https://www.khanacademy.org/economics-finance-domain/core-finance/interest-tutorial' }],
    watch: [yt('compound interest explained simply')] },
  todaysdollars: { term: "Today's dollars", group: 'Big ideas',
    short: "A future amount shown as what it would buy now, after removing inflation. $1,000 in 2050 buys less than $1,000 today.",
    more: "This app usually shows retirement figures in today's dollars so you can picture them against your life now. Where a table says \"nominal,\" it shows the actual future dollar amount.",
    read: [{ label: 'BLS inflation calculator', url: 'https://www.bls.gov/data/inflation_calculator.htm' }],
    watch: [yt('inflation explained real vs nominal dollars')] },
  takehome: { term: 'Take-home pay', group: 'Big ideas',
    short: 'What actually reaches your bank account after taxes and retirement savings come out.',
    more: 'Pre-tax saving lowers your income tax, so saving $100 usually lowers take-home by less than $100. The impact bar shows that difference whenever you change a savings amount.' },
  retincome: { term: 'Retirement income from savings', group: 'Big ideas',
    short: "How much your retirement accounts could pay you each month for your whole retirement, in today's dollars, before taxes. Social Security and pensions are extra.",
    more: "The app spreads your projected savings evenly over your retirement years, assuming your retirement return minus inflation. It's a planning yardstick, not a guarantee." },
  budget: { term: 'Budget (rough reference)', group: 'Big ideas',
    short: 'A monthly picture of where money goes: housing, giving, food and the rest. Here it is a rough reference, not a precise tracker.',
    more: "Round numbers and typical months are fine. The housing lines can feed your housing allowance calculation, and the total shows whether this month's plan leaves a surplus or a shortfall.",
    reflect: 'Knowing where money goes is the first step to directing it toward what you are called to.' },
  emergency: { term: 'Emergency fund', group: 'Big ideas',
    short: 'Cash set aside for surprises like a car repair, a job change or a medical bill. Three to six months of spending is a common goal.',
    more: 'It keeps a hard month from turning into debt or an early withdrawal from retirement savings. Keep it in a savings account, not invested in stocks.',
    read: [{ label: 'Consumer Financial Protection Bureau: emergency savings', url: 'https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/' }] },
  setaside: { term: 'Setting aside tax (withholding and quarterly payments)', group: 'Minister taxes',
    short: "Churches don't withhold Social Security or Medicare from a minister's pay, and often withhold no income tax at all. You must set money aside yourself, or face a large bill and possibly a penalty in April.",
    more: 'Two ways: ask the church to withhold extra federal income tax from each paycheck (a voluntary agreement, using Form W-4), or send quarterly estimated payments with Form 1040-ES. Withheld tax can cover self-employment tax too.',
    read: [PUB517, { label: 'IRS: Estimated taxes', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes' }],
    watch: [yt('pastor quarterly estimated taxes explained')] },
  sideincome: { term: 'Speaking, weddings and other side income', group: 'Minister taxes',
    short: 'Honoraria and fees you receive outside your salary are self-employment income. Nobody withholds tax from them, so you set aside a share of each payment yourself.',
    more: 'This income adds both income tax and self-employment tax (about 14% of it). Expenses you pay to earn it, like travel, reduce what is taxed. Raising your church withholding is often the simplest way to cover it, because withholding counts as paid evenly through the year.',
    read: [PUB517, { label: 'IRS: Estimated taxes', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes' }] },
  hysa: { term: 'High-yield savings account', group: 'Saving for retirement',
    short: 'An online or bank savings account that pays a higher interest rate than ordinary savings, while staying safe and easy to reach.',
    more: 'A good home for an emergency fund or money set aside for taxes. Look for FDIC insurance and no monthly fees.' },
  sep: { term: 'SEP-IRA or solo 401(k)', group: 'Saving for retirement',
    short: 'Retirement accounts for self-employment income such as honoraria. Contributions lower income tax on that income.',
    more: 'You can generally put in up to about 20% of net self-employment earnings (after half of the self-employment tax). They do not reduce self-employment tax. A tax professional can confirm how much applies to you.',
    read: [{ label: 'IRS: SEP plans', url: 'https://www.irs.gov/retirement-plans/plan-sponsor/simplified-employee-pension-plan-sep' }] },
  pension: { term: 'Pension', group: 'Retirement',
    short: 'A set monthly payment for life from a denominational or employer plan, based on years of service.',
    more: 'If it comes from a church plan that designates housing allowance, the part you spend on housing can be free of federal income tax, but generally not for a surviving spouse. Choosing a joint-and-survivor option lowers the payment but keeps income flowing to your spouse.',
    read: [PUB517] },
  college529: { term: '529 college savings plan', group: 'Saving for retirement',
    short: "An account for a child's education. Growth and qualified withdrawals are tax-free, and many states give a state tax deduction or credit for contributions.",
    more: "There is no federal deduction. State rules vary: some allow any state's plan, some only their own, some cap the deduction per child, and a few have income limits. Unused money can, within limits, be rolled into the child's Roth IRA.",
    read: [{ label: 'IRS: 529 plans questions and answers', url: 'https://www.irs.gov/newsroom/529-plans-questions-and-answers' }, { label: 'Saving for College: state 529 tax deductions', url: 'https://www.savingforcollege.com/article/how-much-is-your-state-s-529-plan-tax-deduction-really-worth' }] },
  daf: { term: 'Donor-advised fund (DAF)', group: 'Taxes in general',
    short: "A giving account. You put money in (and take the tax deduction) in one year, then recommend grants to your church and other charities over time.",
    more: "It makes \"bunching\" possible: give two or three years of planned gifts in one year so itemizing beats the standard deduction, then take the standard deduction in the other years. Your church still receives regular gifts through grants from the fund. Gifts to a DAF don't count toward the new $1,000/$2,000 deduction for people who don't itemize.",
    reflect: 'Generosity can be planned with the same care as saving, so more reaches the work you love.',
    read: [{ label: 'IRS: Donor-advised funds', url: 'https://www.irs.gov/charities-non-profits/charitable-organizations/donor-advised-funds' }], watch: [yt('donor advised fund bunching explained')] },
  housing: { term: 'Housing allowance', group: 'Minister taxes',
    short: "The part of a minister's pay the church designates in advance for housing. It's left out of federal income tax, but it still counts for self-employment tax.",
    more: 'The tax-free amount is the smallest of three numbers: what the church designated, what you actually spent on housing, and the fair rental value of your home (furnished, plus utilities). Anything designated above that is taxable income. The designation must be made before the pay is received, usually in board or council minutes. (IRC §107)',
    read: [PUB517, { label: 'GuideStone ministerial resources', url: 'https://www.guidestone.org/ministerialresources' }],
    watch: [yt('minister housing allowance explained')] },
  actual: { term: 'Actual housing expenses', group: 'Minister taxes',
    short: 'What you really spend to provide a home: rent or mortgage payments, utilities, insurance, property tax, furniture, repairs and upkeep.',
    more: 'Keep receipts. If actual costs are lower than the designated allowance, only the actual amount is tax-free.', read: [PUB517] },
  frv: { term: 'Fair rental value', group: 'Minister taxes',
    short: 'What your home would rent for, furnished, plus the cost of utilities. It caps the tax-free housing amount for homeowners.',
    more: 'A local realtor or online rental listings for similar furnished homes give a reasonable estimate. Write down how you arrived at it.', read: [PUB517] },
  dualstatus: { term: 'Dual tax status', group: 'Minister taxes',
    short: 'For income tax a minister is usually an employee, but for Social Security and Medicare a minister is treated as self-employed.',
    more: 'That is why a church does not withhold Social Security and Medicare from a minister\'s pay. The minister pays self-employment tax instead, usually through quarterly estimated payments or voluntary withholding.',
    read: [{ label: 'Brotherhood Mutual: dual tax status of pastors', url: 'https://www.brotherhoodmutual.com/working-together/employment-payroll-taxes/dual-tax-status-of-pastors/' }, PUB517],
    watch: [yt('pastor dual tax status explained')] },
  seca: { term: 'Self-employment tax (SECA)', group: 'Minister taxes',
    short: "Ministers pay both halves of Social Security and Medicare themselves: 15.3% on 92.35% of ministry earnings, housing allowance included. Half of it is deductible.",
    more: 'An employee pays 7.65% and the employer pays the other 7.65%. A minister pays the full 15.3%, which is the main cost of dual status. The 12.4% Social Security part stops at the yearly wage base ($184,500 in 2026); the 2.9% Medicare part has no cap.',
    read: [{ label: 'IRS: Self-employment tax', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes' }, PUB517],
    watch: [yt('pastor self-employment tax explained')] },
  fica: { term: 'FICA', group: 'Minister taxes',
    short: 'The 7.65% Social Security and Medicare tax withheld from a regular employee\'s paycheck. The employer pays a matching 7.65%.',
    more: "Your spouse's W-2 job uses FICA. The app compares your situation to a version of you on FICA to show what dual status costs and saves." },
  netadvantage: { term: 'Net advantage vs W-2', group: 'Minister taxes',
    short: 'How much better or worse off you are each year because of minister tax rules, compared with the same pay as an ordinary employee.',
    more: 'It adds up the income tax saved by the housing allowance and the half-SECA deduction, then subtracts the extra self-employment tax you pay. If it is negative, the housing allowance is not large enough to offset the extra payroll tax.' },
  breakeven: { term: 'Break-even housing', group: 'Minister taxes',
    short: 'The housing allowance at which the income tax you save exactly covers the extra self-employment tax.',
    more: 'Below it, dual status costs you money on net. Above it, you come out ahead. Your excludable amount is still limited by actual expenses and fair rental value.' },
  form4361: { term: 'Opting out of Social Security (Form 4361)', group: 'Minister taxes',
    short: 'Ministers opposed to public insurance on religious grounds can apply to be exempt from self-employment tax on ministry pay. It is a conviction, not a money-saving strategy.',
    more: 'The application has a strict deadline and generally cannot be undone. Ministry earnings then earn no Social Security credits, so retirement and disability protection must come from elsewhere. Talk with a clergy tax professional first.',
    read: [{ label: 'IRS: About Form 4361', url: 'https://www.irs.gov/forms-pubs/about-form-4361' }, PUB517] },
  b403: { term: '403(b)', group: 'Saving for retirement',
    short: "A retirement savings plan for churches and nonprofits, like a 401(k). You choose pre-tax or Roth contributions from each paycheck.",
    more: 'In 2026 you can defer up to $24,500 a year in total (pre-tax and Roth together), plus $8,000 more from age 50, or $11,250 more at ages 60 to 63.',
    read: [PUB571], watch: [yt('403b explained for pastors')] },
  churchplan: { term: 'Church plan 403(b)(9)', group: 'Saving for retirement',
    short: "A 403(b) run by a church or denomination, such as GuideStone. In retirement, withdrawals from it can be designated as housing allowance and come out free of federal income tax.",
    more: "This is one of the most valuable minister benefits. It only applies to the church plan itself: money in a personal IRA or a spouse's 401(k) can't be withdrawn as housing allowance. Ask your plan provider whether your plan qualifies and how it designates retirement housing.",
    read: [{ label: 'GuideStone: why a 403(b)(9) plan makes sense', url: 'https://guidestone.org/Resources/Education/Articles/Retirement/Why-a-403b9-Plan-Makes-Sense-for-Your-Church' }, PUB517],
    watch: [yt('retired minister housing allowance 403b9')] },
  pretax: { term: 'Traditional (pre-tax)', group: 'Saving for retirement',
    short: 'Money you save before income tax. It lowers your tax now, and withdrawals are taxed later as income.',
    more: "Best when your tax rate now is higher than you expect in retirement. For a minister's own 403(b) it is usually better than it looks: pre-tax deferrals also skip about 14% self-employment tax (Roth deferrals don't), and church-plan pre-tax money may later come out tax-free as retirement housing allowance. A spouse's workplace plan pays Social Security and Medicare either way.",
    read: [{ label: 'IRS: Roth vs traditional comparison chart', url: 'https://www.irs.gov/retirement-plans/roth-comparison-chart' }], watch: [yt('Roth vs traditional explained simply')] },
  roth: { term: 'Roth', group: 'Saving for retirement',
    short: 'Money you save after paying income tax. It grows tax-free, and qualified withdrawals in retirement are tax-free.',
    more: "Best when your tax rate now is low compared with later. Roth accounts have no required minimum distributions during your lifetime, which gives flexibility. For a minister, Roth 403(b) deferrals still pay self-employment tax, so compare the full rate on the Paycheck & taxes page before choosing.",
    read: [{ label: 'IRS: Roth vs traditional comparison chart', url: 'https://www.irs.gov/retirement-plans/roth-comparison-chart' }], watch: [yt('Roth vs traditional explained simply')] },
  rothira: { term: 'Roth IRA', group: 'Saving for retirement',
    short: 'A personal Roth account you open yourself, separate from the church plan. The 2026 limit is $7,500 ($8,600 from age 50).',
    more: 'You can only contribute directly if income is below a limit (married filing jointly: phases out between $242,000 and $252,000 in 2026).',
    read: [{ label: 'IRS: Roth IRAs', url: 'https://www.irs.gov/retirement-plans/roth-iras' }] },
  catchup: { term: 'Catch-up contributions', group: 'Saving for retirement',
    short: 'Extra amounts you may save from age 50: $8,000 more in a 403(b) or 401(k) in 2026, or $11,250 more at ages 60 to 63.',
    more: 'High earners with W-2 wages over $150,000 must make catch-ups as Roth. Ministers paid without FICA wages are not affected.' },
  brokerage: { term: 'Brokerage (taxable) account', group: 'Saving for retirement',
    short: 'An ordinary investment account with no special tax treatment. You pay tax on dividends and gains each year.',
    more: 'Useful once retirement accounts are full, or for goals before retirement age. The app treats withdrawals from it as tax-free return of what you put in.' },
  marginal: { term: 'Marginal tax bracket', group: 'Taxes in general',
    short: 'The tax rate on your next dollar of income. Moving into a higher bracket only raises the tax on the dollars above the line, not on all of them.',
    more: 'It tells you how much a pre-tax contribution saves: at 12% federal plus a 5% state tax, $100 saved pre-tax cuts your tax by about $17.',
    watch: [yt('marginal tax brackets explained')] },
  nextdollar: { term: 'Where your next dollar is taxed', group: 'Taxes in general',
    short: 'Your true tax rate on one more dollar, counting everything at once: federal and state income tax, Social Security and Medicare, and any credit that shrinks as income rises.',
    more: "For a minister this is often far higher than the bracket alone, because church salary also pays about 14% self-employment tax. The same is true in reverse: a pre-tax 403(b) dollar avoids that self-employment tax, so it saves more than the bracket suggests.",
    reflect: 'Knowing what a dollar really costs, or saves, helps you steward it on purpose.',
    read: [PUB517], watch: [yt('marginal tax rate vs effective tax rate explained')] },
  threshold: { term: 'Tax thresholds and cliffs', group: 'Taxes in general',
    short: 'Income lines where the tax rules change. Some change gradually (a phase-out), and some all at once (a cliff), where $1 over can cost hundreds or thousands.',
    more: 'This app shows only the lines within reach of your income. Pre-tax saving lowers the income that counts for most of them, so it is often the simplest way back under a line. Your housing allowance is already left out of that income.',
    watch: [yt('tax cliffs phase outs explained')] },
  saverscredit: { term: "Saver's Credit", group: 'Taxes in general',
    short: "A federal tax credit for saving for retirement: 10%, 20% or 50% of up to $2,000 a person put into a 403(b), 401(k) or IRA, when income is under a limit ($80,500 for married couples in 2026).",
    more: "The income that counts is adjusted gross income, which leaves out the housing allowance, so many ministers qualify without knowing it. The credit can only reduce income tax you owe; it isn't paid out as a refund. From 2027 it becomes the Saver's Match, a deposit into your retirement account.",
    read: [{ label: "IRS: Retirement Savings Contributions Credit (Saver's Credit)", url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-savings-contributions-savers-credit' }],
    watch: [yt("saver's credit explained")] },
  ctc: { term: 'Child tax credit', group: 'Taxes in general',
    short: 'In 2026, up to $2,200 off your federal tax for each child under 17, with up to $1,700 of it paid as a refund if your tax is lower. Other dependents get $500.',
    more: 'The credit shrinks by $50 for each $1,000 of income above $400,000 (married) or $200,000 (single).',
    read: [{ label: 'IRS: Child tax credit', url: 'https://www.irs.gov/credits-deductions/individuals/child-tax-credit' }] },
  aca: { term: 'Marketplace premium tax credit', group: 'Taxes in general',
    short: 'Help paying for health insurance bought on healthcare.gov or a state marketplace. For 2026 coverage it stops completely above 400% of the federal poverty line ($84,600 for two people, $128,600 for four).',
    more: "That makes it a cliff: a dollar over can cost the whole subsidy, often thousands. The income that counts is close to adjusted gross income, so your housing allowance is left out and pre-tax saving lowers it. Report income changes to the marketplace during the year so the advance credit stays accurate.",
    read: [{ label: 'HealthCare.gov: Income levels for savings', url: 'https://www.healthcare.gov/lower-costs/' }] },
  niit: { term: 'Net investment income tax', group: 'Taxes in general',
    short: 'An extra 3.8% tax on investment income (dividends, interest, capital gains) once adjusted gross income passes $250,000 for married couples ($200,000 single).',
    more: 'It applies to the smaller of your investment income or the amount you are over the line. Retirement-account withdrawals do not count as investment income, though they raise the income measured.',
    read: [{ label: 'IRS: Net investment income tax', url: 'https://www.irs.gov/individuals/net-investment-income-tax' }] },
  ltcg0: { term: '0% capital gains rate', group: 'Taxes in general',
    short: 'Long-term gains on investments held over a year are taxed at 0% federally when taxable income stays under $98,900 for married couples ($49,450 single) in 2026.',
    more: 'If you have a taxable brokerage account and room under the line, you can sell winners, owe no federal tax on the gain, and buy back to reset your cost. States may still tax the gain.',
    watch: [yt('0% capital gains harvesting explained')] },
  stddeduction: { term: 'Standard and senior deductions', group: 'Taxes in general',
    short: 'Amounts subtracted from income before tax is figured. In 2026 the standard deduction is $32,200 for married couples ($16,100 single).',
    more: 'People 65 and over get an extra $1,650 each (married) and, through 2028, a new senior deduction of up to $6,000 each that shrinks above $150,000 of joint income.' },
  socialsecurity: { term: 'Social Security in retirement', group: 'Retirement',
    short: 'A monthly benefit based on your earnings history. Your statement at ssa.gov shows your estimate. Up to 85% of it can be taxable, depending on your other income.',
    more: "Ministers earn Social Security credits through self-employment tax unless exempt through Form 4361. Your spouse may also qualify for a benefit based on your record.",
    read: [{ label: 'my Social Security (see your estimate)', url: 'https://www.ssa.gov/myaccount/' }, { label: 'IRS Publication 915: taxation of benefits', url: 'https://www.irs.gov/publications/p915' }],
    watch: [yt('how social security benefits are taxed')] },
  rmd: { term: 'Required minimum distributions (RMDs)', group: 'Retirement',
    short: "From a set age, the IRS makes you withdraw a share of pre-tax retirement money each year, whether you need it or not, and it's taxed.",
    more: 'RMDs start at 73 if you were born 1951 to 1959, and at 75 if born 1960 or later. Large pre-tax balances can force big taxable withdrawals late in life. Roth accounts have no RMDs.',
    read: [{ label: 'IRS: RMD FAQs', url: 'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs' }], watch: [yt('required minimum distributions explained')] },
  conversion: { term: 'Roth conversion', group: 'Retirement',
    short: 'Moving money from a pre-tax account to a Roth on purpose and paying the tax now, usually in low-income years before RMDs begin.',
    more: 'It can lower lifetime taxes and RMDs. The app can model converting each year up to the top of a tax bracket you choose. Confirm with a tax professional before doing it.',
    watch: [yt('Roth conversion explained')] },
  draworder: { term: 'Withdrawal order', group: 'Retirement',
    short: 'Which accounts you spend from first in retirement. It changes how much tax you pay over your lifetime.',
    more: 'The app always uses tax-free housing-allowance withdrawals from the church plan first, then lets you choose Roth first or traditional first.' },
  survivor: { term: 'Survivor scenario', group: 'Retirement',
    short: 'What happens if the minister dies first: the housing exclusion ends, the spouse files as single, and the larger Social Security benefit continues.',
    more: "It's hard to think about, and it's often when a household's taxes rise the most. Planning for it is a way of caring for your spouse." },
  legacy: { term: 'Legacy', group: 'Retirement',
    short: 'What is left at the end of the plan: for family, church, or causes you care about.',
    more: 'The app shows it in both future and today\'s dollars.',
    reflect: 'A legacy is more than an estate. It is the generosity your faithfulness made possible.' },
  montecarlo: { term: 'Monte Carlo success rate', group: 'Risk',
    short: 'The app replays your retirement 1,000 times with random good and bad market years. The success rate is the share of those lives where the money lasted.',
    more: 'Around 85–95% is usually considered solid. 100% often means you are saving more or spending less than you need to. It is a way to see risk, not a prediction.',
    read: [{ label: 'Mullooly: Monte Carlo simulation, what is it?', url: 'https://mullooly.net/monte-carlo-simulation-what-is-it/' }], watch: [yt('Monte Carlo retirement simulation explained')] },
  sequence: { term: 'Sequence-of-returns risk', group: 'Risk',
    short: 'Bad market years right after you retire hurt far more than the same bad years later, because you are selling investments while they are down.',
    more: 'Monte Carlo captures this. A cash cushion or flexible spending in early retirement helps.', watch: [yt('sequence of returns risk explained')] },
  volatility: { term: 'Volatility', group: 'Risk',
    short: 'How much yearly returns swing up and down. Higher volatility means a wider range of outcomes, good and bad.',
    more: 'A mostly-stock portfolio might swing around 15% a year; a balanced one closer to 10%.' }
};

// Field id → term id for the "?" buttons next to labels
const FIELD_TERMS = {
  minComp: 'housing', housingDesignated: 'housing', housingActual: 'actual', housingFRV: 'frv',
  minPreTax: 'pretax', minRoth403b: 'roth', minRothIRA: 'rothira', spPreTax: 'pretax', spRoth401k: 'roth', spRothIRA: 'rothira',
  accReturn: 'compound', salaryGrowth: 'compound', minTradBal: 'pretax', churchPlanPct: 'churchplan', minRothBal: 'roth', brokerageBal: 'brokerage',
  todaysDollars: 'todaysdollars', retHousing: 'churchplan', ssMin: 'socialsecurity', ssSp: 'socialsecurity', retVol: 'volatility',
  inflation: 'todaysdollars', dist: 'montecarlo', cashBal: 'emergency', cashContrib: 'emergency', brokContrib: 'brokerage', whMinFed: 'setaside', estQuarterly: 'setaside', whSpFed: 'setaside', linkHousing: 'actual', otherSEIncome: 'sideincome', otherSEExpenses: 'sideincome', contrib529: 'college529', bal529: 'college529', limit529: 'college529', pension: 'pension', pensionHousing: 'pension', pensionSurvivorPct: 'pension', mortgageInterest: 'daf', drawOrder: 'draworder', convOn: 'conversion', survivorOn: 'survivor', seniorExtended: 'stddeduction', kidsUnder17: 'ctc', otherDeps: 'ctc', acaMarket: 'aca', acaSubsidy: 'aca'
};

const askPrompt = t => `Explain "${t.term}" to me in plain language, as if I'm a pastor who has never studied finance. Use one simple example with round numbers. Then tell me how it might apply to a minister's family, and one question I should ask my church benefits provider or tax professional. Keep it under 250 words.`;

/* ---------- popover ---------- */
const pop = document.createElement('div');
pop.className = 'gloss-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'false');
document.body.append(pop);
let lastTrigger = null;
function links(t){
  const r = (t.read || []).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('');
  const w = (t.watch || []).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('');
  return (r ? `<div class="gl-sec"><span class="eyebrow">Read</span><ul>${r}</ul></div>` : '') + (w ? `<div class="gl-sec"><span class="eyebrow">Watch</span><ul>${w}</ul></div>` : '');
}
function termBody(id, full){
  const t = TERMS[id];
  return `<p>${esc(t.short)}</p>${full || true ? `<p class="muted">${esc(t.more || '')}</p>` : ''}
    ${t.reflect ? `<p class="gl-reflect">${esc(t.reflect)}</p>` : ''}
    ${links(t)}
    <div class="row"><button class="btn" type="button" data-askterm="${id}">Copy an "explain this" prompt for any AI</button></div>`;
}
function openTerm(id, trigger){
  const t = TERMS[id]; if (!t) return;
  lastTrigger = trigger || null;
  pop.innerHTML = `<div class="gl-head"><h3>${esc(t.term)}</h3><button class="gl-x" type="button" aria-label="Close">×</button></div>${termBody(id)}
    <p class="small"><a href="#learn" data-gotolearn="${id}">See all terms in Learn</a></p>`;
  pop.hidden = false;
  if (window.matchMedia('(max-width: 640px)').matches || !trigger) { pop.classList.add('sheet'); pop.style.left = pop.style.top = ''; }
  else {
    pop.classList.remove('sheet');
    const r = trigger.getBoundingClientRect(), w = Math.min(380, innerWidth - 32);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(16, Math.min(innerWidth - w - 16, r.left - 20)) + 'px';
    const below = r.bottom + 8, h = pop.offsetHeight;
    pop.style.top = (below + h < innerHeight - 8 ? below : Math.max(8, r.top - h - 8)) + 'px';
  }
  pop.querySelector('.gl-x').focus();
}
function closeTerm(){ if (pop.hidden) return; pop.hidden = true; if (lastTrigger) lastTrigger.focus(); }
async function copyText(text, btn){
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied. Paste it into any AI chat.'; }
  catch { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); btn.textContent = 'Copied. Paste it into any AI chat.'; } catch { btn.textContent = 'Copy failed. Select the text manually.'; } ta.remove(); }
}
document.addEventListener('click', e => {
  const tr = e.target.closest('[data-term]');
  if (tr) { e.preventDefault(); openTerm(tr.dataset.term, tr); return; }
  const ask = e.target.closest('[data-askterm]');
  if (ask) { copyText(askPrompt(TERMS[ask.dataset.askterm]), ask); return; }
  if (e.target.closest('.gl-x')) { closeTerm(); return; }
  const go = e.target.closest('[data-gotolearn]');
  if (go) { e.preventDefault(); closeTerm(); A.showTab('learn'); const c = $('term-' + go.dataset.gotolearn); if (c) { c.open = true; c.scrollIntoView({ block: 'start' }); } return; }
  if (!pop.hidden && !pop.contains(e.target)) closeTerm();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTerm(); });

/* ---------- "?" buttons next to field labels ---------- */
for (const [field, id] of Object.entries(FIELD_TERMS)) {
  const input = $(field); if (!input) continue;
  const label = document.querySelector(`label[for="${field}"]`) || input.closest('label');
  if (!label || label.querySelector('.term-q')) continue;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'term-q'; b.dataset.term = id; b.textContent = '?';
  b.setAttribute('aria-label', 'What is ' + TERMS[id].term + '?');
  const target = label.querySelector('span') && label.classList.contains('check') ? label.querySelector('span') : label;
  const small = target.querySelector('small');
  small ? small.before(b) : target.append(b);
}

/* ---------- Learn tab ---------- */
const START = ['compound', 'todaysdollars', 'housing', 'dualstatus', 'pretax', 'roth', 'churchplan', 'montecarlo'];
function renderLearn(filter = ''){
  const f = filter.trim().toLowerCase();
  const groups = {};
  Object.entries(TERMS).forEach(([id, t]) => {
    if (f && !(t.term + ' ' + t.short + ' ' + (t.more || '')).toLowerCase().includes(f)) return;
    (groups[t.group] = groups[t.group] || []).push([id, t]);
  });
  $('learnList').innerHTML = Object.entries(groups).map(([g, items]) => `<h3 class="learn-group">${esc(g)}</h3>` +
    items.map(([id, t]) => `<details class="learn-term" id="term-${id}"><summary><strong>${esc(t.term)}</strong><span class="muted small">${esc(t.short)}</span></summary>${termBody(id, true)}</details>`).join('')).join('')
    || '<p class="muted">No terms match that search.</p>';
}
$('learnStart').innerHTML = START.map((id, i) => `<li><button type="button" class="linkish" data-term="${id}">${esc(TERMS[id].term)}</button></li>`).join('');
$('learnSearch').addEventListener('input', e => renderLearn(e.target.value));
renderLearn();

A.TERMS = TERMS; A.openTerm = openTerm; A.copyText = copyText;
})();
