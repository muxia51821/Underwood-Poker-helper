// [V7.10.4 新增] GTO 基线种子数据（Phase: GTO 基线域）
// 来源均为公开可引用的聚合统计，来源/条件/转移边界内联（证据纪律）。
// 数值边界：主线 100-200bb 的逐 texture 精确数值在免费来源中是图片图表，v1 = 40bb 精确锚点 + 100bb 定性方向。
export var GTO_BASELINE_SEED_VERSION = 'v1';

var BBZ_SOURCE = {
  title: 'When They C-Bet Too Much (BBZ Poker)',
  url: 'https://bbzpoker.com/when-they-c-bet-too-much/',
  publisher: 'BBZ Poker（引用 GTO Wizard 聚合报告）',
  articleDate: '2025-11-19',
};
var GW_IP_SOURCE = {
  title: 'Flop Heuristics: IP C-Betting in Cash Games (GTO Wizard Blog)',
  url: 'https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/',
  publisher: 'GTO Wizard',
  articleDate: '2023-04-18',
};
var GW_SB_SOURCE = {
  title: 'Aggregate Flop Strategy: SB C-Betting in SRP (GTO Wizard Blog)',
  url: 'https://blog.gtowizard.com/aggregate-flop-strategy-sb-c-betting-in-srp/',
  publisher: 'GTO Wizard',
  articleDate: '',
};

export var GTO_BASELINE_SEEDS = [
  {
    id: 'gto-baseline-btnvsbb-cbet-40bb',
    evidenceId: 'ev-gto-btnvsbb-cbet-40bb',
    street: 'flop',
    question: 'cbet',
    scenario: 'BTNvsBB',
    conditions: { stackBB: 40, game: '6max 现金', tableSize: '6max', solver: 'GTO Wizard aggregated reports' },
    overall: { betFreq: 75.2, checkFreq: 24.8, sizingSplit: null },
    textureNotes: '',
    source: BBZ_SOURCE,
    transferBoundary: '40bb 有效筹码；主线 100-200bb 样本条件不符，仅作结构性参考，不构成直接对照',
    capturedAt: '2026-08-30',
    isActive: true,
  },
  {
    id: 'gto-baseline-covsbtn-cbet-40bb',
    evidenceId: 'ev-gto-covsbtn-cbet-40bb',
    street: 'flop',
    question: 'cbet',
    scenario: 'COvsBTN',
    conditions: { stackBB: 40, game: '6max 现金', tableSize: '6max', solver: 'GTO Wizard aggregated reports' },
    overall: { betFreq: 25.4, checkFreq: 74.6, sizingSplit: null },
    textureNotes: '9xx 与低对子面（55x/66x/77x）C-bet 更高：CO RFI 范围含 offsuit 9x 而 BTN flat 极少同结构牌；A99r 单点：CO cbet 81%，BTN 应对 call 75.4/fold 22.3/raise 2.2',
    source: BBZ_SOURCE,
    transferBoundary: '40bb 有效筹码；主线 100-200bb 样本条件不符，仅作结构性参考',
    capturedAt: '2026-08-30',
    isActive: true,
  },
  {
    id: 'gto-baseline-btnvsbb-cbet-100bb-directional',
    evidenceId: 'ev-gto-btnvsbb-cbet-100bb',
    street: 'flop',
    question: 'cbet',
    scenario: 'BTNvsBB',
    conditions: { stackBB: 100, game: '6max 现金 NL500', tableSize: '6max', solver: 'GTO Wizard（Simple solution，BB 不得 donk）' },
    overall: null,
    textureNotes: 'monotone 大幅降低；rainbow 最高；paired 面更高频但用小尺寸；A-high 低于 K-8 高牌面；disconnect 主 33%；OESD 面 66% 极化；连张面少用超池',
    source: GW_IP_SOURCE,
    transferBoundary: '逐 texture 数值为图表图片未能提取，仅定性方向；9max 与 6max 的 SRP 结构差异小但未验证',
    capturedAt: '2026-08-30',
    isActive: true,
  },
  {
    id: 'gto-baseline-sbvsbb-cbet-directional',
    evidenceId: 'ev-gto-sbvsbb-cbet-directional',
    street: 'flop',
    question: 'cbet',
    scenario: 'SBvsBB',
    conditions: { stackBB: 100, game: '6max 现金', tableSize: '6max', solver: 'GTO Wizard' },
    overall: null,
    textureNotes: 'SB 为 OOP 加注者，翻后从不在位置；C-bet 频率低于 IP 加注者（数值图表未采集，链接已存待补）',
    source: GW_SB_SOURCE,
    transferBoundary: '数值未采集；链接已存待补',
    capturedAt: '2026-08-30',
    isActive: true,
  },
];

// 种子 → 证据包（证据纪律闭环：来源/条件/边界随数据留痕）
export function gtoSeedToEvidencePack(seed) {
  return {
    id: seed.evidenceId,
    title: 'GTO 基线来源：' + seed.source.title,
    sourceType: 'article',
    sourceRef: seed.source.url,
    conditions: seed.conditions.stackBB + 'bb · ' + seed.conditions.game + ' · ' + seed.conditions.solver,
    methodSample: 'GTO 聚合解（' + seed.source.publisher + '，文章日期 ' + (seed.source.articleDate || '未标注') + '）',
    capturedAt: seed.capturedAt,
    transferBoundary: seed.transferBoundary,
    keyPoints: seed.textureNotes || (seed.overall ? 'C-bet ' + seed.overall.betFreq + '% / check ' + seed.overall.checkFreq + '%' : ''),
    createdAt: seed.capturedAt + ' 00:00',
    updatedAt: seed.capturedAt + ' 00:00',
  };
}
