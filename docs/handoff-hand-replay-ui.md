# Handoff：手牌可视化回放（Hand Replay UI）

> 本文档是给新 Session 的自包含交接。开工前先按顺序阅读：`AGENTS.md` → `CONTEXT.md` → `docs/workflow.md` → `docs/ARCHITECTURE.md` → 本文档。遵守 AGENTS.md 全部治理规则（最小修改、先审查后实施、先计划审批、不暂存不提交、报告验证证据）。

## 一、任务目标

为导入的 GG 手牌提供一个**图形化回放视图**：牌桌布局 + 座位位置 + Hero 底牌 + 逐街（翻前/翻牌/转牌/河牌）公共牌与各家动作（BB 计）+ 摊牌与盈亏结果。让复盘从"读文字叙事"变成"看牌局演进"。

**性质**：只读的可视化派生层。不新增持久化对象、不写回任何手牌字段、不做实时建议、不接入策略域。

## 二、明确不做（边界）

- 不做胜率/equity 计算、solver 对照、GTO 提示（旧 GTO 参考已有 scoped 标注，不要在此叠加）。
- 不做动画过场（第一版静态逐街展示即可；动画留给木下后续要求）。
- 不动 Timer、Quick Capture、导入流程、Discover。
- 不引入任何外部库/CDN/Canvas 库——纯 DOM + CSS。
- 不修改任何手牌记录字段；回放组件禁止调用任何 `saveAll`。
- 移动端适配不是第一版目标（桌面优先，不横向溢出即可）。

## 三、数据来源（关键事实，均已核实）

手牌记录（`handReviews`）上可用的字段（V7.9.0 起 GG 导入即有，见 `src/modules/ggImportCoordinator.js` 的 `_makeReviewRecord`）：

| 字段 | 说明 |
| --- | --- |
| `heroPosition / heroCards` | 位置（BTN/SB/BB/UTG/MP/CO/HJ/UTG+1/MP+1）与 Hero 底牌（`'As Kd'` 空格分隔） |
| `bbValue / heroStartStack / heroEndStack` | 盲注（$）与起始/结束筹码（$） |
| `tableMax` | 桌型（6/9），0=未知 |
| `potType / preflopScenario / boardCode / boardCategory / board` | 底池类型、翻前场景、翻牌编码、牌面分类 |
| `actionLineOTF / OTT / OTR` | 逐街行动线短码（如 `B60-(3.2bb)-C`）——粗粒度 |
| `pBB / oId / oCards / ggId / gg` | 盈亏(BB)、对手、GG 标记 |
| `desc` | **唯一包含逐街动作序列的叙事文本**，是回放解析的主要来源 |

### desc 的精确格式（由 `src/parsers/ggParser.js` 生成，必须按此解析）

多行，行结构：

```
preflop 行动：Hero CO/[As Kd] raises to 2.5bb, BB Call
OTF翻牌 Ah 7c 2d    行动：B60 (3.2bb) C
OTT转牌 Qs    行动：X B50 (5.1bb)
OTR河牌 3h    行动：X F
BB [7h 6h] and won ($2.00/+40.0bb) with 一对
```

- **翻前行**：`preflop 行动：` 前缀；Hero 片段 = `Hero {位置}/[{底牌}] {动作}`；对手片段 = `{位置} {动作}`；片段用 `, ` 分隔。对手动作文案集合：`folds` / `Call` / `Raise {bb}bb` / `calls {bb}bb` / `raises to {bb}bb` / `checks`；Hero 动作：`raises to {bb}bb` / `calls {bb}bb` / `check` / `folds` / 原样文本。
- **翻后行**：`{OTF翻牌|OTT转牌|OTR河牌} {新出的公共牌}    行动：{动作 token 用空格连接}`。**注意陷阱：行内牌面只含"本街新出的牌"**（不是累积公共牌）；累积牌面需跨行累加（翻牌行=整幅翻牌，转牌行加一张，河牌行加一张）。可用 `hand.boardCards`（全 3-5 张）交叉校验。
- 翻后动作 token 集合（`ggParser._formatAction`）：`X`（过牌）/ `F`（弃牌）/ `C`（跟注）/ `B{0-500} ({bb}bb)`（按底池百分比下注）/ `B {bb}bb`（超大盘下注）/ `R{bb}bb`（加注到）。token 顺序 = 行动顺序，但 token 本身不含玩家名——**顺序归属需要按 desc 无法精确还原到人**，这是已知信息损耗。第一版可按"逐街动作序列"展示（不标谁做的），或按合理推断标注（加注者多为翻前侵略者）——**不要臆造归属**，倾向前者。
- **摊牌**：最后一条街行尾可能追加 `  shows [{牌}] ({牌型描述})`；对手摊牌是独立行 `{位置} [{牌}] and won|lost (${金额}/{+/-bb}bb) with {牌型}`。
- 大亏损手牌行尾有 `⚠️ 大底池亏损手牌，请详细复盘`。
- Run-it-twice 手牌的街道行可能不完整（解析器只按 FIRST/主街道取行）——降级路径必须兜住。

### 降级策略（必须实现）

`gg === true` 的手牌优先走完整回放；解析不出逐街动作（手工记录的 desc 是自由文本/模板，如 `preflop 行动：Hero /[Xx Xx] ...`）或街数残缺时，展示**降级视图**：结构化字段（位置/底牌/牌面/行动线短码/盈亏）+ desc 原文，并标注"该手牌暂无完整回放数据"。任何解析异常不得抛错打断 UI。

## 四、建议实现方案（可直接采用，也可在计划阶段提出更好方案）

1. **新模块 `src/modules/handReplay.js`**（仿 `handPicker.js` / `sessionClosure.js` 的自包含模块模式）：
   - 纯函数 `parseReplay(hand)` → `{ streets: [{ key:'preflop'|'flop'|'turn'|'river', newCards:[], actions:[...] }], hero:{position,cards,stackBB}, board:[], showdown:[], result:{pBB,endStackBB}, degraded:false|原因 }`——**纯函数、可契约测试、不触 Repo**。
   - `render(container, hand)` → 构建 DOM（建议 DOM API + 文档片段，参考 handPicker；或 innerHTML + 每次重绑，参考 sessionClosure 展开区）。
2. **UI 形态**：CSS 画的俯视牌桌（圆角椭圆容器 + 按位置摆位的座位点：BB/SB/BTN/CO/MP/HJ/UTG…，`tableMax` 决定位置集合；位置布局可静态映射表），Hero 座位高亮；底牌与公共牌用现成的 `Utils.renderCardBadges`（`src/utils.js`，Picks 已在用，含花色徽章）；底池按"累计投入（BB）"展示（desc 中金额够算每街投入的近似值；**不要声称精确底池**，未返还 uncalled 等场景以最终 `pBB` 为准）。逐街切换用"翻前 → 翻牌 → 转牌 → 河牌 → 结果"的分步条或上下步按钮。
3. **入口**：手牌列表展开区（`review.js` 的 `toggleHandExpand`，约 1890-1915 行区域）加「回放」按钮 + Picks 卡片行可选。点击 → 在展开区内嵌渲染回放（不需要弹窗）。样式用 styles.css 既有 CSS 变量（`--color-*`），四套主题（nimbus/ember/neon/pale）自动兼容，新增样式集中在 styles.css 一段并按 `/* [V7.9.x 新增] */` 注释。
4. **只读约束的验证**：契约测试断言调用 `parseReplay`/render 不改变 `pa_handReviews`。

## 五、测试与验证入口

- 契约测试加到 `tests/contracts/core.contract.test.js`（inline 合成手牌是既有惯例，无 fixture 目录）：
  1. `parseReplay` 对一条完整 GG 形手牌：四街齐全、公共牌累积正确（翻牌 3 张→河牌 5 张）、BB 动作序列正确；
  2. 缺街/手工模板 desc → `degraded` 路径，不抛错；
  3. run-it-twice 形手牌降级不崩；
  4. 回放渲染不改写手牌数据。
- e2e：`e2e/smoke.spec.js` 加一条——用既有合成手牌模式（参考"Session 收尾闭环"测试的 setInputFiles/fill 导入法）导入 → Hand 列表 → 打开回放 → 断言公共牌张数随街递增 + 无 console 错误。
- 交付前 `npm run check` 全绿 + 临时产物 `file://` 抽查（脚本模式参考既有做法：合成数据、只输出聚合计数，**不得在回复/日志打印任何真实牌局内容**）。

## 六、版本与文档纪律

- 当前未发布线是 **V7.9.1**（含 Phase 1）。本功能的版本号在计划审批时与木下确认（并入 V7.9.2 或按当时状态定），版本唯一来源 `src/constants.js`，`package.json`/lockfile 同步。
- 代码注释按 `// [Vx.x 新增]` 规范；CHANGELOG 未发布区加条目；ARCHITECTURE.md 模块图/DAG 补 `handReplay.js`；`docs/acceptance.md` 加对应人工验收项。
- 文件名/标识符英文 ASCII，与木下沟通用中文。

## 七、给木下的验收清单（建议，计划阶段确认）

- [ ] 任意一手 GG 导入手牌可打开图形回放：座位位置、Hero 底牌、逐街公共牌与动作、摊牌与盈亏。
- [ ] 手工记录的手牌打开回放显示降级视图，不报错。
- [ ] 回放是只读的：任何操作不改变手牌数据（导出对比前后一致）。
- [ ] 四套主题下回放样式正常，桌面无横向溢出。
- [ ] `file://` 与 HTTPS 行为一致，`npm run check` 全绿。

## 八、未决问题（计划阶段与木下确认）

1. 回放入口位置：仅 Hand 列表展开区，还是 Picks 卡片/手牌详情也加？
2. 逐街动作的呈现粒度：只按街列动作序列（推荐，信息无损），还是尝试标注动作归属（有臆造风险）？
3. 是否需要"上一步/下一步"播放式切换，还是四街并列一屏看完？
4. 版本号归属（V7.9.2 或其他）。

## 九、基线与前置

- 开工前 `git status --short` / `git log -1 --oneline` 确认基线；若 Phase 1（V7.9.1）尚未提交，先由木下提交或明确基线再开工。
- 本分支任务不阻塞主线；主线状态见 `CONTEXT.md`（Phase 0 数据真相 + Phase 1 收尾闭环已实现）。
