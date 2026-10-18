import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { openWorkbenchMode } from './helpers/workbench.js';

const variants = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }];
if (process.env.E2E_OUT_DIR) variants.push({ name: 'offline file', width: 390, height: 844, file: true });
async function openCourse(page) {
  await openWorkbenchMode(page, 'study'); await page.locator('[data-study-view=course]').click();
}
for (const v of variants) test('turn to river course preserves the plan and frozen research feedback: ' + v.name, async ({ page }) => {
  await page.setViewportSize(v); await page.addInitScript(() => { Math.random = () => 0; });
  if (v.file) await page.context().setOffline(true);
  await page.goto(v.file ? pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' : '/#safemode');
  await openCourse(page);
  const lesson = page.locator('[data-course]');
  await expect(lesson).toContainText('研究样例 · 数据待核验');
  await expect(lesson.locator('[data-course-action=start]')).toHaveCount(6);
  await page.screenshot({ path: test.info().outputPath('course-start.png'), fullPage: true });
  await lesson.locator('[data-course-hand=AhQh]').click();
  await expect(lesson.locator('[data-course-feedback]')).toHaveCount(0);
  await lesson.locator('[data-course-draft=reason]').fill('SYNTHETIC reason');
  await lesson.locator('[data-course-draft=plan]').fill('SYNTHETIC river plan');
  await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pa_decision_workspace_v1')).turnRiverCourses)[0].rounds[0].responses.root?.plan)).toBe('SYNTHETIC river plan');
  await page.reload(); await openCourse(page);
  await expect(lesson.locator('[data-course-draft=plan]')).toHaveValue('SYNTHETIC river plan');
  await lesson.locator('[name=courseChoice][value=check]').check();
  await lesson.locator('[data-course-action=submit]').click();
  await expect(lesson.locator('[data-course-feedback]')).toContainText('当前节点的参考数据');
  await expect(lesson.locator('[data-course-feedback]')).toContainText('参考频率');
  await lesson.locator('[data-course-action=next]').click();
  await expect(lesson.locator('[data-course-question]')).toContainText('河牌：现在还按原计划行动吗');
  await expect(lesson.locator('.course-prior')).toContainText('SYNTHETIC river plan');
  await expect(lesson.locator('[data-course-feedback]')).toHaveCount(0);
  await lesson.locator('[data-course-draft=reason]').fill('SYNTHETIC river reasoning');
  await lesson.locator('[name=courseChoice][value=check]').check();
  await lesson.locator('[data-course-action=submit]').click();
  await lesson.locator('[data-course-action=next]').click();
  await expect(lesson.locator('[data-course-summary]')).toContainText('SYNTHETIC river reasoning');
  await lesson.locator('[data-course-draft=summary]').fill('SYNTHETIC takeaway');
  await page.reload(); await openCourse(page);
  await expect(lesson.locator('[data-course-draft=summary]')).toHaveValue('SYNTHETIC takeaway');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('course-summary.png'), fullPage: true });
  await lesson.locator('[data-course-action=repeat]').click();
  await expect(lesson.locator('[data-course-feedback]')).toHaveCount(0);
  await expect(lesson.locator('[data-course-draft=plan]')).toHaveValue('');
  await lesson.locator('.course-ranges summary').first().click();
  await expect(lesson.locator('.course-matrix').first()).toBeVisible();
});

test('course quota failure keeps visible judgment and complete backup restores the active round', async ({ page, browser }) => {
  await page.goto('/#safemode'); await openCourse(page);
  await page.locator('[data-course-hand=AhQh]').click();
  await page.locator('[data-course-draft=reason]').fill('BACKUP synthetic reason');
  await expect.poll(() => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('pa_decision_workspace_v1')).turnRiverCourses)[0].rounds[0].responses.root?.reason)).toBe('BACKUP synthetic reason');
  await openWorkbenchMode(page, 'practice');
  const download = page.waitForEvent('download'); await page.locator('[data-practice-action=export]').click();
  const bytes = await readFile(await (await download).path());
  const context = await browser.newContext();
  try {
    const restored = await context.newPage(); await restored.goto('/#safemode'); await openWorkbenchMode(restored, 'practice');
    await restored.locator('[data-practice-file]').setInputFiles({ name: 'course-backup.json', mimeType: 'application/json', buffer: bytes });
    await restored.locator('[data-backup-action=apply]').click();
    await expect(restored.locator('#backupTitle')).toHaveText('恢复完成');
    await Promise.all([restored.waitForEvent('load'), restored.locator('[data-backup-action=close]').click()]);
    await openCourse(restored);
    await expect(restored.locator('[data-course-draft=reason]')).toHaveValue('BACKUP synthetic reason');
    const before = await restored.evaluate(() => localStorage.getItem('pa_decision_workspace_v1'));
    await restored.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'pa_decision_workspace_v1') throw new DOMException('quota', 'QuotaExceededError'); return original.call(this, k, v); }; });
    await restored.locator('[data-course-draft=plan]').fill('UNSAVED plan');
    await restored.locator('[name=courseChoice][value=check]').check();
    await restored.locator('[data-course-action=submit]').click();
    await expect(restored.locator('[data-course-notice]')).toContainText('尚未保存');
    await expect(restored.locator('[data-course-draft=plan]')).toHaveValue('UNSAVED plan');
    await expect(restored.locator('[data-course-feedback]')).toHaveCount(0);
    expect(await restored.evaluate(() => localStorage.getItem('pa_decision_workspace_v1'))).toBe(before);
  } finally { await context.close(); }
});
