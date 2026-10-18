import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = [{ name: 'desktop', width: 1440, height: 900, url: '/#safemode' }, { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844, url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
for (const target of targets) test('Timer prioritizes play, captures a question and safely clears only today logs: ' + target.name, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    const date = new Date(), today = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    localStorage.setItem('pa_standup', JSON.stringify({ date: today, count: 3 }));
    localStorage.setItem('pa_log_' + today, JSON.stringify([{ workStart: '2026-10-18T10:00:00', workEnd: '2026-10-18T10:20:00', breakStart: '2026-10-18T10:20:00', breakEnd: '2026-10-18T10:22:00' }]));
  });
  await page.goto(target.url);
  await expect(page.locator('.timer-configuration')).not.toHaveAttribute('open', '');
  await page.locator('#startBtn').click(); await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#startBtn').click(); await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-timer-capture]').click();
  await expect(page.locator('#quickCaptureCloseBtn')).toBeFocused();
  await page.locator('#handDesc').fill('A synthetic question during play');
  await page.locator('#saveHandBtn').click(); await expect(page.locator('#timerPanel')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_marks')).at(-1).note)).toBe('A synthetic question during play');
  await page.locator('#logToggle').click(); await expect(page.locator('#logBody tr')).toHaveCount(1);
  await page.locator('#clearLogBtn').click(); await expect(page.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#logBody tr')).toHaveCount(1);
  await page.locator('#clearLogBtn').click(); await page.locator('#actionConfirmDialog').getByRole('button', { name: '清除今日记录', exact: true }).click();
  await expect(page.locator('#logBody tr')).toHaveCount(0); await expect(page.locator('#todayCount')).toHaveText('3');
  expect(errors).toEqual([]);
});

test('Timer core controls remain reachable in the five target sizes and all themes', async ({ page }, testInfo) => {
  await page.goto('/#safemode');
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(size);
    for (const theme of ['', 'color-nimbus', 'color-ember', 'color-neon']) {
      await page.evaluate(theme => { document.body.classList.remove('color-nimbus', 'color-ember', 'color-neon'); if (theme) document.body.classList.add(theme); }, theme);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('#startBtn')).toBeInViewport();
      await expect(page.locator('[data-timer-capture]')).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (!theme) await page.screenshot({ path: testInfo.outputPath('timer-' + size.width + '.png'), fullPage: true });
      await page.locator('.timer-configuration > summary').click();
      await expect(page.locator('#workMin')).toBeVisible();
      await page.locator('#longBreakDetails > summary').click(); await expect(page.locator('#longBreakMin')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.locator('#longBreakDetails > summary').click(); await page.locator('.timer-configuration > summary').click();
    }
  }
});
