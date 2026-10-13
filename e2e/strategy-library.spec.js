import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = [{ name: 'desktop', width: 1440, height: 1000, url: '/' },
  { name: 'mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline', width: 375, height: 812,
  url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });

// [V7.11.15 新增] Legacy units, exact-node drills and position references exercise actual navigation.
for (const target of targets) test('strategy learning routes and position reading: ' + target.name, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize(target);
  await page.addInitScript(() => {
    if (localStorage.getItem('pa_strategyRevisions')) return;
    const strategies = [
      { id: 'route-river', familyKey: 'BTNvsBB|river', title: 'River', spotKeys: [] },
      { id: 'route-defense', familyKey: 'BTNvsBB|flop', title: 'Defense', spotKeys: ['BTNvsBB|flop|9max|dryAHigh|facebet'] },
      { id: 'route-cbet', familyKey: 'BTNvsBB|flop', title: 'Cbet', spotKeys: ['BTNvsBB|flop|9max|monotone|cbet'] },
      { id: 'route-general', familyKey: 'SBvsBB|flop', title: 'General cbet', spotKeys: [] },
    ];
    localStorage.setItem('pa_strategyRevisions', JSON.stringify(strategies));
    localStorage.setItem('pa_learningUnits', JSON.stringify(strategies.map((strategy) => ({
      id: strategy.id + '-unit', strategyId: strategy.id, familyKey: strategy.familyKey,
      type: 'quiz', quizScenario: 'BTNvsBB', title: 'Legacy unit', status: 'active',
    }))));
  });
  await page.goto(target.url);
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="strategy"]');
  const before = await page.evaluate(() => localStorage.getItem('pa_learningUnits'));
  await page.click('[data-unit-quiz="route-river-unit"]');
  await expect(page.locator('#conceptQuizBody')).toContainText('当前主题：河牌价值、诈唬与抓诈');
  await page.click('[data-sub="strategy"]');
  await page.click('[data-unit-quiz="route-defense-unit"]');
  await expect(page.locator('#conceptQuizBody')).toContainText('当前主题：防守价格与继续范围');
  await page.click('[data-sub="strategy"]');
  await page.click('[data-unit-quiz="route-cbet-unit"]');
  await expect(page.locator('#quizScenario')).toHaveValue('BTNvsBB');
  await expect(page.locator('#quizStage')).toHaveValue('monotone');
  await page.click('[data-sub="strategy"]');
  await page.click('[data-unit-quiz="route-general-unit"]');
  await expect(page.locator('#quizScenario')).toHaveValue('SBvsBB');
  await expect(page.locator('#quizStage')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('pa_learningUnits'))).toBe(before);
  await page.click('[data-sub="hand"]');
  await page.locator('#posAdviceDetails > summary').click();
  await page.click('[data-advice-key="UTGvsBB"]');
  await expect(page.locator('#posAdviceText')).toContainText('BB 先行动（OOP），UTG 后行动（IP）');
  await expect(page.locator('#posAdviceText')).not.toContainText('%');
  await page.click('[data-advice-key="SBvsBB"]');
  await expect(page.locator('#posAdviceText')).toContainText('SB 兼按钮');
  expect(await page.locator('#posAdviceText').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  expect(await page.locator('#posAdviceDetails button').evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('#posAdviceDetails').screenshot({ path: testInfo.outputPath('position-reading-' + target.name + '.png') });
  await page.locator('#posAdviceText [data-strategy-topic="ranges"]').click();
  await expect(page.locator('#strategyTopicTitle')).toHaveText('双方范围与牌面分布');
  expect(errors).toEqual([]);
});

// [V7.11.13 新增] Exercise the actual bundled topic view and leave existing personal edits intact.
for (const target of targets) test('strategy library reading and personal-editor isolation: ' + target.name, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize(target);
  await page.goto(target.url);
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="strategy"]');
  await expect(page.locator('#strategyLibrary')).toBeVisible();
  await expect(page.locator('[data-library-topic]')).toHaveCount(8);
  await page.click('[data-library-personal]');
  await expect(page.locator('#strategyEditorPane')).toBeFocused();
  await page.fill('#stratTitle', 'Unsaved personal strategy');
  await page.fill('#stratStatement', 'Keep my own reasoning');
  let concepts = 0;
  let hypotheses = 0;
  for (const id of ['preflop', 'ranges', 'flop', 'defense', 'turn', 'river', 'adjustment', 'special']) {
    await page.click('[data-library-topic="' + id + '"]');
    await expect(page.locator('[data-library-topic="' + id + '"]')).toHaveAttribute('aria-pressed', 'true');
    concepts += await page.locator('[data-library-concept]').count();
    hypotheses += await page.locator('[data-library-hypothesis]').count();
    expect(await page.locator('#strategyTopicBody').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  expect(concepts).toBe(54);
  expect(hypotheses).toBe(19);
  await expect(page.locator('#stratTitle')).toHaveValue('Unsaved personal strategy');
  await expect(page.locator('#stratStatement')).toHaveValue('Keep my own reasoning');
  await page.click('[data-library-topic="preflop"]');
  await page.locator('[data-library-concept="concept-stack-depth"] > summary').click();
  await expect(page.locator('[data-library-concept="concept-stack-depth"]')).toContainText('阅读器页 168-170');
  await expect(page.locator('[data-library-concept="concept-stack-depth"]')).toContainText('三个例子分别读');
  await page.click('[data-library-topic="adjustment"]');
  await page.locator('[data-library-hypothesis]').filter({ hasText: 'SIAe-B-' }).locator('summary').click();
  await expect(page.locator('#strategyTopicBody')).toContainText('必须分别证实');
  await expect(page.locator('#strategyTopicBody a').first()).toHaveAttribute('href', 'https://blog.gtowizard.com/exploiting-excessive-c-betting-by-ip/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('#strategyLibrary').screenshot({ path: testInfo.outputPath('strategy-library-' + target.name + '.png') });
  expect(errors).toEqual([]);
});

// [V7.11.14 新增] Local fixtures exercise the same bundled paths on desktop, mobile and file://.
for (const target of targets) test('strategy topics connect local hands and scoped quizzes: ' + target.name, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize(target);
  const base = { preflopScenario: 'BTNvsBB', heroPosition: 'BB', boardCategory: 'dryAHigh', boardCode: 'A72r',
    tableMax: 9, actionLineOTF: 'X-B33-C', actionLineOTT: '', actionLineOTR: '', desc: 'OTF翻牌 Ah 7d 2c    行动：X B33 C' };
  const hands = Array.from({ length: 11 }, (_, i) => ({ ...base, id: 'study-9-' + i, date: '2026-10-08', pBB: i % 2 ? 5 : -5 }));
  hands.push({ ...base, id: 'study-6', date: '2026-10-07', tableMax: 6 });
  hands.push({ ...base, id: 'study-sb', preflopScenario: 'SBvsBB', heroPosition: 'SB', actionLineOTF: 'B33-C' });
  await page.addInitScript((records) => {
    if (localStorage.getItem('pa_handReviews')) return;
    localStorage.setItem('pa_handReviews', JSON.stringify(records));
    localStorage.setItem('pa_concept_quiz_mastery', JSON.stringify({ 'concept-probe': { asked: 4, correct: 3 } }));
    localStorage.setItem('pa_concept_quiz_errors', JSON.stringify([{ id: 'concept-probe', chosen: 'other-topic-answer', ts: '2026-10-01' }]));
  }, hands);
  await page.goto(target.url);
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="strategy"]');
  await page.fill('#stratTitle', 'Preserve unsaved strategy');
  await page.click('[data-library-topic="defense"]');
  await expect(page.locator('[data-library-hand]')).toHaveCount(10);
  await expect(page.locator('#strategyTopicHands')).toContainText('候选 12 手');
  await expect(page.locator('[data-library-candidates]')).not.toHaveAttribute('open', '');
  await page.locator('[data-library-candidates] > summary').click();
  await page.click('[data-library-more]');
  await expect(page.locator('[data-library-hand]')).toHaveCount(12);
  await page.selectOption('[data-library-profile]', '9max');
  await expect(page.locator('#strategyTopicHands')).toContainText('候选 11 手');
  await page.click('[data-library-hand="study-9-0"]');
  await expect(page.locator('#subHand')).toHaveClass(/is-visible/);
  await expect(page.locator('#handBody [data-hand-id="study-9-0"]')).toHaveCount(1);
  await page.click('[data-sub="strategy"]');
  await expect(page.locator('#strategyTopicTitle')).toHaveText('防守价格与继续范围');
  await expect(page.locator('[data-library-profile]')).toHaveValue('9max');
  await expect(page.locator('[data-library-candidates]')).toHaveAttribute('open', '');
  await expect(page.locator('#stratTitle')).toHaveValue('Preserve unsaved strategy');
  await page.locator('#strategyLibrary').screenshot({ path: testInfo.outputPath('strategy-hands-' + target.name + '.png') });
  await page.click('[data-library-topic="preflop"]');
  await page.click('[data-library-quiz]');
  await expect(page.locator('#subDiscover')).toHaveClass(/is-visible/);
  await expect(page.locator('#conceptQuizBody')).toContainText('当前主题：翻前条件与入池范围');
  await expect(page.locator('#conceptQuizReset')).toBeHidden();
  await expect(page.locator('#conceptQuizBody')).not.toContainText('Probe（');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pa_concept_quiz_mastery'))['concept-probe']);
  await page.locator('#conceptQuizOptions button').first().click();
  await expect(page.locator('#conceptQuizFeedback')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_concept_quiz_mastery'))['concept-probe'])).toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_concept_quiz_errors')).some((error) => error.id === 'concept-probe'))).toBe(true);
  await page.locator('#conceptQuizBody [data-strategy-topic="preflop"]').click();
  await expect(page.locator('#strategyTopicTitle')).toHaveText('翻前条件与入池范围');
  await expect(page.locator('#stratTitle')).toHaveValue('Preserve unsaved strategy');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
