const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/home/ultron/.gemini/antigravity-ide/brain/47125cc2-430f-4cde-8fc5-6e99d376f180';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // 1. Personnel Flow
  console.log('Navigating to Login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '01_login_console.png'), fullPage: true });
  console.log('Captured 01_login_console.png');

  // Click personnel quick-fill button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('CAPF-2024-001')) {
      await btn.click();
      break;
    }
  }

  // Click Submit / Authenticate
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click();
  }

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  // Capture Personnel Dashboard
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '02_personnel_dashboard.png'), fullPage: true });
  console.log('Captured 02_personnel_dashboard.png');

  // Navigate to Daily Wellness Check-in
  await page.goto('http://localhost:5173/personnel/checkin', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '03_wellness_checkin.png'), fullPage: true });
  console.log('Captured 03_wellness_checkin.png');

  // Logout / Switch to Welfare Officer
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // Quick fill Welfare Officer
  const welfareBtns = await page.$$('button');
  for (const btn of welfareBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('CAPF-2024-002')) {
      await btn.click();
      break;
    }
  }
  const welfareSubmit = await page.$('button[type="submit"]');
  if (welfareSubmit) {
    await welfareSubmit.click();
  }
  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  // Capture Welfare Dashboard
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '04_welfare_dashboard.png'), fullPage: true });
  console.log('Captured 04_welfare_dashboard.png');

  // Navigate to Alerts Queue
  await page.goto('http://localhost:5173/welfare/alerts', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '05_alerts_queue.png'), fullPage: true });
  console.log('Captured 05_alerts_queue.png');

  // Navigate to Case Detail
  await page.goto('http://localhost:5173/welfare/cases/CAPF-2024-001', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_case_detail.png'), fullPage: true });
  console.log('Captured 06_case_detail.png');

  await browser.close();
  console.log('Done capturing all screenshots!');
}

main().catch(err => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
