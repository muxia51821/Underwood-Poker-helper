// [V7.15.0 新增] Enter the task shell before selecting its visible mode.
export async function openWorkbenchMode(page, mode) {
  if (!(await page.locator('#decisionWorkbench').isVisible())) await page.locator('[data-tab=workbench]').click();
  if (mode === 'analyze') await page.locator('[data-tab=analyze]').click();
  else if (!(await page.locator('#' + mode + 'Panel').isVisible())) await page.locator('[data-tab=' + mode + ']').click();
}
