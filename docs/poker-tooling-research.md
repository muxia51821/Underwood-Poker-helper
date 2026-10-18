# Poker 开源工具复用研究

本文件是 2026-10-16 的选型调查，回答哪些已有工程可以帮助本项目形成可靠的范围学习与训练能力。产品流程见[新版蓝图](poker-redesign-blueprint.md)，实施批次见[重设计路线图](poker-redesign-roadmap.md)；本文件不修改应用架构，不表示候选已经集成或求解结果已经验证。

## 结论

建议保留现有 `GGParser`、导入协调、`Store`、回放和统一决策工作台，在其外部增加可替换的文件适配，而不是迁移到另一个扑克应用的整套技术栈。

优先借鉴 **RangeAssistant 的范围编辑与文件交换**；试验 **PokerKit + PHH 的手牌互操作与独立校验**；用 **b-inary/postflop-solver 的本机工具生成少量、可复核的翻后数据包**。TexasSolver 可作为第二引擎候选。浏览器内运行 solver 暂缓，现成训练项目主要用于学习交互和数据流水线。

**本轮没有找到已核验、来源与使用权限闭合、适配 Cash 9max／200bb 的完整翻前答案库。** 这表示本轮候选尚未满足条件，不表示这样的数据源不存在。6max／100bb 候选也不能因 README 写了 GTO 就直接纳入自动判分。

## 证据等级与调查边界

- **源码核查**：读取官方仓库 README、许可证、配置、接口及少量实现，能够确认代码表达的结构与限制。
- **官方说明**：作者对功能、精度或速度的介绍；未在本机复现的性能和正确性结论仍属于作者说明。
- **建议／推断**：针对本项目的接入方案和验证门槛。
- **未知**：没有取得足以确认的证据，不能由同类项目或界面标签补足。

通过 GitHub 连接器和 `gh` 只读核查公开仓库；公开仓库发现使用 agent-reach 的 GitHub 路由。没有安装或运行候选工程、下载策略库、处理真实手牌或测试 solver 性能。没有采用 star 数量作为成熟度或正确性依据。个别连接器请求失败后改用 GitHub API；API 返回 404 只说明该地址在本次访问条件下不可取得。

## 候选比较

| 候选 | 已核查事实 | 对本项目的用途 | 决策 |
| --- | --- | --- | --- |
| [PokerKit](https://github.com/uoftcprg/pokerkit) | 纯 Python，MIT；提供游戏状态、牌力计算和手牌读写；官方安装要求 Python 3.11+。不是现成 GTO 答案库。 | 隔离环境中生成合成手牌、校验行动／底池，试验 PHH 文件交换。 | 试验；不替换浏览器运行时。 |
| [PHH](https://github.com/uoftcprg/phh-std) | 手牌历史格式规范，MIT；PokerKit 提供 load／dump 和按行动遍历状态的接口。 | 作为可选交换格式，避免自创另一种通用手牌格式。 | 采用其语义作为适配参考，先试验字段映射。 |
| [postflop-solver](https://github.com/b-inary/postflop-solver) | Rust、AGPL-3.0-or-later；输入 OOP/IP 两个范围、公共牌、底池、筹码、下注树和抽水；可取策略与 EV，保存游戏树为二进制。作者公告自 2023-10 暂停开源开发，且警告接口可能无版本号变动。 | 独立本机工具生成翻后研究包，应用只导入冻结结果。 | 优先试验；固定 commit，不直接成为网页依赖。 |
| [WASM Postflop](https://github.com/b-inary/wasm-postflop) | AGPL-3.0-or-later，Vue + Rust/WASM；同样有暂停开发公告。部署设置 COOP／COEP 响应头，构建需要 Rust 工具链。 | 观察范围、树、策略和 EV 如何协同展示；后续评估单独研究工具。 | 暂缓嵌入。 |
| [TexasSolver](https://github.com/bupticybee/TexasSolver) | C++，LICENSE 是 AGPL v3；console 分支提供参数文件输入、Windows 命令行和 JSON 策略导出。README FAQ 对二进制转发、源码整合还有额外表述。 | 独立本机第二引擎、JSON 文件流水线。 | 试验；许可证表述和结果校验完成前不打包分发。 |
| [amaster97/poker_solver](https://github.com/amaster97/poker_solver) | 本次仓库、内容和 README API 均返回 404。 | 暂不能作为可复现依赖。 | 暂缓；当前无法核实 MIT、能力或维护状态。 |
| [RangeAssistant](https://github.com/HoldemPokerTools/RangeAssistant) | 根 LICENSE 确认 MIT；可编辑混合动作、拖拽复制、标签、`.range` JSON 导出；有 GTO+／Pio 范围字符串转换。React／Electron／PouchDB 工程，默认分支最后一次 commit 核查为 2022 年。 | 最有价值的范围编辑交互和格式适配参考。 | 采用设计经验，选择性适配算法；不迁移整栈。 |
| [prange](https://github.com/thlorenz/prange) | MIT、无运行时依赖、CommonJS；支持 `QQ+`、区间和反向缩写，README 与测试以手牌类别为主。 | 普通范围字符串解析参考。 | 有真实导入需求时试验；不用于完整加权逐花色答案格式。 |

事实依据分别见 [PokerKit README](https://github.com/uoftcprg/pokerkit/blob/abf795299eaac41183495a0956ce7136ce38ed64/README.rst)、[PokerKit 手牌接口](https://pokerkit.readthedocs.io/en/stable/notation.html)、[PHH 规范与许可](https://phh.readthedocs.io/en/stable/)、[postflop-solver README](https://github.com/b-inary/postflop-solver/blob/9d1509fe5077d019825f833eed04b16d342dfda1/README.md)、[WASM README](https://github.com/b-inary/wasm-postflop/blob/97360db7644329b1c23a7adf06e9aa59406e4d4b/README.md)、[WASM 响应头](https://github.com/b-inary/wasm-postflop/blob/97360db7644329b1c23a7adf06e9aa59406e4d4b/public/_headers)、[TexasSolver console 用法](https://github.com/bupticybee/TexasSolver/tree/console#usage)、[TexasSolver README／FAQ](https://github.com/bupticybee/TexasSolver/blob/bb53f8cbfff4841da2d75bd060d0ab269c3d5881/README.md)、[RangeAssistant LICENSE](https://github.com/HoldemPokerTools/RangeAssistant/blob/b2ef5f934fa33397cb123300da3ce84bbe514c18/LICENSE) 和 [prange README／LICENSE](https://github.com/thlorenz/prange/tree/6cbf10c3594970a1e1a0de9400ae1ef9dadfdb4c)。

### Solver 能解决什么

postflop-solver 的 [basic 示例](https://github.com/b-inary/postflop-solver/blob/9d1509fe5077d019825f833eed04b16d342dfda1/examples/basic.rs)明确输入两个范围，演示合法动作、逐底牌策略、权益、EV、内存估计和以底池为单位的 exploitability 目标。[file_io 示例](https://github.com/b-inary/postflop-solver/blob/9d1509fe5077d019825f833eed04b16d342dfda1/examples/file_io.rs)演示保存、读取及截断存储树。它不是开箱即用的统一 JSON 数据接口；应用需要自己的结果导出适配器。

这里的 heads-up postflop 可以用于一张 9max 桌上翻后只剩两人的局面，前提是入池范围、底池、有效筹码、行动树、抽水及遗漏条件得到声明。它不能求出完整 9 人翻前策略，也不能代表三人及以上仍在底池中的均衡。postflop-solver 对 folded-player bunching 的支持同样不等于多人底池求解；作者说明其相关实现最多处理四个已弃牌玩家。[算法与 bunching 说明](https://github.com/b-inary/postflop-solver/blob/9d1509fe5077d019825f833eed04b16d342dfda1/README.md#implementation-details)

TexasSolver 文档展示的也是 OOP／IP 范围及翻后公共牌输入，不能据此声称已有多人翻前方案。两位作者分别宣称与商业 solver 对齐、或指出另一引擎在旧版本比较中有差异；这些是不同作者在特定版本／树上的结果，不能替代本项目交叉验证，也不能直接决定引擎正确与否。

**建议**：先验证河牌小树，再验证转牌，最后才决定是否投入批量翻牌求解。不要从覆盖所有翻牌、所有尺寸、所有桌型开始。

### 源码许可与答案数据分开

MIT 或 AGPL 是所读代码的许可证据，不自动证明仓库内从别处取得的范围数据有再分发许可。自行求解的结果也应保留输入范围的来源与使用条件。AGPL 工具输出是否属于受许可覆盖的作品，取决于输出内容；不能把“独立进程”简化为所有数据都可随意传播。标准条款本身将输出是否构成 covered work 作为条件。[TexasSolver 所附 AGPL 第 2 节](https://github.com/bupticybee/TexasSolver/blob/bb53f8cbfff4841da2d75bd060d0ab269c3d5881/LICENSE)

TexasSolver 根许可证与 README FAQ 对传播、商业整合的表述不一致。工程上可以先保持本机隔离试验；决定嵌入／分发时再针对所用代码、二进制与实际接法澄清，不在本研究中替作者作许可承诺。

## 范围编辑与训练项目中值得借鉴的部分

### RangeAssistant：优先参考编辑器与交换方式

可借鉴的交互是：选中一个手牌类别调整动作权重，拖拽复制到相邻类别；同一格以分段颜色展示混合策略；用标签找范围；导出文件后在其他工具继续研究。[编辑器](https://github.com/HoldemPokerTools/RangeAssistant/blob/b2ef5f934fa33397cb123300da3ce84bbe514c18/packages/web/src/pages/BuildRange.js)、[转换与文件函数](https://github.com/HoldemPokerTools/RangeAssistant/blob/b2ef5f934fa33397cb123300da3ce84bbe514c18/packages/web/src/utils/range.js)

其 [JSON schema](https://github.com/HoldemPokerTools/RangeAssistant/blob/b2ef5f934fa33397cb123300da3ce84bbe514c18/packages/web/src/ranges/range.schema.json)保存动作、颜色、作者、标签和最多 169 个手牌类别的数值数组。它没有把桌型、有效筹码、前序行动、抽水、数据来源版本和动作 EV 设为必需条件；数值数组也没有完整限制动作长度与概率和。**不能原样当作我们的 GTO 答案契约**，但可作为可选导入格式：缺条件的文件进入“用户范围草稿”，由用户补充条件后才能成为练习来源。不能导入后默认为 GTO。

不用照搬 RNG 实现；概率抽样的区间边界、零权重与极小概率需要自己的合成分布验证。不要把一个开源编辑器的混合频率显示功能，当作它已附带完整求解数据的证据。

### 三个训练候选：有产品经验，也有答案边界

| 项目 | 值得借鉴 | 为什么不直接采用其答案库 |
| --- | --- | --- |
| [jensbaagaard/poker-practice](https://github.com/jensbaagaard/poker-practice) | viewer 与 trainer 共用场景；只加载所选数据集；缺失节点禁用；用户导入 JSON；独立 solver → 冻结脚本线 → 浏览器练习的流水线。 | README 声称 MIT，但本次根 LICENSE 404；`data/openSourcePokerData/README.md` 说明数据来自 Poker Trainer app 的内联 JSON chunks，不能仅凭“free to use”认定上游许可闭合。Cash 主要是 100bb；完整手牌是预生成脚本线，答错后沿指定线继续，不等于任意分支模拟。 |
| [mpcaren/preflop-range-trainer](https://github.com/mpcaren/preflop-range-trainer) | 单文件离线、逐题动作反馈、按弱项一键复练；到达节点的范围权重影响抽题。 | README 明确 8max 数据由 GTO Wizard 截图像素提取；根目录未见 LICENSE。不能当开放策略资产引入；100bb 和免抽水条件也不代表主线 9max／200bb。 |
| [Rizehigh/gto-preflop-trainer](https://github.com/Rizehigh/gto-preflop-trainer) | 查看其它位置时保留当前题与回答；学习矩阵与练习共用上下文。LICENSE 确认 MIT。 | `getPositionRfiRange(position)` 把 UTG／UTG+1／UTG+2 指向同一范围、多个 MP 与 HJ 指向同一范围；矩阵按桌型换座位，但取范围不传桌型。读取到的是手写范围映射，未核验生成记录，不能把 6–10max 界面覆盖当作分别求解的答案。 |

对应证据：[jensbaagaard README](https://github.com/jensbaagaard/poker-practice/blob/449993f78d995c77b72d0bcac418a8507dd6f783/README.md)、[上游数据说明](https://github.com/jensbaagaard/poker-practice/blob/449993f78d995c77b72d0bcac418a8507dd6f783/data/openSourcePokerData/README.md)、[mpcaren README](https://github.com/mpcaren/preflop-range-trainer/blob/6606aefc2f6b7fcb6ffff8b1d772c142102113b1/README.md)、[Rizehigh 范围映射](https://github.com/Rizehigh/gto-preflop-trainer/blob/21eba7209073083595aff95e1173a2215fe51e71/src/data/gtoRanges.ts)、[矩阵读取方式](https://github.com/Rizehigh/gto-preflop-trainer/blob/21eba7209073083595aff95e1173a2215fe51e71/src/components/PositionalRangeGrid.tsx)、[MIT LICENSE](https://github.com/Rizehigh/gto-preflop-trainer/blob/21eba7209073083595aff95e1173a2215fe51e71/LICENSE)。

这些项目可以减少交互与流水线探索；本次没有运行其应用，不能评价其实际体验是否成熟，也不能保证其判分正确。尤其不能照搬“只要动作频率大于零就正确”作为通用 EV 评分，也不能把手写理论解释升级成求解器证明。

## 保留现有底座，在接缝处复用

| 本项目边界 | 接入方式 | 最小验证 | 淘汰／暂停标准 |
| --- | --- | --- | --- |
| GG 导入、去重、Session 归组 | 继续用 `GGParser.parseDetailed` 和现有导入协调；PokerKit 仅作独立测试参考。其官方第三方格式列表未列 GG，不能默认替代。 | 两种桌型的合成手牌逐行动比对，含未知底牌、全下、边池与退款；差异必须定位，不能多数票判正确。 | 不能表达现有 GG 信息或要求浏览器引入 Python 时，不用于生产导入。 |
| 手牌交换 | PHH 外部适配器，保留原文、内部 ID 和本项目专有字段的映射记录；PHH 不替代完整应用备份。 | 合成 6max／9max 手牌导出→PokerKit 读回→状态比对；不能表示的事实明确报告。验证金额单位、座位／行动者、未知牌和退款。 | 发生静默丢字段或把缺失信息填成确定事实，停止接入并保留原格式。 |
| 用户范围编辑 | 参考 RangeAssistant，接入统一 Study 上下文；现有 Store 和备份机制管理保存。 | `AA` 六组合、`AKs` 四组合、`AKo` 十二组合；权重非法、重复、缺动作、零概率、概率和、花色阻断；往返不改变数值。 | 强制引入整套 React／PouchDB 或覆盖本地存储，放弃整栈复用，保留交互参考。 |
| 翻后答案生成 | 固定 postflop-solver commit，独立目录运行；导出可读结果文件，不修改应用依赖。 | 一棵河牌小树：条件与动作快照、概率和、阻断、EV 单位、求解精度；重跑与存取一致，再交叉检查第二引擎。 | 无法解释 EV 定义、内存不可控、结果不可重现、关键数值不一致时不进入自动判分。 |
| 浏览器练习 | 原 Practice 继续负责题目快照、作答、反馈和历史；导入文件只提供答案。 | 精确匹配场景，缺答案拒绝判分；旧题不被新答案重新评分；先答后揭示；导出／恢复与断网均可继续。 | 需要在线 API 才能查已下载数据，或条件不匹配仍给 GTO 分数，停止接入。 |

PokerKit 的导入格式与 PHH 接口见[官方文档](https://pokerkit.readthedocs.io/en/stable/notation.html)。本项目现有职责见 [`GGParser.parseDetailed`](../src/parsers/ggParser.js)、[`Store`](../src/store/store.js)、[`decisionContext`](../src/modules/decisionContext.js) 与 [`PracticeStore`](../src/store/practiceStore.js)；模块名和持久化契约以当前源码为准。

## 数据包应承载什么

以下是针对接入的建议，不是已落地格式。先用合成文件验证，再确定 schema；不为未知需求建立通用平台。

一个数据包至少区分：

- **来源与权限**：作者、来源链接、数据版本、代码／数据各自许可、生成时间和输入范围来源。
- **条件**：Cash／MTT、桌型、位置、有效筹码、盲注／ante、抽水规则、行动前缀与尺寸、公共牌、OOP／IP 范围。
- **求解与答案**：引擎 commit、算法配置、下注树、停止条件与实际收敛值、合法动作、逐组合频率；有动作 EV 时再提供动作 EV 及单位与计价基点。
- **适用边界**：手写范围、结构性参考、聚合范围或组合答案；未覆盖的节点明确缺失。169 类聚合与逐花色组合不互相冒充。

PHH 处理的是手牌历史交换，不能单独承担求解树、动作 EV、训练成绩和完整备份。solver 的内部二进制适合重载研究，不宜成为应用长期备份唯一格式。

第一份真实数据包宜聚焦 **6max／100bb 的一个有来源范围、明确抽水和下注树的双人翻后节点**；选择它是缩小验证规模，不意味着把主线改为 6max。随后再扩展至 9max／200bb 手牌中条件明确的双人翻后节点。9max／200bb 翻前数据继续寻找明确授权的来源或可验证生成方法，不用较浅筹码表缩放填补。

## 可复现记录与未完成项

候选读取基线如下，后续试验应固定 commit，不能把本次 README 说明永久视为当前状态：

| 仓库 | 本次读取的默认分支 commit |
| --- | --- |
| `uoftcprg/pokerkit` | `abf795299eaac41183495a0956ce7136ce38ed64` |
| `uoftcprg/phh-std` | `c1bd44c3d0faef9ed989be8d6675f814c0e0f62d` |
| `b-inary/postflop-solver` | `9d1509fe5077d019825f833eed04b16d342dfda1` |
| `b-inary/wasm-postflop` | `97360db7644329b1c23a7adf06e9aa59406e4d4b` |
| `bupticybee/TexasSolver` | `bb53f8cbfff4841da2d75bd060d0ab269c3d5881`；console 用法来自独立 `console` 分支，实际试验前固定该分支 commit。 |
| `HoldemPokerTools/RangeAssistant` | `b2ef5f934fa33397cb123300da3ce84bbe514c18` |
| `thlorenz/prange` | `6cbf10c3594970a1e1a0de9400ae1ef9dadfdb4c` |
| `jensbaagaard/poker-practice` | `449993f78d995c77b72d0bcac418a8507dd6f783` |
| `mpcaren/preflop-range-trainer` | `6606aefc2f6b7fcb6ffff8b1d772c142102113b1` |
| `Rizehigh/gto-preflop-trainer` | `21eba7209073083595aff95e1173a2215fe51e71` |

复现关键观察可只读打开上面的固定链接；通过 `gh api repos/OWNER/REPO/contents/PATH?ref=COMMIT` 读取相同内容。本轮没有 solver 本机运行、PHH 往返、候选 UI 浏览器验收或策略数据授权确认，以上最小验证均为后续试验门槛。没有因此新增依赖、迁移用户数据或改变 Git 历史。agent-reach 更新检查因 GitHub API 限流未取得结果，没有更新工具。
