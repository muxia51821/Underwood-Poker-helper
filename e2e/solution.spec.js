import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { sha256, solutionContent } from '../src/modules/solutionPackModel.js';
import { openWorkbenchMode } from './helpers/workbench.js';
import { readPracticeState, expandPracticeRecord } from './helpers/practice-state.js';

const variants=[{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}];
if(process.env.E2E_OUT_DIR) variants.push({name:'offline file',width:390,height:844,file:true});
async function openStudy(page) {await openWorkbenchMode(page,'study');await page.locator('[data-study-view=solutions]').click();}
for(const variant of variants) test('verified solution loop, frozen history and navigation: '+variant.name,async({page})=>{
  await page.setViewportSize(variant);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(variant.file) await page.context().setOffline(true);
  await page.goto(variant.file?pathToFileURL(path.join(process.env.E2E_OUT_DIR,'index.html')).href+'#safemode':'/#safemode');
  await openStudy(page);
  const study=page.locator('.solution-workspace');
  await expect(study.locator('.solution-conditions')).toContainText('OOP 范围');await expect(study.locator('.solution-conditions')).toContainText('起点底池 10bb');
  await page.locator('[data-solution-pack]').selectOption('river-pot');
  await page.locator('.solution-path [data-solution-node="root/bet:10"]').click();
  await expect(page.locator('[data-solution-node-state]')).toContainText('OOP 剩余 10bb／IP 剩余 20bb');
  await page.locator('[data-solution-pack]').selectOption('river-half-pot');
  await expect(page.locator('[data-solution-node-state]')).toContainText('OOP 剩余 20bb／IP 剩余 20bb');
  await expect(page.locator('[data-solution-hand=AA]')).toBeDisabled();
  await page.locator('[data-solution-hand=KK]').click();await expect(page.locator('[data-solution-combo]')).toHaveCount(3);await expect(page.locator('[data-solution-combo-detail]')).not.toContainText('自身到达权重');await expect(page.locator('[data-solution-combo-detail]')).not.toContainText('兼容对手质量');
  await page.locator('.solution-path [data-solution-node="root/check"]').click();await expect(page.locator('[data-solution-practice]')).toBeDisabled();
  await page.locator('[data-solution-node="root/check/check"]').click();await expect(page.locator('[data-solution-terminal]')).toContainText('摊牌结算');
  await page.locator('[data-solution-node="root/bet:5"]').click();await expect(page.locator('[data-solution-node-state]')).toContainText('OOP 剩余 15bb／IP 剩余 20bb');
  await page.locator('[data-solution-practice]').click();
  const practice=page.locator('#practiceWorkspace');
  await expect(practice.locator('[data-practice-config=type]')).toHaveValue('solution');
  await practice.locator('[data-practice-action=start]').click();
  await expect(practice.locator('.solution-values')).toHaveCount(0);await expect(practice.locator('[data-solution-loss]')).toHaveCount(0);
  await practice.locator('[name=practiceChoice][value=fold]').check();await practice.locator('[data-practice-action=submit]').click();
  await expect(practice).toContainText('本样例中，各动作差异小于核验精度，近似等价。');await expect(practice.locator('.solution-values')).toContainText('动作期望值');
  const saved=(await readPracticeState(page)).sessions[0];
  expect(saved.solutionSnapshot.format).toBe('poker-solution-pack');expect(saved.questions[0].solution.packHash).toBe(saved.solutionSnapshot.contentHash);
  await page.reload();await openWorkbenchMode(page,'practice');if(await practice.locator('[data-practice-action=continue]').isVisible()) await practice.locator('[data-practice-action=continue]').click();
  await expect(practice).toContainText('本样例中，各动作差异小于核验精度，近似等价。');
  await practice.locator('[data-practice-action=next]').click();await expect(practice.locator('.solution-values')).toHaveCount(0);
  await practice.locator('[name=practiceChoice][value=call]').check();await practice.locator('[data-practice-action=submit]').click();
  await practice.locator('[data-practice-action=stop]').click();
  await practice.locator('details.ws-concept').first().locator('summary').click();
  await practice.locator('[data-practice-solution-question]').first().click();
  await expect(page.locator('[data-solution-node-state]')).toContainText('当前由IP决策');
  await expect(page.locator('[data-solution-snapshot]')).toContainText('正在查看本轮冻结答案版本');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:test.info().outputPath('solution-study.png'),fullPage:true});
  expect(errors).toEqual([]);
});

for(const variant of variants) test('turn decisions, exact river branches and frozen feedback: '+variant.name,async({page})=>{
  await page.setViewportSize(variant);if(variant.file) await page.context().setOffline(true);
  await page.goto(variant.file?pathToFileURL(path.join(process.env.E2E_OUT_DIR,'index.html')).href+'#safemode':'/#safemode');
  await openStudy(page);await page.locator('[data-solution-pack]').selectOption('turn-checkdown-half-pot');
  await expect(page.locator('.solution-conditions')).toContainText('继续后发河牌并过牌摊牌');
  await page.locator('.solution-path [data-solution-node="root/check"]').click();
  await page.locator('[data-solution-node="root/check/check"]').click();
  await expect(page.locator('[data-solution-chance]')).toContainText('河牌概率按双方范围和当前行动分支计算');
  await expect(page.locator('[data-solution-river] option')).toHaveCount(48);
  expect(await page.locator('[data-solution-river] option[value=Ks]').count()).toBe(0);
  await page.locator('[data-solution-river]').selectOption('As');
  await expect(page.locator('[data-solution-river-detail]')).toContainText('OOP 9 个组合／IP 12 个组合');
  await expect(page.locator('[data-solution-river-detail]')).not.toContainText('As4s');
  await expect(page.locator('[data-solution-river-detail]')).toContainText('OOP 5.0000bb');
  await expect(page.locator('[data-study-practice]')).toBeDisabled();
  await page.screenshot({path:test.info().outputPath('turn-chance.png'),fullPage:true});
  await page.locator('.solution-path [data-solution-node="root/bet:5"]').click();
  await page.locator('[data-solution-node="root/bet:5/call"]').click();
  await page.locator('[data-solution-river]').selectOption('Td');
  await expect(page.locator('[data-solution-river-detail]')).toContainText('河牌底池 20bb · OOP 剩余 15bb／IP 剩余 15bb');
  await expect(page.locator('[data-solution-river-detail]')).toContainText('OOP 11 个组合／IP 9 个组合');
  await page.locator('.solution-path [data-solution-node="root/bet:5"]').click();
  await page.locator('[data-solution-practice]').click();await page.locator('[data-practice-action=start]').click();
  const practice=page.locator('#practiceWorkspace');
  await expect(practice.locator('.practice-context')).toContainText('转牌');await expect(practice.locator('.practice-choices')).toContainText('跟注');
  await expect(practice.locator('.solution-values')).toHaveCount(0);await practice.locator('[name=practiceChoice][value=call]').check();await practice.locator('[data-practice-action=submit]').click();
  await expect(practice).toContainText('本样例中，各动作差异小于核验精度，近似等价。');
  const hash=(await readPracticeState(page)).sessions[0].solutionSnapshot.contentHash;
  await page.reload();await openWorkbenchMode(page,'practice');
  if(await practice.locator('[data-practice-action=continue]').isVisible()) await practice.locator('[data-practice-action=continue]').click();
  expect((await readPracticeState(page)).sessions[0].solutionSnapshot.contentHash).toBe(hash);
  await practice.locator('[data-practice-action=stop]').click();await practice.locator('[data-practice-action=home]').click();
  await expect(practice.locator('[data-practice-history]').first()).toContainText('转牌样例 C');
  await practice.locator('[data-practice-history]').first().click();await practice.locator('details.ws-concept').first().locator('summary').click();
  await practice.locator('[data-practice-solution-question]').first().click();
  await expect(page.locator('[data-solution-pack]')).toHaveValue('turn-checkdown-half-pot');await expect(page.locator('[data-solution-node-state]')).toContainText('当前由IP决策');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('historical answers retain their snapshot after a built-in revision and survive complete backup',async({page})=>{
  await page.goto('/#safemode');await openStudy(page);await page.locator('[data-solution-practice]').click();
  await page.locator('[data-practice-action=start]').click();await page.locator('[name=practiceChoice]').first().check();await page.locator('[data-practice-action=submit]').click();
  let stored=await readPracticeState(page);
  const session=stored.sessions[0],snapshot=session.solutionSnapshot;
  snapshot.revision=2;snapshot.title='Synthetic frozen revision';snapshot.contentHash=sha256(solutionContent(snapshot));
  session.questions.forEach(q=>q.solution.packHash=snapshot.contentHash);
  Object.values(session.responses).filter(r=>r.submitted).forEach(r=>r.evaluation.packHash=snapshot.contentHash);
  await page.evaluate(state=>localStorage.setItem('pa_practice_v1',JSON.stringify(state)),stored);
  await page.reload();await openWorkbenchMode(page,'practice');if(await page.locator('[data-practice-action=continue]').isVisible()) await page.locator('[data-practice-action=continue]').click();
  await page.locator('[data-practice-action=stop]').click();await page.locator('details.ws-concept').first().locator('summary').click();
  await page.locator('[data-practice-solution-question]').first().click();
  await expect(page.locator('[data-solution-snapshot]')).toContainText('当前内置包已有更新');
  await expect(page.locator('[data-solution-pack] option:checked')).toHaveText(/样例/);
  await page.locator('[data-solution-current]').click();await expect(page.locator('[data-solution-snapshot]')).toHaveCount(0);
  await openWorkbenchMode(page,'practice');
  const download=page.waitForEvent('download');await page.locator('[data-practice-action=export]').click();
  const backup=JSON.parse(await readFile(await(await download).path(),'utf8'));
  expect(expandPracticeRecord(JSON.parse(backup.localState.values.pa_practice_v1)).sessions[0].solutionSnapshot.contentHash).toBe(snapshot.contentHash);
});

test('solution quota failure retains saved history and the visible choice',async({page})=>{
  await page.goto('/#safemode');await openStudy(page);await page.locator('[data-solution-practice]').click();await page.locator('[data-practice-action=start]').click();
  const before=await page.evaluate(()=>localStorage.getItem('pa_practice_v1'));
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='pa_practice_v1')throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};});
  await page.locator('[name=practiceChoice]').first().check();await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('#practiceNotice')).toContainText('练习未能保存');
  await expect(page.locator('[name=practiceChoice]').first()).toBeChecked();await expect(page.locator('#practiceWorkspace .solution-values')).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('pa_practice_v1'))).toBe(before);
});

test('personal question and return position survive sample study without scoring the source hand',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pa_handReviews',JSON.stringify([{id:'synthetic-solution-source',ggId:'SYNTHETIC',gg:true,tableMax:9,date:'2026-10-16',heroPosition:'BTN',heroCards:'Ah Kh',boardCode:'As7d2c',preflopScenario:'BTNvsBB',marked:true,
    desc:'preflop 行动：Hero BTN/[Ah Kh] R2.5, BB C\nOTF翻牌 As 7d 2c 行动：X B33 (1.8bb) C\nOTT转牌 9s 行动：X X\nOTR河牌 4h 行动：X B50 (3bb) F'}])));
  await page.goto('/#safemode');const sourceHands=await page.evaluate(()=>localStorage.getItem('pa_handReviews'));await openWorkbenchMode(page,'analyze');
  await page.locator('#analyzeReplay .replay-step').getByText('翻牌',{exact:true}).click();await page.locator('[data-replay-action="1"]').click();
  await page.locator('[data-decision-question]').fill('SYNTHETIC QUESTION');await page.locator('[data-analyze-study]').click();
  await page.locator('[data-study-view=solutions]').click();await expect(page.locator('.solution-workspace')).toContainText('SYNTHETIC QUESTION');
  await page.locator('[data-solution-practice]').click();await page.locator('[data-practice-action=start]').click();
  await expect(page.locator('[data-workbench-context]')).toContainText('SYNTHETIC QUESTION');
  const q=(await readPracticeState(page)).sessions[0];
  expect(q.config.sourceDecision.handId).toBe('synthetic-solution-source');expect(q.config.sourceDecision.pot).toBeNull();
  expect(q.questions[0].context.board).toEqual(['Ks','7d','2c','8h','3d']);
  await page.locator('[name=practiceChoice]').first().check();await page.locator('[data-practice-action=submit]').click();
  await expect(page.locator('.practice-feedback .solution-values')).toBeVisible();await page.locator('[data-practice-solution-question]').click();
  await page.locator('[data-study-return]').click();await expect(page.locator('[data-replay-action="1"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-decision-question]')).toHaveValue('SYNTHETIC QUESTION');expect(await page.evaluate(()=>localStorage.getItem('pa_handReviews'))).toBe(sourceHands);
});

test('complete backup restores turn and legacy river snapshots together',async({page,browser})=>{
  await page.goto('/#safemode');await openStudy(page);await page.locator('[data-solution-practice]').click();
  await page.locator('[data-practice-action=start]').click();await page.locator('[name=practiceChoice]').first().check();await page.locator('[data-practice-action=submit]').click();
  await page.locator('[data-practice-action=stop]').click();await page.locator('[data-practice-action=home]').click();
  await page.locator('[data-practice-config=solutionPackId]').selectOption('turn-checkdown-half-pot');
  await page.locator('[data-practice-action=start]').click();await page.locator('[name=practiceChoice]').first().check();await page.locator('[data-practice-action=submit]').click();
  await page.locator('[data-practice-action=stop]').click();
  const expected=await page.evaluate(()=>JSON.parse(localStorage.getItem('pa_practice_v1')));
  const downloaded=page.waitForEvent('download');await page.locator('[data-practice-action=export]').click();
  const bytes=await readFile(await(await downloaded).path());
  const context=await browser.newContext();
  try {
    const restored=await context.newPage();await restored.goto('/#safemode');await openWorkbenchMode(restored,'practice');
    await restored.locator('[data-practice-file]').setInputFiles({name:'synthetic-turn-backup.json',mimeType:'application/json',buffer:bytes});
    await restored.locator('[data-backup-action=apply]').click();await expect(restored.locator('#backupTitle')).toHaveText('恢复完成');
    await Promise.all([restored.waitForEvent('load'),restored.locator('[data-backup-action=close]').click()]);await openWorkbenchMode(restored,'practice');
    await expect(restored.locator('[data-practice-history]')).toHaveCount(2);
    expect(await restored.evaluate(()=>JSON.parse(localStorage.getItem('pa_practice_v1')))).toEqual(expected);
    await restored.locator('[data-practice-history]').first().click();await restored.locator('details.ws-concept').first().locator('summary').click();
    await restored.locator('[data-practice-solution-question]').first().click();await expect(restored.locator('[data-solution-pack]')).toHaveValue('turn-checkdown-half-pot');
  } finally {await context.close();}
});
