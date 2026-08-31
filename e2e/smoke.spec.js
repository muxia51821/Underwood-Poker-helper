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
  for (const sub of ['hand', 'session', 'discover', 'strategy', 'weekly', 'total', 'opponent']) {
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
    for (const sub of ['hand', 'session', 'discover', 'strategy', 'weekly', 'total', 'opponent']) {
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

test('GTO 基线只显示结构性参考，并安全渲染手工来源', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="strategy"]');
  await expect(page.locator('#gtoBaselineList')).toContainText('结构性参考');
  await expect(page.locator('#gtoBaselineList')).not.toContainText('与 Spot 差');
  await expect(page.locator('#gtoBaselineList')).toContainText('来源：');
  await expect(page.locator('#gtoBaselineList')).toContainText('边界：');

  await page.click('#addGtoBaselineBtn');
  await page.fill('#gtoStackBB', '100');
  await page.fill('#gtoGame', '<img src=x onerror=alert(1)>');
  await page.fill('#gtoSourceTitle', 'manual <img src=x onerror=alert(1)>');
  await page.fill('#gtoSourceUrl', 'javascript:alert(1)');
  await page.fill('#gtoBoundary', '<b>boundary</b>');
  await page.click('#saveGtoBaselineBtn');

  const manualCard = page.locator('#gtoBaselineList [data-gto-id]').filter({ hasText: 'manual <img src=x onerror=alert(1)>' });
  await expect(manualCard).toHaveCount(1);
  await expect(manualCard.locator('img')).toHaveCount(0);
  await expect(manualCard.locator('a')).toHaveCount(0);
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

  // 成功保存后回到来源 Tab；快速记录现在是 Mark，不产生手牌行。
  await page.click('#quickCaptureBtn');
  await page.fill('#handDesc', quickNote);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.click('#saveHandBtn');
  await expect(page.locator('[data-tab="timer"]')).toHaveClass(/nav__btn--active/);
  await expect(page.locator('#handDetailPane')).not.toHaveClass(/is-quick-capture/);
  await expect(page.locator('body')).not.toHaveClass(/quick-capture-open/);
  await expect(page.locator('#toast')).toHaveText('已记录 Mark，收尾时在 Session 中匹配手牌');

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="hand"]');
  await expect(page.locator('#handDesc')).toHaveValue(draftBeforeQuick);
  await expect(page.locator('#handBody tr[data-hand-id]')).toHaveCount(0);

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
  // 连续时间窗口内切换级别仍是一场，级别列显示场内构成。
  await page.click('[data-sub="session"]');
  await expect(page.locator('#sessionBody tr')).toHaveCount(1);
  await expect(page.locator('#sessionBody')).toContainText('NL5 + NL10');
  expect(getRealErrors(errors)).toEqual([]);
});

test('Session 收尾闭环：Mark 匹配、候选复盘与确认收尾', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');

  // 两手"刚刚"的合成手牌（解析器按 UTC+8 换算，故文本时间 = 目标本地时间 - 8h）
  const mk = (offsetMin, id) => {
    const target = new Date(Date.now() - offsetMin * 60000);
    const text = new Date(target.getTime() - (new Date().getTimezoneOffset() + 480) * 60000);
    const p = (n) => String(n).padStart(2, '0');
    const ymd = `${text.getUTCFullYear()}/${p(text.getUTCMonth() + 1)}/${p(text.getUTCDate())}`;
    const hm = `${p(text.getUTCHours())}:${p(text.getUTCMinutes())}:${p(text.getUTCSeconds())}`;
    return [
      `Poker Hand #CL${id}: Hold'em No Limit ($0.02/$0.05) - ${ymd} ${hm}`,
      `Table 'CL' 9-max Seat #1 is the button`,
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
  };
  const txt = mk(3, 'A') + '\n\n' + mk(2, 'B');

  // 导入两手（自动建场）
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', txt);
  await page.click('#ggParseBtn');
  await page.waitForFunction(
    () => document.querySelectorAll('.gg-import-check').length >= 2,
    undefined,
    { polling: 200 }
  );
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await expect(page.locator('[data-sub="hand"]')).toHaveClass(/subnav__btn--active/);
  await page.click('[data-sub="session"]');

  // 桌面端 Mark 入口（Session 面板内）→ 保存 Mark
  await page.click('#quickMarkBtn');
  await expect(page.locator('#handDetailPane')).toHaveClass(/is-quick-capture/);
  await page.fill('#handDesc', 'closure-e2e-mark');
  await page.click('#saveHandBtn');
  await expect(page.locator('#toast')).toHaveText('已记录 Mark，收尾时在 Session 中匹配手牌');
  await expect(page.locator('#closurePendingCount')).toHaveText('1 场待收尾');

  // 展开该场收尾工作区
  const row = page.locator('#sessionBody tr').filter({ hasText: '未收尾' }).first();
  await row.locator('[data-closure-sid]').click();
  const workspace = page.locator('[data-closure-session]').first();
  await expect(workspace).toBeVisible();

  // Mark 匹配：确认关联（关联后出现"取消关联"）
  await workspace.locator('[data-mark-match]').first().click();
  await expect(workspace.locator('[data-mark-reopen]').first()).toBeVisible();

  // 候选复盘：标为已看
  await workspace.locator('[data-cand-review]').first().click();
  await expect(workspace.locator('[data-cand-review]').first()).toContainText('已看');

  // 确认收尾
  await page.click('[data-closure-confirm]');
  await expect(page.locator('#toast')).toHaveText('本场已收尾');
  await expect(page.locator('#closurePendingCount')).toHaveText('无待收尾');
  expect(getRealErrors(errors)).toEqual([]);
});

test('Decision Radar：Spot 信号、建档与重载持久化', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');

  // 50 手合成 BTNvsBB：10 手三连张面全 C-bet、10 手 monotone 面全 C-bet、30 手干燥面过牌到底
  // → 专项 GTO 参考应匹配对应 Signal（V7.10.8 起含 Mechanics monotone 条目）。
  const hands = [];
  for (let i = 0; i < 50; i++) {
    const flop = i < 10
      ? '*** FLOP *** [9h 8d 7c]\nVillain: checks\nHero: bets $0.18\nVillain: folds\nUncalled bet ($0.18) returned to Hero\nHero collected $0.30 from pot'
      : (i < 20
        ? '*** FLOP *** [Qh Jh 7h]\nVillain: checks\nHero: bets $0.18\nVillain: folds\nUncalled bet ($0.18) returned to Hero\nHero collected $0.30 from pot'
        : '*** FLOP *** [As Kd 2c]\nVillain: checks\nHero: checks\nVillain: checks');
    hands.push([
      `Poker Hand #R2D${String(i).padStart(3, '0')}: Hold'em No Limit ($0.02/$0.05) - 2026/07/01 20:00:00`,
      `Table 'R2D' 2-max Seat #1 is the button`,
      'Seat 1: Hero ($5.00 in chips)',
      'Seat 2: Villain ($5.00 in chips)',
      'Hero: posts small blind $0.02',
      'Villain: posts big blind $0.05',
      '*** HOLE CARDS ***',
      'Dealt to Hero [As Kd]',
      'Hero: raises $0.10 to $0.15',
      'Villain: calls $0.10',
      flop,
      '*** SUMMARY ***',
    ].join('\n'));
  }

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', hands.join('\n\n'));
  await page.click('#ggParseBtn');
  await page.waitForFunction(
    () => document.querySelectorAll('.gg-import-check').length >= 50,
    undefined,
    { polling: 200 }
  );
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.click('[data-sub="discover"]');

  const radarCard = page.locator('#discoverRadarCard');
  await expect(radarCard).toBeVisible();
  const signalCard = radarCard.locator('.finding-card--radar').filter({ hasText: 'made_straight' }).first();
  await expect(signalCard).toContainText('C-Bet');
  await expect(signalCard).toContainText('GTO 结构性参考');

  // [V7.10.8 新增] monotone 信号卡应命中 Mechanics 单牌面条目（来源标题可见）。
  const monoCard = radarCard.locator('.finding-card--radar').filter({ hasText: 'monotone' }).first();
  await expect(monoCard).toContainText('C-Bet');
  await expect(monoCard).toContainText('GTO 结构性参考');
  await expect(monoCard).toContainText('Mechanics of C-Bet Sizing');

  // 条件匹配 MDA 需要明确写入完整 Spot；泛化证据不能自动进入 Radar。
  await page.click('[data-sub="strategy"]');
  await page.click('#addEvidenceBtn');
  await page.fill('#evTitle', 'e2e direct MDA');
  await page.selectOption('#evSourceType', 'mda');
  await page.selectOption('#evEvidenceLevel', 'conditional');
  await page.fill('#evSourceRef', 'https://example.com/e2e-mda');
  await page.fill('#evConditions', '6max Cash 100bb；BTN vs BB；翻牌三连张面');
  await page.fill('#evMethodSample', 'e2e only');
  await page.fill('#evTransferBoundary', 'e2e only');
  await page.locator('#evidenceEditor details summary').click();
  await page.selectOption('#evScenario', 'BTNvsBB');
  await page.selectOption('#evQuestion', 'cbet');
  await page.selectOption('#evBoardCategory', 'made_straight');
  await page.click('#saveEvidenceBtn');
  await expect(page.locator('#toast')).toHaveText('证据包已保存');
  await page.click('[data-sub="discover"]');
  await expect(signalCard).toContainText('MDA 条件匹配');
  await expect(signalCard).toContainText('e2e direct MDA');

  // 建档研究：填假设并保存
  await signalCard.locator('[data-radar-dossier]').click();
  const editor = page.locator('[data-radar-editor]').first();
  await editor.locator('[data-dossier-field="hypothesis"]').fill('e2e-hypothesis');
  await editor.locator('[data-radar-save]').click();
  await expect(page.locator('#toast')).toHaveText('Dossier 已保存');
  await expect(radarCard.locator('.status-inline--success').first()).toBeVisible();

  // 重载后 Dossier 持久化
  await page.reload();
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="discover"]');
  await expect(page.locator('#discoverRadarCard .status-inline--success').first()).toBeVisible();
  await page.locator('#discoverRadarCard [data-radar-dossier]').first().click();
  await expect(page.locator('[data-dossier-field="hypothesis"]')).toHaveValue('e2e-hypothesis');
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

test('手牌回放只读可视化与降级视图', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  // 四街 + 摊牌合成手牌（与契约测试同构）
  const block = [
    "Poker Hand #E2E900: Hold'em No Limit ($0.02/$0.05) - 2026/06/01 10:00:00",
    "Table 'NLH' 6-max Seat #1 is the button",
    'Seat 1: Hero ($5.00 in chips)',
    'Seat 2: Villain ($5.00 in chips)',
    'Hero: posts small blind $0.02',
    'Villain: posts big blind $0.05',
    '*** HOLE CARDS ***',
    'Dealt to Hero [Ah Kd]',
    'Villain: raises $0.10 to $0.15',
    'Hero: calls $0.10',
    '*** FLOP *** [Ah 7c 2d]',
    'Hero: checks',
    'Villain: bets $0.16',
    'Hero: calls $0.16',
    '*** TURN *** [Qs]',
    'Hero: checks',
    'Villain: bets $0.25',
    'Hero: calls $0.25',
    '*** RIVER *** [3h]',
    'Hero: checks',
    'Villain: bets $0.50',
    'Hero: calls $0.50',
    'Hero shows [Ah Kd] (one pair)',
    'Villain: shows [Qh Jh] (flush)',
    '*** SHOWDOWN ***',
    'Villain collected $1.84 from pot',
    '*** SUMMARY ***',
    'Total pot $1.84 | Rake $0.02',
    'Board [Ah 7c 2d Qs 3h]',
    'Seat 2: Villain ($5.13 in chips) showed [Qh Jh] and won ($1.84) with (a flush)',
  ].join('\n');
  await page.setInputFiles('#ggFileInput', [
    { name: 'replay-e2e.txt', mimeType: 'text/plain', buffer: Buffer.from(block, 'utf8') },
  ]);
  await expect(page.locator('#ggImportList .gg-import-check')).toHaveCount(1);
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await expect(page.locator('[data-sub="hand"]')).toHaveClass(/subnav__btn--active/);

  // 展开首行并打开回放：分步条 → 公共牌随街累积 3→4→5
  const firstRow = page.locator('#handBody tr[data-hand-id]').first();
  await firstRow.locator('[data-hand-expand]').click();
  const expandRow = page.locator('tr[id^="hand-expand-row"]').first();
  await expandRow.locator('[data-hand-replay]').click();
  const replay = page.locator('.hand-replay').first();
  await expect(replay).toBeVisible();
  const boardBadges = replay.locator('.replay-board .card-badge');
  await expect(boardBadges).toHaveCount(0);  // 翻前无公共牌
  await replay.getByRole('button', { name: '翻牌', exact: true }).click();
  await expect(boardBadges).toHaveCount(3);
  await replay.getByRole('button', { name: '转牌', exact: true }).click();
  await expect(boardBadges).toHaveCount(4);
  await replay.getByRole('button', { name: '河牌', exact: true }).click();
  await expect(boardBadges).toHaveCount(5);
  await replay.getByRole('button', { name: '结果', exact: true }).click();
  await expect(replay.locator('.replay-showdown__row')).toHaveCount(2);  // Hero 摊牌 + 对手摊牌
  await expect(replay.locator('.replay-result')).toContainText('盈亏');
  // 全街回顾静态可见 + 桌面无横向溢出
  await expect(replay.locator('.replay-review__row')).toHaveCount(7);
  const overflow = await page.evaluate(function () {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);

  // 手工记录 → 降级视图不报错
  await page.fill('#handDesc', '翻前拿AK在CO加注被大盲 3bet 后弃牌。回放降级测试手工标记：仅自由文本。');
  await page.click('#saveHandBtn');
  const dataRows = page.locator('#handBody tr[data-hand-id]');
  const rowCount = await dataRows.count();
  let degradedOpen = false;
  for (let i = 0; i < rowCount && !degradedOpen; i++) {
    await dataRows.nth(i).locator('[data-hand-expand]').click();
    const markerRow = page.locator('tr[id^="hand-expand-row"]', { hasText: '回放降级测试手工标记' });
    if ((await markerRow.count()) > 0) {
      await markerRow.locator('[data-hand-replay]').click();
      await expect(page.locator('.replay-degraded__banner')).toBeVisible();
      degradedOpen = true;
    } else {
      await dataRows.nth(i).locator('[data-hand-expand]').click();  // 收起，试下一行
    }
  }
  expect(degradedOpen).toBe(true);
  expect(getRealErrors(errors)).toEqual([]);
});

test('策略生成训练单元并跳转 Quiz（BTNvsBB）', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  const hand = [
    "Poker Hand #ST43A: Hold'em No Limit ($0.02/$0.05) - 2026/07/02 20:00:00",
    `Table 'ST43' 2-max Seat #1 is the button`,
    'Seat 1: Hero ($5.00 in chips)',
    'Seat 2: Villain ($5.00 in chips)',
    'Hero: posts small blind $0.02',
    'Villain: posts big blind $0.05',
    '*** HOLE CARDS ***',
    'Dealt to Hero [As Kd]',
    'Hero: raises $0.10 to $0.15',
    'Villain: calls $0.10',
    '*** FLOP *** [Ah Th 9h]',
    'Villain: checks',
    'Hero: bets $0.18',
    'Villain: folds',
    'Uncalled bet ($0.18) returned to Hero',
    'Hero collected $0.30 from pot',
    '*** SUMMARY ***',
  ].join('\n');

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', hand);
  await page.click('#ggParseBtn');
  await page.waitForFunction(() => document.querySelectorAll('.gg-import-check').length >= 1, undefined, { polling: 200 });
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 60000 });

  // 新建策略修订（BTNvsBB|flop → 有 gtoRaw 数据 → 应生成 Quiz 型单元）
  await page.click('[data-sub="strategy"]');
  await page.fill('#stratTitle', 'e2e-strategy-unit');
  await page.fill('#stratFamily', 'BTNvsBB|flop');
  await page.click('#saveStrategyBtn');
  await expect(page.locator('#strategyList')).toContainText('e2e-strategy-unit');
  await page.click('[data-strategy-unit]');
  await expect(page.locator('#toast')).toHaveText('已生成 Quiz 训练单元');

  // 去 Quiz：Discover 面板场景自动选中 BTNvsBB
  await page.click('[data-unit-quiz]');
  await expect(page.locator('[data-sub="discover"]')).toHaveClass(/subnav__btn--active/);
  await expect(page.locator('#quizScenario')).toHaveValue('BTNvsBB');
  expect(getRealErrors(errors)).toEqual([]);
});

test('对手观察笔记与 Live 开关持久化', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  const hand = [
    "Poker Hand #OP43A: Hold'em No Limit ($0.02/$0.05) - 2026/07/02 21:00:00",
    `Table 'OP43' 2-max Seat #1 is the button`,
    'Seat 1: Hero ($5.00 in chips)',
    'Seat 2: OppFish99 ($5.00 in chips)',
    'Hero: posts small blind $0.02',
    'OppFish99: posts big blind $0.05',
    '*** HOLE CARDS ***',
    'Dealt to Hero [Ah Kh]',
    'OppFish99: checks',
    'Hero: checks',
    '*** SUMMARY ***',
  ].join('\n');

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', hand);
  await page.click('#ggParseBtn');
  await page.waitForFunction(() => document.querySelectorAll('.gg-import-check').length >= 1, undefined, { polling: 200 });
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 60000 });

  // 对手面板：添加观察笔记 + 切 Live
  await page.click('[data-sub="opponent"]');
  const oppRow = page.locator('.opponent-row').first();
  await oppRow.locator('[data-opp-note]').click();
  const notePanel = page.locator('[id^="opp-notes-"]').first();
  await notePanel.waitFor({ state: 'visible' });
  await notePanel.locator('input[id^="opp-note-input-"]').fill('e2e-opp-note');
  await notePanel.locator('[data-opp-note-add]').click();
  await expect(page.locator('body')).toContainText('e2e-opp-note');
  await oppRow.locator('[data-opp-live]').click();
  await expect(oppRow).toContainText('LIVE');

  // 重载后笔记与 Live 保持
  await page.reload();
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="opponent"]');
  const rowAfter = page.locator('.opponent-row').first();
  await rowAfter.locator('[data-opp-note]').click();
  await expect(page.locator('body')).toContainText('e2e-opp-note');
  await expect(rowAfter).toContainText('LIVE');
  expect(getRealErrors(errors)).toEqual([]);
});

test('连续窗口自动续接与指定 Session 导入的聚合持久化', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  const mk = (id, day, time) => [
    `Poker Hand #SP${id}: Hold'em No Limit ($0.05/$0.1) - 2026/06/${day} ${time}:00`,
    `Table 'SP${id}' 2-max Seat #1 is the button`,
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

  // 路径 A：第一次自动导入创建有精确时间窗口的 Session。
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', mk('A0', '01', '09:30'));
  await page.click('#ggParseBtn');
  await page.waitForFunction(() => document.querySelectorAll('.gg-import-check').length >= 1, undefined, { polling: 200 });
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 60000 });

  // 同一连续窗口的下一手自动续接，重载前统计为 2 手。
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await page.fill('#ggImportText', mk('A1', '01', '10:00'));
  await page.click('#ggParseBtn');
  await page.waitForFunction(() => document.querySelectorAll('.gg-import-check').length >= 1, undefined, { polling: 200 });
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 60000 });

  await page.click('[data-sub="session"]');
  const autoRow = page.locator('#sessionBody tr').filter({ hasText: '2026-06-01' }).first();
  await expect(autoRow.locator('td').nth(3)).toHaveText('2');

  // 路径 B：手工 Session 不猜测时间范围，只能明确指定导入目标。
  await page.fill('#sessDate', '2026-06-02');
  await page.fill('#sessLevel', 'NL10');
  await page.fill('#sessDur', '1');
  await page.fill('#sessHands', '1');
  await page.fill('#sessProfit', '0');
  await page.click('#addSessionBtn');

  // 指定 s2 行 📥 → 06-02 的 1 手。
  const s2row = page.locator('#sessionBody tr').filter({ hasText: '2026-06-02' }).first();
  await s2row.locator('[data-import-sid]').click();
  await page.fill('#ggImportText', mk('B1', '02', '10:00'));
  await page.click('#ggParseBtn');
  await page.waitForFunction(() => document.querySelectorAll('.gg-import-check').length >= 1, undefined, { polling: 200 });
  await page.click('.gg-sel-all-btn');
  await page.click('#ggImportSelectedBtn');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 60000 });

  await page.click('[data-sub="session"]');
  const s2rowAfter = page.locator('#sessionBody tr').filter({ hasText: '2026-06-02' }).first();
  await expect(s2rowAfter.locator('td').nth(3)).toHaveText('2');

  // 重载后两条正确路径的 Session 聚合均持久化。
  await page.reload();
  await page.waitForSelector('.version-tag');
  await page.waitForFunction(
    () => ((document.getElementById('storageHealth') || { getAttribute: () => '' }).getAttribute('title') || '').indexOf('手牌') !== -1,
    undefined,
    { polling: 500 }
  );
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await expect(page.locator('#sessionBody tr').filter({ hasText: '2026-06-01' }).first().locator('td').nth(3)).toHaveText('2');
  await expect(page.locator('#sessionBody tr').filter({ hasText: '2026-06-02' }).first().locator('td').nth(3)).toHaveText('2');
  expect(getRealErrors(errors)).toEqual([]);
});

test('大批量导入模式：汇总预览、免勾选、导入全部新手牌', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  await page.goto('/');
  const mk = (id) => [
    `Poker Hand #${id}: Hold'em No Limit ($0.02/$0.05) - 2026/07/05 20:00:00`,
    `Table 'LB' 2-max Seat #1 is the button`,
    'Seat 1: Hero ($5.00 in chips)',
    'Seat 2: Villain ($5.00 in chips)',
    'Villain: posts small blind $0.02',
    'Hero: posts big blind $0.05',
    '*** HOLE CARDS ***',
    'Dealt to Hero [As Kd]',
    'Villain: folds',
    'Hero collected $0.07 from pot',
    '*** SUMMARY ***',
  ].join('\n');
  const hands = [];
  for (let i = 0; i < 500; i++) hands.push(mk('LB' + String(i).padStart(3, '0')));
  hands.push(mk('LB000'));  // 同批重复 ×2
  hands.push(mk('LB001'));

  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  // 500 手文本通过 DOM 赋值注入；逐字 fill 会让测试工具本身耗尽 30 秒，而非覆盖导入逻辑。
  await page.locator('#ggImportText').evaluate((el, value) => { el.value = value; }, hands.join('\n\n'));
  await page.click('#ggParseBtn');
  await page.waitForFunction(
    () => document.getElementById('ggImportList').textContent.includes('成功解析 502 手'),
    undefined,
    { polling: 200 }
  );

  // 大批量模式：无逐手勾选 DOM，代表样本 ≤ 100
  const checkCount = await page.evaluate(() => document.querySelectorAll('.gg-import-check').length);
  expect(checkCount).toBe(0);
  const sampleCount = await page.evaluate(() => document.querySelectorAll('.gg-sample-row').length);
  expect(sampleCount).toBeLessThanOrEqual(100);
  await expect(page.locator('#ggImportList')).toContainText('已省略其余');

  // 导入全部新手牌（排除 2 手重复）→ 落库确认后提示
  await page.click('#ggImportAllBtn');
  await expect(page.locator('#toast')).toContainText('成功导入 500 手牌');
  await page.waitForSelector('#handBody tr[data-hand-id]', { timeout: 120000 });

  // 重载持久化
  await page.reload();
  await page.waitForSelector('.version-tag');
  await page.waitForFunction(
    () => ((document.getElementById('storageHealth') || { getAttribute: () => '' }).getAttribute('title') || '').indexOf('500手牌') !== -1,
    undefined,
    { polling: 500 }
  );
  expect(getRealErrors(errors)).toEqual([]);
});
