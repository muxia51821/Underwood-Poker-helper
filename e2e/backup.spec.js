import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { newPreflopRange } from '../src/modules/preflopRangeModel.js';
import { openWorkbenchMode } from './helpers/workbench.js';

const targets = [{ name: 'IndexedDB', width: 1440, height: 1000, url: '/' },
  { name: 'localStorage mobile', width: 390, height: 844, url: '/#safemode' }];
if (process.env.E2E_OUT_DIR) targets.push({ name: 'offline file', width: 390, height: 844,
  url: pathToFileURL(join(process.env.E2E_OUT_DIR, 'index.html')).href + '#safemode' });
const source = () => ({ sessions: [{ id: 'backup-session', date: '2026-10-16', level: 'Synthetic', duration: 1, hands: 1, profit: -8, custom: { keep: true } }],
  handReviews: [{ id: 'backup-hand', sessionId: 'backup-session', date: '2026-10-16 10:00', tableMax: 9, marked: true, pBB: -8,
    heroPosition: 'BTN', heroCards: 'Ah Kh', desc: 'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C', reflection: 'Synthetic note', extra: 3 }],
  marks: [{ id: 'backup-mark', sessionId: 'backup-session', time: '2026-10-16 10:00', note: 'Synthetic question', status: 'open' }],
  settings: { sound: false, vibrate: false }, standup: { date: '2026-10-16', count: 4 },
  timerState: { status: 'running', phase: 'work', endTime: Date.parse('2026-10-16T10:03:00Z'), longBreak: { enabled: true, interval: 4, minutes: 15 } },
  backupMeta: { format: 'poker-table-agent', version: 1, createdAt: '2026-10-16T10:00:00Z' },
  learningState: { version: 1, values: { pa_colorScheme: 'future-theme', pa_concept_quiz_mastery: '{"synthetic":{"asked":3,"correct":1}}', pa_concept_quiz_errors: '[{"id":"synthetic-error"}]' } },
  localState: { version: 1, values: { pa_future_user_note: 'preserve these source bytes', pa_ranges_v1: JSON.stringify({version:1,ranges:[],
    drafts:{'backup-range':{...newPreflopRange('backup-range'),name:'Synthetic restored range'}},selectedId:'backup-range',
    editors:{'backup-range':{hand:'AKs',values:{AKs:{weight:'100',fold:'0',call:'',raise:'72.',allin:'0'}}}}}) } } });
async function openBackup(page) {
  await page.locator('#settingsBtn').click(); await page.locator('#backupSettingsBtn').click();
  await expect(page.locator('#backupTitle')).toHaveText('备份与恢复');
}
async function chooseFile(page, data) {
  await page.locator('[data-backup-file]').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#backupTitle')).toHaveText('恢复预览');
}
for (const target of targets) test('complete restore preview, timer pause, duplicate import and checkpoint: ' + target.name, async ({ page }) => {
  await page.setViewportSize(target);
  if (target.name === 'offline file') await page.context().setOffline(true);
  await page.goto(target.url); await openBackup(page);
  await chooseFile(page, source());
  expect(await page.evaluate(() => localStorage.getItem('pa_concept_quiz_mastery'))).toBeNull();
  await page.locator('.backup-conflicts summary').click();
  await page.locator('[data-backup-conflict="pa_timerState"]').check();
  await page.locator('[data-backup-action=apply]').click();
  await expect(page.locator('#backupTitle')).toHaveText('恢复完成');
  await page.locator('[data-backup-action=close]').click();
  await expect(page.locator('#startBtn')).toHaveText('继续恢复的计时');
  await expect(page.locator('#timerDisplay')).toHaveText('03:00');
  await page.waitForTimeout(1100);
  await expect(page.locator('#timerDisplay')).toHaveText('03:00');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_settings')))).toEqual({ sound: false, vibrate: false });
  expect(await page.evaluate(() => localStorage.getItem('pa_colorScheme'))).toBe('future-theme');
  await openBackup(page);
  const downloaded = page.waitForEvent('download'); await page.locator('[data-backup-action=download]').click();
  const backup = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
  expect(backup.handReviews.find(hand => hand.id === 'backup-hand').extra).toBe(3);
  expect(backup.marks[0].sessionId).toBe('backup-session');
  expect(backup.learningState.values.pa_concept_quiz_errors).toContain('synthetic-error');
  expect(backup.localState.values.pa_colorScheme).toBe('future-theme');
  expect(JSON.parse(backup.localState.values.pa_ranges_v1).editors['backup-range'].values.AKs.raise).toBe('72.');
  await chooseFile(page, source()); await page.locator('[data-backup-action=apply]').click();
  await expect(page.locator('#backupTitle')).toHaveText('恢复完成'); await page.locator('[data-backup-action=close]').click();
  await openBackup(page);
  const checkpointDownload = page.waitForEvent('download'); await page.locator('[data-backup-action=checkpoint]').click();
  const previous = JSON.parse(await readFile(await (await checkpointDownload).path(), 'utf8'));
  expect(previous.sessions.filter(session => session.id === 'backup-session')).toHaveLength(1);
  await page.locator('[data-backup-action=close]').click();
  await openWorkbenchMode(page,'study');await page.locator('[data-study-view=ranges]').click();
  await expect(page.locator('[data-range-select]')).toContainText('Synthetic restored range');
  await expect(page.locator('[data-range-value=call]')).toHaveValue('');
});

test('failed restore keeps its report and original snapshot through retry and rollback', async ({ page }) => {
  await page.goto('/#safemode'); await openBackup(page); await chooseFile(page, source());
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.__restoreStorageSet = set;
    Storage.prototype.setItem = function(key, value) { if (key === 'pa_concept_quiz_mastery') throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, key, value); };
  });
  await page.locator('[data-backup-action=apply]').click();
  await expect(page.locator('#backupTitle')).toHaveText('恢复尚未完成');
  await expect(page.locator('#backupDialog')).toContainText('概念掌握度');
  await page.evaluate(() => { Storage.prototype.setItem = window.__restoreStorageSet; });
  await page.locator('[data-backup-action=close]').click();
  await expect(page.locator('#restoreNotice')).toBeVisible();
  await openBackup(page); await chooseFile(page, source());
  await page.locator('[data-backup-action=apply]').click();
  await expect(page.locator('#backupTitle')).toHaveText('恢复完成'); await page.locator('[data-backup-action=close]').click();
  await openBackup(page);
  const sourceDownload = page.waitForEvent('download'); await page.locator('[data-backup-action=source]').click();
  expect(JSON.parse(await readFile(await (await sourceDownload).path(), 'utf8')).localState.values.pa_future_user_note).toBe('preserve these source bytes');
  expect(await page.evaluate(() => localStorage.getItem('pa_future_user_note'))).toBeNull();
  await page.locator('[data-backup-action=rollback]').click();
  await expect(page.locator('#backupTitle')).toHaveText('还原到恢复前');
  await page.locator('[data-backup-action=apply]').click();
  await expect(page.locator('#backupTitle')).toHaveText('恢复完成'); await page.locator('[data-backup-action=close]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pa_sessions')))).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('pa_concept_quiz_mastery'))).toBeNull();
});

test('database upgrade preserves v6 collections while adding the restore checkpoint store', async ({ page }) => {
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('pa_store', 6);
      request.onupgradeneeded = () => {
        for (const name of ['sessions', 'handReviews', 'marks', 'sessionClosures', 'dossiers', 'evidencePacks', 'strategyRevisions', 'learningUnits', 'opponentNotes', 'gtoBaselines', 'weeklyReviews', 'tiltLogs']) request.result.createObjectStore(name, { keyPath: name === 'weeklyReviews' ? 'week' : name === 'tiltLogs' ? 'time' : 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('sessions', 'readwrite');
        tx.objectStore('sessions').put({ id: 'v6-session', date: '2026-10-16', level: 'Synthetic', hands: 1, profit: 0 });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
    localStorage.setItem('pa_migrated_v1', 'true');
  });
  await page.goto('/'); await openBackup(page);
  const downloaded = page.waitForEvent('download'); await page.locator('[data-backup-action=download]').click();
  const backup = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
  expect(backup.sessions[0].id).toBe('v6-session');
  expect(await page.evaluate(async () => new Promise(resolve => { const request = indexedDB.open('pa_store'); request.onsuccess = () => { const db = request.result; resolve({ version: db.version, recovery: db.objectStoreNames.contains('recoverySnapshots') }); db.close(); }; }))).toEqual({ version: 7, recovery: true });
});
