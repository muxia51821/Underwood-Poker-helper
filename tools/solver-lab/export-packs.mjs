// Generate only from the checked-in, successful native verification evidence.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const here = new URL('./', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, here), 'utf8'));
const report = await read('verification.json');
if (report.passed !== true || report.cases.some(item => !item.passed)) throw new Error('Numerical gate has not passed.');
const fixtures = await read('fixtures.json');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const output = new URL('../../src/data/solutions/', here);
await mkdir(output, { recursive: true });
for (const [i, fixture] of fixtures.cases.entries()) {
  const primary = await read(`results/${fixture.id}.primary.json`);
  const reference = await read(`results/${fixture.id}.reference.json`);
  const evidence = report.cases.find(item => item.id === fixture.id);
  if (!evidence?.passed) throw new Error('Missing verification case.');
  const pack = {
    format: 'poker-solution-pack', version: 1, id: fixture.id, revision: 1,
    title: `河牌样例 ${i ? 'B' : 'A'} · 下注 ${fixture.betBb}bb`,
    modelLabel: '受限模型验证样例',
    conditions: { ...fixture, players: 2, street: 'river', futureCards: false, tableMax: null, originalStackBb: null },
    ev: { unit: 'bb', baseline: 'solve-start-zero-sum-half-pot', continuation: 'solved-average-strategy', approximateEqualityBb: 0.002 },
    boundary: '只适用于给定双方范围、公共牌及受限动作树。过牌后摊牌，不能加注、全下或继续发牌；不代表完整 9max／200bb 策略，也不评价来源手牌。',
    provenance: {
      method: 'self-generated; independently enumerated analytic benchmark and dual-engine verification',
      primary: { repository: 'https://github.com/ucsandman/postflop', commit: report.engines.primary, license: 'MIT', copyright: 'Copyright (c) 2026 Wes Sander' },
      reference: { repository: 'https://github.com/b-inary/postflop-solver', commit: report.engines.reference, license: 'AGPL-3.0-or-later', role: 'offline cross-check only' },
      data: 'Synthetic lab fixtures; no personal hand histories or third-party strategy archives',
    },
    rootEvBb: primary.rootEvBb,
    ranges: primary.nodes.filter(node => node.path === 'root' || node.path === 'root/check').map(node => ({ player: node.player, combos: node.combos.map(combo => ({ cards: combo.cards, weight: 1 })) })),
    nodes: primary.nodes.map(node => ({ ...node, actions: node.actions.map(action => ({ ...action, amountBb: action.id.startsWith('bet:') ? Number(action.id.slice(4)) : action.id === 'call' ? fixture.betBb : 0 })), combos: node.combos.map(combo => ({ ...combo, status: combo.opponentMass === 0 ? 'no-compatible-opponent' : combo.reachWeight === 0 ? 'unreachable' : 'reachable' })) })),
    terminals: primary.terminals,
    verification: { passed: true, fixtureHash: hash(fixture), primaryOutputHash: hash(primary), referenceOutputHash: hash(reference), reportHash: hash(report), report: evidence,
      engines: [primary, reference].map(result => ({ name: result.engine, iterations: result.iterations, seconds: result.seconds, nashConvBb: result.nashConvBb })) },
  };
  const document = { ...pack, contentHash: hash(pack) };
  await writeFile(new URL(fixture.id + '.json', output), JSON.stringify(document, null, 2) + '\n');
  console.log(fixture.id, document.contentHash);
}
