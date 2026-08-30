# Poker Personal OS

## 目标与范围

Underwood's Table Agent 是个人 NLHE Cash 的长期提升系统：从真实牌局中发现问题，形成有证据的工作策略，训练并在后续牌局中复测。

- 主线：9max、200bb effective stack；次线：6max、100bb。
- 复盘为主，实时为辅助。近期实时能力是 Mark 与牌桌导航；实时 fold/call/raise 模型留在远期。
- 每场牌局以 warm-up 开始、以 Session Closure 结束；周期复盘用于发现跨期规律。
- 历史导入只处理木下自行整理后的 `.txt` Hand History；不做 zip 解析。

## 产品外壳

```text
Timer | Odds | Review
                 ^
Quick Capture ---|（全局 Mark，进入 Review / Hand）
```

| 入口 | 职责 |
| --- | --- |
| `Timer` | 纯时间记录：开始、结束与休息。其他模块可读取时间事实，但不把策略或复盘塞入 Timer。 |
| `Odds` | 即时数学与标明适用范围的速查。 |
| `Review` | 个人手牌、发现、Session 收尾、周期分析、对手资料与策略。 |
| `Quick Capture` | 牌局中以最少输入留下 Mark；不是新 Tab，也不替代完整复盘。 |

五条产品主线落在上述结构中，而不是变成五个页面：

| 主线 | 现有基础 | 要补齐的能力 |
| --- | --- | --- |
| Game Memory | Hand、Session、GG 解析与导入 | 批量历史、结构化决策、Mark 匹配 |
| Decision Intelligence | Discover、统计、只读分析模型 | 主动发现 Signal 与研究 Dossier |
| Evidence & Strategy | Odds 与现有策略速查 | 多来源证据与工作策略 |
| Mastery & Operations | Timer、Session、Quiz、Tilt | Session Closure、策略驱动训练与复测 |
| Ecology & Opponent Memory | aliases、live flags、Opponent | 有证据和时效的对手/桌况上下文 |

## 使用闭环

```text
warm-up -> Timer -> 可选 Mark -> 结束 Session -> 导入 .txt
-> 匹配 Mark 与系统候选 -> 复盘该场真正值得看的手牌
-> Session Closure -> 周期规律 -> 策略 / 训练 / 复测
```

候选手牌宁可多给，由木下裁决。其来源包括 Mark、高杠杆或新颖决策、重复的决策类型、当前策略复测和数据缺口；盈亏只提供语境，不单独决定选题。系统只根据可观察事实提醒时间、休息、未完成收尾和导入断链，不伪造对情绪、桌况或实时胜率变化的理解。

## 策略与证据

```text
Hand Fact -> Decision Observation -> Decision Family / Spot
                                      -> Signal -> Finding Dossier
Evidence Pack ---------------------------------> Strategy Revision -> Learning Unit
```

- 手牌事实、派生分析、策略结论和训练记录分开保存；策略不会回写事实。
- 基线（GTO）、人口/对手证据、个人观察池并列呈现。来源条件不同仍可提供结构性参考，但数值对照只在直接条件相符时展示。
- `maintain`、`candidate-adjustment`、`research` 都是有效策略结论；证据不足不强迫改策略。
- 线上和线下共用策略模型，人口证据分开。
- GTO Wizard 借鉴的是 aggregate 结构与即时反馈；Savant 借鉴的是有边界的策略内容和间隔复习。产品的闭环是“个人数据诊断 -> 证据 -> 策略 -> 训练 -> 真实复测”，不是复刻 solver。
- 证据免费优先。每项外部资料保存来源、条件、方法/样本、时间和转移边界；AI 负责广泛检索、找反例和整理，木下保留最终裁决。

## 架构方向

- `Review` 是展示与编排层；研究、证据、策略和训练的生命周期进入独立领域模块。
- 现有只读分析模型成为 Decision Observation 与 Signal 的共同入口；Discover 只生成候选，不直接宣布 leak。
- 现有导航层负责在 Session、Hand、Finding、Strategy 与 Opponent 之间携带上下文，不增加第四主页面。
- 旧的局部 GTO 数据保留为 scoped legacy reference，不对主线档案自动标记“偏离 GTO”。
- 新持久化对象有独立 Repository、迁移、导出、导入和恢复路径；不把策略字段塞进既有手牌记录。
- 保持单文件离线产物与本地优先，不为未来假设预设云同步、账户或复杂 adapter。

## 推进顺序

### Phase 0 — 数据真相

批量导入整理后的 `.txt` 历史，建立可重算的档案与结构化决策；修正 Discover 缓存；标明旧 GTO 的适用范围。

### Phase 1 — Session Closure

把全局 Mark、Session、手牌导入与候选手牌连成每场固定收尾；Timer 保持纯计时。

### Phase 2 — Decision Radar

建立 Observation、Family、Signal 与 Dossier，让系统从个人样本提出可核查的 postflop 候选。

### Phase 3 — Evidence & Strategy

在 Review 内加入 Strategy，连接外部资料、个人观察和工作策略；策略必须有适用范围、证据和复测条件。

### Phase 4 — Mastery & Ecology

由策略生成训练与复测，完善对手/桌况上下文，并扩展跨 Tab 的上下文导航。

### Phase 5 — 远期裁决

只有前述闭环被持续使用并产生价值证据后，再评估云端深度分析、更多档案和实时行动模型。

## 阶段门槛

每一阶段先以一条真实使用链验证：事实可追溯、策略不回写事实、离线数据可恢复、用户能完成该阶段的实际动作。通过后再进入下一阶段；不机械地一次实现完整路线图。
