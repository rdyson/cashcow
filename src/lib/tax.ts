/**
 * UK Tax Engine — 2025/26
 * England, Wales & Northern Ireland only (Scotland has different bands)
 *
 * All figures verified against GOV.UK, March 2026.
 */

// ─── Income Tax ────────────────────────────────────────────────────────────

const STANDARD_PERSONAL_ALLOWANCE = 12_570;
const BASIC_RATE_LIMIT = 50_270; // top of basic rate band
const HIGHER_RATE_LIMIT = 125_140; // top of higher rate band (PA taper ends here)
const PA_TAPER_THRESHOLD = 100_000; // PA begins to reduce above this

const INCOME_TAX_RATES = {
  basic: 0.20,
  higher: 0.40,
  additional: 0.45,
};

/**
 * Calculate the personal allowance for a given gross income.
 * Tapers at £1 per £2 above £100k, reaching zero at £125,140.
 */
export function personalAllowance(grossIncome: number): number {
  if (grossIncome <= PA_TAPER_THRESHOLD) return STANDARD_PERSONAL_ALLOWANCE;
  const reduction = Math.floor((grossIncome - PA_TAPER_THRESHOLD) / 2);
  return Math.max(0, STANDARD_PERSONAL_ALLOWANCE - reduction);
}

export interface IncomeTaxBreakdown {
  personalAllowance: number;
  basicRateTax: number;    // 20%
  higherRateTax: number;   // 40%
  additionalRateTax: number; // 45%
  total: number;
}

/**
 * Calculate income tax for a given gross income (2025/26).
 * Returns a breakdown by band plus total.
 */
export function calculateIncomeTax(grossIncome: number): IncomeTaxBreakdown {
  const pa = personalAllowance(grossIncome);
  const taxableIncome = Math.max(0, grossIncome - pa);

  // Basic rate: taxable income up to (50,270 - PA)
  const basicRateBand = Math.max(0, BASIC_RATE_LIMIT - pa);
  const basicRateTaxable = Math.min(taxableIncome, basicRateBand);
  const basicRateTax = basicRateTaxable * INCOME_TAX_RATES.basic;

  // Higher rate: £50,271 – £125,140
  const higherRateTaxable = Math.min(
    Math.max(0, taxableIncome - basicRateBand),
    HIGHER_RATE_LIMIT - BASIC_RATE_LIMIT,
  );
  const higherRateTax = higherRateTaxable * INCOME_TAX_RATES.higher;

  // Additional rate: above £125,140
  const additionalRateTaxable = Math.max(0, grossIncome - HIGHER_RATE_LIMIT);
  const additionalRateTax = additionalRateTaxable * INCOME_TAX_RATES.additional;

  return {
    personalAllowance: pa,
    basicRateTax,
    higherRateTax,
    additionalRateTax,
    total: basicRateTax + higherRateTax + additionalRateTax,
  };
}

// ─── National Insurance (Employee Class 1) ─────────────────────────────────

const NI_PRIMARY_THRESHOLD = 12_570; // NI starts here
const NI_UPPER_EARNINGS_LIMIT = 50_270;

const NI_RATES = {
  main: 0.08,   // 8% between PT and UEL
  upper: 0.02,  // 2% above UEL
};

export interface NIBreakdown {
  mainRateNI: number;  // 8% band
  upperRateNI: number; // 2% band
  total: number;
}

/**
 * Calculate employee NI contributions (2025/26).
 * No NI above State Pension age — pass aboveSPA=true to skip.
 */
export function calculateNI(grossIncome: number, aboveSPA = false): NIBreakdown {
  if (aboveSPA) return { mainRateNI: 0, upperRateNI: 0, total: 0 };

  const mainRateTaxable = Math.min(
    Math.max(0, grossIncome - NI_PRIMARY_THRESHOLD),
    NI_UPPER_EARNINGS_LIMIT - NI_PRIMARY_THRESHOLD,
  );
  const mainRateNI = mainRateTaxable * NI_RATES.main;

  const upperRateTaxable = Math.max(0, grossIncome - NI_UPPER_EARNINGS_LIMIT);
  const upperRateNI = upperRateTaxable * NI_RATES.upper;

  return {
    mainRateNI,
    upperRateNI,
    total: mainRateNI + upperRateNI,
  };
}

// ─── Net Take-Home ──────────────────────────────────────────────────────────

export interface TakeHomeBreakdown {
  grossIncome: number;
  personalAllowance: number;
  incomeTax: IncomeTaxBreakdown;
  ni: NIBreakdown;
  takeHome: number;
  effectiveTaxRate: number; // as a decimal
}

/**
 * Calculate net take-home pay after income tax and NI.
 * Does NOT deduct pension contributions (those reduce grossIncome upstream).
 */
export function calculateTakeHome(grossIncome: number, aboveSPA = false): TakeHomeBreakdown {
  const incomeTax = calculateIncomeTax(grossIncome);
  const ni = calculateNI(grossIncome, aboveSPA);
  const takeHome = grossIncome - incomeTax.total - ni.total;
  const effectiveTaxRate = grossIncome > 0 ? (incomeTax.total + ni.total) / grossIncome : 0;

  return {
    grossIncome,
    personalAllowance: incomeTax.personalAllowance,
    incomeTax,
    ni,
    takeHome,
    effectiveTaxRate,
  };
}

/**
 * Quick check: £50,000 salary
 *
 * Personal Allowance: £12,570
 * Basic rate (20%): (£50,000 − £12,570) = £37,430 × 20% = £7,486
 * Higher rate: £0 (income doesn't exceed £50,270)
 * Income tax: £7,486
 *
 * NI main (8%): (£50,000 − £12,570) = £37,430 × 8% = £2,994.40
 * NI upper (2%): £0 (income below UEL)
 * NI total: £2,994.40
 *
 * Take-home: £50,000 − £7,486 − £2,994.40 = £39,519.60
 */
export function selfTest(): boolean {
  const result = calculateTakeHome(50_000);
  const expectedTax = 7_486;
  const expectedNI = 2_994.40;
  const expectedTakeHome = 39_519.60;

  const taxOk = Math.abs(result.incomeTax.total - expectedTax) < 0.01;
  const niOk = Math.abs(result.ni.total - expectedNI) < 0.01;
  const takeHomeOk = Math.abs(result.takeHome - expectedTakeHome) < 0.01;

  if (!taxOk || !niOk || !takeHomeOk) {
    console.error('Tax engine self-test FAILED', {
      tax: { expected: expectedTax, got: result.incomeTax.total },
      ni: { expected: expectedNI, got: result.ni.total },
      takeHome: { expected: expectedTakeHome, got: result.takeHome },
    });
  }

  return taxOk && niOk && takeHomeOk;
}
