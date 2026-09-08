import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

async function readRecords(page, collection, safeMode) {
  return page.evaluate(async ({ collection, safeMode }) => {
    if (safeMode) return JSON.parse(localStorage.getItem('pa_' + collection) || '[]');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pa_store');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction(collection).objectStore(collection).getAll();
        read.onsuccess = () => { db.close(); resolve(read.result); };
        read.onerror = () => { db.close(); reject(read.error); };
      };
    });
  }, { collection, safeMode });
}

const targets = [
  { name: 'preview IndexedDB', url: '/', safeMode: false },
  { name: 'preview localStorage', url: '/#safemode', safeMode: true },
];
if (process.env.E2E_OUT_DIR) targets.push({
  name: 'offline file localStorage',
  url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode',
  safeMode: true,
});

// [V7.11.12 新增] Real form controls and a reload guard the persisted evidence boundary.
for (const target of targets) {
  test('strategy evidence survives note editing and reload: ' + target.name, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(target.url);
    await page.click('[data-tab="review"]');
    await page.click('[data-sub="strategy"]');
    await expect(page.locator('#gtoBaselineList [data-gto-edit]').first()).toBeVisible();
    await expect.poll(async () => (await readRecords(page, 'gtoBaselines', target.safeMode))
      .some((b) => b.question === 'facebet')).toBe(true);
    const before = await readRecords(page, 'gtoBaselines', target.safeMode);
    const baseline = before.find((b) => b.question === 'facebet');
    expect(baseline).toBeTruthy();
    await page.click('[data-gto-edit="' + baseline.id + '"]');
    await expect(page.locator('#gtoBetFreq')).toBeDisabled();
    await page.fill('#gtoTextureNotes', 'edited source notes');
    await page.click('#saveGtoBaselineBtn');
    await expect(page.locator('#toast')).toHaveText('GTO 基线已保存');
    await expect.poll(async () => (await readRecords(page, 'gtoBaselines', target.safeMode))
      .find((b) => b.id === baseline.id)?.textureNotes).toBe('edited source notes');

    const unknownStack = before.find((b) => b.conditions.stackBB == null);
    expect(unknownStack).toBeTruthy();
    await page.click('[data-gto-edit="' + unknownStack.id + '"]');
    await page.fill('#gtoTextureNotes', 'edited unknown-stack notes');
    await page.click('#saveGtoBaselineBtn');
    await expect.poll(async () => (await readRecords(page, 'gtoBaselines', target.safeMode))
      .find((b) => b.id === unknownStack.id)?.textureNotes).toBe('edited unknown-stack notes');

    const evidence = (await readRecords(page, 'evidencePacks', target.safeMode))
      .find((p) => p.scope?.street === 'river');
    expect(evidence).toBeTruthy();
    await page.click('[data-evidence-edit="' + evidence.id + '"]');
    await page.fill('#evKeyPoints', 'edited river notes');
    await page.click('#saveEvidenceBtn');
    await expect(page.locator('#toast')).toHaveText('证据包已保存');
    await expect.poll(async () => (await readRecords(page, 'evidencePacks', target.safeMode))
      .find((p) => p.id === evidence.id)?.keyPoints).toBe('edited river notes');

    await page.reload();
    await page.click('[data-tab="review"]');
    await page.click('[data-sub="strategy"]');
    await expect(page.locator('#gtoBaselineList')).toContainText('edited source notes');
    const savedBaseline = (await readRecords(page, 'gtoBaselines', target.safeMode)).find((b) => b.id === baseline.id);
    for (const key of ['question', 'street', 'scope', 'conditions', 'overall', 'source', 'capturedAt']) {
      expect(savedBaseline[key], key).toEqual(baseline[key]);
    }
    const savedUnknown = (await readRecords(page, 'gtoBaselines', target.safeMode)).find((b) => b.id === unknownStack.id);
    expect(savedUnknown.conditions).toEqual(unknownStack.conditions);
    const savedEvidence = (await readRecords(page, 'evidencePacks', target.safeMode)).find((p) => p.id === evidence.id);
    expect(savedEvidence.scope).toEqual(evidence.scope);
    expect(savedEvidence.keyPoints).toBe('edited river notes');
    expect(errors).toEqual([]);
  });
}
