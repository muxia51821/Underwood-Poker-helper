# Poker 策略数据资源调查

调查日期：2026-10-16。本文件补充 [工具复用研究](poker-tooling-research.md)，重点回答哪里有可核查的数据、什么可以进入我们的产品。主线仍为 Cash 9max／200bb，次线为 6max／100bb。

## 建议

本轮找到了**代码和数据分别明确授权的数学／短筹码资源**，以及**接近主线条件的公开范围页面和商业数据路线**；尚未找到同时满足主线条件、生成证据、混合动作和再分发权限的完整翻前答案库。

建议分三条推进：

1. 用 HoldemMath 的明确授权小数据，先验证来源记录、条件显示、逐类读取、版权署名和冻结文件流程；数学权益与短筹码模型单独呈现。先交叉核验数值，不直接加入精确 GTO 判分。
2. 把 Verdict 的 9max／200bb 开池图作为外部研究入口；需要抽水、ante、求解方法和数据许可进一步明确，才考虑转换为我们的答案。FreeBetRange 可作为个人学习外链，其已公布条款不支持我们直接内置其库。
3. 若未来愿意采购数据，PokerData 是有机器接口和明确商业许可分层的候选。先澄清最终产品的离线缓存、随应用分发和用户导出权利，再决定是否付费；本次没有注册、申请 key 或购买。

上述是本项目选型建议，均不代表资源已集成、数据正确性已复现或获得额外授权。

## 证据如何理解

- **实际核查**：读取官方仓库固定提交、许可证、文件字段和小样本，或直接请求公开接口。核查结构不等于求解正确性验证。
- **官方说明**：作者关于生成过程、精度、适用条件或功能的声明。
- **推断／建议**：根据我们的场景作出的适配判断。
- **未知**：没有获得直接证据，不以标题、GTO 标签、免费浏览或 GitHub 公开状态补足。

只读取公开资料和少量公开文件，没有登录、抓取付费策略、使用个人牌局或运行求解器。公开 JSON 为内存读取，没有把第三方策略库放入仓库。部分网页工具无法读取 API，改用标准 HTTP 只读请求；接口可访问不代表策略答案已经取得。

## 候选总览

| 资源 | 实际内容／官方覆盖 | 我们可以怎样使用 | 当前结论 |
| --- | --- | --- | --- |
| HoldemMath Data | 169 类权益矩阵；HU／6max／9max 的 4–20bb push/fold；数据 CC BY 4.0，示例代码 MIT | 数学查阅、受限模型研究、数据包试验 | 优先小样本核验；不是深筹码 Cash 答案 |
| PokerBench | 6max、100bb 情景与单动作标签；HF 卡标 Apache-2.0 | 情景覆盖和格式适配参考 | 单动作不能代替混合频率；翻前上游授权需澄清 |
| PokerData | 官方 6max NLHE 多深度、169 类频率与 EV API | 未来授权数据接口／离线包路线 | 免费个人访问不是内置／再分发许可 |
| Verdict Poker | 官方 9max／6max、200bb、4bb RFI 网页；Base 与两类调整 | 主线条件的外部研究参考 | 抽水、ante、引擎、精度和开放许可未取得 |
| FreeBetRange | 官方称库有 100／150／200bb、不同 rake／ante | 个人学习外链、观察库筛选方式 | 条款限制，不抓库、不内置 |
| Poker Lab | MIT 页面工程；范围来自 Greenline、Pekarstas 等 | 来源切换、父节点到达权重的代码设计参考 | 第三方图表授权未闭合；不直接拿答案 |

## 1. HoldemMath：明确分开许可，但必须保留模型边界

**实际核查**：固定提交 [`7c72b1261f08c63cf8366120dc531631935c21cd`](https://github.com/Julian-cloud-max/holdemmath-data/tree/7c72b1261f08c63cf8366120dc531631935c21cd)。[`LICENSE-DATA`](https://github.com/Julian-cloud-max/holdemmath-data/blob/7c72b1261f08c63cf8366120dc531631935c21cd/LICENSE-DATA) 明确 `matrix/`、`pushfold/` 为 CC BY 4.0；[`LICENSE-CODE`](https://github.com/Julian-cloud-max/holdemmath-data/blob/7c72b1261f08c63cf8366120dc531631935c21cd/LICENSE-CODE) 为示例／查看器提供 MIT。

实际读取两个 JSON：

- [`matrix/preflop_equity_matrix.json`](https://github.com/Julian-cloud-max/holdemmath-data/blob/7c72b1261f08c63cf8366120dc531631935c21cd/matrix/preflop_equity_matrix.json)：`n=20000`、169 个 `order`、14,365 个无序对手牌行。行包含两端类别索引和胜／平／负千分数，**是摊牌权益，不是动作频率或动作 EV**；整数舍入可能使三项和不等于 1000。
- [`pushfold/pushfold_charts.json`](https://github.com/Julian-cloud-max/holdemmath-data/blob/7c72b1261f08c63cf8366120dc531631935c21cd/pushfold/pushfold_charts.json)：深度 `[4,6,8,10,12,15,20]`，`hu/max6/max9`，无 ante 和每人 `0.1bb` 两套；`s` 是手牌类别索引列表，`p` 为范围覆盖率，`e` 是 169 类的 EV 数组。HU 10bb SB 样本确有 `s/p/e`；多人还有 `BB|UTG` 等跟注节点。**没有逐手牌混合频率字段**。

**官方说明**：[`README`](https://github.com/Julian-cloud-max/holdemmath-data/blob/7c72b1261f08c63cf8366120dc531631935c21cd/README.md) 说明权益用 eval7 蒙特卡洛；push/fold 用作者 fictitious-play 工具；chip EV、免抽水、无 limp、无 ICM，EV 以 bb 相对弃牌计。HU 近似均衡误差由作者报告；多人每个 first-in 子局面独立处理，采用 single-caller 近似。仓库没有所述完整求解器生成实现，不能声称本次重算确认。

**建议**：可选择权益对照或一个 HU 无 ante push/fold 节点做数据适配试验，保留原作者、提交、改编说明和许可。若展示多人表，必须显式说明单跟注近似。既不能拿它填充 200bb，也不能用“有 EV”推导完整动作 EV 损失；这里不是所有可行动作的 EV 表。

## 2. PokerBench：论文、数据卡和文件可以对应，但不是完整策略

**实际核查**：作者仓库 [`pokerllm/pokerbench@cf13d369630f859b23c9b4a179826f6764c4d6b6`](https://github.com/pokerllm/pokerbench/tree/cf13d369630f859b23c9b4a179826f6764c4d6b6) 只有 README，指向官方 HF 数据集 [`RZ412/PokerBench@7ac61f961c81a50fc0f667820b2fb0e432dfec0d`](https://huggingface.co/datasets/RZ412/PokerBench/tree/7ac61f961c81a50fc0f667820b2fb0e432dfec0d)。HF 数据卡标 `apache-2.0`；仓库代码许可证与数据卡声明分别记录，不能相互替代。

实际读取翻前／翻后 test CSV 的头部：

- [翻前 CSV](https://huggingface.co/datasets/RZ412/PokerBench/blob/7ac61f961c81a50fc0f667820b2fb0e432dfec0d/preflop_1k_test_set_game_scenario_information.csv)：`prev_line/hero_pos/hero_holding/correct_decision/available_moves/pot_size`；包含 `KdKc` 这种具体底牌，答案是 `call` 或 `3.0bb` 一类单标签。
- [翻后 CSV](https://huggingface.co/datasets/RZ412/PokerBench/blob/7ac61f961c81a50fc0f667820b2fb0e432dfec0d/postflop_10k_test_set_game_scenario_information.csv)：有行动线、牌面、评估街、底牌和单答案；较早街道的行仍有未来 turn／river 列。任何未来适配必须按当前街遮蔽未来牌，不能直接全部展示。

**官方说明**：[论文方法](https://arxiv.org/html/2501.08328v1) 是 6max；示例为 100bb，翻前使用 GTOWizard 策略且链接 scraper，翻后使用 WASM-Postflop，筛选存在大于 50% 主导动作的题。数据集不是完整节点树，也未提供混合频率和动作 EV。抽水、ante、全部树配置及逐题收敛记录没有从所读文件建立。

**建议**：借鉴场景字段、牌面覆盖和题库抽样；不把单标签作“其他动作均错误”的依据，不展示 EV 分数。翻前源数据使用权未由 HF 卡自身闭合；翻后也须追溯输入范围与生成配置。不能直接把全库作为我们的内置 GTO 题库。

## 3. PokerData：可查询的商业数据路线

**实际核查**：公开 [`/api/v1/ranges/nl/v2`](https://pokerdata.io/api/v1/ranges/nl/v2) 返回 HTTP 200，列出六个位置、20／30／40／50／70／100／150／200bb。公开 [`config?stack=100`](https://pokerdata.io/api/v1/ranges/nl/v2/config?stack=100) 返回六人各 100bb、盲注 0.5／1、EV 单位 sb、`evBaseline=fold`，同时将 ante、ante 计价时点、树尺寸列为未知；未知原因文字提到 cash pipeline 为 5% rake、0.5bb cap。这里是配置证据，不是已核验的完整求解参数。`nl9` 公开 discovery 本次 404，不能把其 9max PLO 或预留工具名当作已发布 9max NLHE。

**官方说明**：[`API`](https://pokerdata.io/api) 描述 169 类 `[0,1]` 权重、节点所有动作、EV 和动作尺寸；REST 策略查询需要 key。本次未申请 key，**未读取真实策略频率／EV 节点样本**。[`ranges.md`](https://pokerdata.io/ranges.md) 区分 sb EV 与 bb 条件、缺省权重规则、raise-to 计价，且明确收敛信息未发布。

**使用权限（2026-10-16 更正）**：此前把 API 限制概括成全部产品的限制，范围过宽。[官方条款](https://pokerdata.io/terms)（2026-10-13 生效）分别规定：下载包允许软件及商业用途；API 的 Starter／Pro 为个人用途，Enterprise 允许应用内使用，但商业永久镜像不允许，缓存上限为一个月。未来应按具体下载包核查内容、格式及适用条件，不把 API 条款套在下载包上；本次未采购。

**建议**：未来采购可优先考察接口／文件契约。需补节点样本、数据生成来源与质量、离线分发许可；它仍不是当前主线的免费开放答案库。

## 4. Verdict Poker：当前最接近主线的免费公开页面

**实际核查／官方说明**：[Live Preflop Ranges](https://www.verdictpoker.com/web/tools/live-preflop-ranges) 可直接读取，页面标 9max／6max、200bb、open to 4BB、RFI，以及 Base／Passive／Aggro。页面区分纯开池、混合、弃牌；文案对 Base 同时使用 solver baseline 和 solver-style baseline，后两类是针对桌况的调整。

**未知**：本次公开页未找到 rake、ante、引擎、求解树、收敛记录、原始混合频率文件或开放数据许可。没有点击每格核对频率，也没有运行其界面。它的 200bb 标签不能单独证明是条件完备的均衡输出；被动／激进调整尤其不能作为 GTO 判分答案。

**建议**：列为“9max／200bb、4bb 开池的外部参考”，用于研究它如何解释深筹码场景及分离桌况调整。数据内置、批量提取与自动判分暂缓。若后续取得来源与授权，也仅覆盖开池，不代表 vs open、3bet、4bet 均已解决。

## 5. FreeBetRange：9max 深筹码库线索，适合外链

**官方说明**：[9max 指南](https://blog.freebetrange.com/article/9-max-poker-preflop-charts-for-texas-holdem) 区分其基础图表的调整策略与 Library 的 GTO 方案；2026 更新提到 100／150／200bb、不同 rake 和有／无 ante。不能把“NL2–200”级别名误读为 200bb，也不能把文章 PDF 自动等同 200bb 求解数据。

**实际条款核查**：[Terms of Use](https://freebetrange.com/en/terms-of-use) 标 2025-09-08 更新：个人使用；禁止 scraping／reverse engineering；内置 GTO Library 属其服务 IP。用户自建材料和图表分享另有格式及署名限制，不可推断为全库可再分发。

**建议**：学习页外链，借鉴“同一范围查看→编辑→练习”组织。未登录、未导出、未申请授权，不规划抓取其答案或承诺可转换为我们的内置库。

## 6. Poker Lab：代码可借鉴，图表不能继承 MIT 的结论

**实际源码核查**：[`AHTOOOXA/poker-charts@c7192b3bda783d4a0f12f37a6f9876daaf25151c`](https://github.com/AHTOOOXA/poker-charts/tree/c7192b3bda783d4a0f12f37a6f9876daaf25151c) 有 MIT LICENSE，React 页面支持多个 provider。

- [`greenline.ts`](https://github.com/AHTOOOXA/poker-charts/blob/c7192b3bda783d4a0f12f37a6f9876daaf25151c/src/data/ranges/greenline.ts) 明示从 GreenCharts PDF 提取；UTG-RFI 还出现“Testing weighted cells for visual verification”注释。不能把所有显示混合值都认作求解原值。
- [`index.ts`](https://github.com/AHTOOOXA/poker-charts/blob/c7192b3bda783d4a0f12f37a6f9876daaf25151c/src/data/ranges/index.ts) 体现前序节点到达权重和当前动作频率的分离。但 `getCell` 将不存在的图也回为 Fold；本项目不能照搬这种缺失语义。

**未知**：所读第三方图表的原作者再分发许可、完整场景条件和生成链未闭合。**建议**：参考 provider 切换和到达权重接口，不直接带入范围数值，不移植整套运行时。

## 额外排除与警示

| 候选与固定证据 | 实际发现 | 处理 |
| --- | --- | --- |
| [gunahkarcasper/poker-gto-strategy-and-hand-ranges@e53efc3eaf87ebfc4adaaaaea2b69c4243681c65](https://huggingface.co/datasets/gunahkarcasper/poker-gto-strategy-and-hand-ranges/tree/e53efc3eaf87ebfc4adaaaaea2b69c4243681c65) | 实际 CSV 只有 4 条泛化行；没有具体手牌。`expected_value` 为 Positive／High／Variable／Conservative 文本，未见数据卡或许可 | 排除；名字不等于策略数据 |
| [jevonmao/gtow-llama-sft-v3@ff93c3f29d46fc892c4443e36a9255df3531a4f9](https://huggingface.co/datasets/jevonmao/gtow-llama-sft-v3/blob/ff93c3f29d46fc892c4443e36a9255df3531a4f9/README.md) | 作者称来自 GTOWizard researcher API，HU 200bb 单动作样本；明确提醒尊重上游再分发条款，无数据许可字段；卡内 schema 文字与 features 也不完全一致 | 排除直接内置；HU 不等于 9max；本次仅核查卡和文件清单 |
| [pokermath-research/preflop-equity-matrix@c919ae55a93f7884f9ca723d42bd2cea559c3fae](https://github.com/pokermath-research/preflop-equity-matrix/tree/c919ae55a93f7884f9ca723d42bd2cea559c3fae) | README 标 CC BY 4.0；PROVENANCE 将 `gto_open_action` 描述为商业 solver 的 100bb 9max 综合近似；`generate_matrix.py` 实际从既有 CSV 复制／检查，不能从原始牌局模拟重建数值 | 不采用其 GTO 字段；“可生成／测试通过”不等于求解可复现 |
| [jehan-unito/poker-ranges@2dd79e7c897df7694e032421f9b5be6dc9ed8522](https://github.com/jehan-unito/poker-ranges/blob/2dd79e7c897df7694e032421f9b5be6dc9ed8522/app.js) | 9 个座位、多个范围字符串、25／50／75 等权重写入脚本；仓库树只有 HTML／JS／CSS，未见 LICENSE 或生成来源 | 仅参考呈现，不将手写权重当作可靠开放答案 |

这些处理是证据与适配筛选，不是对项目作者整体质量的评价。

## 本轮覆盖与下一步验证

搜索覆盖公开网页、GitHub、HF；关键词包括 preflop ranges／GTO JSON／dataset／MIT／CC BY／9max／200bb／Cash。深入候选共六组，额外核查四组排除项；旧研究的 RangeAssistant、PokerKit、TexasSolver 等不重复作为“新数据发现”。未完成对所有公开范围站的穷尽调查；没有免费主线库的结论仅限本次已核查集合。

下一批若实施数据适配，最小验收是：

- 每份数据独立带来源、固定版本、代码／数据各自许可和原样条件；未知值不补成默认事实。
- 区分摊牌权益、单动作标签、169 类动作频率、逐组合答案和动作 EV；数据未覆盖的格子／节点保持缺失。只有来源契约明确“缺省为零”的完整节点，才允许据此展开零值。
- 先用小文件检验手牌类别映射、条件一致、单位、动作尺寸、概率归一化、版权署名和导入往返；再独立核验样本数值。
- 模型不匹配时只展示参考。个人范围练习明确“按我的计划”；短筹码单跟注近似单独标记；没有真实动作 EV 不给 EV 损失。

本阶段仅新增本研究文档。没有修改应用、依赖、用户数据或 Git 历史；未运行应用回归测试，因为没有产品代码改动。候选的数据正确性和真实导入体验仍未验收。

## 2026-10-17：BTN 对 BB 单加注底池的入口范围

**结论**：本次核查仍未取得可直接内置、条件完整且许可闭合的 Cash 9max／200bb 双方加权入口范围。先使用本项目自行编写、逐项声明的研究假设范围做正常组合规模基准；输出是“给定范围和动作树下的条件解”。不能把其他桌型缩放成主线，也不能直接把转牌范围手工挑成几个代表组合后宣称承接了翻牌策略。

| 来源 | 当前证据与缺口 | 采取的方式 |
| --- | --- | --- |
| [GTO Wizard Ranges Tab](https://help.gtowizard.com/ranges-tab/) | **官方说明**：可将任意节点的双方完整范围或某动作子范围复制为 Pio／GTO+ 文本，适合继续在自己的 solver 研究。**未实测**：本人免费账户是否能访问所需 9max／200bb 条件和复制功能；本文未取得对应节点文本或数据再分发许可。 | 后续可接用户主动导入的个人研究文件，保存原条件与来源；官方提供复制功能不等于允许把库随应用发布。 |
| [PokerData NLHE API](https://pokerdata.io/api) | **实际观察**：100bb、6max 的 BTN 开池与 BB 面对开池节点目前可无 key 返回 HTTP 200；169 类动作权重、EV 单位与 raise-to 金额可读。BTN 开到 2.5bb，SB 弃牌后的 BB 节点确有跟注动作。**未知**：收敛未公布，config 的 ante、ante 计价和完整树仍未知；配置文字只说明 cash pipeline 抽水 5%、上限 0.5bb。 | 作为次线个人研究候选，不把响应放进应用或答案包。实际可读性更新了第 3 节“策略查询需 key”的历史观察，但 `/spots` 本次仍返回 401，不能推断所有接口开放。 |
| [PokerData 当前目录](https://pokerdata.io/)与[下载/API 条款](https://pokerdata.io/terms) | **实际观察**：当前目录未列 9max NLHE Cash，`nl9/v2` discovery 返回 404；搜索缓存曾显示的 9max／200bb 条目不能代替当前目录证据。**官方条款**：下载包允许软件及商业用途；API 个人使用、产品接入及商业持久镜像分别受限。 | 不采购、不镜像。若以后选下载包，单独核对该包真实内容、原条件与文件格式，不能由 API 样本推定下载包已经验收。 |
| [Verdict 200bb 页面](https://www.verdictpoker.com/web/tools/live-preflop-ranges) | **实际观察**：仍只有 RFI 开池参考，缺 BB 跟注范围、完整生成条件与数据许可；不构成双方单加注底池入口。 | 保留外链，不提取为求解输入。 |

可复现的 PokerData 元数据核查入口（GET，不需登录；本文不保存策略权重镜像）：

- [100bb 配置](https://pokerdata.io/api/v1/ranges/nl/v2/config?stack=100)。
- [BTN RFI 节点](https://pokerdata.io/api/v1/ranges/nl/v2/node?stack=100&history=UTG_Fold_HJ_Fold_CO_Fold_BTN)。
- [BTN 2.5bb、SB fold 后的 BB 节点](https://pokerdata.io/api/v1/ranges/nl/v2/node?stack=100&history=UTG_Fold_HJ_Fold_CO_Fold_BTN_60%25_SB_Fold_BB)。`60%` 是其动作路径标记，应读取返回的 `sizeBb`，不能误读成开到 60%bb。

**具体下一步**：基准输入记录双方逐类别／组合权重、所假设的翻前行动与金额、抽水及排除条件；自行编写的范围注明没有前序均衡证明。先在翻牌起点求解，再从所选“过牌 → 下注 → 跟注”分支导出双方实际到达范围进入转牌研究。将来导入来源可靠、条件匹配的用户文件时更换输入并重算，不覆盖旧答案版本，也不把旧假设解改名为完整 GTO 基准。本节只核查来源与可读性，没有验证第三方策略数值。
