import { test, expect } from '@playwright/test';

test('settings keyboard navigation reports actual state and returns focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.locator('#settingsBtn');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#soundOption')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('#backupSettingsBtn')).toBeFocused();
  await page.keyboard.press('Home');
  const soundBefore = await page.locator('#soundOption').getAttribute('aria-pressed');
  await page.keyboard.press('Enter');
  await expect(page.locator('#soundOption')).toHaveAttribute('aria-pressed', soundBefore === 'true' ? 'false' : 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await page.click('#settingsBtn');
  await page.click('#colorSchemeOption');
  await expect(page.locator('#colorSchemeOption')).toContainText('Nimbus');
  expect(await page.evaluate(() => localStorage.getItem('pa_colorScheme'))).toBe('nimbus');
});

test('share and import keep focus inside and restore the opener', async ({ page }) => {
  await page.goto('/');
  await page.click('#settingsBtn');
  await page.click('#shareSiteBtn');
  await expect(page.locator('#shareOverlay')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#shareCopyBtn')).toBeFocused();
  await expect(page.locator('.app')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#shareCloseBtn')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#shareCopyBtn')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settingsBtn')).toBeFocused();
  await expect(page.locator('.app')).not.toHaveAttribute('inert');
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.click('#importGGBtn');
  await expect(page.locator('#ggImportText')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#importGGBtn')).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/ui-modal-open/);
});

test('copy exposes real pending and failure states then allows retry', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: () => new Promise((resolve, reject) => { window.copyAttempts = (window.copyAttempts || 0) + 1; window.finishCopy = ok => ok ? resolve() : reject(new Error('denied')); }),
    } });
  });
  await page.goto('/');
  await page.click('#settingsBtn');
  await page.click('#shareSiteBtn');
  await page.click('#shareCopyBtn');
  await expect(page.locator('#shareCopyBtn')).toBeDisabled();
  await expect(page.locator('#shareCopyBtn')).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => page.evaluate(() => typeof window.finishCopy)).toBe('function');
  await page.evaluate(() => window.finishCopy(false));
  await expect(page.locator('#shareCopyBtn')).toBeEnabled();
  await expect(page.locator('#toast')).toHaveAttribute('role', 'alert');
  await expect(page.locator('#toast')).toContainText('复制失败');
  await page.click('#shareCopyBtn');
  await expect(page.locator('#shareCopyBtn')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.copyAttempts)).toBe(2);
  await page.evaluate(() => window.finishCopy(true));
  await expect(page.locator('#toast')).toContainText('已复制');
  await expect(page.locator('#toast')).toHaveAttribute('data-tone', 'success');
  await page.locator('#toast button').click();
  await expect(page.locator('#toast')).toBeHidden();
});

test('destructive confirmation defaults to cancel and only deletes after approval', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-tab="review"]');
  await page.click('[data-sub="session"]');
  await page.fill('#sessDate', '2099-10-18');
  await page.fill('#sessLevel', 'UI synthetic');
  await page.fill('#sessDur', '1');
  await page.fill('#sessHands', '20');
  await page.fill('#sessProfit', '0');
  await page.click('#addSessionBtn');
  const row = page.locator('#sessionBody tr').filter({ hasText: 'UI synthetic' });
  await expect(row).toHaveCount(1);
  await row.locator('[data-delete-id]').click();
  const dialog = page.locator('#actionConfirmDialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(row).toHaveCount(1);
  await row.locator('[data-delete-id]').click();
  await dialog.getByRole('button', { name: '删除场次', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('shared surfaces fit desktop and mobile in every theme', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080], [390, 844], [430, 932]]) {
    await page.setViewportSize({ width, height });
    for (const theme of ['', 'color-nimbus', 'color-ember', 'color-neon']) {
      await page.evaluate(theme => {
        document.body.classList.remove('color-nimbus', 'color-ember', 'color-neon');
        if (theme) document.body.classList.add(theme);
      }, theme);
      for (const tab of ['timer', 'odds', 'review', 'workbench']) {
        await page.click(`[data-tab="${tab}"]`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.click('#settingsBtn');
      await page.click('#shareSiteBtn');
      const box = await page.locator('#shareOverlay .share-dialog').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.keyboard.press('Escape');
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.click('#settingsBtn');
  expect(await page.locator('#settingsMenu').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(errors).toEqual([]);
});

test('legacy and workspace controls share primary, secondary and danger appearance', async ({ page }) => {
  await page.goto('/#safemode');
  await page.evaluate(() => {
    const probe = document.createElement('div'); probe.id = 'componentProbe';
    probe.innerHTML = '<button class="btn" data-probe="old-primary">Primary</button><button class="btn btn--secondary" data-probe="old-secondary">Secondary</button><input class="input" data-probe="old-input"><div class="workspace"><button class="ws-button ws-button--primary" data-probe="new-primary">Primary</button><button class="ws-button" data-probe="new-secondary">Secondary</button><button class="ws-button ui-danger" data-probe="danger">Delete</button><div class="ws-filters"><input data-probe="new-input"></div></div>';
    document.body.append(probe);
  });
  for (const theme of ['', 'color-nimbus', 'color-ember', 'color-neon']) {
    const styles = await page.evaluate(theme => {
      document.body.classList.remove('color-nimbus', 'color-ember', 'color-neon'); if (theme) document.body.classList.add(theme);
      return Object.fromEntries([...document.querySelectorAll('[data-probe]')].map(el => {
        const style = getComputedStyle(el);
        return [el.dataset.probe, { background: style.backgroundColor, color: style.color, radius: style.borderRadius }];
      }));
    }, theme);
    expect(styles['old-primary']).toEqual(styles['new-primary']);
    expect(styles['old-secondary']).toEqual(styles['new-secondary']);
    expect(styles['old-input']).toEqual(styles['new-input']);
    expect(styles.danger.background).not.toBe(styles['new-secondary'].background);
    expect(styles['old-primary'].background).not.toBe(styles['old-secondary'].background);
  }
});

test('saving feedback belongs to the visible editor after the repository refresh', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pa_handReviews', JSON.stringify([{ id: 'ui-busy-hand', date: '2099-10-18', tableMax: 9,
      desc: 'Hero BTN/[Ah Kh] R2.5, BB C', reflection: '', pBB: 0 }]));
  });
  await page.goto('/#safemode');
  await page.click('[data-tab="workbench"]');
  await page.locator('[data-decision-question]').fill('Synthetic question');
  await page.evaluate(() => {
    window.visibleBusySeen = false;
    new MutationObserver(() => {
      const editor = document.querySelector('#decisionEditor[aria-busy=true]');
      if (editor?.checkVisibility() && editor.querySelector('[data-decision-save]:disabled')) window.visibleBusySeen = true;
    }).observe(document.querySelector('#analyzePanel'), { subtree: true, attributes: true, attributeFilter: ['aria-busy', 'disabled'] });
  });
  await page.locator('[data-decision-save]').click();
  await expect.poll(() => page.evaluate(() => window.visibleBusySeen)).toBe(true);
  await expect(page.locator('[data-decision-save]')).toBeEnabled();
  await expect(page.locator('[data-decision-question]')).toHaveValue('Synthetic question');
  await expect(page.locator('#toast')).toContainText('复盘已保存');
});
