import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.VNTAX_QA_URL ?? 'http://127.0.0.1:4176/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('qa-output');
const errors = [];
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });

async function inspect(name, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${name}: pageerror: ${error.message}`));

  const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  const result = {
    name,
    status: response?.status() ?? null,
    title: await page.title(),
    url: page.url(),
    h1: await page.locator('h1').allTextContents(),
    buttons: await page.getByRole('button').allTextContents(),
    links: await page.getByRole('link').allTextContents(),
    bodyPreview: (await page.locator('body').innerText()).slice(0, 1_500),
  };

  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  await page.close();
  return result;
}

async function inspectPayroll(name, viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => window.localStorage.setItem('vntax.locale', 'en'));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${name}: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${name}: pageerror: ${error.message}`));

  const response = await page.goto(`${baseUrl}#/app/payroll`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.screenshot({ path: path.join(outputDir, `${name}-step1.png`), fullPage: true });
  const hasEmployerRateInput = await page.getByLabel('2026 DC UI employer rate (%)').isVisible();
  await page.getByLabel('Workweek ending').fill('2026-07-01');
  const blocksTransitionWeek = await page.getByText(/crosses the July 1 DC wage change/).isVisible();
  await page.getByLabel('Workweek ending').fill('2026-08-08');
  await page.getByLabel('2026 DC UI employer rate (%)').fill('7.4');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Regular hours').fill('40');
  await page.getByLabel('Reported tips').fill('500');
  await page.getByText('Taxes, deductions, and year-to-date wages').click();
  await page.getByLabel('Qualified section 125 deduction').fill('100');
  await page.getByLabel('Traditional 401(k) deferral').fill('100');
  await page.getByLabel('Other after-tax deductions').fill('50');
  await page.getByLabel('Federal income tax withholding').fill('100');
  await page.getByLabel('DC income tax withholding').fill('50');
  await page.screenshot({ path: path.join(outputDir, `${name}-step2.png`), fullPage: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.screenshot({ path: path.join(outputDir, `${name}-review.png`), fullPage: true });
  await page.screenshot({ path: path.join(outputDir, `${name}-review-viewport.png`) });

  const body = await page.locator('body').innerText();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review CSV' }).click();
  const download = await downloadPromise;
  const csvPath = path.join(outputDir, `${name}-review.csv`);
  await download.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8');
  const result = {
    name,
    status: response?.status() ?? null,
    title: await page.title(),
    h1: await page.locator('h1').allTextContents(),
    hasReview: body.includes('Total funding needed') && body.includes('Official 2026 sources'),
    hasEmployerRateInput,
    blocksTransitionWeek,
    hasSelectedEmployerRate: body.includes('2026 DC UI employer rate (%): 7.40%'),
    hasDeductionRemittance: body.includes('Deductions to remit') && body.includes('$250.00'),
    csvRecordsRateAndRemittance: csv.includes('DC UI employer rate') && csv.includes('Deductions to remit') && csv.includes('0.074'),
    hasStaleWageBase: body.includes('176,100'),
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    scrollY: await page.evaluate(() => window.scrollY),
    bodyPreview: body.slice(0, 2_000),
  };
  await page.close();
  return result;
}

async function inspectPayrollVietnamese() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => window.localStorage.setItem('vntax.locale', 'vi'));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`payroll-vietnamese: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`payroll-vietnamese: pageerror: ${error.message}`));
  const response = await page.goto(`${baseUrl}#/app/payroll`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.getByLabel('Ngày cuối tuần làm việc').fill('2026-07-01');
  const body = await page.locator('body').innerText();
  const result = {
    name: 'payroll-vietnamese',
    status: response?.status() ?? null,
    hasVietnameseTitle: body.includes('Tính lương DC theo tuần'),
    hasEmployerRateGuidance: body.includes('Cơ sở mới dùng 2,7%'),
    hasTranslatedTransitionBlock: body.includes('tách giờ trước và sau ngày 1 tháng 7'),
    horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  };
  await page.screenshot({ path: path.join(outputDir, 'payroll-vietnamese-transition.png'), fullPage: true });
  await page.close();
  return result;
}

const results = [
  await inspect('home-desktop', { width: 1440, height: 1000 }),
  await inspect('home-mobile', { width: 390, height: 844 }),
  await inspectPayroll('payroll-desktop', { width: 1440, height: 1000 }),
  await inspectPayroll('payroll-mobile', { width: 390, height: 844 }),
  await inspectPayrollVietnamese(),
];

await browser.close();
console.log(JSON.stringify({ results, errors }, null, 2));
if (errors.length > 0) process.exitCode = 1;
