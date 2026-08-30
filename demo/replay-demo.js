// [演示页] Hand Replay 组件演示：合成数据 + 主题切换。非产品入口，仅本地查看。
import '../src/styles.css';
import { HandReplay } from '../src/modules/handReplay.js';

// 示例 1：6-max 四街打满 + 摊牌（desc 格式与 ggParser 生成格式一致）
const demo1 = {
  id: 'demo-1',
  gg: true,
  potType: 'SIA',
  boardCode: 'Ah7c2d',
  desc: [
    'preflop 行动：BB Raise 3.0bb, Hero BTN/[Ah Kd] calls 2.0bb',
    'OTF翻牌 Ah 7c 2d    行动：X B64 (3.2bb) C',
    'OTT转牌 Qs    行动：X B61 (5.0bb) C',
    'OTR河牌 3h    行动：X B76 (10.0bb) C  shows [Ah Kd] (一对A)',
    'BB [5d 4c] and won ($10.07/+20.1bb) with 顺子',
  ].join('\n'),
  heroPosition: 'BTN',
  heroCards: 'Ah Kd',
  bbValue: 0.5,
  heroStartStack: 50,
  heroEndStack: 39.95,
  tableMax: 6,
  pBB: -20.1,
};

// 示例 2：9-max，翻前 3bet 直接收池（只有翻前一条街）
const demo2 = {
  id: 'demo-2',
  gg: true,
  potType: '3IA',
  desc: [
    'preflop 行动：UTG Raise 2.5bb, UTG+1 folds, MP Call 2.5bb, MP+1 folds, HJ folds, Hero CO/[As Ks] raises to 12.0bb, BTN folds, SB folds, BB folds, UTG folds, MP folds',
  ].join('\n'),
  heroPosition: 'CO',
  heroCards: 'As Ks',
  bbValue: 1,
  heroStartStack: 100,
  heroEndStack: 114.5,
  tableMax: 9,
  pBB: 14.5,
};

// 示例 3：转牌结束 + 大亏损标记（街数残缺正常渲染）
const demo3 = {
  id: 'demo-3',
  gg: true,
  potType: 'SID',
  boardCode: '9c8s2h',
  desc: [
    'preflop 行动：Hero BB/[7h 6h] Raise 3.5bb, BTN Call 3.5bb',
    'OTF翻牌 9c 8s 2h    行动：X B66 (7.5bb) C',
    'OTT转牌 4c    行动：X F',
    '⚠️ 大底池亏损手牌，请详细复盘',
  ].join('\n'),
  heroPosition: 'BB',
  heroCards: '7h 6h',
  bbValue: 2,
  heroStartStack: 200,
  heroEndStack: 109.8,
  tableMax: 6,
  pBB: -45.1,
};

// 示例 4：手工记录（无 gg 标记）→ 降级视图
const demo4 = {
  id: 'demo-4',
  potType: 'limp',
  boardCode: 'Ks7h2d',
  desc: '翻前 CO 开 2.5bb 我在 BB 拿 KQ 跟注，翻牌 K72 两小被超池下注打了一整条街，河牌放弃。现在回想翻牌该 check-raise 一次。',
  pBB: -12.5,
};

[
  ['demo-1', demo1],
  ['demo-2', demo2],
  ['demo-3', demo3],
  ['demo-4', demo4],
].forEach(([id, hand]) => {
  HandReplay.render(document.getElementById(id), hand);
});

// 主题切换（与 app.js 的 body class 契约一致）
var THEMES = [
  ['pale', '默认 pale'],
  ['nimbus', 'Nimbus'],
  ['ember', 'Ember'],
  ['neon', 'Neon'],
];
var bar = document.getElementById('demoThemeBar');
var themeClasses = ['color-nimbus', 'color-ember', 'color-neon'];
THEMES.forEach(function (t, idx) {
  var btn = document.createElement('button');
  btn.className = 'demo-theme-btn' + (idx === 0 ? ' is-active' : '');
  btn.textContent = t[1];
  btn.addEventListener('click', function () {
    document.body.classList.remove.apply(document.body.classList, themeClasses);
    if (t[0] !== 'pale') document.body.classList.add('color-' + t[0]);
    bar.querySelectorAll('.demo-theme-btn').forEach(function (b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
  });
  bar.appendChild(btn);
});
