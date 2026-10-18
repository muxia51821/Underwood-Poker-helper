# GTO Wizard Study 与 Analyze 借鉴记录

后续 V7.14.0 已补入独立练习页、专项、历史与学习备份，见[Trainer 实施核对](trainer-implementation-audit.md)。本记录保留 V7.13.0 批次的来源与当时验收结果。

本记录服务于本项目的学习与复盘工作区实现，补充[既有研究](gto-wizard-observation.md)。整体页面、数据保护与实施顺序仍分别由[蓝图](poker-redesign-blueprint.md)和[路线图](poker-redesign-roadmap.md)负责。目标沿用个人 Cash 主线 9max / 200bb、次线 6max / 100bb；目标条件不能代替历史手牌或参考资料的实际条件。

2026-10-16 核查第一方帮助文档与本地源码，并在已授权的独立浏览器中用 REA 配合界面操作观察 Study 入口、Analyze 控件及上传窗口。没有上传文件、读取既有牌局记录、购买订阅或探测内部策略接口。官方说明与实际取样分别列出。

证据标记：**D** 为官方说明；**O** 为本轮观察；**L** 为本地源码核查；**I** 为本项目设计推断；**U** 为未取得的资料。建议与实际实现范围在文末分开记录。

## REA 取样

沿用隔离安装的 REA `6.5.0` 和独立 Edge 配置，连接仅 `127.0.0.1:9333`、允许来源仅 `https://app.gtowizard.com`。本轮证据目录为 `%LOCALAPPDATA%\PokerRedesignResearch\2026-10-16-study-analyze\evidence`，浏览器配置与凭据不进入项目。

| 标记 | 实际观察与产物 | 支持范围 |
| --- | --- | --- |
| O-SA01 | 导航链接指向 Study `/solutions`、Analyze `/analyze/v4/hands/table` | 实际入口路径，不据链接推断所有功能已验收。 |
| O-SA02 | `study-page-rea.json`，`ev_8c40aceea9f911865ad746006e09a326596ff31fa8814ff293fe76056cdb0a94`；`study-page-ui.json`、`study-page.png` | 观察到 Cash / 100bb 的翻前节点、策略／范围／Breakdown／报告入口、组合矩阵、整体行动和选中手牌信息。未抓取完整组合策略库，未据此认定 9max / 200bb 数据可用。 |
| O-SA03 | `analyze-safe-ui.json`、`analyze-controls.json`；`analyze-observation-metadata.json`，`ev_5b9fc3435199f750949ff01994019928a1b587fc283e7126e4649daf8d88e8f9` | 仅检查已知控件和页面结构；可见上传与筛选入口。首次快照在加载中没有识别控件，随后读回确认，未将快照为空写成模式不可用。未保存私人表格内容。 |
| O-SA04 | `analyze-upload-observation.json`，`ev_40843c841f7e3321c52f072fabf2fd22f42372ba7510d19e536114f5e729547d`；`analyze-upload.png` | REA 观察窗口内正常点击上传按钮，打开支持拖放／粘贴、文件、文件夹及自动上传入口的窗口；上传数为 0，随后关闭窗口并返回训练配置页。没有执行解算匹配或分析评分。 |

Analyze 的 REA 产物只保存来源 evidence ID、覆盖限制及与安全控件对应的派生记录，不保存请求 header、正文、cookie 或个人牌局；不能据此重建内部调用链。Study 的捕获与浏览器操作方式沿用[原研究的复现步骤](gto-wizard-observation.md#研究环境与复现)。本轮外部辅助脚本为 `observe.cjs` 与 `capture-upload.cjs`；后者会打开窗口，不选择或发送文件。

## 值得采用的主线

**从自己的疑问手牌进入对应场景，研究一项规律，再带着同一问题练习。** Analyze 负责找到问题与定位决策；Study 负责解释条件与比较；Practice 负责先回答、再对照。三者共享上下文，比增加三个互不相通的入口更有价值（I）。

## 官方资料与核心任务

| 标记 | 来源与核查位置 | 支持的事实 |
| --- | --- | --- |
| D1 | [Study Mode](https://help.gtowizard.com/study-mode/)：Navigation、Study Mode Overview、Strategy Tab、Ranges Tab | 先定位场景与行动节点，再查看整体策略、具体组合及双方范围；页面把局面信息与策略视图放在同一工作区。 |
| D2 | [Aggregate Reports](https://help.gtowizard.com/aggregate-reports-guide/)：Filtering、Grouping actions、Specific stats、filtered row | 按牌面筛选、分组、排序，合并动作粒度；可从选定牌面进入研究或练习。报告按牌面实际概率加权，筛选摘要随筛选变化。 |
| D3 | [Analyze Mode](https://help.gtowizard.com/analyze-mode-guide/)：How does it work | 官方流程上传牌谱并匹配解算条件；尺寸可能近似，部分节点没有解答。不能把这种匹配结果当作原始牌局事实。 |
| D4 | [Hand History Analyzer](https://help.gtowizard.com/how-to-use-the-hand-history-analyzer/)：Hand history table、Hand history toolbar、Replayer | 筛选与排序手牌，收藏疑问，通过相邻手牌导航和逐街回放复盘，再跳到研究页；展示未覆盖状态与尺寸差异。 |
| D5 | [Study Analyzed Hands](https://help.gtowizard.com/tips-and-tricks-to-study-analyzed-hands/)：Biggest pots、Solution browser、Underlying trends | 将结果与决策过程分开，带着牌面及行动进入研究；通过改变牌面或位置观察规律。 |

`https://help.gtowizard.com/analyze-mode/` 本轮重定向到 Study 页面；Analyze 的有效概览来源为 D3。未沿用错误页面标题判断模式功能。帮助文档中带有未来计划的措辞不作为已实现能力证据。

## 操作链与本项目的对应实现

以下对应关系属于设计建议（I），现有能力由 L 栏所指源码支持。

| 借鉴点与来源 | 本地基础（L） | 可实施的交互与用户收益（I） |
| --- | --- | --- |
| 场景先于图表，D1 | [analysisReadModel.js](../src/modules/analysisReadModel.js)：`getObservedProfile`；[strategyStudy.js](../src/modules/strategyStudy.js)：`getTopicHandReferences` | 手上一项问题保持可见：实际桌型、位置、牌面、行动节点与来源手牌。进入学习后无需重新找条件；有效筹码未知时直接写未知。 |
| 表格与相邻手牌回看，D4 | [store.js](../src/store/store.js)：`HandRepo`；[review.js](../src/modules/review.js)：已有 `marked`、`mistake`、`reflection` 与筛选呈现；[handReplay.js](../src/modules/handReplay.js)：`HandReplay` | 左侧待复盘队列，右侧详情；切换上一手 / 下一手保留队列筛选。按收藏、自己标注、时间或实际盈亏整理，减少反复开关列表。 |
| 分析状态有区别，D3、D4 | `normalizeLearningHand`、`deriveFlopDecision` 与回放降级结果 | 区分“可回放”“资料不足”“已有本人复盘”；没有匹配策略答案时不能显示“已 GTO 分析”。让用户知道接下来应补资料还是继续学习。 |
| 逐街看事实，D4、D5 | `HandReplay.parseReplay` 的街道、行动与牌面投影 | 先回看当时可见的牌与行动，再展开后续。底部保留“去学习这个问题”；个人牌局实际结果只用于回顾，不用于判定动作质量。 |
| 聚合报告寻找规律，D2 | [BTN 参考](../src/data/strategy/gtoRaw/BTNvsBB_SRP_flop.js)、[SB 参考](../src/data/strategy/gtoRaw/SBvsBB_SRP_flop.js)；[gtoBaseline.js](../src/data/strategy/gtoBaseline.js)：`GTO_LEGACY_SCOPE`；[utils.js](../src/utils.js)：`classifyBoard` | 参考浏览器按场景与牌面类型筛选，支持逐牌面分布、下注 / 过牌合并和下注频率排序。选择一行后查看该牌面，进入对应范围倾向题。理解差异时无需背诵所有尺寸。 |
| 从现象进入解释，D1、D5 | [strategyFramework.js](../src/data/strategyFramework.js)：`STRATEGY_TOPICS`、`resolveTopic`；[strategyLibrary.js](../src/modules/strategyLibrary.js)：`select` | 学习页保留当前主题、教材与来源、本人相关手牌以及参考表入口；按主题走向概念题。未匹配的参考不放在手牌旁充当标准答案。 |
| 研究后接练习，D2 | [conceptQuiz.js](../src/modules/conceptQuiz.js)：`getItems`；[strategyStudy.js](../src/modules/strategyStudy.js)：`getStrategyLearningTarget` | “练这个主题”继承主题；“练这类牌面”继承范围参考筛选；个人手牌盲测另作一种练习。返回时保留研究条件，避免只完成一次跳页。 |

建议的 Analyze 链：本地导入 / 选择已有场次 → 筛选待复盘手牌 → 定位到逐街事实 → 写下一个疑问 → 进入对应主题或参考 → 返回原队列。录入、解析、回放可复用；本项目不复制上传到远端分析的路径。

建议的 Study 链：选择主题或承接来源手牌 → 核对实际条件 → 阅读概念与来源 → 浏览支持该场景的聚合参考 → 对照相似牌面 → 进入相同筛选的练习。可以直接自由浏览，不要求先建立策略修订或填完表单才能开始。

## 可实现的数据边界

| 能力 | 数据条件与本轮结论 | 产品处理建议（I） |
| --- | --- | --- |
| 手上事实、自己的记录、真实盈亏 | L：本地已有；有效筹码、完整行动或回放归属可能缺失 | 不改变事实对象；缺字段保留未知。盈亏排序说明是结果排序，不叫“最大错误”。 |
| 单牌面整体参考频率 | L：两个 legacy 场景各收录 183 个翻牌，字段为 `bet75`、`bet50`、`bet33`、`check`，没有每个底牌组合的答案 | 可展示原记录及动作合并；持续保留 `GTO_LEGACY_SCOPE`。不能因来源手牌是 9max 就把参考改成 9max / 200bb。 |
| 筛选后参考摘要 | L：上述数据没有牌面出现概率权重；D2：官方报告有概率加权 | 若计算均值，只标“已收录牌面简单平均”和收录数量，不称全牌面总体频率。更稳妥的首版只展示每个牌面的分布。 |
| 13 × 13 策略矩阵、单组合动作、双方范围构成 | U：本轮没有取得匹配的组合范围、节点策略与条件版本 | 不按聚合频率涂满矩阵；不生成看似精确的双方范围。可以记录用户自己的范围假设，明确为假设。 |
| EV 差、错误严重度、EV Loss 排序、EQR、阻断评分 | U：本地参考没有所需的动作 EV、组合权重与对手策略 | 不自动计算或使用仿真分数。概念题可依教材答案评价；范围题只问范围倾向；个人手牌盲测只对照自己的前后判断。 |
| 改变动作后继续打，或跨街变体训练 | U：历史牌谱没有所有分支答案；本地聚合仅覆盖翻牌 | 回放可以逐街看真实记录；不把偏离历史行动后的画面称为有答案的对战。 |

`deriveFlopDecision` 源码明确说明匿名行动序列归属存在启发式边界。它足以给部分学习列表提供候选，不足以证明所有手牌都可做自动盲测；个人盲测需要另行核对节点归属与提交前的信息投影。

## 本轮落地优先级与可观察验收

建议优先串起“复盘队列 → 对应主题 / 参考 → 对应练习”的短链，再扩充矩阵式工具。以下是实现验收建议，不是测试通过记录。

1. **Analyze 工作区：** 使用合成手牌能筛选、收藏、切换相邻手牌、回看并进入学习；返回保留筛选与当前手牌。没有真实数据时给出导入或添加入口，不用示例牌冒充用户记录。
2. **Study 工作区：** 主题能看到原教材与来源；参考表的场景、牌面筛选、排序和 Bet / Check 合并确实改变内容。切换条件不会沿用上一场景的选中行；零结果有明确原因和清除筛选入口。
3. **跨模式接续：** 从参考选中牌面进入范围练习后题型与场景一致；从防守主题进入概念自测时，不误路由为进攻方 C-bet 标准答案。练习结束可回到原研究位置。
4. **无数据即留空：** 无组合答案的区域不出现 GTO 判分、EV Loss、双方精确范围或“已匹配 200bb”等标签；外部链接由用户主动打开，本地手牌不随链接或请求上传。
5. **本地使用：** 缓存后的核心浏览与作答不依赖 Wizard 服务；验证桌面、手机、键盘、刷新后可接续，以及新增本地状态的备份覆盖。具体离线生命周期与恢复沿用路线图，不在本记录另立一套规则。

## 尚未知且不阻塞产品工作的事项

本轮没有独立审计第三方套餐权限、内部接口或免费额度，也没有取得完整策略库。这些事项不作为本项目工作队列。只有未来决定提供组合级 GTO 判分时，合法可用的条件匹配答案数据才构成该功能的前置依赖。

## V7.13.0 实际实现范围

本轮用户授权由研究进入实现。当前采用增量接入，在原应用中增加「分析」「学习」入口，保留已有 Timer、Odds、Review 与 V7.12.0 工作区修改；没有执行路线图中的整站换壳或数据迁移。

| 已实现能力 | 源码落点 | 实际行为 |
| --- | --- | --- |
| 本地复盘队列 | [analyzeWorkspace.js](../src/modules/analyzeWorkspace.js)、[只读模型](../src/modules/studyAnalyzeModel.js) | 观察桌型、场次、场景、已有标记／错误标签、文字搜索与排序组合生效。选中后连续回放，相邻手牌取自当前筛选结果；空态可清除筛选或打开原导入窗口。 |
| 原数据与编辑衔接 | `HandRepo`、`HandReplay`、`openGGImportQuick`、`Navigation.goToHand` | 分析／学习本身只读；修改标记与笔记走既有手牌编辑，导入走既有本地预览与确认。没有把牌谱发送给 Wizard。 |
| 主题学习 | [studyWorkspace.js](../src/modules/studyWorkspace.js) | 八个主题引用已有概念与来源，按需阅读；展示本人相关手牌候选，进入对应主题的概念自测。防守主题不会被送去进攻方频率题。 |
| 牌面对照 | 同上与只读模型 | 两场景各 183 个已收录牌面；类别与代码筛选、频率排序、单牌面分布、下注／过牌合并、同场景两牌面对照、可展开的简单平均。切换场景清除旧对照；未收录的来源牌面不以别的牌面替代。 |
| 分析 → 学习 → 返回 | 两个工作区共享来源手牌与学习主题 | 相关主题由已记录街道与可归属的候选决策确定；不是任意节点的精确解算。返回保留当前筛选、手牌与队列位置；自由学习可解除来源关联。 |

本次未新增持久化集合或键。工作区筛选与选中项在本次打开应用期间保留，刷新后回到默认入口；既有手牌、标记、复盘及概念掌握度仍沿用原存储。持久化专项、完整练习历史、范围题语义改写与完整备份修复留给对应批次；当前只连接概念自测，不将旧频率 Quiz 的判分当作新工作区的组合级答案。

### 本轮验证

- `npm run check` 已通过：临时生产构建、83 项契约测试、36 项浏览器测试、单文件产物契约；其中新工作区链覆盖桌面、390px 手机和 `file://` 离线产物。
- 新契约覆盖只读筛选、未知桌型与盈亏、场景隔离、主题路由、参考源不变及非加权平均。新浏览器检查覆盖跨页返回、主题自测入口、牌面对照／合并、切换场景清除旧对照、零结果和用户文本转义。
- 四套主题 × 桌面／手机 × 分析／主题／参考视图完成独立布局检查：无页面横向溢出、无运行错误，新增工作区的可见按钮至少 44px；相关手牌的卡牌尺寸与手机底栏留白另作视觉核对。该检查使用合成数据，不代表真实用户试用。
- 这些结果支持已测行为，不等于真实手机软键盘或人工学习体验验收。新增人工步骤见[用户验收清单](acceptance.md#本地分析与学习v7130)。
- 检查日志与研究产物保存在隔离研究目录；没有暂存、提交、推送或发布。
