# Poker 公开资源与接入建议

调查日期：2026-10-16。本文是本轮公开资源选型记录，面向当前的个人牌局复盘、学习与训练产品。数据候选的文件与许可细节见[策略数据调查](poker-data-resource-research.md)；此前工具核查见[工具复用研究](poker-tooling-research.md)。这些建议不表示候选已集成或求解正确性已经验证。

## 本轮结论

值得优先投入的新增资源是：`ts-fsrs` 的复习排程、HoldemMath 的明确授权数学数据、`ucsandman/postflop` 的独立翻后研究工具，以及 Poker Apprentice 的具体花色范围表示。它们分别解决“何时复习”“数学数据从哪里来”“如何自己生产研究结果”“如何保留组合语义”，不用再从零实现所有部分。

公开范围页面也有接近主线的线索：Verdict Poker 标注 9max / 200bb / 4bb RFI；但尚未核实抽水、生成过程和数据再使用许可。本轮仍未找到可直接内置、条件与生成证据完整的 Cash 9max / 200bb 翻前混合策略库。该结论仅限所核查候选，不表示网上不存在。

建议保持现有工作台、GG 解析、Store、备份和范围编辑器，按实际需求接小模块或文件。研究站的 React / Next.js / Python / Rust 技术栈不构成我们整体迁移框架的理由。

## 优先候选

| 资源与来源 | 已核查内容 | 对当前产品的用途 | 接入判断 |
| --- | --- | --- | --- |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | MIT；核心排程包支持 ESM，本次 package 无运行时 dependencies；提供复习记录与下次复习计算 | 在概念错题、个人计划练习中安排“今天复习什么” | 优先独立小试；无需引入参数优化器。记忆排程不等于扑克决策质量评估 |
| [HoldemMath Data](https://github.com/Julian-cloud-max/holdemmath-data) | 数据 CC BY 4.0、示例代码 MIT；权益矩阵及 4–20bb push/fold，缺逐手混合频率 | 数学查阅、权益练习、受限模型的数据包试验 | 优先核验小样本及署名；多人表有 single-caller 近似，不作为深码答案 |
| [ucsandman/postflop](https://github.com/ucsandman/postflop) | MIT；Rust 双人翻后引擎、CLI、WASM 工作台、结果 JSON、逐组合浏览和训练源码 | 独立生成小型翻后研究包；参考范围→节点→作答→检查器的衔接 | 新增的首要 solver 实验候选；先与已知解析案例和第二引擎对照，不立即嵌入应用 |
| [Poker Apprentice hand-range-notation](https://github.com/poker-apprentice/hand-range-notation) | MIT；支持 `AKs` 展开为具体花色、`AcKd` 精确组合和反向缩写 | 未来接组合级数据时保留花色与 blocker 语义 | 有组合级需求时试验；当前 prange 已承担类别解析，无需为了换库重做现有功能 |
| [PokerKit](https://github.com/uoftcprg/pokerkit) / [PHH](https://github.com/uoftcprg/phh-std) / [PHH Dataset](https://github.com/uoftcprg/phh-dataset) | MIT 项目；规则状态、交换格式与公开手牌语料 | 离线手牌校验、合成夹具、格式往返与复盘样例 | 继续作为独立校验工具；历史行动不作为 GTO 标签，语料不代表当前玩家池 |
| [RangeAssistant](https://github.com/HoldemPokerTools/RangeAssistant) | MIT；混合频率编辑、拖拽复制、导入导出交互 | 后续批量编辑及交换格式的参考 | 已知候选继续复用，避免迁入 React / Electron / PouchDB 整栈 |
| [PokerStove](https://github.com/andrewprock/pokerstove) | BSD-3-Clause；C++ 牌力和权益计算代码 | 权益计算的独立对照来源 | 数学核验候选，不能生成动作策略或直接替代 solver |

### ts-fsrs：先接排程，保留原始答题记录

**实际源码核查**：固定提交 [`c8ca282edc3fe1cdfa1c24912437938b63a25cb3`](https://github.com/open-spaced-repetition/ts-fsrs/tree/c8ca282edc3fe1cdfa1c24912437938b63a25cb3)。[`packages/fsrs/package.json`](https://github.com/open-spaced-repetition/ts-fsrs/blob/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/packages/fsrs/package.json) 将排程核心与原生参数训练 binding 分开，提供 ESM 导出；[`使用说明`](https://github.com/open-spaced-repetition/ts-fsrs/blob/c8ca282edc3fe1cdfa1c24912437938b63a25cb3/packages/fsrs/README.md) 展示作答后记录评分并计算下次复习。

**建议**：概念、个人计划和求解答案按不同题型及来源版本分别排程。保留实际回答、是否正确、主观回忆难度、算法版本；排程只是派生结果，不能覆写原始学习历史或把个人计划一致性变成 GTO 分数。先用固定时间和少量合成回答验证刷新、备份、过期任务及改期；已有用户记录缺少排程字段时按需加入，不重新改判历史。

### ucsandman/postflop：能力更贴近数据生产，但仍需独立验证

**实际源码核查**：固定提交 [`5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de`](https://github.com/ucsandman/postflop/tree/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de)，根 [`LICENSE`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/LICENSE) 为 MIT。该候选是新增研究对象，不能因文档完整就称为成熟或已验证引擎。

- [`solution.rs`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/engine/src/solution.rs) 保存配置、引擎版本、误差元数据、根组合顺序及各节点策略。版本和结构校验可参考。
- 实际读取约 4KB 的 [`fixture-river.json`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/fixture-river.json)：公共牌 `Ks 7d 2c 8h 3d`，OOP `KK,A4s,A5s`，IP `TT,JJ`，起始底池 10、有效筹码 20、免抽水，是小型河牌构造例。它不是完整 9max / 200bb 或 6max / 100bb 翻前结果。
- **重要格式区别**：该文件有节点动作频率与根 EV，没有逐节点逐动作 EV 数组。其 [`TrainPanel`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/web/components/TrainPanel.tsx) 通过 [`WASM handle`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/wasm/src/lib.rs) 的 `combo_evs` 获取后继价值，再交给评分函数。单纯把其 JSON 读进当前页面，并不足以实现真实动作 EV 反馈；需要经过核验的额外导出步骤。
- [`trainer.ts`](https://github.com/ucsandman/postflop/blob/5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de/web/lib/trainer.ts) 展示缺失 EV 跳过、按权重抽题和历史定位。代码还有高频动作判为 best 的阈值，因此评分规则只能作为参考；本项目需要自己规定数据精度和动作评价条件。

**官方说明**：作者提供可利用度测量、验证里程碑及性能数据，并明确未实现翻前求解和多人底池。上述正确性与速度尚未在本机复现。ICM、多人数的外围输入也不把双人翻后树变成多人均衡求解器。

**实际页面观察**：独立匿名浏览器打开[公开工作台](https://postflop-workbench.vercel.app/)，默认转牌示例成功加载，能看到公共牌、底池、筹码、矩阵、动作频率及检查器；页面无捕获到的运行异常。快速点击另一示例后最终仍显示默认转牌，本轮不据此声称示例切换或训练已经验收。没有提交作答、触发新求解或对显示数值作正确性认证。

**建议实验**：先复现一个可手算的河牌小树，再与固定版 `b-inary/postflop-solver` 在相同树、范围、抽水及 EV 基点下对照。通过后才生产小数据包，导出逐动作价值、动作尺寸、组合顺序、到达权重、输入条件和误差。输入来源必须记录；手工入池范围只能称为给定范围下的子局面解。

## 可借鉴的产品经验

| 第一方资源 | 官方页面说明 | 对我们的具体启发 |
| --- | --- | --- |
| [RangeSharp](https://www.rangesharp.com/) | Study 编辑与比较、导入、Decision / Recall 训练和间隔复习 | 同一范围既能“选动作”，也能“凭记忆还原范围”；每日建议应链接回原范围和历史。仅核查公开介绍，未实测账号功能或导入兼容 |
| [Forge.poker](https://forge.poker/en) | 今日复习列表、整张范围回忆与局面决策两种练习、自有范围导入 | 下次打开先给少量到期任务，减少反复配置；明确训练的是用户导入的范围。未把其关于记忆或收益的宣传当作已证实效果 |
| [Dtzaka/gto-trainer](https://github.com/Dtzaka/gto-trainer) | MIT；Leduc 玩具博弈，离线解表与浏览器查询使用同一节点键 | 可借鉴“生成端和训练端使用一致节点标识”的检查；Leduc 不能充当真实 NLHE 题库或替代 9max 求解 |
| [Pokeria](https://github.com/cbaezp/Pokeria) | MIT；综合学习、复盘和训练工程，README 将教学范围与精确 GTO 分开 | 参考答案能力声明与不给无依据 EV 分数的分层；不要仅按项目介绍导入其课程或图表 |

这些公开产品说明支持设计借鉴，不授权复制页面、品牌、图表或策略库。RangeSharp 和 Forge 未核实为开源，不列为源码依赖。

## 其他候选为什么暂不接入

| 候选 | 本次证据 | 判断 |
| --- | --- | --- |
| [Poker Apprentice hand-history-parser](https://github.com/poker-apprentice/hand-history-parser) | MIT；本次 README 支持表只有 Bodog / Bovada / Ignition；源码用 ANTLR，package 含多个运行时依赖 | 可参考结构化金额、行动与测试格式；没有 GGPoker 覆盖证据，保留现有 GGParser |
| [Poker Apprentice hand-evaluator](https://github.com/poker-apprentice/hand-evaluator) | 同组织公开仓库，但本次树未找到根 LICENSE，API 无识别许可 | 不能继承同组织其他包的 MIT 结论，暂不复制源码 |
| [ArtemIyX/TexasSolverLib](https://github.com/ArtemIyX/TexasSolverLib) | MIT 根代码与多个第三方许可；是独立于 `bupticybee/TexasSolver` 的工程。README 明确多人 CLI 仍是有界 tiny 研究路径，测试通过不证明多人 Nash | 留作 C++ 研究候选，不因多人字段或 preflop 目录就用于主线答案生产 |
| [Shark 2.0](https://github.com/24parida/shark-2.0) | README 描述 HU、简化下注尺寸及低概率子树的不可靠性；本次递归树未找到 license 文件，API 无识别许可 | 可阅读交互说明，暂不复制或打包；“free / open-source”标题不替代许可证 |
| [homanp/ohh](https://github.com/homanp/ohh) / [OHH 规范](https://hh-specs.handhistory.org/) | TypeScript 的 OHH 读写项目；根 LICENSE 本次 404，规范可公开查阅 | 规范可作字段参考，包的代码许可另查；OHH JSON 与 PHH 是不同格式，不混用名称 |
| [amaster97/poker_solver](https://github.com/amaster97/poker_solver) | 本轮官方 GitHub API 仍返回 404；搜索索引能看到历史内容 | 索引可发现线索，不能据此确认当前仓库可复现、MIT 或可安装；不采用镜像二进制 |

此前 `b-inary/postflop-solver`、WASM Postflop 和 `bupticybee/TexasSolver` 的 AGPL 代码仍是研究候选，原研究记录保留；本轮不把它们因许可证不同就判为不能使用。具体集成和分发方案需要分别核查，当前不修改主应用依赖。

## 推荐实施顺序

1. **今天复习什么**：将概念错题和个人计划练习接到可恢复的复习队列，独立试验 FSRS 排程；题型和来源版本分开，反馈仍沿用各自的真实依据。
2. **第一份明确许可的小数据包**：用 HoldemMath 的小样本验证版权署名、单位、条件、缺失项和类别映射；权益先用独立计算核对，短码模型单列，不扩成 200bb。
3. **第一份自生成研究包**：隔离验证 MIT postflop 的小树、误差和逐动作 EV 导出，再进入查看→作答→反馈的同源数据流程。
4. **主线深码资料**：Verdict / FreeBetRange 保持外链研究入口；PokerData 保留为未来授权采购路线。需要准确来源和权限的部分，不能由手工抄表或公开接口可达代替。

这些是基于本轮证据的推荐，没有开始安装、接入、购买或发布。公开资料继续研究与个人范围训练可以独立推进，不必等待一套覆盖所有条件的大库。

## 可复现性与边界

本轮组合通用网页搜索、GitHub 仓库与源码搜索、HF 数据集和公开产品站；搜索结果中的 Reddit / Two Plus Two 作者帖仅用于发现候选，技术结论回到官方仓库、文件和第一方页面。未登录任何账号，也没有发帖或联系作者。搜索关键词覆盖 poker solver / preflop trainer / 9max 200bb / hand history parser / FSRS / open dataset 及中文 GTO 开源工具。

Agent Reach 体检发现 Exa 与社交后端未配置，因此使用内置网页搜索和已有 `gh`，没有为调研安装工具或索要账号。更新检查显示 Agent Reach 为 v1.5.0 且无可用更新；没有改全局配置。

GitHub 固定源码可通过 `gh api repos/OWNER/REPO/contents/PATH?ref=COMMIT` 复现。读取的少量源码、许可、API 元数据与公开示例界面证据保存在本机 `%LOCALAPPDATA%/PokerRedesignResearch/2026-10-16-resources/`。11MB 的转牌 JSON 只核对文件元数据，没有经 GitHub API 下载；公开工作台可能自行加载其默认示例。未运行候选的完整测试或本地重算求解。

仅新增本文与[策略数据调查](poker-data-resource-research.md)，没有修改应用、依赖、版本、用户数据或 Git 历史。没有运行 `npm run check`，因为本轮无产品代码改动；既有测试通过不能替代候选工具或数据验收。

## 本轮固定版本索引

下列提交是本次读取证据所用版本，不表示最新或推荐部署版本。

| 仓库 | 提交 |
| --- | --- |
| `ucsandman/postflop` | `5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de` |
| `open-spaced-repetition/ts-fsrs` | `c8ca282edc3fe1cdfa1c24912437938b63a25cb3` |
| `poker-apprentice/hand-range-notation` | `78af360c97eae225209cceb8b3a706769b18540a` |
| `poker-apprentice/hand-history-parser` | `eaa7d9016668fef0a0663b1d8dc4df8b667567b2` |
| `poker-apprentice/hand-evaluator` | `3ed428ba4877400695161a79d72861c4696c0b15` |
| `uoftcprg/phh-dataset` | `e47fbd5816372360bade4de5d712346fe1bb70f6` |
| `andrewprock/pokerstove` | `ae377e23cfd0cf2a5e2cdc11891a93307a30a65d` |
| `Dtzaka/gto-trainer` | `d43dfafbc13dc376239e9afbdcb4553b9c9c2895` |
| `cbaezp/Pokeria` | `db5aff321f29f77cae15e5f33bb24fd48dfc4239` |
| `ArtemIyX/TexasSolverLib` | `d651ebba2b58121d880a4ead563340f914d5cbf0` |
| `24parida/shark-2.0` | `23e5915f4c6dc6c1c88257f037f61704ca189221` |
| `homanp/ohh` | `9e9143af279854b7bac51998a99eb68c95449d38` |

策略数据候选的固定提交、字段及授权证据由独立数据调查记录，不在此复制。
