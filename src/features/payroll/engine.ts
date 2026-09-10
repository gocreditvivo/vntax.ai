export type WorkerKind = 'w2_hourly' | 'w2_tipped' | 'w2_salary_exempt' | 'contractor';

export interface PayrollWorkerInput {
  id: string;
  name: string;
  kind: WorkerKind;
  /** Hourly rate for hourly workers; flat weekly pay for salary/contractor. */
  rateOrPay: number;
  regularHours: number;
  overtimeHours: number;
  reportedTips: number;
  /** True when reported tips still need to be included in this payment. */
  tipsPaidWithPayroll: boolean;
  /** Qualified section 125 deduction. Never infer qualification from a label. */
  section125Deduction: number;
  /** Traditional 401(k) deferral: FIT-exempt, but still subject to FICA. */
  retirement401k: number;
  otherAfterTaxDeductions: number;
  federalWithholding: number;
  dcWithholding: number;
  ytdSocialSecurityWages: number;
  ytdMedicareWages: number;
  ytdFutaWages: number;
  ytdDcUiWages: number;
}

export interface DcPayrollRules {
  taxYear: 2026;
  effectiveDate: string;
  minimumWage: number;
  tippedCashWage: number;
  socialSecurityRate: number;
  socialSecurityWageBase: number;
  medicareRate: number;
  additionalMedicareRate: number;
  additionalMedicareThreshold: number;
  futaEstimatedRate: number;
  futaWageBase: number;
  dcUiEmployerRate: number;
  dcUiAdministrativeAssessmentRate: number;
  dcUiWageBase: number;
}

const BASE_2026 = {
  taxYear: 2026,
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 184_500,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: 200_000,
  futaEstimatedRate: 0.006,
  futaWageBase: 7_000,
  dcUiEmployerRate: 0.027,
  dcUiAdministrativeAssessmentRate: 0.002,
  dcUiWageBase: 9_000,
} as const;

/** Official 2026 DC wage changes take effect July 1. Unsupported periods fail closed. */
export function dcRulesFor(
  workweekEnd: string,
  dcUiEmployerRate: number = BASE_2026.dcUiEmployerRate,
  payDate: string = workweekEnd,
): DcPayrollRules {
  if (!/^2026-\d{2}-\d{2}$/.test(workweekEnd)) {
    throw new Error('Enter a valid 2026 Washington, DC workweek ending date.');
  }
  const end = new Date(`${workweekEnd}T00:00:00Z`);
  if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== workweekEnd) {
    throw new Error('Enter a valid 2026 Washington, DC workweek ending date.');
  }
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const workweekStart = start.toISOString().slice(0, 10);
  if (workweekStart < '2026-01-01' || workweekEnd > '2026-12-31') {
    throw new Error('The worksheet only supports a seven-day workweek entirely inside 2026.');
  }
  if (workweekStart < '2026-07-01' && workweekEnd >= '2026-07-01') {
    throw new Error('This workweek crosses the July 1 DC wage change. Split hours into periods before and after July 1.');
  }
  if (!/^2026-\d{2}-\d{2}$/.test(payDate)) {
    throw new Error('Enter a valid 2026 pay date.');
  }
  const paid = new Date(`${payDate}T00:00:00Z`);
  if (Number.isNaN(paid.getTime()) || paid.toISOString().slice(0, 10) !== payDate) {
    throw new Error('Enter a valid 2026 pay date.');
  }
  if (payDate < workweekEnd) {
    throw new Error('Pay date cannot be before the workweek ending date.');
  }
  if (!Number.isFinite(dcUiEmployerRate) || dcUiEmployerRate < 0 || dcUiEmployerRate > 0.1) {
    throw new Error("Enter a DC unemployment rate from the employer's 2026 rate notice.");
  }
  const julyRates = workweekStart >= '2026-07-01';
  return {
    ...BASE_2026,
    dcUiEmployerRate,
    effectiveDate: julyRates ? '2026-07-01' : '2026-01-01',
    minimumWage: julyRates ? 18.4 : 17.95,
    tippedCashWage: julyRates ? 10.3 : 10,
  };
}

export interface PayrollWorkerResult {
  workerId: string;
  name: string;
  kind: WorkerKind;
  regularPay: number;
  overtimeRate: number;
  overtimePay: number;
  tipMakeup: number;
  cashWages: number;
  reportedTips: number;
  grossWages: number;
  socialSecurityWages: number;
  federalIncomeTaxWages: number;
  employeeSocialSecurity: number;
  employeeMedicare: number;
  employeeAdditionalMedicare: number;
  employeeFica: number;
  employerSocialSecurity: number;
  employerMedicare: number;
  estimatedFuta: number;
  dcUnemploymentInsurance: number;
  dcAdministrativeAssessment: number;
  employerPayrollTaxes: number;
  deductionRemittances: number;
  paymentToWorker: number;
  federalDeposit: number;
  federalWithholding: number;
  dcWithholding: number;
  fundingNeeded: number;
  warnings: string[];
  blockers: string[];
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function wagesInsideBase(current: number, ytd: number, base: number): number {
  return Math.min(nonnegative(current), Math.max(0, base - nonnegative(ytd)));
}

export function calculateWorker(raw: PayrollWorkerInput, rules: DcPayrollRules): PayrollWorkerResult {
  const input = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, typeof value === 'number' ? nonnegative(value) : value]),
  ) as unknown as PayrollWorkerInput;
  const warnings: string[] = [];
  const blockers: string[] = [];
  const isContractor = input.kind === 'contractor';
  const isHourly = input.kind === 'w2_hourly' || input.kind === 'w2_tipped';
  const isTipped = input.kind === 'w2_tipped';

  if (!input.name.trim()) blockers.push('Enter the worker name.');
  if (input.regularHours + input.overtimeHours > 168) blockers.push('Hours exceed one seven-day workweek.');
  if (isHourly && input.regularHours > 40) blockers.push('Regular hours exceed 40; move excess weekly hours to overtime.');
  if (!isHourly && (input.regularHours > 0 || input.overtimeHours > 0)) {
    blockers.push('This worker type cannot use hourly fields in this worksheet.');
  }
  if (input.kind === 'w2_hourly' && input.rateOrPay < rules.minimumWage) {
    blockers.push(`Hourly rate is below the DC minimum wage of $${rules.minimumWage.toFixed(2)}.`);
  }
  if (isTipped && input.rateOrPay < rules.tippedCashWage) {
    blockers.push(`Tipped cash rate is below the DC minimum of $${rules.tippedCashWage.toFixed(2)}.`);
  }
  if (input.kind === 'w2_salary_exempt') {
    warnings.push('Salary alone does not establish an overtime exemption; confirm duties and salary tests.');
  }
  if (isContractor) warnings.push('Worker classification is a legal facts-and-circumstances test, not a payroll choice.');
  if (!isTipped && input.reportedTips > 0) warnings.push('Reported tips were entered for a worker not marked as tipped.');

  let regularPay = 0;
  let overtimeRate = 0;
  let overtimePay = 0;
  let tipMakeup = 0;
  if (isHourly) {
    regularPay = input.regularHours * input.rateOrPay;
    if (isTipped) {
      const allowedTipCredit = Math.max(0, rules.minimumWage - input.rateOrPay);
      const regularRateFloor = Math.max(rules.minimumWage, input.rateOrPay);
      overtimeRate = Math.max(0, 1.5 * regularRateFloor - allowedTipCredit);
      overtimePay = input.overtimeHours * overtimeRate;
      const creditNeeded = allowedTipCredit * (input.regularHours + input.overtimeHours);
      tipMakeup = Math.max(0, creditNeeded - input.reportedTips);
      if (tipMakeup > 0) warnings.push('Employer tip-credit makeup was added for this workweek.');
    } else {
      overtimeRate = input.rateOrPay * 1.5;
      overtimePay = input.overtimeHours * overtimeRate;
    }
  } else {
    regularPay = input.rateOrPay;
  }

  const cashWages = money(regularPay + overtimePay + tipMakeup);
  const reportedTips = isContractor ? 0 : money(input.reportedTips);
  const grossWages = money(cashWages + reportedTips);

  if (isContractor) {
    const paymentToWorker = money(input.rateOrPay - input.federalWithholding - input.dcWithholding);
    return {
      workerId: input.id, name: input.name, kind: input.kind,
      regularPay: money(regularPay), overtimeRate: 0, overtimePay: 0, tipMakeup: 0,
      cashWages: money(input.rateOrPay), reportedTips: 0, grossWages: money(input.rateOrPay),
      socialSecurityWages: 0, federalIncomeTaxWages: 0,
      employeeSocialSecurity: 0, employeeMedicare: 0, employeeAdditionalMedicare: 0, employeeFica: 0,
      employerSocialSecurity: 0, employerMedicare: 0, estimatedFuta: 0,
      dcUnemploymentInsurance: 0, dcAdministrativeAssessment: 0, employerPayrollTaxes: 0,
      deductionRemittances: 0, paymentToWorker, federalDeposit: money(input.federalWithholding),
      federalWithholding: money(input.federalWithholding),
      dcWithholding: money(input.dcWithholding),
      fundingNeeded: paymentToWorker + money(input.federalWithholding + input.dcWithholding),
      warnings, blockers,
    };
  }

  const section125 = Math.min(input.section125Deduction, grossWages);
  const retirement401k = Math.min(input.retirement401k, Math.max(0, grossWages - section125));
  if (input.section125Deduction > 0) {
    warnings.push('Confirm the section 125 election is exempt from FIT, FICA, and FUTA for this worker; benefit treatment varies.');
  }
  if (input.retirement401k > 0) {
    warnings.push('Confirm plan eligibility and year-to-date 401(k) limits; this worksheet does not test plan limits.');
  }
  if (input.otherAfterTaxDeductions > 0) {
    warnings.push('Confirm authorization and any applicable limits for other after-tax deductions.');
  }
  const socialSecurityWages = money(Math.max(0, grossWages - section125));
  const federalIncomeTaxWages = money(Math.max(0, grossWages - section125 - retirement401k));
  const ssTaxable = wagesInsideBase(socialSecurityWages, input.ytdSocialSecurityWages, rules.socialSecurityWageBase);
  const employeeSocialSecurity = money(ssTaxable * rules.socialSecurityRate);
  const employeeMedicare = money(socialSecurityWages * rules.medicareRate);
  const additionalMedicareWages = Math.max(
    0, input.ytdMedicareWages + socialSecurityWages - rules.additionalMedicareThreshold,
  ) - Math.max(0, input.ytdMedicareWages - rules.additionalMedicareThreshold);
  const employeeAdditionalMedicare = money(additionalMedicareWages * rules.additionalMedicareRate);
  const employeeFica = money(employeeSocialSecurity + employeeMedicare + employeeAdditionalMedicare);
  const employerSocialSecurity = employeeSocialSecurity;
  const employerMedicare = employeeMedicare;
  const futaWages = wagesInsideBase(socialSecurityWages, input.ytdFutaWages, rules.futaWageBase);
  const dcUiWages = wagesInsideBase(socialSecurityWages, input.ytdDcUiWages, rules.dcUiWageBase);
  const estimatedFuta = money(futaWages * rules.futaEstimatedRate);
  const dcUnemploymentInsurance = money(dcUiWages * rules.dcUiEmployerRate);
  const dcAdministrativeAssessment = money(dcUiWages * rules.dcUiAdministrativeAssessmentRate);
  const employerPayrollTaxes = money(
    employerSocialSecurity + employerMedicare + estimatedFuta + dcUnemploymentInsurance + dcAdministrativeAssessment,
  );
  const tipsInPayment = input.tipsPaidWithPayroll ? reportedTips : 0;
  const paymentToWorker = money(
    cashWages + tipsInPayment - section125 - retirement401k - input.otherAfterTaxDeductions -
    employeeFica - input.federalWithholding - input.dcWithholding,
  );
  if (paymentToWorker < 0) blockers.push('Deductions and withholding exceed this payment.');
  if (grossWages > 0 && input.federalWithholding === 0) {
    warnings.push('Federal withholding is $0; verify the employee W-4 and 2026 Publication 15-T.');
  }
  if (grossWages > 0 && input.dcWithholding === 0) {
    warnings.push('DC withholding is $0; verify the employee D-4 and current DC instructions.');
  }
  const deductionRemittances = money(section125 + retirement401k + input.otherAfterTaxDeductions);
  const federalDeposit = money(input.federalWithholding + employeeFica + employerSocialSecurity + employerMedicare);
  const fundingNeeded = money(
    paymentToWorker + deductionRemittances + federalDeposit + input.dcWithholding + estimatedFuta +
    dcUnemploymentInsurance + dcAdministrativeAssessment,
  );
  return {
    workerId: input.id, name: input.name, kind: input.kind,
    regularPay: money(regularPay), overtimeRate: money(overtimeRate), overtimePay: money(overtimePay),
    tipMakeup: money(tipMakeup), cashWages, reportedTips, grossWages, socialSecurityWages,
    federalIncomeTaxWages, employeeSocialSecurity, employeeMedicare, employeeAdditionalMedicare,
    employeeFica, employerSocialSecurity, employerMedicare, estimatedFuta, dcUnemploymentInsurance,
    dcAdministrativeAssessment, employerPayrollTaxes, deductionRemittances, paymentToWorker, federalDeposit,
    federalWithholding: money(input.federalWithholding),
    dcWithholding: money(input.dcWithholding), fundingNeeded, warnings, blockers,
  };
}

export interface PayrollRunTotals {
  grossWages: number;
  employeeFica: number;
  federalWithholding: number;
  dcWithholding: number;
  employerPayrollTaxes: number;
  deductionRemittances: number;
  paymentsToWorkers: number;
  federalDeposit: number;
  fundingNeeded: number;
}

export function totalPayroll(results: PayrollWorkerResult[]): PayrollRunTotals {
  const sum = (key: keyof PayrollWorkerResult) => money(
    results.reduce((total, result) => total + (typeof result[key] === 'number' ? result[key] : 0), 0),
  );
  return {
    grossWages: sum('grossWages'), employeeFica: sum('employeeFica'),
    federalWithholding: sum('federalWithholding'),
    dcWithholding: sum('dcWithholding'), employerPayrollTaxes: sum('employerPayrollTaxes'),
    deductionRemittances: sum('deductionRemittances'), paymentsToWorkers: sum('paymentToWorker'),
    federalDeposit: sum('federalDeposit'), fundingNeeded: sum('fundingNeeded'),
  };
}
