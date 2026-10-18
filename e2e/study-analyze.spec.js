import { test, expect } from '@playwright/test';
import { openWorkbenchMode } from './helpers/workbench.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = [{ name: 'desktop', width: 1440, height: 1000, url: '/#safemode' },
  { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844,
  url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });

async function prepare(page, target) {
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_handReviews')) return;
    localStorage.setItem('pa_handReviews', JSON.stringify([
      { id: 'fixture-nine', ggId: 'SYNTHETIC-001', gg: true, date: '2026-10-16', tableMax: 9, heroPosition: 'BTN',
        heroCards: 'Ah Kh', boardCode: 'As7d2c', preflopScenario: 'BTNvsBB', marked: true, pBB: -12,
        desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C',
        actionLineOTF: 'X-B33-C', reflection: '合成测试：核对范围与价格', mistake: '' },
      { id: 'fixture-six', ggId: 'SYNTHETIC-002', gg: true, date: '2026-10-15', tableMax: 6, heroPosition: 'BB',
        heroCards: 'Qh Jh', boardCode: 'Qs8d2c', preflopScenario: 'BTNvsBB', marked: false, pBB: 8,
        desc: 'preflop 行动：BTN R2.5, Hero BB/[Qh Jh] C\nOTF翻牌 Qs 8d 2c 行动：X B33 (1.8bb) C',
        actionLineOTF: 'X-B33-C', mistake: '合成标签', reflection: '<img src=x onerror="window.__unsafe=true">' },
      { id: 'fixture-unknown', ggId: 'SYNTHETIC-003', date: '2026-10-14', heroCards: '2s 2h', pBB: null },
    ]));
  });
  await page.goto(target.url);
  await openWorkbenchMode(page, 'analyze');
}

// [V7.13.0 新增] One actual chain crosses the two new workspaces and the existing quiz route.
for (const target of targets) test('local analysis to study and scoped practice: ' + target.name, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page, target);
  const before = await page.evaluate(() => localStorage.getItem('pa_handReviews'));
  await expect(page.locator('[data-analyze-hand]')).toHaveCount(3);
  await page.locator('[data-analyze-field="profile"]').selectOption('9max');
  await expect(page.locator('[data-analyze-hand]')).toHaveCount(1);
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-analyze-study]').click();
  await expect(page.locator('#studyPanel')).toBeVisible();
  await expect(page.locator('#studyTopicTitle')).toHaveText('翻牌进攻与加注构造');
  await expect(page.locator('.ws-context')).toContainText('SYNTHETIC-001');
  await page.locator('[data-study-return]').click();
  await expect(page.locator('[data-analyze-field="profile"]')).toHaveValue('9max');
  await expect(page.locator('#analyzeHandTitle')).toHaveText('手牌 SYNTHETIC-001');
  await page.locator('[data-analyze-reset]').click();
  await page.locator('[data-analyze-step="1"]').click();
  await expect(page.locator('#analyzeHandTitle')).toHaveText('手牌 SYNTHETIC-002');
  await page.locator('#analyzeDetail > .ws-concept summary').click();
  await expect(page.locator('#analyzeDetail .ws-notes')).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__unsafe)).toBeUndefined();
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-analyze-study]').click();
  await expect(page.locator('#studyTopicTitle')).toHaveText('防守价格与继续范围');
  await page.screenshot({ path: testInfo.outputPath('study-context-' + target.name + '.png'), fullPage: true });
  await page.locator('[data-study-practice]').first().click();
  await expect(page.locator('[data-practice-config=topicId]')).toHaveValue('defense');
  await page.locator('[data-practice-action=start]').click();
  await page.locator('[name=practiceChoice]').first().check();
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback')).toBeVisible();
  await page.locator('[data-practice-action=next]').click();
  await expect(page.locator('.practice-feedback')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pa_handReviews'))).toBe(before);
  expect(errors).toEqual([]);
});

for (const target of targets) test('study board comparisons and empty states: ' + target.name, async ({ page }, testInfo) => {
  await prepare(page, target);
  await openWorkbenchMode(page, 'study');
  await page.locator('[data-study-view="reports"]').click();
  await expect(page.locator('[data-study-board]')).toHaveCount(183);
  await page.locator('[data-study-board="TsTdTc"]').click();
  await expect(page.locator('#studyBoardTitle')).toHaveText('T♠T♦T♣');
  await expect(page.locator('.ws-board-detail')).toContainText('91.5');
  await page.locator('[data-study-pin]').click();
  await page.locator('[data-study-board="TsTd5c"]').click();
  await expect(page.locator('.ws-comparison')).toBeVisible();
  await page.locator('[data-study-field="grouped"]').check();
  await expect(page.locator('.ws-board-detail > .ws-actions > div')).toHaveCount(2);
  await page.locator('[data-study-field="scenario"]').selectOption('SBvsBB');
  await expect(page.locator('.ws-comparison')).toHaveCount(0);
  await page.locator('[data-study-field="category"]').selectOption('monotone');
  const rows = await page.locator('[data-study-board]').count();
  expect(rows).toBeGreaterThan(0);
  expect(rows).toBeLessThan(183);
  await page.locator('[data-study-field="sort"]').selectOption('bet');
  await page.locator('[data-study-board]').first().click();
  await expect(page.locator('.ws-board-detail')).toContainText('已收录牌面的简单平均');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('study-report-' + target.name + '.png'), fullPage: true });
  await page.locator('[data-study-field="query"]').fill('not-a-board');
  await page.locator('[data-study-field="query"]').press('Tab');
  await expect(page.locator('[data-study-board]')).toHaveCount(0);
  await expect(page.locator('.ws-board-detail')).not.toContainText('NaN');
  await page.locator('[data-study-reset]').click();
  await expect(page.locator('[data-study-board]')).toHaveCount(183);
  const backToTopic = page.locator('.ws-board-detail [data-study-view="concepts"]');
  await backToTopic.scrollIntoViewIfNeeded();
  expect(await backToTopic.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
  })).toBe(true);
  await backToTopic.click();
  await expect(page.locator('#studyTopicTitle')).toBeVisible();
});
