import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const targets = [{ name: 'desktop', width: 1440, height: 1000, url: '/#safemode' }, { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844, url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
async function prepare(page, target) {
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_handReviews')) return;
    localStorage.setItem('pa_handReviews', JSON.stringify([{ id: 'ux-hand', ggId: 'SYNTHETIC-UX', gg: true, tableMax: 9, date: '2026-10-16', heroPosition: 'BTN', heroCards: 'Ah Kh', boardCode: 'As7d2c', preflopScenario: 'BTNvsBB', pBB: -12, marked: true,
      desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C\nOTT转牌 9s 行动：X X\nOTR河牌 4h 行动：X B50 (3bb) F', reflection: 'original reflection', customFact: 'keep' }]));
  });
  await page.goto(target.url);
  // Works on the old shell too so the original bug fails at the actual behavior.
  if (await page.locator('[data-tab=workbench]').count()) await page.locator('[data-tab=workbench]').click();
  else await page.locator('[data-tab=analyze]').click();
}
for (const target of targets) test('current flop decision survives study, practice and return: ' + target.name, async ({ page }, testInfo) => {
  await prepare(page, target);
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-replay-action="1"]').click();
  await page.locator('[data-decision-kind]').selectOption('initiative');
  await page.locator('[data-decision-question]').fill('为什么在这张翻牌下注？');
  await page.locator('[data-decision-reason]').fill('我的初步判断与范围假设');
  await page.locator('[data-analyze-study]').click();
  await expect(page.locator('#studyTopicTitle')).toHaveText('翻牌进攻与加注构造');
  await expect(page.locator('[data-workbench-context]')).toContainText('为什么在这张翻牌下注？');
  await expect(page.getByRole('button', { name: '回到原决策', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '自由学习', exact: true })).toHaveCount(1);
  await expect(page.locator('[data-workbench-source-details]')).not.toHaveAttribute('open', '');
  await expect(page.locator('#studyWorkspace > .ws-tabs')).toHaveCSS('overflow-x', 'auto');
  await expect(page.locator('#studyWorkspace > .ws-tabs button').first()).toHaveCSS('white-space', 'nowrap');
  await page.screenshot({ path: testInfo.outputPath('study-single-source.png'), fullPage: false });
  await page.locator('[data-workbench-source-details] > summary').click();
  await expect(page.locator('[data-workbench-context]')).toContainText('我的初步判断与范围假设');
  await page.locator('[data-study-practice]').first().click();
  await expect(page.locator('[data-practice-config=learningQuestion]')).toHaveValue('为什么在这张翻牌下注？');
  await page.locator('[data-practice-action=start]').click();
  await page.locator('[name=practiceChoice]').first().check();
  await page.locator('[data-practice-action=submit]').click();
  await page.locator('.practice-feedback [data-practice-action=study]').click();
  await expect(page.locator('[data-workbench-context]')).toContainText('第 2 个动作前');
  await page.locator('[data-study-return]').click();
  await expect(page.locator('#analyzeReplay .replay-step--active')).toHaveText('翻牌');
  await expect(page.locator('[data-replay-action="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-decision-reason]')).toHaveValue('我的初步判断与范围假设');
  await page.locator('[data-decision-insight]').fill('新理解需要限定下注目的与适用条件');
  await page.locator('[data-decision-save]').click();
  const saved = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pa_handReviews'))[0].decisionReviews)[0]);
  expect(saved.insight).toContain('适用条件'); expect(saved.references[0].topicId).toBe('flop');
  await page.reload();
  await page.locator('[data-tab=workbench]').click();
  await expect(page.locator('#analyzeReplay .replay-step--active')).toHaveText('翻牌');
  await expect(page.locator('[data-decision-insight]')).toHaveValue('新理解需要限定下注目的与适用条件');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
for (const target of targets) test('reflection editing stays beside the current hand: ' + target.name, async ({ page }) => {
  await prepare(page, target);
  await page.locator('[data-analyze-edit]').click();
  await expect(page.locator('#analyzePanel')).toBeVisible();
  await page.locator('[data-decision-reflection]').fill('updated in place');
  await page.locator('[data-decision-save]').click();
  const hand = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_handReviews'))[0]);
  expect(hand.reflection).toBe('updated in place');
  expect(hand.customFact).toBe('keep'); expect(hand.pBB).toBe(-12);
});
for (const target of targets) test('quota failure keeps current text and saved notes supersede stale drafts: ' + target.name, async ({ page }) => {
  await prepare(page, target);
  await page.locator('[data-decision-question]').fill('old draft');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'pa_decision_workspace_v1') throw new DOMException('synthetic quota', 'QuotaExceededError'); return original.call(this, key, value); };
  });
  await page.locator('[data-decision-question]').fill('NEW INPUT MUST SURVIVE');
  await page.locator('[data-decision-save]').click();
  await expect(page.locator('[data-decision-question]')).toHaveValue('NEW INPUT MUST SURVIVE');
  expect(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pa_handReviews'))[0].decisionReviews)[0].question)).toBe('NEW INPUT MUST SURVIVE');
  await page.reload(); await page.locator('[data-tab=workbench]').click();
  await expect(page.locator('[data-decision-question]')).toHaveValue('NEW INPUT MUST SURVIVE');
});
test('a stale browser tab cannot write a flop question into another tab turn decision', async ({ page }) => {
  await prepare(page, targets[0]);
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  const other = await page.context().newPage();
  try {
    await other.goto('/#safemode'); await other.locator('[data-tab=workbench]').click();
    await other.locator('#analyzeReplay .replay-step').getByText('转牌', { exact: true }).click();
    await page.locator('[data-decision-question]').fill('FLOP INPUT STAYS WITH FLOP');
    await expect(page.locator('[data-decision-status]')).toContainText('没有写入其他决策');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_decision_workspace_v1')).drafts);
    expect(Object.entries(stored).filter(([key]) => key.includes(':turn:')).some(([, draft]) => draft.question === 'FLOP INPUT STAYS WITH FLOP')).toBe(false);
    await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
    await expect(page.locator('[data-decision-question]')).toHaveValue('FLOP INPUT STAYS WITH FLOP');
  } finally { await other.close(); }
});

for (const target of targets) test('postflop card, blind plan, frozen feedback and resume: ' + target.name, async ({ page, browser }) => {
  await prepare(page, target);
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-replay-action="1"]').click();
  await page.locator('[data-decision-kind]').selectOption('initiative');
  await page.locator('[data-decision-question]').fill('翻牌如何安排后续街道？');
  await page.locator('[data-postflop-conditions] summary').click();
  await page.locator('[data-decision-potBb]').fill('5.5');
  await page.locator('[data-decision-effectiveStackBb]').fill('97.5');
  await page.locator('[data-decision-conditionNote]').fill('核对原牌谱，抽水未确认');
  await page.locator('[data-decision-section=plan] > summary').click();
  await page.locator('[data-decision-rangeHypothesis]').fill('PRIOR_RANGE');
  await page.locator('[data-decision-streetPlan]').fill('PRIOR_PLAN');
  await page.locator('[data-decision-nextStreetPlan]').fill('PRIOR_NEXT');
  await page.locator('[data-decision-reason]').fill('PRIOR_REASON');
  await page.locator('[data-decision-save]').click();
  await page.locator('[data-analyze-study]').click();
  await expect(page.locator('[data-workbench-context]')).toContainText('5.50bb');
  await page.locator('[data-workbench-source-details] > summary').click();
  await page.locator('[data-workbench-context] summary').filter({ hasText: '我的翻后计划' }).click();
  await expect(page.locator('[data-workbench-context]')).toContainText('PRIOR_NEXT');
  await page.locator('[data-study-return]').click();
  await page.locator('[data-analyze-practice]').click();
  await expect(page.locator('#decisionWorkbench')).not.toContainText('PRIOR_PLAN');
  await page.locator('[data-practice-config=confirmed]').check();
  await page.locator('[data-practice-action=start]').click();
  const visible = await page.locator('#practicePanel').textContent();
  expect(visible).not.toContain('PRIOR_'); expect(visible).not.toContain('9s');
  await expect(page.locator('.practice-context')).toContainText('97.50bb');
  await page.locator('[name=practiceChoice]').first().check();
  await page.locator('[data-practice-reason]').fill('先看范围与下注目的');
  await page.locator('[data-practice-next-plan]').fill('NEW_PLAN');
  await page.reload(); await page.locator('[data-tab=workbench]').click();
  await page.locator('#decisionWorkbench [data-tab=practice]').click();
  await expect(page.locator('[data-practice-next-plan]')).toHaveValue('NEW_PLAN');
  await expect(page.locator('#decisionWorkbench')).not.toContainText('PRIOR_PLAN');
  await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback')).toContainText('PRIOR_PLAN');
  await expect(page.locator('.practice-feedback')).toContainText('NEW_PLAN');
  await page.locator('[data-practice-action=next]').click();
  await page.locator('#decisionWorkbench [data-tab=analyze]').click();
  await page.locator('#analyzeReplay .replay-step').getByText('转牌', { exact: true }).click();
  await page.locator('[data-postflop-resume] summary').click();
  await page.locator('[data-postflop-hand="ux-hand"]').click();
  await expect(page.locator('#analyzeReplay .replay-step--active')).toHaveText('翻牌');
  await expect(page.locator('[data-decision-kind]')).toHaveValue('initiative');
  await expect(page.locator('[data-decision-nextStreetPlan]')).toHaveValue('PRIOR_NEXT');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // New edits must not change the plan bound to an earlier exercise.
  await page.locator('[data-decision-nextStreetPlan]').fill('MODIFIED_LATER');
  await page.locator('[data-decision-save]').click();
  await page.locator('#decisionWorkbench [data-tab=practice]').click();
  await page.locator('[data-practice-history]').first().click();
  await page.locator('#practiceContent details summary').first().click();
  await expect(page.locator('.practice-feedback')).toContainText('PRIOR_NEXT');
  await expect(page.locator('.practice-feedback')).not.toContainText('MODIFIED_LATER');
  if (target.name === 'desktop') {
    const download = page.waitForEvent('download');
    await page.locator('[data-practice-action=export]').click();
    const backup = await readFile(await (await download).path(), 'utf8');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    try {
      const restored = await context.newPage(); await restored.goto(page.url());
      await restored.locator('#settingsBtn').click(); await restored.locator('#backupSettingsBtn').click();
      await restored.locator('[data-backup-file]').setInputFiles({ name: 'postflop-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
      await expect(restored.locator('#backupTitle')).toHaveText('恢复预览');
      await restored.locator('[data-backup-action=apply]').click();
      await expect(restored.locator('#backupTitle')).toHaveText('恢复完成');
      await restored.locator('[data-backup-action=close]').click();
      await restored.reload(); await restored.locator('[data-tab=workbench]').click();
      await expect(restored.locator('[data-decision-nextStreetPlan]')).toHaveValue('MODIFIED_LATER');
      await restored.locator('#decisionWorkbench [data-tab=practice]').click();
      await restored.locator('[data-practice-history]').first().click();
      await restored.locator('#practiceContent details summary').first().click();
      await expect(restored.locator('.practice-feedback')).toContainText('PRIOR_NEXT');
      await expect(restored.locator('.practice-feedback')).toContainText('NEW_PLAN');
    } finally { await context.close(); }
  }
});
