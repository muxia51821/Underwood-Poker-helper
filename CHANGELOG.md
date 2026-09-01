# 变更日志

本文件记录正式发布证据。详细的历史功能说明继续保留在 `牌桌助手历史迭代版本/版本更新说明.md`。

## 未发布

- V7.11.7 概念自测题库全量覆盖：52 条概念每条 1 道书源自测题（40 → 52，新增 pot odds 门槛计算、形态配对、抓诈唬 pot odds、combo EQR、implied odds 场景、纯/频率错误、尺寸瞄准、阈值三问、手牌无真空、GTO 目标、solver 噪声、range-bet 例外）——全部提炼自已全文精读课程，quiz-first 全覆盖；`CONCEPT_SEED_VERSION` v6；契约测试同步（v6/52 条/52 题自测）。

- V7.11.6 概念自测错题集：答错入册（`pa_concept_quiz_errors`，按题去重保留最新错误答案）、答对销账、重做错题模式（只出错题，剩余数在总结页显示）、错题集折叠视图（题目+你的答案+正确答案+解析+出处，计数徽章+清空按钮）——复用 quizTrainer 错题集（`pa_quiz_errors`）的交互模式；`CONCEPT_QUIZ_VERSION` 3；契约测试新增错题簿逻辑校验（入册/去重/未知 id 过滤/销账/清空），测试总数 64。

- V7.11.5 概念库扩量（46 → 52）：Equity Distribution Graph 读法转正（x=范围内百分位/y=手对范围 equity；Guess the line——形状与线互为指纹：block-bet 线分布以 60-80% 中段为主体；深度写进形状——越浅 3-bet 越需强价值防 shove）；牌面→分布形状（monotone 均化：A43 面 CO check back 72%+；888 天然极化：超对优势 vs 浓缩冷跟；777 阶梯=超对优势+quads 跳升）；无诈唬全下（chop 面三条件纯价值）与无 nuts 全下（986 面 draw-heavy 四原因、BTN call 60%）两个分布极端；combo 级 EQR 差（KJs vs 最差 KJ：equity 差 4%、pot share 差 14pp）；EQR 不是零和（643 面双方 80.7%/90.5% 同时欠实现，rake 占池 14%）；4 连张面 chop 防守（6x 主导权压裸 Ax）。对比补充：转牌 EQR 时序（paired T 最大化 BB 实现）、200bb 三街抓诈 blocker 价值（A4）、面对全下 raw equity 决定一切（352% 面 AQ/T9s 可 call）。新增应用 1 条（4-flush 河牌 probe 面对的是对方 67% 宽防守）。契约测试同步（v5/52 条/40 道自测）。

- V7.11.4 图像复核收尾 + href 白名单：3 处"图像复核（留待）"全部关闭——PDF 页面渲染 PNG 逐张核验（pymupdf）：①QT 的 EQR 数值表确认（Q♣T♣ check 线 EV 2.6bb/EQ 67.51%/EQR 70.71%，OOP 实现打折），已作为对比例写入 concept-equity-realization；②backdoor 例子修正（此前误写"QTs 在 8-7-5 面"，正确为 T8s/T♥8♥ 在 Q♥7♦5♣ 面，任意 6/9/J/♥ 共 19 张转牌）；③CH11 形态配对表按颜色圈配对确认（call→Condensed、XR→Merged、probe(A♥)→Polarized、call-down→Linear）。另：pokerLogic.js evidenceLine 补 href 协议白名单（复用 decisionRadar._safeExternalUrl 模式，仅 http/https 渲染为链接）——关闭证据包 sourceRef 注入面。台账见 `docs/concept-seed-schema.md` 第 10 节。

- V7.11.2 概念层吸收 DDoG 教学理念并填满 spot 卡：`conceptSeed.js` 升 v2——概念从 13 条扩至 20 条（新增 range-bet、donk、probe、block-bet、薄价值/Vluff、check-raise 构造、陷阱 7 条），每条新增 contrastExamples（A/B 对比微例）、thresholds（可操作阈值）、selfCheck（书源选择题，答案折叠）三个教学维度（对应 DDoG「quiz-first、对比驱动、阈值化」教学法）；新增 `CONCEPT_APPLICATIONS`（38 条 spot×四步应用条目，全部提炼自 40 课全文精读并附 DDoG 课程/GW 博客出处）；`pokerLogicSeed.js` 升 v3——每格 = 导航语 + 应用条目 + 概念引用，32 格全部有出处化内容（契约测试断言每格至少 1 条应用）；`pokerLogic.js` 渲染应用要点、对比例、阈值与自测折叠卡。契约测试覆盖应用条目 spot/step 归属、出处格式、概念引用可解析及教学维度覆盖度。全书 334 课作为同一参考源（典型 = 已提炼条目，全本 = `docs/ddog-concept-map.md` 附录 A 页码台账）。
- V7.11.3 概念库扩量 + Quiz 接入：概念从 20 条扩至 46 条（新增 implied-odds/nut-potential、纯错误 vs 频率错误、尺寸瞄准、阈值思维、手牌无真空、GTO 目标、solver 噪声、Nash Distance 语义、Clairvoyant Defense、ICM、风险溢价、面对 draw 的 MDF、3-bet 范围构造、低 SPR 听牌 check-back、混合策略、有摊牌价值诈唬的 MDF、超池选手机制、3BP C-bet 尺寸、多人池、rake 影响、筹码深度、squeeze 构造、push-fold EV、延迟 c-bet、用大注持有 draw，全部提炼自对应课程全文并附出处）；`conceptQuiz.js` 升级为交互式判分训练器（单题作答 → 即时反馈 → 掌握度记入 `pa_concept_quiz_mastery`，与现有 Quiz 训练器机制同构）；契约测试更新（46 条概念、教学维度覆盖度、题库校验：答案 ∈ 选项/出处必填/确定性排序）。
- V7.11.1 复盘牌理参考重构为概念层组装：新增原子概念种子 `src/data/conceptSeed.js` v1（13 条概念，全部提炼自 Daily Dose of GTO 对应课程全文并附出处——课名/章/阅读器页码/提取方式标注，含"常见误解"与赛制深度适用边界字段）；`pokerLogicSeed.js` 升 v2——V7.11.0 的自写牌理叙述作废，四步框架保留为导航（每格 = 导航语 + 概念引用列表，空引用为显式缺口），匹配字段、证据引用与转移边界不变；`pokerLogic.js` 渲染概念卡（机制/误解/适用边界/来源行）。选材依据与 schema 见 `docs/concept-seed-schema.md`、`docs/ddog-concept-map.md`（全书 334 课章节地图）。概念种子为静态只读知识，直接 import 不入 localStorage。契约测试覆盖概念种子完整性（id 唯一/来源必填/提取方式枚举/引用可解析/不得携带 updatedAt）与 v2 卡片结构（四步齐全/概念引用可解析/v1 叙述字段不得回归），概念卡渲染断言（标题/误解/来源行）亦在契约测试；e2e 既有命中路径断言与 v2 渲染兼容、无需改动。
- V7.11.0 新增复盘牌理参考：手牌展开详情中，命中已定义 spot（翻牌五项 + 河牌三项，基于 4.37 万手真实样本摸底裁剪）时显示结构化推理链卡片——范围合法性 → 前置线语义 → 街牌效应（河牌按惊悚/空白二分）→ 偏离解读，每条要点挂可核验证据与转移边界。新增 `src/modules/spotMatcher.js`（单手牌 spot 识别纯函数，两人池位置交替归属与多人池噪声排除从摸底校准固化）与 `src/modules/pokerLogic.js`（渲染层）；牌理种子为只读知识（`src/data/pokerLogicSeed.js` v1），不做频率答案、不与个人样本做差值；识别结果不写回手牌数据。契约测试覆盖归属规则、种子完整性与证据引用可解析；e2e 覆盖命中路径渲染。
- V7.10.9 新增河牌证据域：外部证据种子升版 v5，追加四篇后街文章的结构性参考（street:'river'，按场景归位）——OOP 惊悚河牌导航（尺寸封顶/超池只属空白/三段式策略骨架）、河牌 miss 同花听牌的诈唬例外（范围过滤与 blocker 相对性，含 200bb 超池全下场景）、SB vs BB check-call 后的转河（过牌陷阱与 B-X-B 线小注）、翻牌超注后的转河延续（极化 vs 浓缩 + 几何尺寸）；全部正文数字交付前重新核验。Radar v1 仍只扫翻牌，河牌条目由 street 过滤保证不进翻牌信号，仅供 Dossier/策略复盘查阅；契约测试断言该隔离。
- V7.10.8 按 Radar 场景补强 GTO 结构性参考：新增 11 条场景级种子（BTNvsBB 的 C-bet 逐牌面定性 + 6max 100bb 总体 63/37 数值锚点 + 面对下注三条应对构成 + 对手过度 C-bet 的应对位移机制；COvsBTN 的 OOP 进攻方 28/72 框架 + 静/动面结构 + A99r 应对数字），并把 SBvsBB 升级为六筹码深度精确分布（100bb cbet 54.3/check 45.7 + 尺寸拆分，来源 GTO Wizard 文章内表格直读）。全部数字在交付前对来源重新核验。
- V7.10.8 建立读数标注规范：正文数字标「正文核验」、文章内渲染表格标「文章表格直读」、逐手策略网格不逐手抄录只取定性；facebet 条目不填 C-bet 频率字段（避免渲染误标），改以 sizingContext（应对所针对的下注尺寸）+ 应对构成（fold/call/raise）呈现。GTO 种子升版 v4（未编辑行按 seedRevision 自动升级，保留用户启用状态与手工批注）。
- V7.10.8 外部证据种子升版 v4：追加 Poker Copilot 人群线索（fold-to-flop-C-bet 42–57%，2017 年代，lead 级）与两篇 MTT 40bb 牌面启发式（IP/OOP，structural 情境参考，含 AJ6 99%+ vs 986dd 93.67% equity realization 正文数字）；契约测试覆盖种子完整性、播种升级三态（升级/保留启用状态/保护手工批注）与两级匹配（牌面专项优先、facebet 独立路由）。
- V7.10.7 将外部证据接回实际 Radar Spot：GTO 基线优先匹配同场景、同决策、同牌面类别的专项参考，不存在专项时才回退通用聚合；新增 BTNvsBB 三连张面与 COvsBTN 低对子面的公开 GTO 结构性参考。SBvsBB 两花干面的相邻 25bb GTO 材料明确标为「情境参考」，不冒充 Hero 面对下注规则。
- V7.10.7 证据包新增可选 Radar 适用范围（场景 / Hero 决策 / 牌面类别）。只有完整标注、且不是研究线索的 MDA 才会自动出现在同类 Signal；无直接匹配 MDA 时，L3 Signal 明示证据缺口，不以泛化人口结论替代。现有证据包与手工 GTO 基线均向后兼容。
- V7.10.6 修正 GG 自动导入的 Session 语义：以连续 1 小时打牌窗口为一场，换级别不再拆场，场内级别显示为组合（如 `NL5 + NL10`）；同日相隔超过 1 小时不再按日期错误合并。新自动场次记录精确起止时间，后续分批导入仅在时间窗口可验证相连时续接；历史/手工场次维持原状，仍可由用户明确指定导入目标。
- V7.10.5 修复批量导入 Session 聚合持久化：导入命中既有 Session（自动分组或目标 Session）时，Session 的 hands/profit 更新此前不落库；现在只要导入手牌就必须保存 Session 并等待持久化完成。
- V7.10.5 新增大批量导入模式：新解析 ≥500 手时预览只显示汇总/失败/重复计数与至多 100 条代表样本（不再生成与手牌数同量的勾选 DOM），提供「导入全部新手牌（已排除重复）」一键动作；小批量逐手勾选/覆盖/对比行为不变；大批量写入仍等待 IndexedDB 落库后提示成功。
- V7.10.5 修复 Decision Radar 混合 6max/9max 样本：Spot 与场景基线均按可观测桌型隔离；旧 Dossier/策略仅在样本唯一对应一个观察档案时兼容迁移，避免把跨档案历史关联误判为改善。
- V7.10.5 GTO 基线统一改为结构性参考：显示来源频率、来源、已核验条件和转移边界，但不再计算与当前 Spot 的差值；修正种子中未由引用正文核验的 6max/100bb 条件，并安全升级未编辑的 v1 种子。
- V7.10.4 新增 GTO 基线域：来源/条件/转移边界内联的 GTO 聚合参考（40bb 精确锚点 + 100bb 定性方向，来源为 GTO Wizard 博客与 BBZ Poker 2025-11 聚合报告，证据包留痕）；Radar 信号卡与策略卡按场景显示 GTO 参考块（40bb 对主线样本仅结构性参考）；策略子页新增 GTO 基线管理区（手工录入/编辑/停用）。
- V7.10.3 修复 Radar 卡片陈旧显示：findings 为空时同步隐藏 Radar 区块，不再残留上一次的信号。
- V7.10.3 Radar 扫描加数据纪元缓存（handDataChanged 失效），同一次访问内不再重复全量派生（4.3 万手场景的多次点击显著提速）；删除策略桌死字段；移除根目录残留的 86KB 静态演示文件（demo/ 版本保留）。
- V7.10.3 补 Phase 4 e2e：策略生成训练单元跳转 Quiz（场景自动选中）、对手观察笔记与 Live 开关重载持久化。
- V7.10.2 新增 Mastery & Ecology v1：策略可生成训练/复测单元（quiz 型仅限有 gtoRaw 数据的 BTNvsBB/SBvsBB，其余为基线快照复测）；复测判定 = 基线快照 vs 当前 Radar（频率变化 ≥15pp / 样本增长 ≥50% / 信号消失）。
- V7.10.2 对手上下文 v1：Villain 面板每对手新增「观察」笔记（带时效，过期灰显）与 Live 标记开关（激活既有休眠写入）；导航新增 goToOpponent deep-link。
- V7.10.2 存储新增 learningUnits / opponentNotes 集合（IndexedDB v5 平滑升级，导出/导入合并支持）。
- V7.10.1 新增 Evidence & Strategy：Review 新增「策略」子页——证据包（来源/条件/方法样本/取证时间/转移边界/要点）与策略修订（family 分组、research/candidate-adjustment/maintain 三态、关联证据与 Dossier、复测条件）。
- V7.10.1 Dossier 编辑器新增「转为策略修订」（预填草稿、不回写事实）；导航新增策略 deep-link（goToStrategy）。
- V7.10.1 存储新增 evidencePacks / strategyRevisions 集合（IndexedDB v4 平滑升级，导出/导入合并支持）。
- V7.10.0 新增手牌可视化回放（Hand Replay UI）：手牌列表展开区「⏵ 回放」按钮进入只读派生视图——上半部为分步条牌桌（座位位置 + Hero 底牌 + 公共牌随街累积高亮 + 逐街动作 + 已知投入近似），下半部为全街文字回顾 + 摊牌与盈亏。
- V7.10.0 回放解析为纯函数（parseReplay，契约测试覆盖）：desc 逐街叙事解析、翻前位置归属、翻后匿名动作序列（不臆造归属）、摊牌 shows 剥离与对手摊牌行；手工记录或信息残缺走降级视图（结构化摘要 + 原因标注），任何解析异常不抛错。
- V7.10.0 回放为只读派生层：新模块 handReplay.js 零 store import（结构性无写路径），不新增持久化对象、不写回手牌字段、无胜率/solver/动画、纯 DOM + CSS 四主题兼容。
- V7.9.2 新增 Decision Radar v1：Discover 面板内按场景分组的 Spot 级信号（翻牌 C-bet 与跟注者应对；你的频率 vs 你自己的场景基线），样本/偏差阈值可调，证据手牌直达。
- V7.9.2 新增 Observation 派生层（analysisReadModel.buildFlopObservations）：从行动线短码按"翻牌行动顺序表"启发式归属 Hero 决策，覆盖率统计如实呈现，基线不涉及旧 GTO（Phase 0 裁决）。
- V7.9.2 新增 Finding Dossier 持久化（dossiers 集合，IndexedDB v3）：假设/反例/下一步取证/状态四字段，以确定性 signalId 锚定，导出/导入合并支持。
- V7.9.2 裁决：Signal v1 覆盖翻牌 C-bet + 跟注者应对；与既有发现（盈亏异常/自我矛盾）并存。
- V7.9.1 新增 Session Closure 最小闭环：Session 面板内每场收尾工作区（Mark 匹配、候选手牌复盘、确认收尾），未收尾场次显示「未收尾」徽章与待收尾计数。
- V7.9.1 快速记录改为创建 Mark（时间指针 + 短备注，独立 marks 存储），收尾时按时间邻近（±5 分钟、同 Session 优先）与导入手牌匹配；「完整编辑」仍创建手牌记录（线下无 GG 文本场景）。
- V7.9.1 候选手牌四源最小集：Mark 关联、大亏损（≤-40BB）、每场 |pBB| 前 3、星标；去重上限 8 条，来源徽章标注，盈亏只提供语境。
- V7.9.1 桌面端快速记录入口移入 Review 的 Session 面板（不新增 tab）；存储新增 marks / sessionClosures 两个集合（IndexedDB v2 平滑升级，导出/导入合并支持）。
- V7.9.0 新增多文件 `.txt` 导入可靠性：文件选择器支持多选、合并顺序与选择顺序一致（消除 FileReader 竞态）。
- V7.9.0 修复混合档位导入盈亏失真：盲注值改为逐块从牌局头部 `($sb/$bb)` 结构检测（异常 post 行与缺失时按块回退），导入语料 43,680 手逐手指纹与修复前一致（单档位零回归）。
- V7.9.0 修复 Session 等级硬编码：改由盲注派生（0.05→NL5、0.1→NL10、0.25→NL25），同日不同档位不再错并，档位变化强制切组。
- V7.9.0 导入手牌新增持久化事实字段：`heroPosition`、`heroCards`、`bbValue`、`heroStartStack`、`heroEndStack`、`marked:false`；覆盖补丁同步刷新这些字段且不触碰决策/反思/Session 关联。
- V7.9.0 修复 Discover 缓存：手牌数据任何增删改/导入/恢复经 `handDataChanged` 事件强制重扫，不再出现"编辑同数量手牌后 Discover 不刷新"。
- V7.9.0 移除 Discover 自动"偏离 GTO"发现：旧 GTO 数据无适用范围元数据，转为 scoped legacy reference；热力图对照、Quiz 场景区与 GTO 速查表统一标注"旧 GTO 参考数据：条件未记录，未经 9max/200bb 主线档案验证，仅作结构性参考"。
- V7.9.0 新增手牌桌型事实字段 `tableMax`：从 GG 牌谱 Table 行的 `-max` 标注提取（6-max/9-max），缺失记 0；覆盖补丁同步刷新（总控裁决：6-max 与 9-max 历史同等进入观察档案；旧导入 Session 等级错标保留不修）。
- V7.9.0 修复手牌头部时间无法解析时的静默丢弃：改为按失败上报（原因"无法解析手牌时间"），导入预览可见（压测发现）。
- V7.9.0 修复 Session 统计聚合：多桌混档位或分批导入时，手数/盈亏按唯一 Session 累加（此前只计首个分片，真实语料压测暴露）；导入完成提示改为去重后的真实场次数。
- V7.9.0 导入改为落库确认制：成功提示在 IndexedDB 真正写入完成后显示，按钮期间显示"写入存储中…"；全量 43,680 手实测 toast 后立刻重载数据完整（修复压测发现的"toast 已显示但未落盘"丢失窗口，落库耗时随批量约 10-30 秒）。
- V7.9.0 数据量超过本地备份容量（LOCAL_BACKUP_SAFE_CHARS）时，导入提示引导定期在"迁移"中导出备份；localStorage 配额为单源总量，大数据集的备份依赖导出文件。
- V7.9.0 修正导入浮层文案：Session 自动分组间隔实际为 1 小时（V7.3.2 起），浮层"3 小时"为遗留描述。
- V7.8.0 新增可安装 PWA 基础：相对路径 manifest、Apple/PWA 图标、maskable 图标、HTTPS 离线 shell 与严格构建产物白名单；继续保留 `file://` 单文件核心能力。
- 新增部署基线，区分本地 Git 状态、公开远端状态、Netlify 和 GitHub Pages。
- 新增轻量开发、检查和发布流程。
- 新增面向用户的 parser、存储、离线、HTTPS 和移动端验收标准。
- 新增临时构建型 `npm run check` 流程，检查构建产物、数据契约和浏览器冒烟。
- 更新 GitHub Pages workflow：发布前先安装依赖并从源码构建。
- 完成存储 seam：IndexedDB、localStorage 降级、备份和迁移重试统一由持久化协调器管理。
- 完成 GG 导入 seam：解析失败、重复、覆盖和 Session 分组在写入前统一生成导入计划。
- 完成 Review 导航 seam：手牌、Session、Discover 和学习目标使用统一导航意图。
- 完成学习分析读模型：Review、Discover、Quiz 使用只读规范化快照，Discover 可稳定跳转 Quiz。
- 强化构建产物契约：检查单文件输出、CSP、无外部运行时资源、HTTPS Service Worker 和两套部署构建入口。

本条目不代表已经发布到生产环境。

## 正式发布记录模板

```text
Source SHA:
App Version:
Artifact Hash:
Target URL:
Automated Checks:
Manual Acceptance:
Online Smoke:
Rollback Point:
```
