/**
 * Cashflow Projection Engine
 *
 * Year-by-year projection from current age to 100.
 * Working years: accumulate pension and ISA pots.
 * Retirement years: draw down from pots, add State Pension, check deficit.
 */

import { calculateIncomeTax, calculateNI } from './tax.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClientProfile {
  currentAge: number;
  salary: number;               // gross annual salary (today's £)
  retirementAge: number;        // target retirement age
  currentPensionPot: number;    // existing DC pension pot (£)
  employerContributionPct: number; // employer pension contribution (% of salary)
  employeeContributionPct: number; // employee pension contribution (% of salary)
  currentISABalance: number;    // current ISA savings (£)

  // Spending
  retirementSpending: number;   // target annual spending in retirement (today's £)

  // Assumptions
  salaryGrowthRate: number;      // e.g. 0.02 for 2%
  investmentGrowthRate: number;  // e.g. 0.05 for 5%
  inflationRate: number;         // e.g. 0.025 for 2.5%
}

export interface ProjectionYear {
  age: number;
  isWorking: boolean;
  isRetired: boolean;

  // Income
  grossSalary: number;          // 0 in retirement
  statePensionIncome: number;   // kicks in at SPA 67
  pensionDrawdown: number;      // gross drawdown from DC pot
  isaWithdrawal: number;        // from ISA (tax-free)

  // Tax
  incomeTax: number;
  employeeNI: number;

  // Contributions (working years)
  employerContribution: number;
  employeeContribution: number;
  isaContribution: number;      // excess savings after contributions and spending

  // Pots
  pensionPot: number;           // DC pot at year end
  isaPot: number;               // ISA pot at year end

  // Cashflow
  totalIncome: number;          // gross income (before tax)
  netIncome: number;            // after tax and NI
  spending: number;             // actual spending (inflation-adjusted)
  surplus: number;              // netIncome − spending (negative = deficit)
  cumulativeSurplus: number;    // running total

  // Totals
  totalWealth: number;          // pensionPot + isaPot
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATE_PENSION_ANNUAL = 11_973;   // full new State Pension 2025/26
const STATE_PENSION_AGE = 67;
const ISA_ANNUAL_ALLOWANCE = 20_000;
const MAX_AGE = 100;

// ─── Main Projection ────────────────────────────────────────────────────────

export function runProjection(profile: ClientProfile): ProjectionYear[] {
  const years: ProjectionYear[] = [];

  let pensionPot = profile.currentPensionPot;
  let isaPot = profile.currentISABalance;
  let cumulativeSurplus = 0;
  let taxFreeLumpSumTaken = false;

  const {
    currentAge,
    retirementAge,
    salary: baseSalary,
    employerContributionPct,
    employeeContributionPct,
    retirementSpending: baseRetirementSpending,
    salaryGrowthRate,
    investmentGrowthRate,
    inflationRate,
  } = profile;

  for (let age = currentAge; age <= MAX_AGE; age++) {
    const yearsFromNow = age - currentAge;
    const isWorking = age < retirementAge;
    const isRetired = !isWorking;
    const aboveSPA = age >= STATE_PENSION_AGE;

    // Inflation-adjust spending target
    const spending = baseRetirementSpending * Math.pow(1 + inflationRate, yearsFromNow);

    let grossSalary = 0;
    let statePensionIncome = 0;
    let pensionDrawdown = 0;
    let isaWithdrawal = 0;
    let incomeTax = 0;
    let employeeNI = 0;
    let employerContribution = 0;
    let employeeContribution = 0;
    let isaContribution = 0;
    let netIncome = 0;
    let totalIncome = 0;

    if (isWorking) {
      // ── Working year ──────────────────────────────────────────────────────

      // Salary grows year on year (inflation + real growth)
      grossSalary = baseSalary * Math.pow(1 + salaryGrowthRate, yearsFromNow);

      // Employee pension contribution comes off gross for tax purposes (relief at source)
      const empeeContrib = grossSalary * (employeeContributionPct / 100);
      const emprContrib = grossSalary * (employerContributionPct / 100);

      // Taxable income = salary − employee pension contributions
      const taxableIncome = Math.max(0, grossSalary - empeeContrib);
      const tax = calculateIncomeTax(taxableIncome);
      const ni = calculateNI(grossSalary); // NI on gross (before pension relief)

      incomeTax = tax.total;
      employeeNI = ni.total;
      employerContribution = emprContrib;
      employeeContribution = empeeContrib;

      const totalPensionContrib = empeeContrib + emprContrib;

      // Net take-home after tax and NI
      const netSalary = grossSalary - empeeContrib - incomeTax - employeeNI;

      // ISA contribution: save excess up to annual allowance
      const availableForISA = Math.max(0, netSalary - spending);
      isaContribution = Math.min(availableForISA, ISA_ANNUAL_ALLOWANCE);

      netIncome = netSalary;
      totalIncome = grossSalary;

      // Grow pots during the year
      // Pension: existing pot grows, plus contributions
      pensionPot = pensionPot * (1 + investmentGrowthRate) + totalPensionContrib;
      isaPot = isaPot * (1 + investmentGrowthRate) + isaContribution;
    } else {
      // ── Retirement year ───────────────────────────────────────────────────

      // State Pension kicks in at SPA
      statePensionIncome = aboveSPA
        ? STATE_PENSION_ANNUAL * Math.pow(1 + inflationRate, yearsFromNow)
        : 0;

      // Grow pots first (before withdrawals)
      pensionPot = pensionPot * (1 + investmentGrowthRate);
      isaPot = isaPot * (1 + investmentGrowthRate);

      // Take 25% tax-free lump sum in first year of retirement (up to LSA £268,275)
      if (!taxFreeLumpSumTaken && retirementAge === age) {
        const lsaLimit = 268_275;
        const taxFreeAmount = Math.min(pensionPot * 0.25, lsaLimit);
        // Move tax-free cash to ISA pot (or general savings — simplification)
        isaPot += taxFreeAmount;
        pensionPot -= taxFreeAmount;
        taxFreeLumpSumTaken = true;
      }

      // Target spending this year
      const targetSpending = spending;

      // ISA covers spending first (tax-free)
      const isaCanPay = Math.min(isaPot, targetSpending);
      isaWithdrawal = isaCanPay;
      let remainingNeeded = Math.max(0, targetSpending - isaCanPay);

      // State pension offsets remaining need
      remainingNeeded = Math.max(0, remainingNeeded - statePensionIncome);

      // Pension drawdown covers the rest
      if (remainingNeeded > 0 && pensionPot > 0) {
        // Pension drawdown is taxable — need to gross up to get the net amount needed
        // Iterative approach: find gross drawdown such that net = remainingNeeded
        pensionDrawdown = grossUpDrawdown(remainingNeeded, aboveSPA);
        pensionDrawdown = Math.min(pensionDrawdown, pensionPot);
      }

      // Calculate tax on retirement income (state pension + pension drawdown)
      const retirementGrossIncome = statePensionIncome + pensionDrawdown;
      const retirementTax = calculateIncomeTax(retirementGrossIncome);
      const retirementNI = calculateNI(retirementGrossIncome, aboveSPA); // no NI above SPA

      incomeTax = retirementTax.total;
      employeeNI = retirementNI.total;

      // Deduct withdrawals from pots
      isaPot = Math.max(0, isaPot - isaWithdrawal);
      pensionPot = Math.max(0, pensionPot - pensionDrawdown);

      // Net income
      const netPensionDrawdown = pensionDrawdown - (retirementTax.total + retirementNI.total);
      const netStatePension = statePensionIncome; // already accounted for in tax calc above
      netIncome = isaWithdrawal + netPensionDrawdown + netStatePension;
      totalIncome = statePensionIncome + pensionDrawdown + isaWithdrawal;
    }

    const surplus = netIncome - spending;
    cumulativeSurplus += surplus;

    years.push({
      age,
      isWorking,
      isRetired,
      grossSalary,
      statePensionIncome,
      pensionDrawdown,
      isaWithdrawal,
      incomeTax,
      employeeNI,
      employerContribution,
      employeeContribution,
      isaContribution,
      pensionPot,
      isaPot,
      totalIncome,
      netIncome,
      spending,
      surplus,
      cumulativeSurplus,
      totalWealth: pensionPot + isaPot,
    });
  }

  return years;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Gross up a net income target to find the gross drawdown needed.
 * Uses binary search (pension drawdown is taxable income).
 */
function grossUpDrawdown(netTarget: number, aboveSPA: boolean): number {
  if (netTarget <= 0) return 0;

  let low = netTarget;
  let high = netTarget * 2; // generous upper bound

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const tax = calculateIncomeTax(mid);
    const ni = calculateNI(mid, aboveSPA);
    const net = mid - tax.total - ni.total;
    if (Math.abs(net - netTarget) < 0.01) return mid;
    if (net < netTarget) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}

// ─── Outcome Classification ───────────────────────────────────────────────

export type TrafficLight = 'green' | 'amber' | 'red';

export interface ProjectionOutcome {
  trafficLight: TrafficLight;
  moneyRunsOutAge: number | null;   // null = money lasts to 100+
  finalWealth: number;
  summary: string;
}

export function classifyOutcome(years: ProjectionYear[]): ProjectionOutcome {
  const runsOutYear = years.find(y => y.isRetired && y.totalWealth <= 0 && y.pensionPot <= 0 && y.isaPot <= 0);
  const moneyRunsOutAge = runsOutYear?.age ?? null;
  const finalWealth = years[years.length - 1]?.totalWealth ?? 0;

  let trafficLight: TrafficLight;
  let summary: string;

  if (moneyRunsOutAge === null) {
    trafficLight = 'green';
    summary = `Money lasts to 100+ with £${formatK(finalWealth)} remaining.`;
  } else if (moneyRunsOutAge >= 85) {
    trafficLight = 'amber';
    summary = `Money runs out at age ${moneyRunsOutAge}. Getting tight.`;
  } else {
    trafficLight = 'red';
    summary = `Money runs out at age ${moneyRunsOutAge}. Significant shortfall.`;
  }

  return { trafficLight, moneyRunsOutAge, finalWealth, summary };
}

function formatK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toFixed(0);
}
