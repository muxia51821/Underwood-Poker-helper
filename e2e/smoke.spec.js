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

test('移动端快速记录复用 Hand 表单并恢复来源上下文', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  const draftBeforeQuick = 'draft-before-quick-capture';
  const quickNote = 'quick-capture-e2e-' + Date.now();
  const latestSessionLevel = 'Quick Capture Latest';

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForSelector('#quickCaptureBtn');
  await expect(page.locator('#quickCaptureBtn')).toBeVisible();
  await expect(page.locator('#quickCaptureBtn')).not.toHaveClass(/nav__btn/);
  await expect(page.locator('#quickCaptureBtn')).toHaveAttribute('aria-expanded', 'false');

  // 建立最新 Session，验证 quick capture 自动关联当前记录上下文。
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.fill('#sessDate', '2099-01-02');
  await page.fill('#sessLevel', latestSessionLevel);
  await page.fill('#sessDur', '1');
  await page.fill('#sessHands', '50');
  await page.fill('#sessProfit', '5');
  await page.click('#addSessionBtn');
  await page.click('[data-sub="hand"]');

  // 再建立未保存草稿，验证取消 quick capture 后能够完整恢复。
  await page.fill('#handDesc', draftBeforeQuick);
  await page.click('[data-tab="timer"]');
  await page.click('#quickCaptureBtn');
  await expect(page.locator('#handDetailPane')).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#handDetailPane')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#handDetailPane')).toHaveClass(/is-quick-capture/);
  await expect(page.locator('#quickCaptureCloseBtn')).toBeFocused();
  await expect(page.locator('#quickCaptureBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#handReflection')).toBeHidden();
  await expect(page.locator('#handMistakeGroup')).toBeHidden();
  await expect(page.locator('#handMistakeCustom')).toBeVisible();
  await expect(page.locator('#saveHandBtn')).toBeVisible();
  await expect(page.locator('#handSessionSelect option:checked')).toContainText(latestSessionLevel);
  const dialogBox = await page.locator('#handDetailPane').boundingBox();
  expect(dialogBox).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#saveHandBtn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#quickCaptureCloseBtn')).toBeFocused();
  await expect(page.locator('#handDesc')).toHaveValue('');
  await page.click('#saveHandBtn');
  await expect(page.locator('#handDetailPane')).toHaveClass(/is-quick-capture/);
  await page.fill('#handDesc', 'cancelled-quick-note');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tab="timer"]')).toHaveClass(/nav__btn--active/);
  await expect(page.locator('#handDetailPane')).not.toHaveClass(/is-quick-capture/);
  await expect(page.locator('#quickCaptureBtn')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#handDesc')).toHaveValue(draftBeforeQuick);

  // 成功保存后回到来源 Tab；随后进入 Review Hand 核查记录并清理。
  await page.click('#quickCaptureBtn');
  await page.selectOption('#handPotType', 'SIA');
  await page.selectOption('#handPreflopScenario', 'BTNvsBB');
  await page.selectOption('#handBoard', 'R');
  await page.fill('#handDesc', quickNote);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.click('#saveHandBtn');
  await expect(page.locator('[data-tab="timer"]')).toHaveClass(/nav__btn--active/);
  await expect(page.locator('#handDetailPane')).not.toHaveClass(/is-quick-capture/);
  await expect(page.locator('body')).not.toHaveClass(/quick-capture-open/);
  await expect(page.locator('#toast')).toHaveText('已快速记录，可稍后补全反思');

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="hand"]');
  await expect(page.locator('#handDesc')).toHaveValue(draftBeforeQuick);
  const createdRow = page.locator('#handBody tr[data-hand-id]').filter({ hasText: quickNote.slice(0, 20) });
  await expect(createdRow).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await createdRow.locator('[data-hand-delete]').evaluate((button) => button.click());
  await expect(createdRow).toHaveCount(0);

  // 第二个目标移动尺寸保持 dialog 无页面级横向溢出。
  await page.setViewportSize({ width: 430, height: 932 });
  await page.click('#quickCaptureBtn');
  await expect(page.locator('#handDetailPane')).toHaveClass(/is-quick-capture/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.fill('#handDesc', 'full-edit-retained');
  await page.click('#quickCaptureFullBtn');
  await expect(page.locator('#handDetailPane')).not.toHaveClass(/is-quick-capture/);
  await expect(page.locator('[data-tab="review"]')).toHaveClass(/nav__btn--active/);
  await expect(page.locator('[data-sub="hand"]')).toHaveClass(/subnav__btn--active/);
  await expect(page.locator('#handDesc')).toHaveValue('full-edit-retained');

  // 桌面端不显示移动入口。
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(page.locator('#quickCaptureBtn')).toBeHidden();
  expect(getRealErrors(errors)).toEqual([]);
});

test('GG 多文件导入走解析预览并落库为手牌记录', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.click('[data-tab="review"]');
  // 导入入口位于 Session 子面板
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await expect(page.locator('#ggImportOverlay')).toHaveClass(/is-active/);

  // 两份不同档位的合成 .txt：验证多文件选择器、确定性合并与按块盲注换算
  const fileA = [
    "Poker Hand #E2E100A: Hold'em No Limit ($0.02/$0.05) - 2026/06/01 10:00:00",
    "Table 'E2EA' 9-max Seat #1 is the button",
    'Seat 1: Hero ($5.00 in chips)',
    'Seat 2: Villain ($5.00 in chips)',
    'Villain: posts small blind $0.02',
    'Hero: posts big blind $0.05',
    '*** HOLE CARDS ***',
    'Dealt to Hero [Ah Kh]',
    'Villain: folds',
    'Hero collected $0.07 from pot',
    '*** SUMMARY ***',
  ].join('\n');
  const fileB = [
    "Poker Hand #E2E200B: Hold'em No Limit ($0.05/$0.1) - 2026/06/01 10:05:00",
    "Table 'E2EB' 9-max Seat #1 is the button",
    'Seat 1: Hero ($10.00 in chips)',
    'Seat 2: Villain ($10.00 in chips)',
    'Villain: posts small blind $0.05',
    'Hero: posts big blind $0.10',
    '*** HOLE CARDS ***',
    'Dealt to Hero [As Kd]',
    'Villain: folds',
    'Hero collected $0.15 from pot',
    '*** SUMMARY ***',
  ].join('\n');

  await page.setInputFiles('#ggFileInput', [
    { name: 'e2e-nl5.txt', mimeType: 'text/plain', buffer: Buffer.from(fileA, 'utf8') },
    { name: 'e2e-nl10.txt', mimeType: 'text/plain', buffer: Buffer.from(fileB, 'utf8') },
  ]);

  // 解析预览出现两行新手牌，且各按自己的盲注换算 BB 盈亏
  await expect(page.locator('#ggImportList .gg-import-check')).toHaveCount(2);
  await expect(page.locator('#ggImportList')).toContainText('+0.4 BB');
  await expect(page.locator('#ggImportList')).toContainText('+0.5 BB');

  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');

  // 导入后跳转 Hand 子面板，两条记录均已落库
  await expect(page.locator('[data-sub="hand"]')).toHaveClass(/subnav__btn--active/);
  await expect(page.locator('#handBody tr[data-hand-id]')).toHaveCount(2);
  expect(getRealErrors(errors)).toEqual([]);
});

test('PWA manifest 与图标资源可读取且 Chromium 可解析', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');

  const resourcePaths = [
    './manifest.webmanifest',
    './favicon.ico',
    './apple-touch-icon.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
  ];
  for (const relativePath of resourcePaths) {
    const response = await page.request.get(new URL(relativePath, page.url()).href);
    expect(response.ok(), relativePath + ' should be readable').toBe(true);
    expect((await response.body()).length, relativePath + ' should not be empty').toBeGreaterThan(0);
  }

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  const appManifest = await cdp.send('Page.getAppManifest');
  expect(appManifest.url).toContain('/manifest.webmanifest');
  expect(appManifest.errors).toEqual([]);
  expect(appManifest.data).toBeTruthy();
  const manifest = JSON.parse(appManifest.data);
  expect(manifest.name).toBe("Underwood's Table Agent");
  expect(manifest.short_name).toBe('木下牌桌助手');
  expect(manifest.start_url).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual([
    { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);
  await cdp.detach();

  expect(getRealErrors(errors)).toEqual([]);
});
