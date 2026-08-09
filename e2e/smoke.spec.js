import { test, expect } from '@playwright/test';

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE: ' + msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push('PAGE: ' + err.message);
  });
  return errors;
}

function getRealErrors(errors) {
  return errors.filter(function (error) {
    return error.indexOf('@vite') === -1 && error.indexOf('vite/client') === -1;
  });
}

test('页面加载无 Console 报错', async ({ page }) => {
  // 先绑监听，再导航（CSP 违规在加载阶段就触发）
  const errors = captureRuntimeErrors(page);

  await page.goto('/');
  await page.waitForSelector('.version-tag');
  await page.waitForTimeout(500);

  // 验证核心 UI 存在
  await expect(page.locator('.nav__btn').first()).toBeVisible();
  await expect(page.locator('#storageHealth')).toBeAttached();

  // 切换到四个主 Tab，触发各模块 init
  for (const tab of ['timer', 'odds', 'review']) {
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(200);
    await expect(page.locator(`[data-tab="${tab}"]`)).toHaveClass(/nav__btn--active/);
    await expect(page.locator('.nav__btn--active')).toHaveCount(1);
  }

  // 复盘子 Tab
  for (const sub of ['hand', 'session', 'discover', 'weekly', 'total', 'opponent']) {
    await page.click(`[data-sub="${sub}"]`);
    await page.waitForTimeout(200);
    const panelName = sub.charAt(0).toUpperCase() + sub.slice(1);
    await expect(page.locator(`[data-sub="${sub}"]`)).toHaveClass(/subnav__btn--active/);
    await expect(page.locator('#reviewSubNav .subnav__btn--active')).toHaveCount(1);
    await expect(page.locator(`#sub${panelName}`)).toHaveClass(/is-visible/);
  }

  if (errors.length) {
    console.log('\n=== Console 报错 (' + errors.length + ' 条) ===');
    errors.forEach((e) => console.log('  ' + e));
    console.log('================================\n');
    // 过滤 Vite HMR 相关报错（仅 dev 模式）
    var realErrors = getRealErrors(errors);
    if (realErrors.length > 0) {
      test.fail();
    }
  }
});

test('Timer 与 Review 在目标视口无页面级横向溢出', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  const viewports = [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.waitForSelector('#timerDisplay');

    await expect(page.locator('#timerDisplay')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);

    await page.click('[data-tab="review"]');
    for (const sub of ['hand', 'session', 'discover', 'weekly', 'total', 'opponent']) {
      await page.click(`[data-sub="${sub}"]`);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
  }

  expect(getRealErrors(errors)).toEqual([]);
});

test('四种主题继续使用既有持久化契约', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('pa_colorScheme'));
  await page.reload();
  await page.click('#settingsBtn');

  const expected = [
    { scheme: 'nimbus', className: 'color-nimbus' },
    { scheme: 'ember', className: 'color-ember' },
    { scheme: 'neon', className: 'color-neon' },
    { scheme: 'pale', className: '' },
  ];
  for (const state of expected) {
    await page.click('#colorSchemeOption');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pa_colorScheme')))
      .toBe(state.scheme);
    if (state.className) {
      await expect(page.locator('body')).toHaveClass(new RegExp(state.className));
    } else {
      await expect(page.locator('body')).not.toHaveClass(/color-(nimbus|ember|neon)/);
    }
  }

  expect(getRealErrors(errors)).toEqual([]);
});
