import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = [{ name: 'desktop', width: 1440, height: 1000, url: '/#safemode' }, { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844, url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
for (const target of targets) test('finish play, match a mark, review, return and close the session: ' + target.name, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_sessions')) return;
    localStorage.setItem('pa_sessions', JSON.stringify([{ id: 'closure-session', date: '2026-10-16', level: 'Synthetic', duration: 1, hands: 1, profit: -12 }]));
    localStorage.setItem('pa_handReviews', JSON.stringify([{ id: 'closure-hand', sessionId: 'closure-session', ggId: 'SYNTHETIC-CLOSURE', date: '2026-10-16 10:00', tableMax: 9,
      heroPosition: 'BTN', heroCards: 'Ah Kh', boardCode: 'As7d2c', preflopScenario: 'BTNvsBB', pBB: -12, marked: true,
      desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C' }]));
    localStorage.setItem('pa_marks', JSON.stringify([{ id: 'closure-mark', sessionId: 'closure-session', time: '2026-10-16 10:00', status: 'open', note: 'Synthetic question' }]));
  });
  await page.goto(target.url);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_handReviews'))[0]);
  await page.locator('#startBtn').click(); await page.locator('#finishPlayBtn').click();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_timerState')).status)).toBe('paused');
  await page.locator('[data-closeout-session=closure-session]').click();
  await page.locator('[data-closure-note]').fill('下一次研究这个翻牌决策');
  await expect(page.locator('[data-closure-note-status]')).toContainText('已保存');
  await page.locator('[data-mark-match]').click();
  await page.locator('[data-cand-view=closure-hand]').click();
  await expect(page.locator('#analyzeHandTitle')).toContainText('SYNTHETIC-CLOSURE');
  await page.locator('[data-analyze-return-session]').click();
  await expect(page.locator('[data-closure-note]')).toHaveValue('下一次研究这个翻牌决策');
  await page.locator('[data-cand-review=closure-hand]').click();
  await page.locator('[data-closure-confirm]').click();
  await expect(page.locator('[data-closeout-session=closure-session]')).toHaveCount(0);
  await page.reload();
  const result = await page.evaluate(() => ({ closure: JSON.parse(localStorage.getItem('pa_sessionClosures'))[0], mark: JSON.parse(localStorage.getItem('pa_marks'))[0], hand: JSON.parse(localStorage.getItem('pa_handReviews'))[0] }));
  expect(result.closure.status).toBe('closed'); expect(result.closure.note).toBe('下一次研究这个翻牌决策');
  expect(result.closure.reviewedHandIds).toEqual(['closure-hand']); expect(result.mark.matchedHandId).toBe('closure-hand');
  expect(result.hand).toEqual(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
