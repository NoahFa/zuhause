const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const sizes = [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];
  const results = [];
  for (const viewport of sizes) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto('http://127.0.0.1:4173/?preview=calendar', { waitUntil: 'networkidle' });
    const cells = await page.locator('#calendarGrid .cal-day').count();
    const bodyOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const stalePersonalContent = await page.locator('body').evaluate(node => /Noah|Charleen|Lou|1\.284,00|462,30/.test(node.textContent));
    await page.getByRole('button', { name: 'Woche', exact: true }).click();
    const weekDays = await page.locator('.calendar-week-day').count();
    await page.locator('[data-calendar-add]').first().click();
    const dialogVisible = await page.locator('#calendarEventDialog').evaluate(node => node.open);
    const payload = '<img src=x onerror=window.__xss=1>Familie';
    await page.locator('#calendarEventForm [name=title]').fill(payload);
    await page.locator('#calendarEventForm [name=allDay]').check();
    await page.locator('#calendarEventForm [name=recurrence]').selectOption('weekly');
    await page.locator('#calendarEventForm button[type=submit]').click();
    await page.waitForTimeout(100);
    const xss = await page.evaluate(() => window.__xss === 1);
    const literalTitle = await page.getByText(payload, { exact: true }).count();
    await page.getByRole('button', { name: 'Agenda', exact: true }).click();
    const agendaDays = await page.locator('.agenda-day').count();
    const result = {
      viewport, status: response && response.status(), cells, weekDays, agendaDays,
      dialogVisible, xss, literalTitle, stalePersonalContent, bodyOverflow, errors,
    };
    result.ok = result.status === 200 && cells === 42 && weekDays === 7 && agendaDays >= 1 &&
      dialogVisible && !xss && literalTitle >= 1 && !stalePersonalContent && errors.length === 0 && bodyOverflow <= 1;
    results.push(result);
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some(result => !result.ok)) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
