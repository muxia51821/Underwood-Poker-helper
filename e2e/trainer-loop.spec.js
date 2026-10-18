import { test, expect } from '@playwright/test';
import { openWorkbenchMode } from './helpers/workbench.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const targets = [{ name: 'desktop', width: 1440, height: 1000, url: '/#safemode' },
  { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844,
  url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
async function prepare(page, target = targets[0]) {
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_handReviews')) return;
    localStorage.setItem('pa_handReviews', JSON.stringify([
      { id: 'trainer-one', ggId: 'SYNTHETIC-TRAINER-1', gg: true, date: '2026-10-01 12:34', tableMax: 9,
        heroPosition: 'BTN', heroCards: 'Ah Kh', boardCode: 'As7d2c', preflopScenario: 'BTNvsBB', pBB: -12, marked: true,
        desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C\nOTT转牌 9s 行动：X X\nOTR河牌 4h 行动：X B50 (3bb) F',
        reflection: 'FUTURE_NOTE', customFact: 'preserve-me' },
      { id: 'trainer-two', ggId: 'SYNTHETIC-TRAINER-2', gg: true, date: '2026-09-30', tableMax: 6,
        heroPosition: 'BB', heroCards: 'Qh Jh', boardCode: 'Qs8d2c', preflopScenario: 'BTNvsBB', pBB: 8, marked: true,
        desc: 'preflop 行动：BTN R2.5, Hero BB/[Qh Jh] C\nOTF翻牌 Qs 8d 2c 行动：X B33 (1.8bb) C', reflection: 'needle' },
    ]));
  });
  await page.goto(target.url);
}

// [V7.14.0 新增] Reproduce the two review findings before changing their implementations.
test('editing reflection preserves imported hand facts', async ({ page }) => {
  await prepare(page);
  await openWorkbenchMode(page, 'analyze');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_handReviews'))[0]);
  await page.locator('[data-analyze-edit]').click();
  await page.locator('[data-decision-reflection]').fill('Updated reflection');
  await page.locator('[data-decision-save]').click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_handReviews')).find(h => h.id === 'trainer-one'));
  for (const key of ['ggId', 'gg', 'date', 'tableMax', 'heroPosition', 'heroCards', 'boardCode', 'pBB', 'marked', 'customFact']) expect(after[key]).toEqual(before[key]);
  expect(after.reflection).toBe('Updated reflection');
});

test('search then direct click keeps the chosen hand and board', async ({ page }) => {
  await prepare(page);
  await openWorkbenchMode(page, 'analyze');
  await page.locator('[data-analyze-field=query]').fill('SYNTHETIC');
  await page.locator('[data-analyze-hand=trainer-two]').click();
  await expect(page.locator('#analyzeHandTitle')).toContainText('SYNTHETIC-TRAINER-2');
  await openWorkbenchMode(page, 'study');
  await page.locator('[data-study-view=reports]').click();
  await page.locator('[data-study-field=query]').fill('Ts');
  await page.locator('[data-study-board=TsTdTc]').click();
  await expect(page.locator('#studyBoardTitle')).toHaveText('T♠T♦T♣');
  await page.locator('[data-study-field=scenario]').focus();
  await page.locator('[data-study-field=scenario]').selectOption('SBvsBB');
  await expect(page.locator('[data-study-field=scenario]')).toBeFocused();
});

for (const target of targets) test('concept preset, draft resume, history and file recovery: ' + target.name, async ({ page, browser }) => {
  await prepare(page, target);
  await openWorkbenchMode(page, 'practice');
  await page.locator('[data-practice-config=topicId]').selectOption('defense');
  await page.locator('[data-practice-config=learningQuestion]').fill('防守价格与后续范围');
  await page.locator('[data-practice-config=name]').fill('我的防守专项');
  await page.locator('[data-practice-action=preset]').click();
  await expect(page.locator('[data-practice-preset]')).toContainText('我的防守专项');
  await page.locator('[data-practice-action=start]').click();
  await page.locator('[name=practiceChoice]').first().check();
  await page.locator('[data-practice-reason]').fill('恢复这句未提交理由');
  await page.reload();
  await openWorkbenchMode(page, 'practice');
  if (await page.locator('[data-practice-action=continue]').count()) await page.locator('[data-practice-action=continue]').click();
  await expect(page.locator('[data-practice-reason]')).toHaveValue('恢复这句未提交理由');
  await expect(page.locator('[name=practiceChoice]').first()).toBeChecked();
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback')).toBeVisible();
  await expect(page.locator('.practice-round .ws-section-heading h3')).toContainText('第 1 /');
  if (!(await page.locator('[data-practice-action=review]').textContent()).includes('已加入')) await page.locator('[data-practice-action=review]').click();
  await page.locator('[data-practice-action=stop]').click();
  await expect(page.locator('#practiceContent')).toContainText('本轮中途结束');
  await expect(page.locator('#practiceContent')).toContainText('待复习 1 题');
  await page.locator('[data-practice-note]').fill('保留一条适用条件');
  await page.evaluate(() => {
    localStorage.setItem('pa_concept_quiz_mastery', '{"legacy":{"asked":2,"correct":1}}');
    localStorage.setItem('pa_concept_quiz_errors', '[{"id":"legacy"}]');
    localStorage.setItem('pa_quizState', '{"scenario":"SBvsBB","records":{"SYNTHETIC":{"cat":"monotone","picks":{"check":2}}},"stageStats":{"monotone":{"ok":1,"fail":1}}}');
  });
  const downloadEvent = page.waitForEvent('download');
  await page.locator('[data-practice-action=export]').click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup.learningState.values.pa_practice_v1).toContain('保留一条适用条件');
  expect(backup.learningState.values.pa_concept_quiz_mastery).toContain('legacy');
  const context = await browser.newContext({ viewport: target });
  try {
    if (target.name === 'offline') await context.setOffline(true);
    const restored = await context.newPage(); await restored.goto(target.url);
    await restored.locator('[data-tab=review]').click();
    await restored.locator('[data-sub=discover]').click();
    await expect(restored.locator('#quizScenario')).toBeVisible();
    await openWorkbenchMode(restored, 'practice');
    await restored.evaluate(() => { window.__beforeRestore = true; });
    await restored.locator('[data-practice-file]').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await restored.locator('[data-backup-action=apply]').click();
    await expect(restored.locator('#backupTitle')).toHaveText('恢复完成');
    await restored.locator('[data-backup-action=close]').click();
    await expect.poll(() => restored.evaluate(() => window.__beforeRestore)).toBeUndefined();
    await restored.locator('[data-tab=review]').click();
    await restored.locator('[data-sub=discover]').click();
    await restored.locator('#quizScenario').selectOption('BTNvsBB');
    const legacyQuiz = await restored.evaluate(() => JSON.parse(localStorage.getItem('pa_quizState')));
    expect(legacyQuiz.records.SYNTHETIC.picks.check).toBe(2);
    expect(legacyQuiz.stageStats.monotone).toEqual({ ok: 1, fail: 1 });
    await openWorkbenchMode(restored, 'practice');
    await expect(restored.locator('[data-practice-preset]')).toContainText('我的防守专项');
    await expect(restored.locator('[data-practice-history]')).toHaveCount(1);
    expect(await restored.evaluate(() => JSON.parse(localStorage.getItem('pa_concept_quiz_mastery')).legacy.asked)).toBe(2);
    await restored.locator('[data-practice-history]').click();
    await expect(restored.locator('[data-practice-note]')).toHaveValue('保留一条适用条件');
    await restored.locator('[data-practice-action=redo]').click();
    await expect(restored.locator('.practice-round .ws-section-heading h3')).toContainText('第 1 / 1');
  } finally { await context.close(); }
});

for (const target of targets) test('range frequency estimation has explicit conditions and no GTO grade: ' + target.name, async ({ page }) => {
  await prepare(page, target);
  await openWorkbenchMode(page, 'study');
  await page.locator('[data-study-view=reports]').click();
  await page.locator('[data-study-board=TsTdTc]').click();
  await expect(page.locator('.ws-board-detail')).toContainText('BTN 进攻方');
  await page.locator('[data-study-range-practice]').click();
  await expect(page.locator('[data-practice-config=category]')).toHaveValue('trips_board');
  await page.locator('[data-practice-config=input]').selectOption('frequency');
  await page.locator('[data-practice-action=start]').click();
  await expect(page.locator('.practice-context')).toContainText('参考决策方 BTN');
  await page.locator('[data-practice-frequency=bet]').fill('50');
  await page.locator('[data-practice-frequency=check]').fill('25');
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('#practiceNotice')).toContainText('100%');
  await page.locator('[data-practice-frequency=check]').fill('50');
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback')).toContainText('个百分点');
  await expect(page.locator('.practice-feedback')).not.toContainText('回答正确');
  await expect(page.locator('.practice-feedback')).not.toContainText('EV 损失');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

for (const target of targets) test('personal single-decision practice hides future facts until submission: ' + target.name, async ({ page }) => {
  await prepare(page, target);
  await openWorkbenchMode(page, 'analyze');
  const before = await page.evaluate(() => localStorage.getItem('pa_handReviews'));
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-replay-action="1"]').click();
  await page.locator('[data-analyze-practice]').click();
  await expect(page.locator('[data-practice-config=handId]')).toHaveValue('trainer-one');
  await page.locator('[data-practice-config=decisionIndex]').selectOption('1');
  await page.locator('[data-practice-config=decisionKind]').selectOption('initiative');
  await page.locator('[data-practice-config=confirmed]').check();
  await page.locator('[data-practice-config=decisionIndex]').selectOption('0');
  await expect(page.locator('[data-practice-config=confirmed]')).not.toBeChecked();
  await page.locator('[data-practice-config=decisionIndex]').selectOption('1');
  await page.locator('[data-practice-config=confirmed]').check();
  await page.locator('[data-practice-config=decisionKind]').selectOption('facingBet');
  await expect(page.locator('[data-practice-config=confirmed]')).not.toBeChecked();
  await page.locator('[data-practice-config=decisionKind]').selectOption('initiative');
  await page.locator('[data-practice-config=confirmed]').check();
  await page.locator('[data-practice-action=start]').click();
  await expect(page.locator('#practiceContent')).not.toContainText('FUTURE_NOTE');
  await expect(page.locator('#practiceContent')).not.toContainText('9♠');
  await expect(page.locator('#practiceContent')).not.toContainText('4♥');
  await expect(page.locator('#practiceContent')).not.toContainText('-12');
  await page.locator('[name=practiceChoice]').first().check();
  await page.locator('[data-practice-reason]').fill('先核对位置与范围，再判断下注目标');
  await page.locator('[data-practice-hypothesis]').fill('这只是我的假设');
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback')).toContainText('FUTURE_NOTE');
  await expect(page.locator('.practice-feedback')).toContainText('9♠');
  await expect(page.locator('.practice-feedback')).toContainText('当时实际行动：');
  await expect(page.locator('.practice-feedback')).toContainText('后续真实行动');
  await expect(page.locator('.practice-feedback')).toContainText('转牌');
  await expect(page.locator('.practice-feedback')).toContainText('河牌');
  await expect(page.locator('.practice-feedback')).toContainText('弃牌');
  await page.locator('[data-practice-action=next]').click();
  await expect(page.locator('#practiceContent')).toContainText('本轮已完成');
  await expect(page.locator('#practiceContent .ws-summary')).not.toContainText('GTO 正确率');
  expect(await page.evaluate(() => localStorage.getItem('pa_handReviews'))).toBe(before);
});
