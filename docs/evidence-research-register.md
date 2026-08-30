# 外部证据候选登记册

本文件只登记可进入 Evidence Pack 的外部资料和其边界；不直接生成策略，也不替代真实牌局复盘。

## 入库规则

| 级别 | 可以做什么 | 不能做什么 |
| --- | --- | --- |
| 结构性参考 | 提供分组、问题或方向，用于建立 Dossier 和训练题 | 与个人样本做频率差，或直接写成默认策略 |
| 条件匹配参考 | 牌局类型、桌型、有效筹码、rake/ante、位置和行动线都已核验时，才可做数值对照 | 外推到未匹配的档案 |
| 研究线索 | 记录来源，等待方法、样本或条件补全 | 进入 Radar、策略或训练 |

每次录入 Evidence Pack 时，必须填入来源、条件、方法/样本、取证日期和转移边界。MDA 的结论还要写明牌池、档位、玩家分类和资料更新日期。

## 当前候选

| 候选 | 可确认的事实 | 对产品的用途 | 当前级别与边界 |
| --- | --- | --- | --- |
| [GTO Wizard：IP cash c-bet 聚合](https://blog.gtowizard.com/flop-heuristics-ip-c-betting-in-cash-games/) | 文章用 BTN vs BB 单挑翻牌和按 texture 的聚合报告解释 c-bet 频率与尺度；文中明确是 BB 不允许 donk 的 Simple solution。 | 为 `BTNvsBB` 的 texture 分组、复盘问题和训练反馈提供理论语言。 | 结构性参考。文章页未给出可核验的主线 9max/200bb、rake、open size 与全部树配置，不能把图中频率录作本项目数值基线。 |
| [GTO Wizard：200bb OOP 4-bet cash](https://blog.gtowizard.com/oop-4-betting-in-deep-stacked-cash-games/) | 文章直接比较 100bb 与 200bb 的 4-bet pot，并说明 200bb 下 preflop range 更极化、较不利翻牌检查更多。 | 验证“100bb 与 200bb 不能混成一个 postflop profile”；为深筹码 4-bet pot 建立后续研究题。 | 结构性参考。只适用于文中 4-bet pot，不可迁移到 SRP 或直接转成所有深筹码 c-bet 规则。 |
| [GTO Wizard：可自定义抽水解](https://blog.gtowizard.com/customizable-raked-solutions-with-gto-wizard-ai/) | GTO Wizard 说明现金局 postflop 可按 rake% 与 cap 自定义求解。 | 确立今后购买或手工抄录 GTO 数值时，rake/cap 是必填条件。 | 研究线索。不是一条策略证据，也不证明任何特定 GG 配置。 |
| [FreeBetRange MDA 说明](https://help.freebetrange.com/MDA/) | 该产品自述以 300M+ 真实 cash 手牌建立 preflop MDA；筛选项包括 Classic（含 GG）、3-6 max/7+ max、ante、NL25-50/NL100-200/NL500+ 与 Reg/Fish 分类；其文档称每六个月刷新一次。 | 最接近当前主线的免费优先 MDA 入口：先比较 7+ max 与 3-6 max 的 preflop 人口范围，再决定是否值得购入精确档位。 | 研究线索到条件匹配参考之间。数据量、重建和刷新都来自供应商自述，且免费层只开放一个预览 spot；只有实际打开后逐项保存筛选条件和范围，才可成为某个 preflop Evidence Pack。绝不外推为 postflop MDA。 |
| [FreeBetRange：产品与训练模式](https://help.freebetrange.com/) | 产品把 GTO、MDA、范围查看、单手决策训练与范围绘制训练分开。 | 可借鉴“同一策略内容可以有复习和练习两种呈现”，但不复制其全套 preflop 产品。 | 产品参考，不是扑克证据。 |
| [GTO Wizard：Daily Dose](https://blog.gtowizard.com/your-daily-dose-of-gto-is-here/) 与 [Trainer Drills](https://help.gtowizard.com/manage-training-drills/) | Daily Dose 主张短课/题目；Trainer 同时有默认 Drill 和用户自建 Drill，并能保存、排序与看表现。 | 支持本项目的“由 Dossier/策略生成小训练、按题目而非定时”方向。 | 产品参考，不是 GTO/MDA 证据。项目只吸收短反馈、可复测、可追溯的机制。 |
| [Savant Poker](https://www.savantpoker.com/) | 官网目前展示 guided path、drill packs、practice checkpoints、Hand of the Day 与 progress tracking。 | 支持“策略内容有边界、训练有路径和复测”的产品方向。 | 产品参考，不引入课程结论，也不复制订阅/社区结构。 |

## 下次取证顺序

1. 先从 FreeBetRange 的免费预览开始，只保存真实可见的一条范围及其完整筛选条件；不购买、不猜测不可见范围。
2. 只有该范围与目标桌型、ante、档位和玩家类型相符，才作为 preflop 条件匹配参考录入；否则保留为结构性参考。
3. 需要 postflop 数值时，优先从 GTO Wizard 可核验的具体 node 手工录入。每条数值必须同时保存 stack、players/table type、rake/cap、open size、行动线与 board/texture。
4. MDA 取证六个月后重新检查来源是否更新；更新前的资料仍可读，但不自动强化为当前人口结论。

## 不做的事

- 不把供应商的样本量、营销收益或教程举例当作木下牌池的事实。
- 不因有一个 6max/100bb 或 7+ max 来源，就推导出 9max/200bb 的精确频率。
- 不把外部证据直接写进实时行动建议；它只经过 Review、Dossier、策略和训练闭环后才影响复测。
