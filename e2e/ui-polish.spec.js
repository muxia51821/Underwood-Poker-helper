import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// [V7.12.0 新增] Check keyboard and touch access on the production preview too.
test('核心导航与快记操作具有可见键盘焦点', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['#startBtn', '[data-tab="review"]', '#settingsBtn']) {
    const button = page.locator(selector);
    await button.focus();
    await expect(button).toBeFocused();
    const style = await button.evaluate(el => {
      const css = getComputedStyle(el);
      return { visible: el.matches(':focus-visible'), outline: css.outlineStyle, shadow: css.boxShadow };
    });
    expect(style.visible).toBe(true);
    expect(style.outline !== 'none' || style.shadow !== 'none').toBe(true);
  }
  await page.click('[data-tab="review"]');
  await page.locator('[data-sub="session"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#subSession')).toBeVisible();
  await page.locator('#quickMarkBtn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#quickCaptureCloseBtn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#subSession')).toBeVisible();
});

if (process.env.E2E_OUT_DIR) test('离线单文件支持核心界面与 Mark 快记', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode');
  await page.click('#startBtn');
  await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#startBtn');
  await page.click('#quickCaptureBtn');
  await page.fill('#handDesc', 'Offline synthetic Mark');
  await expect(page.locator('#saveHandBtn')).toBeInViewport();
  await page.click('#saveHandBtn');
  await expect(page.locator('#timerPanel')).toBeVisible();
  await page.click('[data-tab="review"]');
  await expect(page.locator('#handBody .table-empty-state')).toContainText('快记');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('移动快记可触控且减少动态效果时主操作保持可用', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.click('#startBtn');
  await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#startBtn');
  await expect(page.locator('#startBtn')).toHaveAttribute('aria-pressed', 'false');
  const duration = await page.locator('#startBtn').evaluate(el => getComputedStyle(el).transitionDuration);
  expect(duration.split(',').every(value => parseFloat(value) <= .001)).toBe(true);
  await page.click('#quickCaptureBtn');
  for (const selector of ['#quickCaptureCloseBtn', '#quickCaptureFullBtn', '#saveHandBtn']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.locator('#saveHandBtn')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#timerPanel')).toBeVisible();
});
