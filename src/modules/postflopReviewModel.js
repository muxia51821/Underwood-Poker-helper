// [V7.19.0 新增] Personal plans and entered conditions never become solver answers.
export const POSTFLOP_REVIEW_FIELDS = ['potBb', 'effectiveStackBb', 'conditionNote', 'rangeHypothesis', 'streetPlan', 'nextStreetPlan'];
export const POSTFLOP_PLAN_LABELS = { rangeHypothesis: '对手范围假设', streetPlan: '本街行动、尺度与目的', nextStreetPlan: '后续计划' };
const amount = value => /^\d+(\.\d+)?$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
export function postflopReview(value = {}, strict = false) {
  const review = {};
  for (const key of POSTFLOP_REVIEW_FIELDS) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 2000)) throw new Error('翻后决策卡字段无效，请核对原始记录。');
    review[key] = value[key] || '';
  }
  if (strict) for (const [key, label] of [['potBb', '行动前底池'], ['effectiveStackBb', '节点剩余有效筹码']]) {
    if (review[key].trim() && (amount(review[key]) === null || (key === 'potBb' && amount(review[key]) <= 0)))
      throw new Error(label + '请填写' + (key === 'potBb' ? '大于 0' : '不小于 0') + '的 bb 数值；未知可留空。');
  }
  return review;
}
export function postflopFacts(value = {}) {
  const review = postflopReview(value);
  const pot = amount(review.potBb);
  const effectiveStack = amount(review.effectiveStackBb);
  return { pot: pot !== null && pot > 0 ? pot : null, effectiveStack,
    conditionSource: (pot !== null && pot > 0) || effectiveStack !== null ? 'user-entered' : 'unknown', conditionNote: review.conditionNote };
}
