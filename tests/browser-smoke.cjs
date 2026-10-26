const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.MAPKWETU_BROWSER_MODULE || 'playwright');

async function main() {
  for (const route of ['site-check', 'site-check/report']) {
    const trace = JSON.parse(fs.readFileSync(`.next/server/app/api/${route}/route.js.nft.json`, 'utf8'));
    assert.ok(trace.files.some((file) => file.endsWith('.generated/site-check/index.json')), `Server deployment trace omits Site Check data: ${route}`);
  }
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '-p', '4173'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; server.stdout.on('data', (chunk) => { output += chunk; }); server.stderr.on('data', (chunk) => { output += chunk; });
  let browser;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch('http://127.0.0.1:4173/')).ok) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, `Production server did not start: ${output}`);
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    fs.mkdirSync('artifacts/browser', { recursive: true });
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /projects behind the transition/i }).waitFor();
    await page.screenshot({ path: 'artifacts/browser/home-desktop.png', fullPage: true });
    await page.goto('http://127.0.0.1:4173/datasets');
    await page.waitForFunction(() => document.querySelector('.kw-dataset-metrics strong')?.textContent === '112');
    assert.equal(await page.locator('.kw-dataset-card').count(), 4);
    await page.screenshot({ path: 'artifacts/browser/datasets-desktop.png', fullPage: true });
    await page.goto('http://127.0.0.1:4173/transition');
    await page.locator('.kw-project-table tbody tr').first().waitFor();
    assert.equal(await page.locator('.kw-project-table tbody tr').count(), 25);
    await page.locator('.kw-project-table input[type=checkbox]').nth(0).check();
    await page.locator('.kw-project-table input[type=checkbox]').nth(1).check();
    await page.locator('.kw-project-table input[type=checkbox]').nth(2).check();
    await page.locator('.kw-project-table input[type=checkbox]').nth(3).click();
    await page.getByRole('status').filter({ hasText: 'Compare up to three records' }).waitFor();
    assert.equal(await page.locator('.kw-comparison-grid article').count(), 3);
    await page.locator('.kw-project-name').first().click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('.kw-workspace-controls select').nth(0).selectOption('hydrogen');
    await page.locator('.kw-workspace-controls select').nth(1).selectOption('KEN');
    await page.waitForFunction(() => [...document.querySelectorAll('.kw-project-table tbody tr')].length > 0 && [...document.querySelectorAll('.kw-project-table tbody tr')].every((row) => row.cells[2].textContent === 'Kenya'));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export filtered CSV' }).click();
    const download = await downloadPromise; const csv = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(csv.includes('"source_url"')); assert.ok(csv.includes('iea.org')); assert.ok(csv.includes('"KEN"'));
    await page.locator('.kw-workspace-search input').fill('no-such-mapkwetu-project-unique');
    await page.getByText('No records match these filters.', { exact: false }).waitFor();
    await page.locator('.kw-workspace-search input').fill('');
    await page.locator('.kw-scenario-copy input[type=range]').nth(1).focus();
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.querySelectorAll('.kw-scenario-copy output')[1]?.textContent === '100%');
    assert.ok((await page.locator('.kw-scenario-number strong').innerText()).startsWith('0'));
    await page.screenshot({ path: 'artifacts/browser/workspace-desktop.png', fullPage: true });
    await page.goto('http://127.0.0.1:4173/site-check');
    await page.getByPlaceholder('Try Nairobi, Mombasa, Lagos…').fill('Nairobi');
    const siteResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/site-check') && response.request().method() === 'POST');
    await page.locator('.kw-city-results button').first().click();
    const siteResponse = await siteResponsePromise;
    assert.equal(siteResponse.status(), 200, `Site Check failed: ${await siteResponse.text()}`);
    await page.locator('.kw-site-report-heading h2').waitFor();
    assert.equal(await page.locator('.kw-nearby-grid article').count(), 6);
    assert.ok((await page.locator('.kw-site-metric-grid article strong').first().innerText()).includes('km'));
    await page.getByText('PDF sign-ups are not enabled yet.', { exact: false }).waitFor();
    assert.equal(await page.locator('#site-report-email').count(), 0);
    await page.screenshot({ path: 'artifacts/browser/site-check-desktop.png', fullPage: true });
    await page.getByLabel('Latitude', { exact: true }).fill('-4.0435');
    await page.getByLabel('Longitude', { exact: true }).fill('39.6682');
    await page.getByRole('button', { name: 'Run Site Check', exact: true }).click();
    await page.locator('.kw-site-report-heading h2').waitFor();
    assert.ok((await page.locator('.kw-site-report-heading p').last().innerText()).includes('39.66820'));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Site Check overflows the mobile viewport.');
    await page.screenshot({ path: 'artifacts/browser/site-check-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const atlasRequests = [];
    page.on('request', (request) => atlasRequests.push(request.url()));
    const dataResponse = page.waitForResponse((response) => response.url().includes('/data/transition/hydrogen.geojson') && response.status() === 200);
    await page.goto('http://127.0.0.1:4173/atlas?dataset=hydrogen&country=KEN'); await dataResponse;
    await page.locator('.maplibregl-canvas').waitFor();
    assert.ok(!atlasRequests.some((url) => url.includes('/data/grid/africa_transmission.geojson')), 'A transition deep link fetched the disabled large transmission layer.');
    await page.getByText('Energy transition', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Project status').count(), 1);
    await page.screenshot({ path: 'artifacts/browser/atlas-hydrogen.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://127.0.0.1:4173/transition');
    await page.locator('.kw-project-table tbody tr').first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Workspace overflows the mobile viewport.');
    await page.screenshot({ path: 'artifacts/browser/workspace-mobile.png', fullPage: true });
    await page.goto('http://127.0.0.1:4173/');
    await page.screenshot({ path: 'artifacts/browser/home-mobile.png', fullPage: true });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((element) => { const box = element.getBoundingClientRect(); return box.right > window.innerWidth + 1 && box.width > 0; }).slice(0, 12).map((element) => ({ tag: element.tagName, className: element.className, width: element.getBoundingClientRect().width, right: element.getBoundingClientRect().right })));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Homepage overflows the mobile viewport: ${JSON.stringify(overflow)}`);
    assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
    console.log('Browser smoke checks passed: catalogue, filtering, comparison limits, dialog, CSV, scenario, map, and mobile layouts.');
  } finally {
    await browser?.close(); server.kill('SIGTERM');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
