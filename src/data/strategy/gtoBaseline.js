// [V7.4.0] GTO 参考查询层 — 数据来自 gtoRaw
// [V7.9.0 修改] 移除 L1 极端阈值检测（detectExtremes/_compileExtremes/_parseUserFlopAction）：
// 旧 GTO 数据没有适用范围元数据，不应对个人手牌自动判断"偏离 GTO"。
// 本文件保留参考查询接口，并声明统一的 scoped legacy reference 适用范围。

import BTNvsBB from './gtoRaw/BTNvsBB_SRP_flop.js';
import SBvsBB from './gtoRaw/SBvsBB_SRP_flop.js';

var SCENARIOS = { BTNvsBB: BTNvsBB, SBvsBB: SBvsBB };

// [V7.9.0 新增] 旧 GTO 数据适用范围声明 — 所有展示 GTO 对照的位置统一引用此文案。
// gtoRaw 未记录筹码深度/桌型/盲注级别，未经 9max/200bb 主线档案验证，仅作结构性参考。
export var GTO_LEGACY_SCOPE = {
  status: 'legacy-reference',
  note: '旧 GTO 参考数据：条件未记录，未经 9max/200bb 主线档案验证，仅作结构性参考。',
};

/**
 * 查询某个场景+牌面的 GTO 参考频率
 */
export function getGTOReference(scenarioKey, boardCode) {
  var sc = SCENARIOS[scenarioKey];
  if (!sc) return null;
  for (var i = 0; i < sc.boards.length; i++) {
    if (sc.boards[i].code === boardCode) return sc.boards[i];
  }
  return null;
}

/**
 * 获取所有可用场景列表
 */
export function getAvailableScenarios() {
  return Object.keys(SCENARIOS).map(function (k) {
    return { key: k, label: SCENARIOS[k].description, hero: SCENARIOS[k].heroPosition, villain: SCENARIOS[k].villainPosition };
  });
}
