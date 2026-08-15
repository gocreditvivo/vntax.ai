import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.env.VNTAX_QA_URL ?? 'http://127.0.0.1:4176/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('qa-output');
const errors = [];
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => window.localStorage.setItem('vntax.locale', 'en'));
page.on('console', (message) => {
  if (message.type() === 'error') {
    const source = message.location().url;
    errors.push(`console: ${message.text()}${source ? ` [${source}]` : ''}`);
  }
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

const homeResponse = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.getByRole('heading', { level: 1 }).waitFor();
const home = await page.locator('body').innerText();
await page.screenshot({ path: path.join(outputDir, 'production-locked-home.png'), fullPage: true });

await page.evaluate(() => { window.location.hash = '#/app/dashboard'; });
await page.getByRole('heading', { name: 'Customer accounts are not open in this build' }).waitFor();
const app = await page.locator('body').innerText();
await page.screenshot({ path: path.join(outputDir, 'production-locked-app.png'), fullPage: true });

await page.evaluate(() => { window.location.hash = '#/auth/sign-up'; });
await page.getByRole('heading', { name: 'Customer accounts are not open in this build' }).waitFor();
const auth = await page.locator('body').innerText();
await page.screenshot({ path: path.join(outputDir, 'production-locked-auth.png'), fullPage: true });

const result = {
  homeStatus: homeResponse?.status() ?? null,
  homeStatesAccountBoundary: home.includes('This build has no verified customer database connection'),
  homeAvoidsUninstalledClaims: !home.includes('Connect your accounts') && !home.includes('Snap receipts'),
  appFailsClosed: app.includes('Customer accounts are not open in this build'),
  authFailsClosed: auth.includes('Customer accounts are not open in this build'),
  fixtureBusinessAbsent: !app.includes('Phở Bình Minh') && !app.includes('Lotus Nail'),
  fixtureNavigationAbsent: !app.includes('Transactions') && !app.includes('Receipts'),
  horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
};

const passed = result.homeStatus === 200 && result.homeStatesAccountBoundary &&
  result.homeAvoidsUninstalledClaims && result.appFailsClosed && result.authFailsClosed &&
  result.fixtureBusinessAbsent && result.fixtureNavigationAbsent && !result.horizontalOverflow;
console.log(JSON.stringify({ result, errors, passed }, null, 2));

await page.close();
const closeResult = await Promise.race([
  browser.close().then(() => 'closed'),
  new Promise((resolve) => setTimeout(() => resolve('timed_out'), 5_000)),
]);
if (closeResult !== 'closed') console.error('Browser close timed out after QA evidence was collected.');
// Chrome occasionally does not acknowledge Playwright's close request in this
// Windows host. That is a runner-cleanup warning, not a product assertion; the
// Node process exits immediately after this line and does not treat it as app
// evidence. Failed page assertions or browser errors still fail the command.
process.exit(errors.length > 0 || !passed ? 1 : 0);
