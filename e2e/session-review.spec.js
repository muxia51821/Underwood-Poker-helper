import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = [{ name: 'desktop', width: 1440, height: 900, url: '/#safemode' }, { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 390, height: 844, url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
async function prepare(page, target = targets[0]) {
  await page.setViewportSize(target);
  if (target.name === 'offline') await page.context().setOffline(true);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_sessions')) return;
    localStorage.setItem('pa_sessions', JSON.stringify([
      { id: 'session-a', date: '2026-10-17', level: 'Synthetic A', hands: 100, duration: 1.5, profit: -30, remark: '<img src=x onerror="window.__unsafe=true">' },
      { id: 'session-b', date: '2026-10-18', level: 'Synthetic B', hands: 60, duration: 1, profit: 8 },
      { id: 'session-empty', date: '2026-10-16', level: 'No linked hands', hands: 40, duration: 1, profit: 0 },
    ]));
    const hand = (id, sessionId, marked, pBB) => ({ id, sessionId, gg: true, ggId: id.toUpperCase(), date: '2026-10-17 10:00', tableMax: 9,
      heroPosition: 'BTN', heroCards: 'Ah Kh', boardCode: 'As7d2c', preflopScenario: 'BTNvsBB', marked, pBB,
      desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C' });
    localStorage.setItem('pa_handReviews', JSON.stringify([hand('hand-a1', 'session-a', true, -12), hand('hand-a2', 'session-a', false, null), hand('hand-b', 'session-b', false, 8), hand('orphan', null, false, 1)]));
    localStorage.setItem('pa_marks', JSON.stringify([
      { id: 'mark-a', sessionId: 'session-a', status: 'open', time: '2026-10-17 10:00', note: 'Remember the turn plan' },
      { id: 'mark-linked', sessionId: 'session-a', status: 'matched', matchedHandId: 'hand-a2', note: 'Matched question' },
      { id: 'mark-other', sessionId: 'session-b', status: 'open', note: 'Other session note' },
      { id: 'mark-dismissed', sessionId: 'session-a', status: 'dismissed', note: 'Dismissed note' },
    ]));
  });
  await page.goto(target.url);
  await page.locator('.nav__btn[data-tab=workbench]').click();
}

for (const target of targets) test('Session overview to selected hand, study and back: ' + target.name, async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await prepare(page, target);
  const original = await page.evaluate(() => localStorage.getItem('pa_handReviews'));
  await expect(page.locator('[data-review-session]')).toHaveCount(3);
  await expect(page.locator('[data-review-session]').first()).toHaveAttribute('data-review-session', 'session-b');
  const search = page.locator('[data-review-session-search]');
  await search.pressSequentially('Synthetic A');
  await expect(search).toBeFocused(); await expect(search).toHaveValue('Synthetic A');
  await expect(page.locator('[data-review-session]')).toHaveCount(1);
  await page.locator('[data-review-session=session-a]').click();
  await expect(page.locator('.session-review__metrics')).toContainText('-12.0');
  await expect(page.locator('.session-review__marks')).toContainText('Remember the turn plan');
  await expect(page.locator('.session-review__marks')).not.toContainText('Other session note');
  await expect(page.locator('.session-review__marks')).not.toContainText('Dismissed note');
  await expect(page.locator('[data-review-hand]')).toHaveCount(2);
  expect(await page.evaluate(() => window.__unsafe)).toBeUndefined();
  await page.screenshot({ path: testInfo.outputPath('session-overview.png'), fullPage: true });
  await page.locator('[data-review-hand=hand-a1]').click();
  await expect(page.locator('[data-analyze-hand]')).toHaveCount(2);
  await page.locator('.analysis-filters > summary').click();
  await page.locator('[data-analyze-field=flag]').selectOption('marked');
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await page.locator('[data-replay-action="1"]').click();
  await page.locator('[data-decision-question]').fill('How should I plan the turn?');
  await page.locator('[data-analyze-study]').click();
  await page.locator('[data-study-return]').click();
  await expect(page.locator('[data-analyze-field=sessionId]')).toHaveValue('session-a');
  await expect(page.locator('[data-decision-question]')).toHaveValue('How should I plan the turn?');
  await page.locator('[data-review-session-overview]').click();
  await page.locator('[data-review-session-hands]').click();
  await expect(page.locator('[data-analyze-field=flag]')).toHaveValue('marked');
  await expect(page.locator('#analyzeHandTitle')).toHaveText('手牌 HAND-A1');
  await expect(page.locator('[data-replay-action="1"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-analyze-reset]').click();
  await expect(page.locator('[data-analyze-hand]')).toHaveCount(2);
  await expect(page.locator('[data-analyze-field=sessionId]')).toHaveValue('session-a');
  await page.locator('[data-review-sessions]').click();
  await expect(search).toHaveValue('Synthetic A');
  await page.locator('[data-review-all-hands]').click();
  await expect(page.locator('[data-analyze-hand=orphan]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pa_handReviews'))).toBe(original);
  expect(errors).toEqual([]);
});

test('records entry opens the same Session overview and closeout remains available', async ({ page }) => {
  await prepare(page);
  await page.locator('.nav__btn[data-tab=review]').click();
  await page.locator('#browseSessionReviewBtn').click();
  await expect(page.locator('[data-review-session]')).toHaveCount(3);
  await page.locator('.nav__btn[data-tab=review]').click();
  await page.locator('[data-sub=session]').click();
  await page.locator('[data-session-review=session-empty]').click();
  await expect(page.locator('.session-review__empty')).toContainText('本场尚无关联手牌');
  await expect(page.locator('[data-analyze-import]')).toBeVisible();
  await page.locator('[data-analyze-import]').click();
  await expect(page.locator('#ggImportOverlay')).toHaveClass(/is-active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.session-review__empty')).toBeVisible();
  await page.locator('[data-review-sessions]').click();
  await page.locator('[data-review-session=session-a]').click();
  await page.locator('[data-review-closeout]').click();
  await expect(page.locator('[data-closure-note]')).toBeVisible();
});

test('leaving the Session overview for free study does not attach the last selected hand', async ({ page }) => {
  await prepare(page);
  await page.locator('[data-review-session=session-a]').click();
  await page.locator('[data-review-hand=hand-a1]').click();
  await page.locator('[data-decision-question]').fill('A question for this hand only');
  await page.locator('[data-review-sessions]').click();
  await page.locator('[data-tab=study]').click();
  await expect(page.locator('#studyPanel')).toBeVisible();
  await expect(page.locator('[data-workbench-context]')).not.toContainText('A question for this hand only');
  await expect(page.locator('[data-study-return]')).toHaveCount(0);
});

test('Session views fit desktop and phone sizes in all four themes', async ({ page }, testInfo) => {
  await prepare(page);
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(size);
    for (const theme of ['', 'color-nimbus', 'color-ember', 'color-neon']) {
      await page.evaluate(theme => {
        document.body.classList.remove('color-nimbus', 'color-ember', 'color-neon');
        if (theme) document.body.classList.add(theme);
      }, theme);
      await page.locator('[data-review-session=session-a]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (!theme) await page.screenshot({ path: testInfo.outputPath('overview-' + size.width + '.png'), fullPage: true });
      await page.locator('[data-review-session-hands]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.locator('[data-review-sessions]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
});

test('browse a full Session, mark a hand, analyze it and resume the same page', async ({ page }, testInfo) => {
  await prepare(page);
  await page.evaluate(() => {
    const hands = JSON.parse(localStorage.getItem('pa_handReviews'));
    for (let index = 0; index < 28; index++) hands.push({ ...hands[0], id: 'browse-' + index, ggId: 'BROWSE-' + index, marked: false,
      date: '2026-10-17 11:' + String(index).padStart(2, '0'), pBB: index });
    localStorage.setItem('pa_handReviews', JSON.stringify(hands));
  });
  await page.reload(); await page.locator('.nav__btn[data-tab=workbench]').click();
  await page.locator('[data-review-session=session-a]').click();
  await expect(page.locator('[data-session-hand-row]')).toHaveCount(25);
  const search = page.locator('[data-session-pick-filter=query]');
  await search.pressSequentially('BROWSE');
  await expect(search).toBeFocused();
  await expect(page.locator('[data-session-pick-count]')).toContainText('28');
  await page.locator('[data-session-pick-page="2"]').click();
  await expect(page.locator('[data-session-hand-row]')).toHaveCount(3);
  const row = page.locator('[data-session-hand-row=browse-25]');
  await row.locator('[data-session-pick-toggle]').click();
  await expect(row.locator('[data-session-pick-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(search).toHaveValue('BROWSE');
  await row.locator('[data-review-hand]').click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('[data-decision-save]')).toBeInViewport();
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌', { exact: true }).click();
  await expect(page.locator('[data-decision-section=plan]')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-decision-section=learning]')).not.toHaveAttribute('open', '');
  await page.locator('[data-decision-question]').fill('A focused question');
  await page.locator('[data-decision-reason]').fill('A short first judgment');
  await page.screenshot({ path: testInfo.outputPath('focused-review-1280.png'), fullPage: true });
  await page.locator('[data-decision-save]').click();
  await page.locator('[data-review-session-overview]').click();
  await expect(search).toHaveValue('BROWSE');
  await expect(page.locator('[data-session-hand-row]')).toHaveCount(3);
  await expect(row.locator('[data-session-pick-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload(); await page.locator('.nav__btn[data-tab=workbench]').click();
  await page.locator('[data-review-session=session-a]').click();
  await page.locator('[data-session-pick-filter=scope]').selectOption('marked');
  await expect(page.locator('[data-session-hand-row=browse-25]')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_handReviews')).find(hand => hand.id === 'browse-25'));
  expect(saved.marked).toBe(true); expect(saved.pBB).toBe(25);
  expect(Object.values(saved.decisionReviews)[0].question).toBe('A focused question');
});
