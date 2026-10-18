# Architecture — 木下的牌桌助手 (Underwood's table agent)

## Tech Stack

- **Dev**: Vite 7 dev server (`npm run dev` → `http://localhost:5173`)
- **Build**: Vite + `vite-plugin-singlefile` → 单文件核心 `dist/index.html`，外加严格白名单内的 PWA manifest、Service Worker 和图标
- **Runtime**: ES 模块（dev 时 Vite 处理 import；build 时全内联）
- **Storage**: `src/store/storage.js` 统一协调 IndexedDB 主存储、localStorage 降级、备份和迁移重试。保留所有 `pa_` 键名和历史迁移标记
- **Hosting**: 平台入口与带日期的核查记录见 [部署基线](deployment-baseline.md)
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` + 本地图标；Service Worker 与 Blob URL 降级仅 HTTPS 生效

## Session-first review navigation

Analyze opens with a Session browser when Session records exist. `sessionReviewView.js` projects Session, linked hand, Mark and closure records without writing repositories. The Session summary leads to manually marked or Mark-linked hands, all hands in that Session, and the existing closeout workflow. Imported hand profit in BB is distinguished from recorded Session profit and is not a decision score.

`AnalyzeWorkspace` owns the overview / Session / hand screen state and in-memory per-Session queue snapshots. Returning from the Session summary restores filters, selection, queue scroll and page position; decision drafts and replay positions continue using `DecisionWorkspaceStore`. Clearing hand filters keeps the current Session scope. Cross-Session search and hands without a Session remain available. `Review.onSessionReview` connects existing record-table rows to the same Session summary; `onReturnSession` continues to open the existing closeout workflow. Study and Practice retain their existing source context interfaces. Analyze suppresses the duplicate source block above the replay.

`sessionHandBrowser.js` renders the complete Session hand list with search, explicit filters, sorting and bounded pages. `AnalyzeWorkspace.sessionBrowsers` retains each Session's browsing controls, page and scroll in memory. Marking a hand updates the existing `hand.marked` flag through `HandRepo` and awaits persistence; it does not introduce a new pick collection or alter hand facts. This browsing state and the editor's disclosure/scroll state are not persisted across reloads or included in backups.

The focused editor keeps question and initial reasoning visible, groups optional plans and post-learning notes in native disclosures, and puts the existing save operation in a sticky header. All existing fields, including collapsed ones, remain part of the same draft/save operation. Desktop replay and notes can scroll independently; narrow desktop widths collapse the switch-hand queue to preserve reading width. Record management retains its forms and statistics and links explicitly to Session-first analysis.

## Timer presentation

`timerWorkspace.css` owns the Timer layout and responsive rules. The clock and phase occupy the main surface; run/pause status is derived in `Timer.syncPrimaryAction()`. Quick capture invokes the existing global capture button, and finishing play continues through the existing pause/closeout handler. Progress and a default-collapsed configuration disclosure follow the clock. Timer duration, phase switching, log writes and persistence retain their existing interfaces. Clearing today's logs uses the shared confirmation dialog without resetting the standing count.

## Shared interaction behavior

The existing Buttons and form-control sections in `src/styles.css` own the shared appearance of legacy `.btn` controls and workspace `.ws-button` controls, including primary/secondary states and workspace filters. `src/workspaces.css` retains workspace layout rather than a second button palette. Specialized mini controls, range matrices and chart encodings retain their own rules.

`DecisionWorkbench.renderContext()` is the shared source summary in Study and Practice: the source and question stay visible, while detailed conditions and original notes are disclosed on demand. Source deletion or revision warnings stay outside the disclosure. Study renders one return/free-study action row and continues to own its return callback; Practice keeps its source-return actions in the workbench. Practice still excludes prior judgment and plans before submission.

`src/modules/uiInteractions.js` provides DOM-only interaction behavior. `Utils.initDropdown()` delegates keyboard navigation, dismissal and expanded state to it. `App.init()` installs focus containment, background inertness, Escape and scroll locking on the existing share, GG import and metric-description overlays. Business modules continue to own visibility and cleanup. Native backup and confirmation dialogs retain browser modal behavior; Mark capture retains its existing draft and focus lifecycle.

`Utils.confirmAction({ title, message, confirmLabel, danger })` returns a Promise of the explicit choice; Escape and cancellation return false. Core record, Session and batch hand deletions await it before invoking their original repository operations. Other legacy confirmation prompts are not automatically intercepted.

`Utils.withBusy(button, label, operation, scope)` returns the operation Promise, prevents concurrent calls on the same button and restores original disabled states in `finally`. Review saving and GG import keep the existing persistence APIs; busy UI does not imply durable success. `Utils.showToast(message, duration)` remains compatible and also accepts `{ duration, tone }`, where tone is neutral, success, warning or error. Notifications retain the original message text, expose live-region semantics, pause dismissal during reading/focus and offer an explicit close control.

`src/interactions.css`, loaded after the legacy and workspace styles, owns shared state, menu and overlay transitions. It consumes the existing Poker theme tokens, honors reduced motion and adds no runtime dependency. The community reference [open-claude-ui](https://github.com/Caho1/open-claude-ui) informed component-state hierarchy, bounded dialogs and restrained transitions; its React components, brand colors and reverse-engineering claims are not product dependencies or official specifications.

## Dual-Scenario Runtime

| | `file://` (offline) | `https://` (online) |
|---|---|---|
| Entry | 双击 `dist/index.html` | Netlify / GitHub Pages |
| Dev | — | `npm run dev` |
| Service Worker | Disabled | `public/sw.js` (DevTools 可调试) |
| Notifications | Disabled | Enabled |
| Storage | IndexedDB + localStorage | 同左 |

## Module Map

```
src/
  main.js            # 入口：initStorage() → App.init(health)
  constants.js       # CONSTANTS + EQUITY 查找表
  utils.js           # Utils + PubSub + setSafeHTML/showToast/renderCardBadges/formatProfitHTML
  styles.css         # 全局 CSS
  selfTests.js       # GG 解析器自测（仅 DEV，生产构建剔除）

  parsers/
    ggParser.js      # GG 手牌历史 → 结构化数据（含 rake/jackpot/oHash）

  store/
    db.js            # IndexedDB 封装（DB 对象，零依赖）
    storage.js       # localStorage / IndexedDB adapter + PersistenceCoordinator
    store.js          # Store + BaseRepo + repos + initStorage + 迁移 + 健康状态

  modules/
    app.js           # App 骨架（init/导航/SW注册/beep/vibrate/健康指示器/SRP/行动线）
    timer.js         # 站立提醒（beep/vibrate/notify 依赖注入）
    odds.js          # 底池赔率计算（MDF/SPR/隐含赔率/几何路线）
    tournament.js    # 占位桩
    tiltRescue.js    # 情绪急救（PubSub → Review）
    dataSync.js      # 剪切板导入导出 + CSV
    review.js        # 复盘系统（Session/Hand/Discover/Weekly/Overall/Villain + 分页 + 统计 + 图表）
    navigation.js    # 统一导航意图：Tab / Review 子 Tab / Hand / Session / 学习目标
    analysisReadModel.js # Review / Discover / Quiz 共用的只读规范化学习快照
    ggImport.js      # GG 导入 UI（预览/反馈/文件拖拽）
    ggImportCoordinator.js # GG 解析结果 → 去重/覆盖/Session/持久化计划
    statsEngine.js   # 声明式统计引擎（指标、范围阈值、优化建议与 context 缓存）
    handPicker.js    # 手牌精选（☆ 标记 + Picks 卡片 + Hand/Session 跳转）
    discover.js      # 自动模式发现（盈亏异常、自我矛盾与热力图数据）
    quizTrainer.js   # GTO 频率判断训练器（双阈值判分 + 错题集 + 掌握追踪 + 轮转出题）
    sessionClosure.js # [V7.9.1 新增] 每场收尾领域模块（Mark 时间匹配 + 候选手牌 + 收尾记录）
    decisionRadar.js # [V7.10.7 修改] Spot 信号 + Dossier；同类牌面 GTO 优先匹配、严格 MDA 条件匹配
    strategyDesk.js  # [V7.10.7 修改] Evidence & Strategy（证据包 + 策略修订 + Radar scope 录入）
    strategyLibrary.js # [V7.11.14 修改] 策略主题目录；源码出处/边界/待证经验，仅读 HandRepo；候选手牌跳转与主题概念自测，不写个人策略
    strategyStudy.js # [V7.11.15 修改] 纯函数 getTopicHandReferences / getStrategyLearningTarget；行动归属、主题候选、策略训练路由与位置关系
    studyAnalyzeModel.js # [V7.13.0 新增] 只读筛选、主题路由和 legacy 牌面参考；简单平均不冒充概率加权策略
    analyzeWorkspace.js # [V7.15.0 修改] 共用手牌队列、回放定位、内联反思与决策短记；维护可见输入草稿
    decisionContext.js # [V7.15.0 新增] 当前节点事实投影、来源修订、逐决策短记更新；不读写仓库
    decisionWorkbench.js # [V7.15.0 新增] 复盘／学习／练习共用任务入口及来源信息
    studyWorkspace.js # [V7.13.0 新增] 主题阅读与牌面对照；引用同源概念与来源，复用主题概念自测路由
    practiceModel.js # [V7.14.0 新增] 三类题目投影、冻结条件、各自评价语义、手动推进与原题复练；不读写仓库
    practiceWorkspace.js # [V7.14.0 新增] 专项设置、确认时点、作答反馈、历史、草稿与文件恢复
    handReplay.js    # [V7.10.0 新增] 手牌可视化回放（只读派生层：desc 解析 + 逐街视图，零 store import）
    spotMatcher.js   # [V7.11.0 新增] 单手牌 spot 识别（两人池位置交替归属 + 多人池噪声排除 + 河牌惊悚/空白启发式；零 store import）
    pokerLogic.js    # [V7.11.2 修改] 复盘牌理参考渲染：四步导航 + 应用要点（出处行）+ 概念卡（误解/对比例/阈值/自测折叠）；esc 真转义 + href 协议白名单（仅 http/https）
    conceptQuiz.js   # [V7.11.6 新增] 概念自测训练器：selfCheck 题库 + 交互判分 + 掌握度（pa_concept_quiz_mastery）+ 错题集（pa_concept_quiz_errors，答错入册/答对销账/重做错题）

  data/
    srpData.js       # GTO 策略速查表（从 gtoRaw 自动生成，import Utils + gtoRaw）
    actionLines.js   # underBluff + overBluff 行动线表
    strategyFramework.js # [V7.11.14 修改] STRATEGY_TOPICS / STRATEGY_HYPOTHESES；引用概念、来源与场景；阅读限定与自测以 conceptSeed.js 为唯一正文源
    gtoBaselineSeed.js # [V7.10.8 修改] GTO 结构性参考种子 v4：按 Radar spot（scenario+question+boardCategory+sizingContext）落位 17 条；数字标注「正文核验/文章表格直读」；gate pa_gto_baseline_seed_v4，未编辑行按 seedRevision 升级
    externalEvidenceSeed.js # [V7.10.9 修改] 外部证据种子 v5：16 条（solver/mda/article/community/video，evidenceLevel 三级 + Radar scope）；含 4 条 street:'river' 河牌证据（由 matchEvidenceForSignal 的 street 过滤保证不进翻牌信号）
    pokerLogicSeed.js # [V7.11.15 修改] 复盘牌理参考种子：四步导航 + applicationIds + conceptIds + evidenceRefs；河牌前置线与相邻书例的条件保留在对应条目
    conceptSeed.js   # [V7.11.5 修改] 原子概念种子 v5：52 条概念（机制/误解/边界 + ⚖对比例 + 📐阈值 + ❓selfCheck 自测）+ CONCEPT_APPLICATIONS 45 条 spot×四步应用；主出处 DDoG 课程（页码+提取方式标注），静态 import 不入 localStorage
    strategy/
      gtoBaseline.js # L1 极端阈值自动编译（>90%/<5%）+ getGTOReference() + GTO_LEGACY_SCOPE
      gtoRaw/        # Solver 原始输出（旧遗留，scoped legacy reference）
        BTNvsBB_SRP_flop.js  # BTNvsBB 翻牌频率（183 boards）
        SBvsBB_SRP_flop.js   # SBvsBB 翻牌频率（183 boards）

public/
  manifest.webmanifest        # 相对 scope/start_url 的安装描述
  favicon.ico                 # 用户 ICO 字节级副本
  apple-touch-icon.png        # 180x180 Apple 图标
  icons/                      # 192/512 any 与 512 maskable PNG
  sw.js                       # 同源 GET：导航网络优先回退，静态资源 cache-first
```

PWA 图标源自 `public/favicon.ico`。普通图标保持原构图；maskable 图标使用不透明全幅背景，主体位于系统裁切安全区内。

### Dependency DAG

```
main.js
  ├── constants.js           (zero deps)
  ├── utils.js               → constants
  ├── parsers/ggParser.js    → constants, utils
  ├── store/db.js            (zero deps)
  ├── store/store.js         → constants, utils, db, statsEngine.clearStatsCache
  ├── modules/app.js         → constants, utils, store, srpData, actionLines, gtoBaseline, 全部子模块
  ├── modules/timer.js       → constants, utils, store, [beep/vibrate/notify from app]
  ├── modules/odds.js        → constants, utils
  ├── modules/review.js      → constants, utils, store, statsEngine, ggImport, handPicker, discover, quizTrainer, navigation, analysisReadModel, gtoBaseline (V7.9.0 scope 标注)
  ├── modules/statsEngine.js → constants
  ├── modules/handPicker.js  → constants, utils, store, navigation
  ├── modules/sessionClosure.js → constants, utils, store (V7.9.1 新增：每场收尾)
  ├── modules/decisionRadar.js → utils, analysisReadModel, store, navigation (V7.9.2 新增：Decision Radar)
  ├── modules/strategyDesk.js → utils, store, navigation (V7.10.1 新增：Evidence & Strategy)
  ├── modules/handReplay.js  → utils (V7.10.0 新增：手牌回放，纯只读派生，不 import store)
  ├── modules/ggImport.js    → constants, utils, store, ggParser, ggImportCoordinator, navigation
  ├── modules/discover.js    → constants, utils, store, gtoBaseline, analysisReadModel
  ├── modules/navigation.js  → DOM adapter + App-configured callbacks
  ├── modules/analysisReadModel.js → utils
  ├── modules/quizTrainer.js → constants, utils, gtoRaw (BTNvsBB + SBvsBB)
  ├── modules/tiltRescue.js  → constants, utils, store, PubSub
  ├── modules/dataSync.js    → utils, store
  ├── modules/tournament.js  (zero deps)
  ├── data/srpData.js        → utils, gtoRaw (BTNvsBB + SBvsBB)
  ├── data/actionLines.js    (zero deps)
  ├── data/strategy/gtoBaseline.js → gtoRaw (BTNvsBB + SBvsBB)
  ├── data/strategy/gtoRaw/*.js    (zero deps)
  └── selfTests.js           → parsers/ggParser (DEV only，构建时剔除)
```

## Core Data Flows

### App Boot

```
main.js
  → CONSTANTS.VERSION → document.title / .version-tag
  → initStorage(opts)
      ├── #safemode? → skip IndexedDB, load cache from localStorage
      ├── DB.open() → IndexedDB (pa_store; version and stores declared in db.js)
      ├── pa_migrated_v1? → load cache from IndexedDB
      │   └── else → load from localStorage → migrate → verify → flag
      ├── Recovery: localStorage backup vs IndexedDB cache → merge missing
      ├── Integrity: each repo cache must be Array → else reset/restore
      └── getStorageHealth() → { mode, issues, counts }
  → App.init(health)
      ├── _setTimerGlobals(beep, vibrate, notify)   ← Timer
      ├── Review._confirmDelete = App.confirmDelete  ← Review
      ├── PubSub.on('tiltLogSaved', ...)             ← TiltRescue → Review
      ├── ResizeObserver(profitChart)                ← Canvas auto-redraw
      ├── oHash 补丁：扫描 HandRepo 为旧数据补 oHash
      ├── All submodule init() → DOM event bindings
      └── initGGImport() → GG import event bindings
```

### Data Write Path

```
User action → Repo.add/update/delete/saveAll()
  → BaseRepo in-memory cache (业务模块不直接读取其内部状态)
  → PersistenceCoordinator.persistCollection() (300ms debounce)
      → IndexedDBAdapter.writeAll()（主路径）
      → 失败后 localStorage adapter 写入备份并标记降级

beforeunload:
  → Repo._flush() → coordinator 写入 localStorage (sync safety net)

大数据导入 (GG import) [V7.9.0]:
  → Repo.saveAll() → Repo.persistNow()（绕过防抖立即写入，返回 Promise）
  → 写入完成后才提示"成功导入"（toast = 已落盘；43,680 手约需 30 秒，期间按钮显示"写入存储中…"）
  → 记录数超过 LOCAL_BACKUP_SAFE_CHARS 时提示定期"迁移 → 导出"备份
  （localStorage 配额为单源总量，超限备份静默跳过且无法通过分块绕过——导出文件是大数据集的唯一备份手段）
```

### GG Hand History Import

```
User pastes GG text / selects multiple .txt (V7.9.0: picker multiple + 拖拽多文件)
  → handleFiles(): FileReader 按选择顺序索引装配（消除完成顺序竞态）
  → GGParser.parseDetailed(raw)
      → Return { hands, failures, total }
      → [V7.9.0] bbValue 逐块检测：优先牌局头部 ($sb/$bb)，异常/缺失回退块内 posts 行，再回退上一块
  → ggImportCoordinator.buildImportPlan()
      → duplicate (ggId, 含同批跨文件) / overwrite / Session 分组 / record mapping
      → [V7.10.6] Session 按连续 1 小时窗口分组；盲注派生的级别构成保留为 stakeLevels（如 NL5 + NL10）
  → User selects/deselects hands → HandRepo.saveAll(plan.records)
  → Navigation.refreshReview() + Navigation.goToReviewSubtab('hand')
```

### BaseRepo Cache Layer

```
BaseRepo
  _cache: []          ← in-memory sync reads（仅 store seam 内部）
  _backend: 'localstorage' | 'indexeddb'
  _dirty: false       ← pending IndexedDB write
  _key: 'pa_xxx'      ← localStorage key (fallback)

Methods:
  getAll()            → this._cache         (sync, O(1))
  getPage(n, p)       → this._cache.slice   (sync)
  getById(id)         → this._cache.find    (sync, O(n))
  count()             → this._cache.length
  saveAll(arr)        → cache = arr; _scheduleDBWrite()
  add(item)           → cache.push; _scheduleDBWrite()
  update(id, patch)   → Object.assign; _scheduleDBWrite()
  delete(id)          → cache.filter; _scheduleDBWrite()

业务模块只通过 Repo 的公开读写方法访问数据，不依赖 `_cache`、`_dbReady`、`_flush` 等内部状态。
```

## Store Schema

```js
settings:          { sound: bool, vibrate: bool }
timerState:        { endTime, phase, workStart, breakStart, longBreak: { enabled, interval, minutes }, cycleCount }
standup:           { date: 'YYYY-MM-DD', count: int }
log_<date>:        [ { workStart, workEnd, breakStart, breakEnd } ]
opponentAliases:   { oId: "昵称", ... }
opponentLiveFlags: { oId: true, ... }
opponentMerges:    { canonicalHash: [oId1, oId2, ...] }
sessions:          [ { id, date, level, duration, hands, profit, tilt, mistake, remark,
                       startedAt?, endedAt?, stakeLevels? } ]
handReviews:       [ { id, sessionId, date, potType, board, boardCode, boardCategory,
                       preflopScenario, actionLineOTF, actionLineOTT, actionLineOTR,
                       desc, mistake, reflection, pBB,
                       gg?, ggId?, oId?, oCards?, oHash?, rake, jackpot, marked,
                       heroPosition?, heroCards?, bbValue?, heroStartStack?, heroEndStack?, tableMax? }
                       // [V7.9.0] 尾部六字段 + marked 由 GG 导入新记录携带；旧记录无这些字段，读取方需容错
                       // tableMax = GG '-max' 桌型标注（6/9），缺失记 0；6-max 与 9-max 历史同等进入观察档案（总控裁决）
weeklyReviews:     [ { week: 'YYYY-Www', weakness, plan } ]
tiltLogs:          [ { date, time, trigger, intensity, note } ]
// Quiz & Discover (localStorage)
pa_quizState:      { scenario, records: { boardCode: { cat, picks } }, stageStats: { cat: { ok, fail } } }
pa_quiz_errors:    [ { id, type, scenario, boardCode, category, userAnswer, correctAnswer, gtoFreqs, timestamp } ]
pa_quiz_mastery:   { "scenario|boardCode": { consecutiveCorrect, totalAttempts, lastResult, mastered } }
pa_discoverState:  { findings, scanHandCount, archive }
pa_concept_quiz_mastery: { questionId: { asked, correct, ... } }
pa_concept_quiz_errors:  [ { id, chosen, ts } ]
pa_practice_v1:    { version: 1, presets: [{ id, name, config }], sessions: [{ id, config, questions, responses, index, status, startedAt, endedAt, note }], activeId }
pa_decision_workspace_v1: { version: 1, selectedId, attached, filters, positions: { handId: { street, actionIndex, decisionKind, revision } }, drafts: { draftId: { question, reason, insight, reflection, reflectionDirty, references, editedAt, saved } } }
```

IndexedDB: `pa_store`；版本与 object store 声明以 `src/store/db.js` 的 `DB._version` / `DB.open()` 为准。业务集合之外的 `recoverySnapshots` 仅保存最近一次恢复的原始导入内容、恢复前副本与执行结果，不进入业务统计，也不递归导出。
`handReviews` has 3 indexes: `sessionId`, `ggId`, `date`.
// [V7.9.1 新增] marks: [{ id, time 'YYYY-MM-DD HH:MM', note, mistake, sessionId|null, status 'open'|'matched'|'dismissed', matchedHandId, createdAt }]
// [V7.9.1 新增] sessionClosures: [{ id, sessionId（唯一）, status 'draft'|'closed', closedAt, reviewedHandIds[], matchedMarkIds[], note }]
// [V7.9.2 新增] dossiers: [{ id, signalId（确定性锚 radar|{scenario}|flop|{profileKey}|...）, spotKey, profileKey, title, status 'open'|'checking'|'resolved'|'maintain', hypothesis, counterexamples, nextSteps, sampleHandIds[], observationVersion, createdAt, updatedAt }]

## UI Navigation

策略主题的决策讲解由 `strategyLessons.js` 的 `TOPIC_LESSONS` 与 `TURN_DECISIONS` 提供；原子概念和持久化自测仍由 `conceptSeed.js` 提供。转牌位置变体通过 `TURN_SPOTS` 连接 `POKER_LOGIC_SEEDS` 与 `CONCEPT_APPLICATIONS`，主题与手牌卡共享正文，不另存个人策略。

`spotMatcher.js` 的 `matchTurnSpot` 识别未加注翻牌线后的 SRP 转牌节点，保留 Hero 的加注者／跟注者身份与翻后行动顺序。翻牌加注线和不支持的转牌分支不强行归类。`PokerLogic.renderForHand` 可同时呈现转牌与河牌卡；转牌卡不导向仅覆盖翻牌观察的 Radar，也不生成频率或个人漏损结论。

### Decision workbench

主入口「复盘与学习」包含 `analyze` / `study` / `practice` 三种模式；「记录与统计」保留手工录入、场次收尾、研究记录、对手、统计及旧 Quiz。`Navigation.goToHand()` 将各候选来源统一定位到工作台详情；`goToLearningTarget()` 和策略主题练习进入统一练习页。旧 Quiz 保留独立入口和原统计，未用新会话改判旧记录。

`HandReplay.render(container, hand, options)` 可接收 `street`、`actionIndex` 与 `onPositionChange`，无 options 的旧回放保持原行为。所选匿名行动仅表示研究位置；生成个人题仍需明确确认 Hero。`decisionContext()` 只投影已选时点的公共牌与行动前缀，并携带疑问和初步判断，主题不由最后一街代替当前街道。学习与练习来源保留该快照；个人题作答区及共用栏使用题目自身的可见事实，防止来源面板泄露更晚节点的信息。

可选手牌字段 `decisionReviews` 按来源修订、街道、行动前位置索引，保存疑问、判断、新理解、学习主题与来源、更新时间。原牌谱字段不被学习回写。来源修订改变后旧短记保留，位置需重新核对；旧练习仍读冻结快照。`reflection` 属整手牌，只有明确编辑该字段的草稿才可更新，避免其他节点的旧副本回滚新反思。

工作区草稿使用 `pa_decision_workspace_v1`，`draftId` 由手牌 ID 与决策 key 组成，恢复导入校验位置及引用结构；按标识补入、本地冲突保留。可见草稿有同 key 内存副本；存储配额失败不以旧缓存替换当前输入。保存时核对编辑器绑定的决策并读取可见字段，等待 `HandRepo.persistNow()`；成功记录优先于更旧缓存。跨页面切换节点后，旧编辑器拒绝写入新节点，原输入保留供重新选择原节点后保存。队列筛选与位置本地恢复，页面滚动位置在本次打开期间按视图恢复。

`postflopCourseWorkspace.js` 在学习页提供独立的转牌—河牌研究课程；`postflopCourseModel.js` 管理当前节点、已发生行动、提交前草稿、已提交理由／计划和总结。它不属于已有自动评分题型。课程数据为 `src/data/solutions/turn-river-course.json`，从已保存的父翻牌策略离线导出，保留有限教学河牌及起始手牌，所有课内决策节点沿原生树的合法行动连接。对手动作使用排除当前 Hero 底牌冲突后、按到达权重聚合的节点策略；河牌仅从课内候选选择，不宣称模拟完整发牌分布。零到达或没有兼容范围的分支结束延续，历史判断保留。

课程进度复用 `pa_decision_workspace_v1` 的可选 `turnRiverCourses` 字典，以内容哈希保存一份完整课程快照及多轮记录；旧字段和存储键不变。理由和计划绑定渲染时的课程、轮次与节点，短延迟保存，页面离开时同步保存；失败保留可见输入并阻止当前课程内的跳转。完整备份自包含，恢复按哈希和轮次 ID 合并，本地同 ID 冲突保留。历史始终读取相应课程快照。结构／内容一致性检查不等于数值认证；当前课程 `numericalVerification: pending`、`scoringEligible: false`，反馈仅显示研究频率与同节点内相对最高参考 EV 的差值，不判对错、不生成 GTO 分数、不回写个人手牌。

研究依据与未知项见[工作台研究](decision-workbench-research.md)，人工任务见[验收清单](acceptance.md#决策工作台v7150)。

Study / Analyze 可带来源进入 Practice。新会话保存题目、来源、实际条件与评价版本的完整快照；个人题前缀只包含确认时点以前的事实，后续行动、最终牌和原反思只在提交后渲染。概念题按题库答案判分；范围题对照聚合参考；个人题保留行动和理由，不以实际结果当标准答案。新会话不回写旧 Quiz 的掌握度或评分。

`src/store/practiceStore.js` 管理独立 localStorage 记录，写入失败报错并尝试保留旧值，超额时可下载现有备份。`Store.exportAll()` 的可选 `learningState` 补充 `LEARNING_KEYS` 所列独立学习记录；旧备份缺此字段仍可导入。历史会话快照保持原义，不重新判分。

### Verified solution samples

个人翻后决策卡由 `postflopReviewModel.js` 的 `postflopReview()` 与 `postflopFacts()` 约束，沿用逐决策草稿和 `hand.decisionReviews`。数值输入保留原字符串，草稿允许未完成输入；保存复盘与开始练习时校验金额。底池与剩余有效筹码是用户填写的节点条件，不改变原手牌事实，也不填补自动求解匹配资格。

个人题在开始时将同节点的旧判断冻结到 `reveal.review`；可见局面仅携带手工条件，不携带旧行动计划或学习短记。新回答可保存 `nextStreetPlan`，提交后与冻结的原判断并列，旧记录缺少这些可选字段仍可读取。工作台在练习模式隐藏旧判断；Analyze 的翻后问题入口按当前牌谱修订筛选并定位原节点。

`tools/solver-lab/fixtures.json` 定义独立求解输入和数值门槛，`run.py` 用仓库外的固定原生引擎核验；`export-packs.mjs` 只从成功报告生成内置数据。主／对照适配器独立编译，原生引擎、编译器及缓存不进入网页。实际求解证据见 [河牌核验记录](solver-lab-verification.md)。

`src/data/solutions/index.js` 静态导入并冻结支持的答案包，构建时全部内联，不新增运行时请求或存储键。`solutionPackModel.js` 验证内容哈希与受支持的模型结构；SHA-256 证明内容一致，不证明作者身份或外部数据质量。节点以行动路径、底牌以具体花色标识，频率与 EV 分开保存。类别统计按自身到达权重乘兼容对手质量聚合；未覆盖、不可达、没有兼容对手、未计算 EV 与真实零值分别呈现。

`solutionWorkspace.js` 是 Study 的独立研究子视图，不读写翻前个人范围。`practiceModel.js` 的 `solution` 题型按兼容到达权重不放回抽取有完整动作 EV 的组合，每轮只保存一份 `solutionSnapshot`；题目绑定包哈希、节点和组合。反馈比较所选动作与最高动作 EV，数值基准由包的 `ev` 字段声明，不把最高频动作当唯一答案，不产生跨题型分数。

练习在内存中仍使用带 `solutionSnapshot` 的 v1 会话。`practiceSnapshotCodec.js` 将 `pa_practice_v1` 的新保存内容编码为 v2：`solutionSnapshots` 按内容哈希保留每版答案，求解会话以 `solutionSnapshotHash` 引用；没有会话引用的答案在保存时移除。读取兼容旧 v1 整包快照且不写入，下一次成功保存才压缩。同一答案库中的会话共享经校验并递归冻结的对象，仅本模块已验证对象可跳过重复包校验，不凭哈希字符串或外部冻结状态信任内容。页面和评分继续使用展开后的会话，旧回答按原快照回看，不按当前内置包重判。

答案库与引用在同一键内一次写入并读回，失败沿用原记录回滚和重试；完整备份携带整个库，自包含，无新增存储键。恢复先验证内容、引用、题目及反馈；缺包、混用内联与引用、未使用的库项及未知版本拒绝写入。学习导入可合并 v1／v2，按会话 ID 保留本地冲突，独立答案版本并存。向后兼容指新版读取旧备份；旧应用无法读取 v2，回退应用须使用升级前保留的旧格式备份，新备份由支持 v2 的版本恢复。较大数据仍受单键 JSON 读写及浏览器配额限制，尚未实现分片或按需加载。来源手牌只携带疑问及返回位置；样例条件独立展示，不填补来源未知的底池／有效筹码，也不写回个人手牌。

转牌模型另由 `tools/solver-lab/turn-fixtures.json`、`run_turn.py` 与 `turn-verification.json` 管理。原生树包含全部发牌与强制河牌过牌节点；内置包仅保留转牌行动节点，并用 `chanceNodes` 汇总继续分支。每个公开河牌保留规范路径、分支范围加权概率、阻断后的具体组合、兼容组合对及同起点平均摊牌 EV；发牌分支不作为可作答节点。`export-turn-pack.mjs` 在导出前校验核验材料哈希，旧河牌包无需重写。

可下注两街模型由 `line-fixture.json`、`run_line.py` 和 `line-verification.json` 管理，原生适配器与旧摊牌模型分开。完整动作树进入答案包；紧凑组合行以 `comboEncoding: tuple-v1` 声明，依次保存规范底牌、到达权重、兼容质量、两个动作频率及两个 EV。`solutionNode()` 解码为统一对象，节点路径和底牌标识不依赖引擎数组顺序。

`solutionLineModel.js` 在冻结答案树上推进单条行动线，`config.solutionPlayer` 选择 OOP／IP，未设置时沿用 OOP；实际视角保存在 `line.heroPlayer`。按兼容范围抽取双方底牌，对手按节点策略行动，发牌排除双方私牌及已发公共牌。IP 模式先推进 OOP 行动，再出第一道 IP 题；后续题目只在当前决策提交并主动继续后生成。历史保存已发生行动、双方私牌与冻结包，但界面不揭示对手底牌或未发生分支；不合计跨节点 EV 损失。组合不可达或缺少完整 EV 时结束评分延续。重新练习原线按冻结原题逐题进行，不重新抽取一条分支。

`solutionComparisonModel.js` 只比较同一发牌分支、相同河牌行动后缀的节点，并核对行动方、底池、筹码与动作金额。公共牌合法组合数不含行动过滤，范围频率按本节点自身到达权重乘兼容对手质量加权；具体底牌保留不变，被河牌阻断或没有完整 EV 时不能开始该组合的练习。牌面特征只描述公共牌配对、同花和顺子变化，不自动解释策略原因。对照节点盲练以可选 `config.solutionCombo` 固定底牌，仍冻结整包答案。

`practiceModel.js` 的 `solutionReviewQueue()` 从已有已提交回答的 `review` 标记派生复习列表，按包哈希、节点路径、具体底牌去重。`repeatPracticeQuestion()` 复制原单题及答案快照，不重新抽题或生成连续分支；主动移出时取消对应组的复习标记，不改回答和评价。沿用现有练习存储与完整备份，没有新存储键或到期调度。

题目以包的实际街道及后续限制建立上下文，恢复时同时核对；旧河牌题目无需新增字段。历史名称从该轮冻结包读取，避免被默认主题或新内置包覆盖。转牌数学验证与公开河牌概率口径见 [转牌核验记录](turn-solution-verification.md)。

### Backup and restore

`src/store/backup.js` 的 `readBackup()` 接受旧 JSON / Base64 备份；`planRestore()` 返回无写入的合并计划、冲突、已知字段问题和只隔离保留的原始键。业务集合以 `BACKUP_COLLECTIONS` 的稳定主键合并，未知扩展字段保留；默认本地优先，只有用户选择的冲突采用导入内容。独立学习记录复用 `planLearningImport()`，保留独有题目、掌握度、错题及草稿，计数不相加。

导出保留旧顶层字段，增加 `backupMeta` 格式声明和 `localState` 原始字符串快照。快照只读取本产品的 `pa_` 命名空间及 `pokerAssistantData`，排除恢复 checkpoint 自身。导入只写显式白名单：旧集合副本、未知扑克键、旧迁移与补种 gate 均留在隔离的原始导入副本，不能直接激活。

`applyRestore()` 检查预览时快照与持久集合是否仍匹配，先保存恢复前副本，再逐项写入和读回。`Store.backupIO()` 提供公开仓储适配；有 IndexedDB 时将 checkpoint 放在 `recoverySnapshots`，安全模式使用 `pa_restore_checkpoint_v1`。checkpoint 保存失败则不开始导入。活动计时先暂停；导入计时按备份时点保存剩余时长并等待主动继续，不补写过去日志。没有备份时间的旧活动计时保留来源状态，剩余时长按零处理。

跨集合与 localStorage 没有总事务：中途失败保留完成／失败／待处理项和最初副本。跨刷新重试读取未完成 checkpoint，保留最初 `before`；用户可下载最近导入内容、恢复前副本，或预览主动还原。还原会移除恢复后新增的对应集合记录，操作前可下载当前备份。配额不足时报告失败并保留原文件，不自动清理用户数据。完成后由用户刷新以重建学习模块缓存。旧同步 `Store.importAll()` 保留兼容，用户导入入口统一经 `DataSync` 使用新流程。

`SessionClosure` 仍负责 Mark 匹配、候选手牌及收尾状态；`renderInbox()` 展示可继续的场次，`saveNote()` 将本场总结存入原收尾记录。结束牌局入口暂停计时后进入 Session；回放详情可返回所属场次，手牌事实不因收尾修改。

策略主题中的手牌只表示复盘候选，不表示来源条件已完全匹配或已成为支持／反例。候选规则以 `src/modules/strategyStudy.js` 的 `getTopicHandReferences` 为准；当前不自动识别锦标赛分支或完整有效筹码档案。主题自测复用已有概念题目 ID、掌握度与错题存储，仅临时限制题目范围。

策略训练通过 `getStrategyLearningTarget` 按父策略的街与 Spot 问题动态路由。明确的翻牌 C-bet 节点（或未限定节点的既有翻牌 Family）才进入频率练习，其余进入相应主题概念自测；精确节点保留牌面筛选。新训练单元的 `topicId` 是可选补充字段，旧单元不回写、不迁移，导出／导入继续保留完整对象。

翻后行动顺序由 `analysisReadModel.js` 的 `getPostflopOrder` 统一定义，`deriveFlopDecision` 同时供 Radar 与牌理卡使用；普通桌与真实两人桌分开，无法确定 SB/BB 顺序时排除。策略 `baselineSnapshot.observationVersion` 与当前观察版本不同（含旧记录缺失版本）时不可做数值复测；用户确认重建后，旧快照追加到 `baselineHistory`。可选字段无需迁移，导出／导入沿用策略对象合并；取消、重复重建或无唯一信号时不改记录。

```
Timer                  计时、休息、Quick Capture 与结束牌局
Odds                   赔率工具、GTO 速查、Outs 参考与 Tournament GTO 外链
Review（记录与统计）     Hand / Session / Discover / Quiz / Strategy / Weekly / Overall / Villain
复盘与学习               Analyze -> Study -> Practice
```

主 Tab 声明位于 `index.html` 的 `.nav`；Review（记录与统计）的子 Tab 由 `#reviewSubNav` 的 `data-sub` 驱动。导航意图由 `src/modules/navigation.js` 的 `Navigation` 统一适配，复盘详情及学习目标可跨入口定位。
GTO 翻牌频率速查表在 Odds 面板 `<details>` 懒加载（场景选择 + 高牌 + 牌面类型三过滤器）。
Discover 面板整合：自动模式发现 + Canvas 热力图 + Quiz 训练器 + 错题集。
存储健康指示器：页面标题旁圆点，🟢 IndexedDB / 🟡 localStorage / 🔴 异常。

## Performance Optimizations

### V7.0
- **Context Cache**: `statsEngine.js` → `_contextCache` (Map)，`createHandContext()` 按 `hand.id` 缓存，跨面板复用
- **Analyze Fingerprint**: 首尾手牌 ID + 数量 + 过滤条件→ 共享结果；`HandRepo.saveAll()` 自动清缓存
- **Render Fingerprint**: Villain/Opponent 面板数据不变则跳过 DOM 重建
- **Lazy Stats**: `analyze()` 从渲染时预计算→ 展开时才计算，`data-rendered` 防重复
- **Lazy Hand List**: 对手手牌列表展开时才通过 `_buildOppHandListHtml()` 构建
- **Event Delegation Unification**: Villain 面板 5×forEach → `#opponentList` 单委托；Hand/Jump 按钮复用 `#handBody` 委托
- **Chart RAF**: `renderChart` 用 `requestAnimationFrame` 防抖
- **AudioContext Reuse**: `beep()` 缓存单实例
- **EscapeHtml Reuse**: 复用单 div 元素
- **Session Map O(1)**: `sessionsMap.get()` 替代 `sessions.find()`

### V7.6+
- **Chart Fingerprint** (V7.6.5): `renderCharts()` 手牌数+最后 ID 不变则跳过 Canvas 重绘
- **Discover Scan Lock** (V7.6.5): `try-finally` 确保 `_scanning` 异常时释放，防止永久锁死
- **Discover Scan Cache** (V7.4.7): 手牌总数未变 + 已有结果时直接返回缓存，避免重复扫描
- **SRP Data Dedup** (V7.7.0): 818 行硬编码→35 行生成脚本，-783 行代码，构建产物 -10kB

### GTO Strategy Quick-Lookup

```
SRP Details <details> toggle (Odds Panel)
  → App.renderSRPTable()
      → srpData.js (import gtoRaw BTNvsBB + SBvsBB, auto-derive 367 entries)
      → read filterScenario / filterHigh / filterCategory values
      → filter + render table (card-badges + frequency mini-bars + action codes)
```

### Quiz Trainer Flow

```
QuizTrainer.next(stageKey?, targetBoardCode?)
  → load scenario data from gtoRaw
  → V7.6.4+: _pickFromErrors (错题优先) → _pickFromPool (轮转+降权)
  → return { boardCode, boardDisplay, category, actions }

QuizTrainer.answer(actionKey)
  → V7.6.3: dual-threshold (≥35% correct / 13-35% acceptable / <13% wrong)
  → update pa_quizState.stageStats + pa_quizState.records
  → V7.6.2: wrong → save to pa_quiz_errors; correct → removeOldestError
  → V7.6.4: update pa_quiz_mastery (consecutiveCorrect + mastered flag)
```

### Discover Auto-Analysis

```
HandRepo.getAll()
  → analysisReadModel.createLearningSnapshot()
  → filter hands (boardCategory + actionLineOTF + Hero preflop fold)
  → group by category × scenario
  → detect: profit_anomaly (< -0.5BB) / self_contradiction (CBet deviation >10pp)
    [V7.9.0] gto_deviation 自动发现已移除：旧 GTO 数据无适用范围元数据（scoped legacy reference）
  → try-finally release _scanning lock
  → cache: skip re-scan if hand count unchanged
    [V7.9.0] HandRepo.saveAll → PubSub 'handDataChanged' → Discover 强制重扫（修复编辑同数量手牌不刷新）

Discover.getHeatmapData()
  → return full category×scenario grid (not just anomalies)
  → each cell: handCount, avgProfit, cbetFreq, gtoAvgCbet

Review / Discover / Quiz 共用 `analysisReadModel` 的规范化字段，不回写手牌数据。
Discover 的 Quiz 按钮通过 `Navigation.goToLearningTarget()` 传递 `{ scenario, boardCategory, handIds }`。
```

## Preflop range workspace

`src/modules/preflopRangeModel.js` owns partial 169-class charts, conditional action frequencies, inclusion weights, condition comparison and explicit file/text validation. Unknown hands are absent entries; weight zero is an explicit excluded class. The denominator is 1326 preflop combinations. No exact-suit, board-conditioned or EV values are inferred.

`src/store/rangeStore.js` owns `pa_ranges_v1: { version: 1, ranges, drafts, editors, selectedId }`. Saved charts retain identity, kind, current revision, conditions, provenance and class entries. Personal drafts overlay saved charts; editor state retains selected class, unfinished numeric strings, bulk text and action. Writes validate and compare the last read bytes before replacement. This key participates in full backup preview, preference-based identity merge, checkpoint and rollback; unique ranges and drafts survive merge without adding frequencies. Reference charts remain read-only; copies receive a new personal identity and derivation metadata. Revision is not a historical snapshot collection.

`PreflopRangeWorkspace.init()` binds the Study container once, and Study's ranges subview renders the local library. Failed writes preserve page state for a draft backup download. Partial range-only backups use the existing restore preview. Parser code is a pinned MIT adaptation of `thlorenz/prange`, with the full license rendered offline and stricter validation outside the vendor file. See [validation and limits](range-workspace-validation.md).

Restore checkpoints may exist in both `recoverySnapshots` and `pa_restore_checkpoint_v1`; reads select the newest valid timestamp across available backends, permitting fallback-to-database recovery. Known collection and relationship IDs must match the string identifiers consumed by current views. Opponent dictionary conflicts are selected per opponent, while valid learning backups may explicitly replace corrupt local state without discarding the recovery copy.

## Implementation references

权限与产品约束见 [AGENTS.md](../AGENTS.md)，检查和发布步骤见[工作流](workflow.md)。

依赖及开发命令以 `package.json` 和 lockfile 为准；构建与 CSP 由 `vite.config.js` 实现，产物白名单由 `scripts/build-output-contract.mjs` 核对。后续调整单文件构建时，一并更新相应配置、离线行为和产物检查。
