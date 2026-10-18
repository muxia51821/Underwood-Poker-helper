// [V7.18.0 新增] Shared display for research and frozen practice feedback.
import { Utils } from '../utils.js';
import { solutionActionLabel } from './solutionPackModel.js';
const esc = value => Utils.escapeHtml(String(value ?? ''));
const number = value => value === null ? '未计算' : Utils.safeFixed(value,4)+'bb';
export const SOLUTION_EV_EXPLANATION = '期望值（EV）以求解起点为基准，并计入双方已有投入。初始底池为 10bb 时，弃牌 EV 是 −5bb；动作 EV 表示双方从此处继续按参考策略行动后的期望结果。';
export function solutionValuesTable(node, combo) {
  return '<table class="solution-values"><thead><tr><th>动作</th><th>频率</th><th>动作期望值</th></tr></thead><tbody>'+node.actions.map((a,i) => '<tr><th>'+esc(solutionActionLabel(a.id))+'</th><td>'+(combo.frequency[i] === null ? '本分支无数据' : Utils.safeFixed(combo.frequency[i]*100,2)+'%')+'</td><td>'+number(combo.evBb[i])+'</td></tr>').join('')+'</tbody></table>';
}
