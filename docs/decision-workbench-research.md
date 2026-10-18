# Decision Workbench Research

研究日期：2026-10-16。范围：借鉴 GTO Wizard 的复盘、研究与练习衔接，支持本项目已确认的「当前决策 → 疑问 → 学习 → 练习 → 回原节点」。本文是来源与产品判断记录，不承担实现状态或测试结果的职责。

本轮直接阅读公开官方页面；未访问账号、个人牌局或内部策略接口。没有将社区观点作为产品功能事实，也没有重新核验订阅权限与免费额度。

## 证据与可借鉴点

| 来源 | 官方说明 | 本项目的产品判断 |
| --- | --- | --- |
| [Redesigned Analyzer & Upgraded GTO Reports](https://blog.gtowizard.com/redesigned_analyzer_and_upgraded_gto_reports/)，2025-09-24，Analyzer / One-Click Actions | 手牌表是集中复盘位置；筛选后可直接进入 Study 或针对手牌场景的 Practice。 | 统一入口应围绕同一手牌与疑问组织，避免用户在多个列表重新寻找记录。官方文章不能证明其浏览器刷新、返回位置或草稿恢复行为。 |
| [Tips & Tricks to Study Analyzed Hands](https://help.gtowizard.com/tips-and-tricks-to-study-analyzed-hands/)，Replayer / Solution browser / Underlying trends | 回放逐街检查；进入研究时预填牌面与行动；检查范围假设、范围优势、继续阈值及解算尺寸／筹码是否适合原问题。建议分开看结果与决策过程，改变牌面或位置寻找规律。 | 学习入口应传递所选决策当时的信息与具体问题。实际盈亏可辅助整理，不能称为动作质量或错误严重度。 |
| [Study Mode](https://help.gtowizard.com/study-mode/)，Navigation / Infobox / Strategy / Reports | 先选择场景和行动路径；局面信息与策略视图并置；提供范围、动作构成及同场景牌面报告。 | 在学习区持续显示来源节点，读资料时无需重新构造条件。没有组合策略数据时不模仿其精确矩阵或 EV 视图。 |
| [How To Use the Trainer](https://help.gtowizard.com/how-to-use-the-trainer/)，Spot / Board / Difficulty / Learning mode / History | 支持单决策、单街和整手模式；可限定相近牌面；简化动作粒度；暂停时显示反馈，历史可回看。 | 当前阶段采用单决策、先回答后对照和手动继续；学习后练习应继承问题。资料中的 close decisions 依赖动作 EV，本项目不能仅凭聚合频率生成这种题。 |
| [The Learning System That Separates the Best From the Rest](https://blog.gtowizard.com/the-learning-system-that-separates-the-best-from-the-rest/)，2025-04-02，Isolating / Conclusion | 作者展示只改变筹码或下注尺寸、其余条件保持一致的研究方法，并强调综合输出解释变化。 | 可以采用「先写预测，再对照资料」的学习方法。现有牌面与主题参考不能支持任意筹码、尺寸或位置变体的自动解答。文章是官方教学观点及示例，不是本产品学习效果的实验性证明。 |

## 本地核查：改造前的断点

以下为本轮开始时的源码证据，不是 GTO Wizard 操作证据。文件将在实施中变化，改造后的行为与验收以实际代码和测试为准。

- [studyAnalyzeModel.js](../src/modules/studyAnalyzeModel.js) 的 `handLearningContext()` 依据整手牌的 `actionLineOTR` / `actionLineOTT` 推主题，没有接收回放所选街道。翻牌疑问可能被后来的河牌记录带到河牌主题。
- [handReplay.js](../src/modules/handReplay.js) 的 `_buildReplayView()` 将 `stepIdx` 初始化为零，位置保存在该次渲染的闭包内。回到手牌后无法由外部恢复刚才查看的节点。
- [analyzeWorkspace.js](../src/modules/analyzeWorkspace.js) 已有队列与学习入口，但编辑通过 `Navigation.goToHand()` 跳到旧 Review；学习和个人练习分别传递有限字段。
- [studyWorkspace.js](../src/modules/studyWorkspace.js) 的主题练习入口主要传 `topicId` 与 `returnTab`；[practiceWorkspace.js](../src/modules/practiceWorkspace.js) 已能保存学习问题、作答与总结，具备复用基础，但返回页签不足以表达原节点。

## 推荐改造与收益

下列均为本项目设计判断，实际操作数与学习效果需要改造后的用户体验验证。

| 推荐 | 复用或修改 | 预期收益 | 边界与可观察验收 |
| --- | --- | --- | --- |
| 1. 以一个工作台承接复盘、学习和练习 | 复用 Analyze 队列、Study 资料与 Practice 会话；导航集中入口，旧链接路由到同一手牌详情。 | 减少找入口和重新选择手牌；自由学习仍可直接开始。 | 不删除 Session、计时、导入、策略等独立任务；从旧入口打开后仍能找到原记录。 |
| 2. 共享当前决策上下文 | 回放提供街道与行动位置；跨视图携带手牌 ID、来源指纹、疑问及当前可见条件。 | 翻牌疑问进入翻牌学习，返回后继续原节点。 | 匿名行动不自动断定为 Hero；缺失筹码、底池或归属保留未知。原手牌变化后重新确认节点，不沿用过期确认。 |
| 3. 将疑问与自己的解释放在学习前 | 复用个人复盘字段和题目草稿，关联节点；学习内容旁保留疑问与条件。 | 阅读围绕待解决的问题展开，避免读完不知如何用于原手牌。 | 个人假设与资料结论分开，学习记录不改写原始牌局事实。无需填完整表单才能自由浏览。 |
| 4. 学习后练同一问题，结束返回原节点 | 复用三类练习、冻结题目、总结与复练；传递学习问题及来源上下文。 | 形成能回到原决策的任务链，保留中途作答与理解变化。 | 概念题按教材答案；范围题仅对照已收录参考；个人题对照原行动与自己的理由。不能统一为 GTO 分数。 |
| 5. 用有限对照解释变化，写回一条带条件的理解 | 复用主题出处、牌面比较与练习总结，将用户选择的结论关联回来源决策。 | 以后回看能知道判断依据与适用范围；从单手疑问积累可复习的问题。 | 用户主动保存；来源与条件可见。只在有匹配证据时解释差异，无答案时保存待核查点，不推导新 EV 或冒充 solver。 |

## 未知与不采用的部分

- 官方页面支持跨模式携带局面与集中入口；本轮没有实际验证 GTO Wizard 跨刷新保存街道、筛选、滚动或草稿。我们需要的位置恢复是明确的本地产品要求。
- 不接入 Wizard 的远端上传、解算服务或私有接口；本项目继续本地优先。默认个人档案 9max / 200bb、次线 6max / 100bb，与参考资料实际条件分别呈现。
- 不按个人盈亏模拟 EV loss；不按整体范围频率判定某一底牌动作正确；不生成没有答案数据的多街分支、范围矩阵或单变量变体标准答案。
- 首期验收关注同一任务能否接续：原队列与节点能返回、疑问能继承、草稿与学习记录能恢复、旧入口和旧数据仍可访问。自动检查通过不能代替实际使用体验。
