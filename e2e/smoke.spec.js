import { test, expect } from '@playwright/test';

test('页面加载无 Console 报错', async ({ page }) => {
  const errors = [];

  // 先绑监听，再导航（CSP 违规在加载阶段就触发）
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push('CONSOLE: ' + msg.text());
    }
  });
  page.on('pageerror', (err) => {
    errors.push('PAGE: ' + err.message);
  });

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
  }

  // 复盘子 Tab
  for (const sub of ['hand', 'session', 'weekly', 'opponent']) {
    await page.click(`[data-sub="${sub}"]`);
    await page.waitForTimeout(200);
    const panelName = sub.charAt(0).toUpperCase() + sub.slice(1);
    await expect(page.locator(`#sub${panelName}`)).toHaveClass(/is-visible/);
  }

  if (errors.length) {
    console.log('\n=== Console 报错 (' + errors.length + ' 条) ===');
    errors.forEach((e) => console.log('  ' + e));
    console.log('================================\n');
    // 过滤 Vite HMR 相关报错（仅 dev 模式）
    var realErrors = errors.filter(function (e) {
      return e.indexOf('@vite') === -1 && e.indexOf('vite/client') === -1;
    });
    if (realErrors.length > 0) {
      test.fail();
    }
  }
});
