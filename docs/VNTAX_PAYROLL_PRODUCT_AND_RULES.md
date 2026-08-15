# VNTax payroll: product reference and verified 2026 rules

Research and implementation checkpoint: 2026-08-15.

## Product references

TurboTax and Keeper are functional references, not copy sources.

| Reference | Pattern worth adopting | VNTax implementation | Boundary |
|---|---|---|---|
| TurboTax | One clear question at a time; review before completion; escalate to a human when facts matter | Workweek -> People -> Review flow; blockers and warnings remain visible before CSV export | VNTax does not promise filing, accuracy guarantees, maximum refunds, or expert review unless those services actually exist |
| Keeper | Year-round capture; plain-language deduction and payroll explanations; export to a professional | Weekly record worksheet, separate year-to-date wage bases, source links, portable CSV | No bank connection, automatic classification, filing, or professional review is claimed |

VNTax's product position is narrower and more defensible: bilingual record preparation for Vietnamese-owned restaurants and nail salons, with industry-specific workflows and a clean human-preparer handoff.

## Verified 2026 constants

| Rule | Implemented value | Primary source |
|---|---:|---|
| Social Security employee and employer rate | 6.2% each | IRS Publication 15 (2026); SSA |
| Social Security wage base | $184,500 | SSA contribution and benefit base |
| Medicare employee and employer rate | 1.45% each, no wage cap | IRS Publication 15 (2026) |
| Additional Medicare withholding | 0.9% on employer-paid wages above $200,000; employee only | IRS Publication 15 (2026) |
| FUTA wage base | $7,000 | IRS Publication 15 (2026) |
| FUTA planning rate | 0.6%, assuming full state credit | IRS Publication 15 (2026); final credit-reduction status still requires annual verification |
| DC minimum wage, Jan 1-Jun 30 | $17.95 | DC Office of Wage-Hour |
| DC tipped cash wage, Jan 1-Jun 30 | $10.00 | DC Office of Wage-Hour |
| DC minimum wage, beginning Jul 1 | $18.40 | DC Office of Wage-Hour |
| DC tipped cash wage, beginning Jul 1 | $10.30 | DC Office of Wage-Hour |
| DC new-employer UI default | 2.7%; established employers enter their assigned 2026 rate | DC DOES Employer and Agent Portal |
| DC UI administrative assessment | 0.2% | DC DOES Employer and Agent Portal |
| DC UI taxable wage base | $9,000 | DC DOES Employer and Agent Portal |
| Tipped overtime cash-rate method | 1.5 times the full applicable minimum wage, less no more than the straight-time tip credit | U.S. DOL Fact Sheet 15 and Overtime Calculator Advisor |
| Traditional 401(k) elective deferral | Excluded from FIT wages; retained in Social Security, Medicare, and FUTA wages | IRS 401(k) plan overview |

Primary links:

- https://www.irs.gov/publications/p15
- https://www.ssa.gov/OACT/cola/cbb.html
- https://does.dc.gov/node/1412291
- https://essp.does.dc.gov/DOES%20ESSP%20Employer%20Landing%20Page.html
- https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa
- https://www.irs.gov/retirement-plans/401k-plan-fix-it-guide-401k-plan-overview
- https://www.irs.gov/publications/p15b

## Defects found in the prior standalone worksheet

1. It used the 2025 Social Security wage base of $176,100 for a 2026 payroll run. The engine now fails closed outside 2026 and uses $184,500.
2. It used one year-to-date wage field for Social Security, Medicare, FUTA, and DC UI. These tax bases are now separate inputs.
3. It omitted DC's separate 0.2% administrative assessment. The engine now calculates it separately.
4. It treated all reported tips as though their payment timing were the same. The guided flow asks whether tips are still owed in the payroll payment or were already received.
5. It allowed multiweek payroll periods while calculating overtime and tip-credit makeup from aggregate hours. The first production module is intentionally one workweek at a time.
6. It presented salary and contractor labels as operational choices. The new flow warns that salary does not establish an overtime exemption and contractor classification depends on the working facts.
7. It displayed an automatic Form 8846 amount. The new module does not calculate that credit; it belongs in a reviewed tax workflow, not the employee payment calculation.
8. It selected one DC minimum wage from the workweek-ending date even when the seven-day week crossed July 1. The engine now blocks that transition week and requires the hours to be split across the two effective periods.
9. It applied the 2.7% new-employer UI rate to every business. The guided flow now identifies 2.7% as the new-employer default and requires established employers to enter the rate on their 2026 DOES notice; the selected rate is recorded in the CSV.
10. It did not bind the 2026 employment-tax rules to the pay date. The guided flow now requires a valid 2026 pay date on or after the workweek ending date and blocks a later-year payment from using 2026 constants.
11. It allowed more than 40 weekly hours to remain in the regular-hours field. The engine now blocks export until excess hours are moved to overtime for the supported hourly worker types.
12. It subtracted employee deductions from take-home pay without carrying those amounts into total cash funding. The review now shows deductions to remit separately and includes them in total funding needed.
13. It could make a plan label look like a tax-eligibility decision. Nonzero Section 125, 401(k), and other deductions now remain visibly marked for eligibility, plan-limit, and authorization review.

## Release boundary

The module calculates and exports a review worksheet. It does not:

- calculate federal or DC income-tax withholding from W-4/D-4 facts;
- issue a paystub, file Form 941 or DC returns, make deposits, or move money;
- determine worker classification or overtime exemption;
- validate cafeteria-plan qualification, retirement-plan eligibility or limits, or deduction authorization;
- persist employee data to the production database;
- replace a payroll service or accountable payroll/tax professional.

Federal and DC withholding must be entered from current agency instructions. A run with missing withholding is visibly marked for review. Any unsupported year is blocked rather than estimated with stale rules.

The 0.6% FUTA figure is a planning estimate that assumes the full state credit; it is not a final Form 940 liability. DC UI uses the employer-entered 2026 notice rate plus the separate 0.2% administrative assessment. A seven-day workweek that crosses July 1 is blocked because one aggregate hours field cannot apply both wage periods accurately.
