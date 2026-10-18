# GTO Wizard observation

## 调查结论与覆盖范围

2026-10-15 至 2026-10-16 的调查已在独立环境实际运行 REA。第一轮完成未登录边界、页面捕获和脚本静态分析；用户自行登录后，第二轮先阅读官方练习介绍，再完成设置、开始、一次作答、反馈、下一题、本轮总结、历史展开、回放与重复原手牌的研究取样。

本次使用木下说明的免费账号，只提交了一个决策，另外查看下一题和原题重复，不读取已有的历史手牌或上传个人牌局。研究用于理解有价值的训练方法与交互，为本项目自主设计提供参照；第三方套餐、额度、历史存储和内部接口不属于本项目验收对象。新版界面与实现建议分别见[产品蓝图](poker-redesign-blueprint.md)和[实施路线图](poker-redesign-roadmap.md)。

证据分级：

- **O / 实际观察**：本轮工具或浏览器返回的结果，仅支持其捕获范围。
- **D / 官方说明**：第一方教程所描述的功能，不等于本账号可用性。
- **I / 推断**：从观察和本地代码得出的设计或可行性判断，需要实现验证。
- **U / 未知**：本轮未获得足够证据，不能当作已验证需求或实现事实。

## 证据索引

### 本轮观察

| 编号 | 证据与结果 | 支持的结论 | 不能推出的结论 |
| --- | --- | --- | --- |
| O01 | 独立目录安装 `rea-agents@6.5.0`；`rea --version` 返回 `6.5.0`，Node 为 `v24.15.0` | 固定版本命令行已能运行；项目依赖未改变 | 每个 REA provider 或原生工具均已可用 |
| O02 | Edge `155.0.4283.45`；CDP 实际监听 `127.0.0.1:9333`；目标为 `Login - GTO Wizard`、`https://app.gtowizard.com/login` | 已连上独立浏览器的目标页面；训练入口需要登录 | 免费账号的功能权限与剩余额度 |
| O03 | `login-inspection.json`，REA evidence ID `ev_905a11ad4cd3bfe54b550b8541a822d0d3f819a1e797a766a723584b889d8fdd` | 捕获到登录页的 DOM、脚本和资源元数据 | 连接前的网络流量、第三方 frame 内容或训练反馈 |
| O04 | `login-bundle.json`，REA evidence ID `ev_cb95a5bee70ba0402e5eca7aae7fed863c23b2dce92dd26d4e913dafe06705e1` | 静态检查了 589 个脚本，得到 589 个 chunk 节点、3614 条关系及路由线索 | 完整源代码恢复、完整调用图、运行时请求或求解器实现 |
| O05 | 用户确认登录；`signed-in-home.json`，REA ID `ev_de6e0f9eecac69d8305d40840c8013d5fa3ec4aa922adfecdc5fa3124c24a73f`；随后进入 `/practice/trainer` | 本账号能进入练习首页和 Trainer 配置页 | 免费账号所有入口均可用；原有训练历史的内容或来源 |
| O06 | `settings-before.json`：`ev_9cc4b907f4fbd9298d04e6e63e9968cd5e7ae61f5804f7ad7c6bc2cb8cb5d679`；`settings-tabs.json`；`settings-batch-events.json`：`ev_33dd5e579efbc66e7c87461e719470d93e5c4801856c0d3fbc0edc064033eeb9` | 五组设置可浏览，区分训练对象、模式与显示 | 所有可见选项均已切换并通过权限验证 |
| O07 | `research-start-events.json`：`ev_7d59ead8e904b32e94abf889232a5bc49400c66e188af3b566b704b52d9073ec`；配置和题目快照 | 以 BTN 对 BB、单次加注底池、翻牌、单节点、单桌、每步反馈、自动下一手关闭的配置成功开始；首题实际 150bb | 目标档案为 200bb；顶部格式摘要已经锁定全部题目条件 |
| O08 | `research-answer-rea.json`：`ev_b011451265f673a9f78ceac32e02c5adb496fc3930463fa8541fbc16703464e3`；`research-feedback-inspection.json`：`ev_b83c48f3617e3f20d92525dc709dd113cfad578e8a513af1c756e49f35ed7d47`；提交前后 UI 与工作区截图 | 一次 Check 提交后显示动作频率、各动作 EV、评分和本轮历史；本轮计数为 1 手牌 / 1 行动 | 通用评分算法、未显示精度的 EV 差、所有节点均有完整答案 |
| O09 | `research-next-stop-events.json`：`ev_db6c24f55c5f3e34d050bb2140f4c1b509409f5c972e536c9ad065b30b3f1aca`；下一题与停止弹窗快照 | 下一题实际为 300bb，未作答；停止操作出现本轮总结与历史入口 | 下一题会与上一题同深度；未答题应计为错误 |
| O10 | `research-session-history-ui.json`、`research-history-expanded.json`、`research-replay-ui.json`、`research-repeat-confirmed-ui.json` | 本轮记录可展开行动、频率和 EV，可回放并重新进入原 150bb 场景；中断当前题目会先确认 | 全账号历史列表、跨刷新保存、重复作答的统计归属均已验收 |
| O11 | `research-history-network.json`：`ev_62d6718f61c4473eb05fb7c563d4d364b6c41679d6ac08f3f3d2df0883cd14b7`；`research-replay-inspection.json`：`ev_7a200390d2f7cd9de810319d9f53868c725bf7e3734e584eb0be1d2161afbac0` | 有时间窗口与 origin 限定的网络元数据；回放窗口含同源性能上报 | 训练接口已定位；空列表证明完全本地求解或可离线运行 |
| O12 | `research-finished-inspection.json`：`ev_c74668026a21252781f5cac44d37c998bf4e549230202d13c87a63ca49db552b`；`research-finish-state.json`、`research-settings-restored.json` | 已回到配置页，无活动停止按钮和可见弹窗；17 项临时设置读回恢复，未保存命名专项 | 原有历史被删除；剩余额度等于研究前额度 |

O03 捕获窗口为 `2026-10-15T10:24:32.541Z` 至 `10:24:33.117Z`，本地对应北京时间 18:24。它的完整性状态为 `policy_filtered`，包括 `attach_limited`：显式未收集可访问文本、console 文本、存储内容、JSON body 和 WebSocket payload；不在所选 origin 内的内容被排除。没有截断事件不代表捕获了所有内容。

O04 的完整性状态为 `partial`。虽然 `parse_failures` 为 0，结果另有一个源码片段经解析器错误恢复，REA 明确保留“结果可能不完整”的未知项。未请求 source map。不能把“589 个脚本被检查”写成“589 个脚本均已完整还原”。

静态发现的相关路由名包括 `practicePlay`、`practiceTrainer`、`practiceRangeBuilder`、`practiceSessions`、`practiceStats`、`practiceDrills`、`practiceHands`；它们支持进一步定位调查页面。路由字符串的存在不证明免费账号可以打开、配置或保存这些页面。分析返回的 endpoint 候选也只是静态语法线索，不是本轮实际发出的请求清单。

### 第一方资料

| 编号 | 来源 | 用于本方案的事实 |
| --- | --- | --- |
| D01 | [How To Use the Trainer](https://help.gtowizard.com/how-to-use-the-trainer/) | 教程描述整手、单街、单节点训练，以及场景、牌面、手牌筛选、动作 / 频率输入与反馈时机设置。 |
| D02 | [Manage Training Drills](https://help.gtowizard.com/manage-training-drills/) | 专项可保存配置、再次开始、用标签管理，并查看该专项表现。 |
| D03 | [Measure Performance](https://help.gtowizard.com/measure-performance/) | 动作频率相关评价与 EV 损失分别展示，支持按已练手牌和练习 Session 回看。 |
| D04 | [How To Use the Range Builder](https://help.gtowizard.com/how-to-use-the-range-builder/) | 范围构建要求用户为手牌 / 组合分配策略，再与指定 solution 比较。 |
| D05 | [REA browser observation](https://github.com/morluto/rea/blob/c61c108b522de1a2b46e65b59360c9be66fb038e/docs/browser-observation.md) | CDP 观察和脚本分析是分开的能力；捕获有 origin、时间窗口与明确完整性边界。 |
| D06 | [REA CdpBrowserProvider](https://github.com/morluto/rea/blob/c61c108b522de1a2b46e65b59360c9be66fb038e/src/browser/CdpBrowserProvider.ts) | 页面捕获、bundle 静态分析和会话观察有各自入口，不将脚本候选直接认定为运行行为。 |
| D07 | [How to Use Practice Mode to Improve Your Game](https://blog.gtowizard.com/how-to-use-practice-mode-in-gto-wizard-to-improve-your-game/) | 先确定学习问题，再选择参数；复习自己的决策、对手范围与相似场景，避免只追逐罕见动作。 |
| D08 | [Training Ideas](https://help.gtowizard.com/training-ideas/) | 不同目标可以使用不同速度、反馈、频率输入和信息显示配置。 |
| D09 | [The 5 Levels of Trainer Mastery for Cash Games](https://blog.gtowizard.com/the-5-levels-of-trainer-mastery/) | 按能力安排训练跨度与复杂度，先聚焦场景，再扩展覆盖并跟踪进展。 |

这里仅保留与设计相关的摘要；配置默认值、免费额度和收费条件以实际账号页面为准，不将教程中的额度长期写入产品规则。

## 官方训练方法与本轮观察重点

D07 强调围绕具体问题练习，并在练后比较自身与对手范围、相近条件下的决策，形成可迁移的规律。D09 为逐步扩大训练跨度提供参照；这里不把其分级名称或时间安排直接变成用户必须遵守的课程。

据此，本轮观察先看配置如何表达学习问题与适用条件，再区分单节点 / 单街 / 整手的跨度、动作 / 频率的回答方式和尺寸粒度。研究选单节点、单桌、每次行动后反馈，关闭自动下一手和限时，以便对照提交前后的信息。

D01、D03 对 RNG 的说明意味着“最常用动作”“按随机数应选的动作”和“没有显著 EV 损失”是不同评价。本轮 RNG 关闭；没有实测 High / Low RNG，也没有用某一百分比阈值推导通用算法。新版应保存评分语义，不能将不同模式的分数混在一起。

### 细读 Trainer 指南后的产品取舍

2026-10-16 已按本表补入 V7.14.0 本地练习流程；原先 V7.13.0 仅部分覆盖。逐项前后差异、明确暂缓项和验证记录见[Trainer 实施核对](trainer-implementation-audit.md)，下表保留原设计判断。

以下根据 D01 的各节逐项作设计判断；右两列均为本项目建议，不是对 Wizard 账号权限的实测结论。它们回答的是“哪些方法能改善木下的学习”，不要求继续验证第三方实现。

| 指南章节与事实要点（D） | 本项目采用的设计（I） | 首期取舍与理由（I） |
| --- | --- | --- |
| Setting up the spot / Board：可按场景和牌面限定练习 | 从复盘的问题带入位置、节点、牌面类别与来源，开始前展示有效条件 | 先用本地题库支持的筛选；避免出现选了却不影响出题的设置。 |
| Selecting Hands：可筛选手牌与接近决策 | 将复盘中主动标记的疑问作为选题入口；提供主题内的相似题 | 没有动作 EV 时不用“接近决策”标签；个人标记表示学习价值，不代表数学上接近。 |
| Game Mode：区分整手、单街、单节点 | 首期围绕一次 Hero 决策做题；题目上下文保留已经发生的行动 | 不用历史回放充当可自由分支的对战；偏离原行动后的局面没有可验证答案。 |
| Difficulty：可改变动作与尺寸的粒度 | 首次先理解下注 / 过牌或防守倾向，需要时再看尺寸分布 | 尺寸是第二层学习目标；合并频率可用于范围说明，不推出某手底牌的最优尺寸。 |
| Input Mode：动作与频率是不同回答方式 | 范围题询问整体分布；概念题询问机制；盲测先选行动再说理由 | 不把三类回答压成同一个正确率。 |
| Info panel / Learning mode：范围和策略辅助信息可显示或隐藏 | 作答前只给决策所需事实；提交后把回答、参考和解释放在一起 | 本地没有对手范围时展示用户假设，不生成貌似精确的范围图。 |
| Auto New Hand / Pause：可以控制练习节奏 | 默认由用户在读完反馈后继续，结束后可回题；自由练习保留快捷开始 | 首期不用自动跳题、倒计时或多桌制造忙碌感，先验证理解与复习是否顺畅。 |
| RNG / Stats：频率评价随模式变化 | 历史同时保存题目条件和评价语义；解释与结果分开 | RNG 暂不进入首期；没有匹配的组合策略与 EV，不生成“GTO 分数”或 EV 损失。 |

采用这些原则不需要取得 Wizard 的接口、完整源码或策略库。REA 本轮的实际价值是把设置、提交和反馈的状态变化留成可核查证据；本项目的页面、题库、存储和业务规则仍独立实现。整体流程与页面安排见[蓝图的页面规格](poker-redesign-blueprint.md#主要页面规格)。

## 研究环境与复现

研究目录位于 `%LOCALAPPDATA%\PokerRedesignResearch\2026-10-15`，与项目目录分开。REA 安装使用 `--ignore-scripts`，未注册 MCP、未修改全局 Agent 配置，未安装原生反编译工具。本轮证明的是所调用浏览器命令能运行，不是其他功能的环境验收。

独立 Edge 配置为该目录下的 `edge-profile`，由用户自行登录。它与日常浏览器配置隔离，不导入日常浏览器 cookies。该配置因正常登录可能包含认证状态，不属于可分享的证据，不进入 Git 或附件。研究结束可由用户关闭窗口；恢复后续研究时使用同一独立配置。

以下命令用于复现工具准备和目标发现；已完成的安装不必重复运行。若端口已被占用，应先确认属于本研究窗口，不能接管未知浏览器。

```powershell
$researchRoot = Join-Path $env:LOCALAPPDATA 'PokerRedesignResearch\2026-10-15'
npm install --prefix "$researchRoot\rea-runtime" --ignore-scripts --no-audit --no-fund rea-agents@6.5.0
$rea = Join-Path $researchRoot 'rea-runtime\node_modules\.bin\rea.cmd'
& $rea --version
& $rea list-browser-targets http://127.0.0.1:9333 --allowed-origins https://app.gtowizard.com --format json
```

浏览器启动参数为独立 `--user-data-dir`、`--remote-debugging-address=127.0.0.1`、`--remote-debugging-port=9333`。使用 Edge 可见交互窗口，由用户完成登录。不要把 `/json/version` 返回的 browser WebSocket 地址或账号认证信息复制到文档。

目标 ID 每次发现后重新取得，不能硬编码本次 ID。三个研究命令分别为：

```powershell
# $targetId comes from the allowed-origin target list.
& $rea inspect-web-page http://127.0.0.1:9333 $targetId --allowed-origins https://app.gtowizard.com --observation-ms 500 --format json
& $rea analyze-web-bundle http://127.0.0.1:9333 $targetId --allowed-origins https://app.gtowizard.com --observation-ms 500 --format json
& $rea observe-web-session http://127.0.0.1:9333 $targetId --allowed-origins https://app.gtowizard.com --observation-ms 12000 --format json
```

观察操作前先启动会话窗口，再通过浏览器执行一次明确动作；关联同一窗口的页面状态与事件。新窗口的事件不能补回观察前的网络。需要动作前后对照时分别保留状态，再比较；一个空事件窗口不能证明操作没有网络依赖。

本地 `research-control.cjs` 是本次隔离研究的辅助入口，不是产品代码。它使用现有 Playwright 完成正常浏览器交互，REA 负责被动观察；只允许目标 origin。保存结果先移除邮箱、URL query / fragment 和 token 字段，默认不采集认证 header、cookie、存储值、console 文本、响应正文或 payload。截图仅限核查后的工作区，身份信息和登录区域不得截图。

`evidence/` 内的 JSON 与工作区截图只保存在外部研究目录，不提交到仓库。REA 文件是脱敏派生文件；文件中的 evidence ID 标识原始来源捕获，不保证派生文件与原始 envelope 字节一致，也不充当派生文件校验和。`evidence-verification.json` 单独记录派生文件 SHA-256。已安装的运行时、浏览器配置和仓库基线快照同样不提交。

第二轮由 `batch-research.cjs` 批量遍历设置、准备一次取样、查看本轮历史与回放。UI 快照由浏览器读取，只保留本轮配置与研究用记录；REA 的页面、会话和网络证据独立编号。脚本若发生定位超时，先核对实际页面状态再继续，不能把超时写成网站功能失败。最终停止状态由 O12 读回确认，不由某条命令的退出码推断。

## 逐步观察

| 步骤 | 本轮状态 | 已观察内容与取样边界 |
| --- | --- | --- |
| 打开训练链接 | 已观察 O02 | `/practice/play` 导航后停在 `/login`；这只是未登录行为。 |
| 登录与免费权限 | O05、O07：用户登录后，本次配置与开始成功 | 免费身份来自用户说明；套餐、额度与付费选项可用性未独立审计。 |
| 场景配置 | O06：浏览五组设置；O07：实际切换研究所需的选项并开始 | 切换成功仅支持本次用到的配置，不能扩大为所有模式或解算结果。 |
| 开始练习 | O07：成功进入首题 | 页面显示 Cash、6max、NL25；首题实际 150bb，不与 9max / 200bb 对齐。 |
| 作答与反馈 | O08：完成一次 Check 提交与前后快照 | 提交前不显示动作频率 / EV，提交后出现反馈；未复现所有评价类别。 |
| 下一题与结束 | O09、O12：下一题、停止总结及最终退出配置页 | 第二题实际 300bb 且未答；本轮记录的 1 手牌 / 1 行动不能解释为免费额度扣减数量。 |
| 历史回看与复练 | O10：只展开本轮生成的那一手，回放并确认重复原题 | 重复时先提示取消在途题；重新进入原场景后没有第二次提交。全账号列表与跨刷新持久性未测。 |
| 网络与脚本归属 | O04 静态分析；O07–O09 会话时间线；O11 网络窗口 | 同文档导航不是 HTTP 请求；没有定位到可复现的策略请求到源码调用链。 |

免费额度用尽时停止消耗，不通过新账号、改请求或其他方式继续训练。受限步骤引用 D01–D04 作为功能说明，仍标注未实测；正常页面未提供的付费内容不进入本轮采集。

### 观察到的交互与条件

- 设置弹窗按游戏、牌面、手牌、模式、显示分组，顶部汇总当前条件。牌面可见花色、成对、连接性、子集和高 / 中 / 低张筛选；手牌页可见类别矩阵与接近决策选项。这些属于可见控件观察，不代表均通过权限与实际出题验证。
- 模式页将训练跨度、尺寸难度、回答方式、反馈时机、自动下一手、RNG、学习模式与限时分开。首期借鉴其概念分离，不能照搬按钮数量来宣称拥有完整策略引擎。
- 首题动作选项为 Check 与 140% pot 下注；反馈显示各自动作频率和 EV。下一题出现 33% pot 下注选项。因此动作集合随节点变化，不应硬编码为固定的三种下注比例。
- 在现有解算结果选择下，首题是 150bb，下一题是 300bb。尚未独立核查全部解算结果选择规则；证据支持“本次样本条件混合”，不支持“始终固定 100bb”或“所有专项都会混合”。新版固定专项需要明确锁定条件，混合专项需要逐题留条件与分组统计。
- 停止后出现本轮总结、历史、继续和结束入口。历史展开保留原 150bb 条件，回放的结果与新题分开；重复时先确认取消当前未答题，再重新进入原题。未执行第二次提交，未验证重复后分数累积算法。
- 反馈截图中的 EV 为格式化显示，不能靠四舍五入后的数值差重建内部评分或断言细微动作优劣。看到少数节点的数值也不等于已经取得可复用题库、完整策略库或求解器。

### 网络证据能说明什么

`observe-web-session` 的本轮产物包含会话时间线；开始和下一题窗口出现同文档导航，但这些事件不等于远端策略请求，也不能用初始化 lifecycle 事件建立点击因果。

O11 的历史窗口内，同源请求列表为空且明确排除了两个跨 origin 请求；回放窗口内记录到两个 `/cdn-cgi/rum` 性能上报，另排除九个跨 origin 请求。配套浏览器监听只保存 method、origin、去掉标识的 path 和资源类型，观察到的跨源请求为 Sentry / Clarity 等上报；没有读 headers、body 或 query。

这些数据没有证实答案来自本地计算，也没有建立策略接口与脚本调用的归属链。预加载、缓存、跨源过滤、worker 或连接前流量仍可能影响覆盖。方案据此不依赖 Wizard 接口，不主动探测内部 endpoint；以后若需要策略数据接入，应另行验证数据资格与正常可用的导入路径。

## 可移植能力与数据边界

| 推断 | 对应证据 | 可独立实现的能力 | 必须具备的数据与限制 |
| --- | --- | --- | --- |
| I01 | D01、D02、D07；O06、O07 | 保存学习问题与专项条件、按主题集中练习、再次开始 | 本轮已验证配置与开始，未保存命名专项；保存 / 导入专项的行为仍以 D02 为说明。 |
| I02 | D01、D03；O08、O09、O10；本地 `ConceptQuiz` / `QuizTrainer` | 作答后反馈、训练 / 测验节奏、本轮总结与练习历史 | 本轮实际验证每步反馈和即时历史；测验结束后统一反馈及跨刷新保存为本项目设计，另行验收。 |
| I03 | D03 的回看概念；本地 `HandReplay` / `analysisReadModel` | 用个人手牌做决策前盲测，作答后再回看 | 属于本项目设计推断，不是已观察的 Wizard 同名功能；需要决策级时间切片，不能提前显示后续牌与结果。 |
| I04 | D01；O07、O09、O10；本地 `GTO_LEGACY_SCOPE` | 明确显示位置、街道、牌面和参考条件 | 混合深度须逐题留条件；桌型、有效筹码、抽水等未知项不能从目标档案回填。 |
| I05 | D04；本地策略主题与概念内容 | 范围组成与手牌类别的学习交互 | 矩阵可绘制不等于有权威答案；自动评分需条件匹配的组合级策略。 |
| I06 | 本地 `Timer`、`Odds`、`SessionClosure` 与各 Repo | 把训练与牌局准备、复盘、工具、对手观察连成使用链 | 这是综合助手自身需求，不要求从 Wizard 复制这些模块。 |

现有 `gtoRaw` 两个场景各有 183 个翻牌面，每条仅包含 `code`、`bet75`、`bet50`、`bet33`、`check`。这是本次直接读取模块的结果。没有逐手 Hero 底牌的动作频率，也没有动作 EV；旧数据的条件声明位于 [GTO_LEGACY_SCOPE](../src/data/strategy/gtoBaseline.js)。

当前 [QuizTrainer.answer](../src/modules/quizTrainer.js) 按 35% / 13% 聚合频率阈值显示“正确 / 可接受 / 错误”。范围中低频动作不能直接证明某手具体底牌行动错误；本项目旧标签需要在新版训练语义中调整，而不是照搬到组合级训练。原始历史仍按其旧评价版本保存。

当前学习路由已能区分翻牌 C-bet 频率题与其他主题概念题，见 [getStrategyLearningTarget](../src/modules/strategyStudy.js)；新版可以复用该判断，再增加专项与历史对象。现有导出遗漏的学习键与恢复缺口在[路线图的数据清单](poker-redesign-roadmap.md#2-数据兼容与恢复先行)中单独核查。

本地进一步核查（2026-10-16）：`HandReplay` 明确保留翻后匿名行动，`deriveFlopDecision` 的归属含启发式推断。因此“回放可解析”只证明可展示序列，不证明已取得自动盲测所需的精确 Hero 决策时点。这收窄 I03 的自动选题范围；资格不足时采用人工确认局面或普通复盘，具体规则见[四类练习](poker-redesign-blueprint.md#四类练习与判分边界)。这不是继续调查第三方接口的理由。

## 研究结论与交付状态

已完成：独立工具准备、loopback 监听核查、REA 页面捕获、bundle 静态分析、官方练习方法阅读与本地源码对应；登录后的设置、开始、一次提交与反馈、下一题、本轮总结、即时历史展开、回放和重复原题；操作窗口时间线与有限网络元数据；研究区截图与提交前后对照。最终停止训练，并读回恢复研究前 17 项临时设置，没有保存命名专项。

本轮调查在此收束。表中未验证的第三方行为只用于限定证据，不列为后续待办、实现前置条件或验收门槛。套餐与额度、对方跨刷新历史保存、内部策略接口均不继续调查。保存专项、RNG 等功能是否进入本项目，按具体用户收益与可用数据决定，不以复制对方配置为目标。

三份文档现可用于评审本轮所观察范围内的新版设计与实施批次。尚未实现新版界面、迁移、离线缓存或评分系统；产品功能验收仍按蓝图与路线图执行。具体布局作为参照，接口结构、套餐规则和未测能力不作为已验证实现合同。
