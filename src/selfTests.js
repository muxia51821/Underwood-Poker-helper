import { GGParser } from './parsers/ggParser.js';
import { CONSTANTS } from './constants.js';

// [V6.10.2] 自测函数：CONSTANTS.DEV 控制，生产构建死代码消除
function runTests() {
// [V6.4.2 新增] GG 解析器自测用例
// [V6.9.2 扩充] 4→10 个测试用例，覆盖真实 GG 手牌场景
var errors = [];
function assert(cond, msg) {
  if (!cond) errors.push(msg);
}
function assertEq(actual, expected, msg) {
  if (actual !== expected)
    errors.push(
      msg + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)
    );
}

// Test 1: HU 手牌，Hero 翻前 3bet 对手弃牌，验证基础解析 + 盈亏
var test1 =
  'Poker Hand #RC100001\n' +
  '2026/05/01 12:00:00\n' +
  'Seat 1: Hero ($10.00 in chips)\n' +
  'Seat 2: Villain ($10.00 in chips)\n' +
  'Seat #2 is the button\n' +
  'Villain posts small blind $0.02\n' +
  'Hero posts big blind $0.05\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to Hero [Ah Kh]\n' +
  'Villain raises $0.10 to $0.15\n' +
  'Hero raises $0.30 to $0.45\n' +
  'Villain folds\n' +
  'Uncalled bet ($0.30) returned to Hero\n' +
  'Hero collected $0.33 from pot\n' +
  '*** SUMMARY ***\n';
var r1 = GGParser.parse(test1);
assert(r1.length === 1, 'Test1: 应返回1局');
if (r1.length) {
  var h1 = r1[0];
  assertEq(h1.handId, 'RC100001', 'Test1: handId');
  assertEq(h1.heroPosition, 'BB', 'Test1: heroPosition (HU BB)');
  assertEq(h1.potType, '3IA', 'Test1: potType (3bet)');
  assert(h1.heroCards === 'Ah Kh', 'Test1: heroCards');
  assert(Math.abs(h1.profit - 0.13) < 0.01, 'Test1: profit ~$0.13, got ' + h1.profit);
  assert(Math.abs(h1.profitBB - 2.6) < 0.1, 'Test1: profitBB ~2.6, got ' + h1.profitBB);
  assert(h1.boardCards === '', 'Test1: no board');
  assert(h1.board === '', 'Test1: no board texture');
}

// Test 2: 多人底池，Hero 河牌 all-in 被弃牌返还 uncalled，验证盈亏扣除
var test2 =
  'Poker Hand #RC200002\n' +
  '2026/05/02 12:00:00\n' +
  'Seat 1: Hero ($5.00 in chips)\n' +
  'Seat 3: OppA ($8.00 in chips)\n' +
  'Seat 5: OppB ($6.00 in chips)\n' +
  'Seat #3 is the button\n' +
  'Hero posts small blind $0.02\n' +
  'OppB posts big blind $0.05\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to Hero [Ts 9s]\n' +
  'OppA folds\n' +
  'OppB raises $0.10 to $0.15\n' +
  'Hero calls $0.13\n' +
  '*** FLOP *** [8s 7d 2c]\n' +
  'Hero checks\n' +
  'OppB bets $0.20\n' +
  'Hero calls $0.20\n' +
  '*** TURN *** [8s 7d 2c] [Jh]\n' +
  'Hero checks\n' +
  'OppB bets $0.50\n' +
  'Hero raises $1.50 to $2.00\n' +
  'OppB calls $1.50\n' +
  '*** RIVER *** [8s 7d 2c Jh] [3d]\n' +
  'Hero bets $2.65\n' +
  'OppB folds\n' +
  'Uncalled bet ($2.65) returned to Hero\n' +
  'Hero collected $4.55 from pot\n' +
  '*** SUMMARY ***\n';
var r2 = GGParser.parse(test2);
assert(r2.length === 1, 'Test2: 应返回1局');
if (r2.length) {
  var h2 = r2[0];
  assertEq(h2.handId, 'RC200002', 'Test2: handId');
  assertEq(h2.heroPosition, 'BB', 'Test2: heroPosition (3人桌, seat1=BB)');
  assertEq(h2.potType, 'SIA', 'Test2: potType (单次加注)');
  assert(Math.abs(h2.profit - 2.2) < 0.01, 'Test2: profit ~$2.20, got ' + h2.profit);
  assert(Math.abs(h2.profitBB - 44.0) < 0.5, 'Test2: profitBB ~44.0, got ' + h2.profitBB);
  assertEq(h2.board, 'R', 'Test2: board texture (rainbow)');
  assert(h2.boardCards.indexOf('Jh') >= 0, 'Test2: boardCards contains Jh');
  assert(h2.opponentId !== '', 'Test2: opponentId set');
}

// Test 3: _classifyBoard 辅助函数
assertEq(GGParser._classifyBoard('Ah Kh Qh'), 'M', 'Test3: 天花→M');
assertEq(GGParser._classifyBoard('Ah Kh Qd'), 'TT', 'Test3: 双色→TT');
assertEq(GGParser._classifyBoard('Ah Kd Qs'), 'R', 'Test3: 彩虹→R');

// Test 4: _sortCardsDesc 辅助函数
assertEq(GGParser._sortCardsDesc('Ah Kh Qh'), 'Ah Kh Qh', 'Test4: 高牌降序');
assertEq(GGParser._sortCardsDesc('2s As Ts'), 'As Ts 2s', 'Test4: A>T>2');

// [V6.9.2] Test 5: 真实手牌 — NL5 9-max + ante，Hero QsJd call 翻前，翻牌下注收池
var test5 =
  'Poker Hand #HD2815913697: Hold\'em No Limit ($0.02/$0.05($0.01)) - 2026/04/10 23:37:51\n' +
  'Table \'NLHAYellow5\' 9-max Seat #6 is the button\n' +
  'Seat 2: 492f627f ($26.04 in chips)\n' +
  'Seat 3: dcdf696b ($1.35 in chips)\n' +
  'Seat 4: 385a44f2 ($13.77 in chips)\n' +
  'Seat 5: Hero ($13.85 in chips)\n' +
  'Seat 6: 39cb3b74 ($10.55 in chips)\n' +
  'Seat 7: 73440f50 ($11.64 in chips)\n' +
  'Seat 8: 72866567 ($2.6 in chips)\n' +
  'Hero: posts the ante $0.01\n' +
  '492f627f: posts the ante $0.01\n' +
  'dcdf696b: posts the ante $0.01\n' +
  '73440f50: posts the ante $0.01\n' +
  '385a44f2: posts the ante $0.01\n' +
  '39cb3b74: posts the ante $0.01\n' +
  '72866567: posts the ante $0.01\n' +
  '73440f50: posts small blind $0.02\n' +
  '72866567: posts big blind $0.05\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to 492f627f\n' +
  'Dealt to dcdf696b\n' +
  'Dealt to 385a44f2\n' +
  'Dealt to Hero [Qs Jd]\n' +
  'Dealt to 39cb3b74\n' +
  'Dealt to 73440f50\n' +
  'Dealt to 72866567\n' +
  '492f627f: folds\n' +
  'dcdf696b: folds\n' +
  '385a44f2: raises $0.15 to $0.2\n' +
  'Hero: calls $0.2\n' +
  '39cb3b74: folds\n' +
  '73440f50: folds\n' +
  '72866567: folds\n' +
  '*** FLOP *** [Ah 2h Jh]\n' +
  '385a44f2: checks\n' +
  'Hero: bets $0.16\n' +
  '385a44f2: folds\n' +
  'Uncalled bet ($0.16) returned to Hero\n' +
  '*** SHOWDOWN ***\n' +
  'Hero collected $0.52 from pot\n' +
  '*** SUMMARY ***\n' +
  'Total pot $0.54 | Rake $0.02 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0\n' +
  'Board [Ah 2h Jh]\n' +
  'Seat 5: Hero showed [Jd] and won ($0.52)\n';
var r5 = GGParser.parse(test5);
assert(r5.length === 1, 'Test5: 应返回1局');
if (r5.length) {
  var h5 = r5[0];
  assertEq(h5.handId, 'HD2815913697', 'Test5: handId');
  assertEq(h5.heroCards, 'Qs Jd', 'Test5: heroCards QsJd');
  assert(h5.heroPosition !== '', 'Test5: heroPosition should be set');
  assert(h5.boardCards.indexOf('Ah') >= 0, 'Test5: board contains Ah');
  assertEq(h5.potType, 'SIA', 'Test5: potType (单次加注)');
  // 投入: ante$0.01 + call$0.2 = $0.21, 收集$0.52, profit=$0.31, BB=$0.05
  assert(Math.abs(h5.profit - 0.31) < 0.02, 'Test5: profit ~$0.31, got ' + h5.profit);
  assert(Math.abs(h5.profitBB - 6.2) < 0.5, 'Test5: profitBB ~6.2, got ' + h5.profitBB);
  assert(h5.board === 'M' || h5.board === 'TT', 'Test5: board texture (two hearts on board)');
}

// [V6.9.2] Test 6: 真实手牌 — NL10 6-max 无 ante，HU Hero BTN 河牌下注收池（collected 语法）
var test6 =
  'Poker Hand #HD2760968546: Hold\'em No Limit ($0.05/$0.1) - 2026/03/05 15:10:08\n' +
  'Table \'NLHBlue22\' 6-max Seat #4 is the button\n' +
  'Seat 1: 8ab4e007 ($10 in chips)\n' +
  'Seat 4: Hero ($10 in chips)\n' +
  'Hero: posts small blind $0.05\n' +
  '8ab4e007: posts big blind $0.1\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to 8ab4e007\n' +
  'Dealt to Hero [9c Qd]\n' +
  'Hero: raises $0.2 to $0.3\n' +
  '8ab4e007: calls $0.2\n' +
  '*** FLOP *** [5h 8d 7h]\n' +
  '8ab4e007: checks\n' +
  'Hero: checks\n' +
  '*** TURN *** [5h 8d 7h] [2d]\n' +
  '8ab4e007: checks\n' +
  'Hero: bets $0.24\n' +
  '8ab4e007: calls $0.24\n' +
  '*** RIVER *** [5h 8d 7h 2d] [Ah]\n' +
  '8ab4e007: checks\n' +
  'Hero: bets $1.35\n' +
  '8ab4e007: folds\n' +
  'Uncalled bet ($1.35) returned to Hero\n' +
  '*** SHOWDOWN ***\n' +
  'Hero collected $1.03 from pot\n' +
  '*** SUMMARY ***\n' +
  'Total pot $1.08 | Rake $0.05 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0\n' +
  'Board [5h 8d 7h 2d Ah]\n' +
  'Seat 4: Hero (small blind) won ($1.03)\n';
var r6 = GGParser.parse(test6);
assert(r6.length === 1, 'Test6: 应返回1局');
if (r6.length) {
  var h6 = r6[0];
  assertEq(h6.handId, 'HD2760968546', 'Test6: handId');
  assertEq(h6.heroCards, '9c Qd', 'Test6: heroCards 9cQd');
  assertEq(h6.heroPosition, 'BTN', 'Test6: heroPosition (HU BTN/SB)');
  assertEq(h6.potType, 'SIA', 'Test6: potType (open raise)');
  // 投入: SB$0.05 + raise$0.3 + bet$0.24 + bet$1.35 - uncalled$1.35 = $0.59
  // 收集: $1.03, profit=$0.44, BB=$0.1
  assert(Math.abs(h6.profit - 0.44) < 0.02, 'Test6: profit ~$0.44, got ' + h6.profit);
  assert(Math.abs(h6.profitBB - 4.4) < 0.5, 'Test6: profitBB ~4.4, got ' + h6.profitBB);
  assert(h6.boardCards.indexOf('Ah') >= 0, 'Test6: board contains Ah');
  assert(h6.board === 'TT' || h6.board === 'R', 'Test6: board texture');
}

// [V6.9.2] Test 7: 真实手牌 — NL10 9-max + ante，Run-it-twice 4bet all-in 分池
var test7 =
  'Poker Hand #HD2820341042: Hold\'em No Limit ($0.05/$0.1($0.02)) - 2026/04/13 22:41:29\n' +
  'Table \'NLHABlue56\' 9-max Seat #3 is the button\n' +
  'Seat 1: fe82ed85 ($19.98 in chips)\n' +
  'Seat 2: Hero ($20.86 in chips)\n' +
  'Seat 3: 77f6436 ($18.82 in chips)\n' +
  'Seat 4: 9cd733f8 ($20 in chips)\n' +
  'Seat 5: 63edae9 ($20 in chips)\n' +
  'Seat 6: 74ab4582 ($60.57 in chips)\n' +
  'Seat 7: f8c3aa72 ($21.39 in chips)\n' +
  'Seat 8: 1147b76a ($24.3 in chips)\n' +
  'Seat 9: bcde7b88 ($24.18 in chips)\n' +
  '77f6436: posts the ante $0.02\n' +
  'Hero: posts the ante $0.02\n' +
  '63edae9: posts the ante $0.02\n' +
  '1147b76a: posts the ante $0.02\n' +
  '9cd733f8: posts the ante $0.02\n' +
  'bcde7b88: posts the ante $0.02\n' +
  'f8c3aa72: posts the ante $0.02\n' +
  '74ab4582: posts the ante $0.02\n' +
  'fe82ed85: posts the ante $0.02\n' +
  '9cd733f8: posts small blind $0.05\n' +
  '63edae9: posts big blind $0.1\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to fe82ed85\n' +
  'Dealt to Hero [Kc Ah]\n' +
  'Dealt to 77f6436\n' +
  'Dealt to 9cd733f8\n' +
  'Dealt to 63edae9\n' +
  'Dealt to 74ab4582\n' +
  'Dealt to f8c3aa72\n' +
  'Dealt to 1147b76a\n' +
  'Dealt to bcde7b88\n' +
  '74ab4582: folds\n' +
  'f8c3aa72: folds\n' +
  '1147b76a: folds\n' +
  'bcde7b88: raises $0.2 to $0.3\n' +
  'fe82ed85: folds\n' +
  'Hero: raises $0.7 to $1\n' +
  '77f6436: raises $1.86 to $2.86\n' +
  '9cd733f8: folds\n' +
  '63edae9: folds\n' +
  'bcde7b88: folds\n' +
  'Hero: raises $17.98 to $20.84 and is all-in\n' +
  '77f6436: calls $15.94 and is all-in\n' +
  'Uncalled bet ($2.04) returned to Hero\n' +
  'Hero: shows [Kc Ah]\n' +
  '77f6436: shows [Kh Kd]\n' +
  '*** FIRST FLOP *** [3c 5c 5h]\n' +
  '*** FIRST TURN *** [3c 5c 5h] [Qd]\n' +
  '*** FIRST RIVER *** [3c 5c 5h Qd] [Ad]\n' +
  '*** SECOND FLOP *** [4h 8s 8d]\n' +
  '*** SECOND TURN *** [4h 8s 8d] [7s]\n' +
  '*** SECOND RIVER *** [4h 8s 8d 7s] [7h]\n' +
  '*** FIRST SHOWDOWN ***\n' +
  'Hero collected $18.33 from pot\n' +
  '*** SECOND SHOWDOWN ***\n' +
  '77f6436 collected $18.32 from pot\n' +
  '*** SUMMARY ***\n' +
  'Total pot $38.23 | Rake $1.5 | Jackpot $0.08 | Bingo $0 | Fortune $0 | Tax $0\n' +
  'Hand was run two times\n' +
  'FIRST Board [3c 5c 5h Qd Ad]\n' +
  'SECOND Board [4h 8s 8d 7s 7h]\n' +
  'Seat 2: Hero showed [Kc Ah] and won ($18.33) with two pair, Aces and Fives, and lost with two pair, Eights and Sevens\n' +
  'Seat 3: 77f6436 (button) showed [Kh Kd] and lost with two pair, Kings and Fives, and won ($18.32) with two pair, Kings and Eights\n';
var r7 = GGParser.parse(test7);
assert(r7.length === 1, 'Test7: 应返回1局');
if (r7.length) {
  var h7 = r7[0];
  assertEq(h7.handId, 'HD2820341042', 'Test7: handId');
  assertEq(h7.heroCards, 'Kc Ah', 'Test7: heroCards KcAh');
  assert(h7.potType.indexOf('4') >= 0 || h7.potType.indexOf('3') >= 0, 'Test7: potType 应有 3bet+ 标记');
  // 投入: ante$0.02 + raise$20.84 - uncalled$2.04 = $18.82
  // 收集: $18.33, profit≈-$0.49, BB=$0.1 → profitBB≈-4.9
  assert(h7.profit < 0 || Math.abs(h7.profit) < 1, 'Test7: profit near zero (split pot)');
  assert(h7.opponentId !== '', 'Test7: opponentId (vs KK)');
  // [V6.12.0] 修复 Run-it-twice 板面解析后恢复
  assert(h7.boardCards.length > 0, 'Test7: boardCards should be set');
}

// [V6.9.2] Test 8: _classifyBoard 扩展 — 公对面 + 边缘花色
assertEq(GGParser._classifyBoard('Ah Ad Kh'), 'TT', 'Test8: 公对+两色→TT');
assertEq(GGParser._classifyBoard('Ah Ad Kd'), 'TT', 'Test8: 公对+两色→TT');
assertEq(GGParser._classifyBoard('Ah Ad Ac'), 'R', 'Test8: 三条+三色→R');
assertEq(GGParser._classifyBoard('2h 7d Qs'), 'R', 'Test8: 彩虹低牌→R');
assertEq(GGParser._classifyBoard('Kh Th 5h'), 'M', 'Test8: 三天花→M');

// [V6.9.2] Test 9: _sortCardsDesc 扩展 — 多花色同值 + 连牌
assertEq(GGParser._sortCardsDesc('Ks Kh Kd'), 'Ks Kh Kd', 'Test9: 三条降序');
assertEq(GGParser._sortCardsDesc('Ts Js Qs'), 'Qs Js Ts', 'Test9: QJT 连牌降序');
assertEq(GGParser._sortCardsDesc('2c 3c 4c'), '4c 3c 2c', 'Test9: 小连牌降序');

// [V6.9.2] Test 10: 边缘格式 — "didn't bet" + 多局文本解析
var test10 =
  'Poker Hand #HD2760968534: Hold\'em No Limit ($0.05/$0.1) - 2026/03/05 15:09:56\n' +
  'Table \'NLHBlue22\' 6-max Seat #1 is the button\n' +
  'Seat 1: 8ab4e007 ($10 in chips)\n' +
  'Seat 4: Hero ($2 in chips)\n' +
  '8ab4e007: posts small blind $0.05\n' +
  'Hero: posts big blind $0.1\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to 8ab4e007\n' +
  'Dealt to Hero [5h 6s]\n' +
  '8ab4e007: folds\n' +
  'Uncalled bet ($0.05) returned to Hero\n' +
  '*** SHOWDOWN ***\n' +
  'Hero collected $0.1 from pot\n' +
  '*** SUMMARY ***\n' +
  'Total pot $0.1 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0\n' +
  'Seat 4: Hero (big blind) collected ($0.1)\n' +
  '\n' +
  'Poker Hand #HD2760968546: Hold\'em No Limit ($0.05/$0.1) - 2026/03/05 15:10:08\n' +
  'Table \'NLHBlue22\' 6-max Seat #4 is the button\n' +
  'Seat 1: 8ab4e007 ($9.9 in chips)\n' +
  'Seat 4: Hero ($2.05 in chips)\n' +
  'Hero: posts small blind $0.05\n' +
  '8ab4e007: posts big blind $0.1\n' +
  '*** HOLE CARDS ***\n' +
  'Dealt to 8ab4e007\n' +
  'Dealt to Hero [8s Td]\n' +
  'Hero: folds\n' +
  'Uncalled bet ($0.05) returned to 8ab4e007\n' +
  '*** SHOWDOWN ***\n' +
  '8ab4e007 collected $0.1 from pot\n' +
  '*** SUMMARY ***\n' +
  'Total pot $0.1 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0\n' +
  'Seat 1: 8ab4e007 (button) collected ($0.1)\n' +
  'Seat 4: Hero (small blind) folded before Flop\n';
var r10 = GGParser.parse(test10);
assert(r10.length === 2, 'Test10: 应返回2局（多局文本解析）');
if (r10.length >= 2) {
  var h10a = r10[0];
  assertEq(h10a.handId, 'HD2760968534', 'Test10a: 第1局 handId');
  assertEq(h10a.heroCards, '5h 6s', 'Test10a: heroCards');
  // Hero BB fold to SB walk → profit = SB $0.05 (uncalled returned)
  assert(h10a.profit > 0, 'Test10a: Hero should profit (walk)');

  var h10b = r10[1];
  assertEq(h10b.handId, 'HD2760968546', 'Test10b: 第2局 handId');
  assertEq(h10b.heroCards, '8s Td', 'Test10b: heroCards');
  // Hero SB folds → profit = -SB $0.05
  assert(h10b.profit < 0, 'Test10b: Hero should lose (folded SB)');
}

if (errors.length) {
  console.warn('GG 解析器自测失败 ' + errors.length + ' 项:', errors);
} else {
  console.log('GG 解析器自测全部通过 (' + 10 + ' 项)');
}
} // runTests()

if (CONSTANTS.DEV) { runTests(); }
