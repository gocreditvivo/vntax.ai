import { describe, expect, it } from 'vitest';
import { calculateWorker, dcRulesFor, totalPayroll, type PayrollWorkerInput } from '../features/payroll/engine';

const worker = (patch: Partial<PayrollWorkerInput> = {}): PayrollWorkerInput => ({
  id: 'w1', name: 'Synthetic Worker', kind: 'w2_hourly', rateOrPay: 20,
  regularHours: 40, overtimeHours: 0, reportedTips: 0, tipsPaidWithPayroll: true,
  section125Deduction: 0, retirement401k: 0, otherAfterTaxDeductions: 0,
  federalWithholding: 100, dcWithholding: 50,
  ytdSocialSecurityWages: 0, ytdMedicareWages: 0, ytdFutaWages: 0, ytdDcUiWages: 0,
  ...patch,
});

describe('2026 Washington, DC payroll engine', () => {
  it('uses the two official 2026 DC minimum-wage periods', () => {
    expect(dcRulesFor('2026-06-30').minimumWage).toBe(17.95);
    expect(dcRulesFor('2026-06-30').tippedCashWage).toBe(10);
    expect(dcRulesFor('2026-07-07').minimumWage).toBe(18.4);
    expect(dcRulesFor('2026-07-07').tippedCashWage).toBe(10.3);
  });

  it('fails closed when one workweek crosses a year or July 1 rate boundary', () => {
    expect(() => dcRulesFor('2026-01-06')).toThrow(/entirely inside 2026/);
    expect(() => dcRulesFor('2026-07-01')).toThrow(/crosses the July 1/);
    expect(() => dcRulesFor('2026-07-06')).toThrow(/crosses the July 1/);
    expect(dcRulesFor('2026-07-07').effectiveDate).toBe('2026-07-01');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => dcRulesFor('2026-02-30')).toThrow(/valid 2026/);
    expect(() => dcRulesFor('2026-13-01')).toThrow(/valid 2026/);
  });

  it('requires a valid 2026 pay date on or after the workweek', () => {
    expect(() => dcRulesFor('2026-08-08', 0.027, '2027-01-02')).toThrow(/2026 pay date/);
    expect(() => dcRulesFor('2026-08-08', 0.027, '2026-02-30')).toThrow(/valid 2026 pay date/);
    expect(() => dcRulesFor('2026-08-08', 0.027, '2026-08-07')).toThrow(/cannot be before/);
    expect(dcRulesFor('2026-08-08', 0.027, '2026-08-12').taxYear).toBe(2026);
  });

  it('rejects a stale or unsupported tax year', () => {
    expect(() => dcRulesFor('2025-12-31')).toThrow(/2026/);
    expect(() => dcRulesFor('')).toThrow(/2026/);
  });

  it('uses the official 2026 Social Security wage base', () => {
    const rules = dcRulesFor('2026-08-08');
    expect(rules.socialSecurityWageBase).toBe(184_500);
    const result = calculateWorker(worker({ rateOrPay: 1_000, regularHours: 1, ytdSocialSecurityWages: 184_000 }), rules);
    expect(result.employeeSocialSecurity).toBe(31);
  });

  it('calculates ordinary wages, FICA, and the employer match', () => {
    const result = calculateWorker(worker(), dcRulesFor('2026-08-08'));
    expect(result.grossWages).toBe(800);
    expect(result.employeeSocialSecurity).toBe(49.6);
    expect(result.employeeMedicare).toBe(11.6);
    expect(result.employerSocialSecurity).toBe(49.6);
    expect(result.employerMedicare).toBe(11.6);
  });

  it('blocks regular hours above 40 in the weekly hourly workflow', () => {
    const result = calculateWorker(worker({ regularHours: 41 }), dcRulesFor('2026-08-08'));
    expect(result.blockers.join(' ')).toMatch(/move excess weekly hours to overtime/);
  });

  it('calculates DC tipped overtime and weekly tip-credit makeup', () => {
    const result = calculateWorker(worker({
      kind: 'w2_tipped', rateOrPay: 10.3, regularHours: 40, overtimeHours: 5,
      reportedTips: 300, federalWithholding: 0, dcWithholding: 0,
    }), dcRulesFor('2026-08-08'));
    expect(result.overtimeRate).toBe(19.5);
    expect(result.tipMakeup).toBe(64.5);
    expect(result.cashWages).toBe(574);
    expect(result.grossWages).toBe(874);
  });

  it('distinguishes tips paid in the check from tips already received', () => {
    const base = worker({ kind: 'w2_tipped', rateOrPay: 10.3, reportedTips: 500 });
    const inCheck = calculateWorker({ ...base, tipsPaidWithPayroll: true }, dcRulesFor('2026-08-08'));
    const alreadyPaid = calculateWorker({ ...base, tipsPaidWithPayroll: false }, dcRulesFor('2026-08-08'));
    expect(inCheck.grossWages).toBe(alreadyPaid.grossWages);
    expect(inCheck.paymentToWorker - alreadyPaid.paymentToWorker).toBe(500);
  });

  it('keeps 401(k) deferrals in FICA wages but removes qualified section 125 amounts', () => {
    const result = calculateWorker(worker({ section125Deduction: 100, retirement401k: 100 }), dcRulesFor('2026-08-08'));
    expect(result.socialSecurityWages).toBe(700);
    expect(result.federalIncomeTaxWages).toBe(600);
  });

  it('keeps employee deductions in the cash-funding reconciliation', () => {
    const result = calculateWorker(worker({
      section125Deduction: 100, retirement401k: 100, otherAfterTaxDeductions: 50,
    }), dcRulesFor('2026-08-08'));
    expect(result.deductionRemittances).toBe(250);
    expect(result.warnings.join(' ')).toMatch(/section 125 election/);
    expect(result.warnings.join(' ')).toMatch(/401\(k\) limits/);
    expect(result.warnings.join(' ')).toMatch(/after-tax deductions/);
    expect(result.fundingNeeded).toBeCloseTo(
      result.paymentToWorker + result.deductionRemittances + result.federalDeposit + result.dcWithholding +
      result.estimatedFuta + result.dcUnemploymentInsurance + result.dcAdministrativeAssessment,
      2,
    );
  });

  it('withholds Additional Medicare only as wages cross $200,000', () => {
    const result = calculateWorker(worker({ rateOrPay: 1_000, regularHours: 1, ytdMedicareWages: 199_500 }), dcRulesFor('2026-08-08'));
    expect(result.employeeAdditionalMedicare).toBe(4.5);
    expect(result.employerMedicare).toBe(14.5);
  });

  it('adds the 0.2% DC administrative assessment separately from UI', () => {
    const result = calculateWorker(worker(), dcRulesFor('2026-08-08'));
    expect(result.dcUnemploymentInsurance).toBe(21.6);
    expect(result.dcAdministrativeAssessment).toBe(1.6);
  });

  it('uses an established employer rate from the 2026 DOES notice', () => {
    const result = calculateWorker(worker(), dcRulesFor('2026-08-08', 0.074));
    expect(result.dcUnemploymentInsurance).toBe(59.2);
    expect(result.dcAdministrativeAssessment).toBe(1.6);
  });

  it('rejects a DC UI rate outside the supported notice range', () => {
    expect(() => dcRulesFor('2026-08-08', 0.101)).toThrow(/rate notice/);
  });

  it('does not treat a contractor payment as employee payroll', () => {
    const result = calculateWorker(worker({ kind: 'contractor', rateOrPay: 500, regularHours: 0 }), dcRulesFor('2026-08-08'));
    expect(result.employeeFica).toBe(0);
    expect(result.employerPayrollTaxes).toBe(0);
    expect(result.warnings.join(' ')).toMatch(/classification/i);
  });

  it('totals exact worker results', () => {
    const rules = dcRulesFor('2026-08-08');
    const results = [calculateWorker(worker(), rules), calculateWorker(worker({ id: 'w2', name: 'Second' }), rules)];
    const totals = totalPayroll(results);
    expect(totals.grossWages).toBe(1_600);
    expect(totals.federalWithholding).toBe(200);
    expect(totals.paymentsToWorkers).toBe(results[0].paymentToWorker * 2);
    expect(totals.fundingNeeded).toBe(results[0].fundingNeeded * 2);
  });
});
