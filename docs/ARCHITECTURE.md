# Architecture — 木下的牌桌助手 (Underwood's table agent)

## Tech Stack

- **Dev**: Vite 7 dev server (`npm run dev` → `http://localhost:5173`)
- **Build**: Vite + `vite-plugin-singlefile` → 单文件核心 `dist/index.html`，外加严格白名单内的 PWA manifest、Service Worker 和图标
- **Runtime**: ES 模块（dev 时 Vite 处理 import；build 时全内联）
- **Storage**: `src/store/storage.js` 统一协调 IndexedDB 主存储、localStorage 降级、备份和迁移重试。保留所有 `pa_` 键名和历史迁移标记
- **Hosting**: Netlify (`https://mxpoker.netlify.app/`) + GitHub Pages (`https://muxia51821.github.io/Underwood-Poker-helper/`)
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` + 本地图标；Service Worker 与 Blob URL 降级仅 HTTPS 生效

## Dual-Scenario Runtime

| | `file://` (offline) | `https://` (online) |
|---|---|---|
| Entry | 双击 `dist/index.html` | Netlify / GitHub Pages |
| Dev | — | `npm run dev` |
| Service Worker | Disabled | `public/sw.js` (DevTools 可调试) |
| Notifications | Disabled | Enabled |
| Storage | IndexedDB + localStorage | 同左 |

## Module Map (30 ES modules, ~10000 lines)

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
    statsEngine.js   # 声明式统计引擎（~900行：36 指标 + 范围阈值 + 优化建议 + context 缓存）
    handPicker.js    # 手牌精选（☆ 标记 + Picks 卡片 + Hand/Session 跳转）
    discover.js      # 自动模式发现（盈亏异常/自我矛盾/偏离GTO + 热力图数据）
    quizTrainer.js   # GTO 频率判断训练器（双阈值判分 + 错题集 + 掌握追踪 + 轮转出题）
    sessionClosure.js # [V7.9.1 新增] 每场收尾领域模块（Mark 时间匹配 + 候选手牌 + 收尾记录）
    decisionRadar.js # [V7.10.7 修改] Spot 信号 + Dossier；同类牌面 GTO 优先匹配、严格 MDA 条件匹配
    strategyDesk.js  # [V7.10.7 修改] Evidence & Strategy（证据包 + 策略修订 + Radar scope 录入）
    handReplay.js    # [V7.10.0 新增] 手牌可视化回放（只读派生层：desc 解析 + 逐街视图，零 store import）
    spotMatcher.js   # [V7.11.0 新增] 单手牌 spot 识别（两人池位置交替归属 + 多人池噪声排除 + 河牌惊悚/空白启发式；零 store import）
    pokerLogic.js    # [V7.11.2 修改] 复盘牌理参考渲染：四步导航 + 应用要点（出处行）+ 概念卡（误解/对比例/阈值/自测折叠）；esc 真转义 + href 协议白名单（仅 http/https）
    conceptQuiz.js   # [V7.11.6 新增] 概念自测训练器：selfCheck 题库 + 交互判分 + 掌握度（pa_concept_quiz_mastery）+ 错题集（pa_concept_quiz_errors，答错入册/答对销账/重做错题）

  data/
    srpData.js       # GTO 策略速查表（从 gtoRaw 自动生成，import Utils + gtoRaw）
    actionLines.js   # underBluff + overBluff 行动线表
    gtoBaselineSeed.js # [V7.10.8 修改] GTO 结构性参考种子 v4：按 Radar spot（scenario+question+boardCategory+sizingContext）落位 17 条；数字标注「正文核验/文章表格直读」；gate pa_gto_baseline_seed_v4，未编辑行按 seedRevision 升级
    externalEvidenceSeed.js # [V7.10.9 修改] 外部证据种子 v5：16 条（solver/mda/article/community/video，evidenceLevel 三级 + Radar scope）；含 4 条 street:'river' 河牌证据（由 matchEvidenceForSignal 的 street 过滤保证不进翻牌信号）
    pokerLogicSeed.js # [V7.11.2 修改] 复盘牌理参考种子 v3：8 条 spot 卡（翻牌 5 + 河牌 3），四步导航 + applicationIds（指向 CONCEPT_APPLICATIONS）+ conceptIds + evidenceRefs；v1 自写叙述字段已移除（契约测试防回归）
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
      ├── DB.open() → IndexedDB (pa_store, v1, 4 stores + 3 indexes)
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
sessions:          [ { id, date, level, duration, hands, profit, tilt, mistake, remark } ]
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
```

IndexedDB: `pa_store` v6, 12 ObjectStores (`handReviews`/`sessions`/`weeklyReviews`/`tiltLogs`/`marks`/`sessionClosures`/`dossiers`/`evidencePacks`/`strategyRevisions`/`learningUnits`/`opponentNotes`/`gtoBaselines`) [V7.10.4 升 v6].
`handReviews` has 3 indexes: `sessionId`, `ggId`, `date`.
// [V7.9.1 新增] marks: [{ id, time 'YYYY-MM-DD HH:MM', note, mistake, sessionId|null, status 'open'|'matched'|'dismissed', matchedHandId, createdAt }]
// [V7.9.1 新增] sessionClosures: [{ id, sessionId（唯一）, status 'draft'|'closed', closedAt, reviewedHandIds[], matchedMarkIds[], note }]
// [V7.9.2 新增] dossiers: [{ id, signalId（确定性锚 radar|{scenario}|flop|{profileKey}|...）, spotKey, profileKey, title, status 'open'|'checking'|'resolved'|'maintain', hypothesis, counterexamples, nextSteps, sampleHandIds[], observationVersion, createdAt, updatedAt }]

## UI Navigation

```
Timer ──── Odds ──── Review ──────────────────────────────────────────
番茄钟    底池赔率  Hand│Discover│Session│Weekly│Overall│Villain
今日统计  隐含赔率  ┌─Picks (手牌精选卡片)
日志      随机数    ├─Hand Review (筛选/分页/编辑)
          GTO速查   ├─Discover (自动发现 + 热力图 + Quiz训练 + 错题集)
          隐含赔率  ├─GG 导入
          Outs参考  └─行动线速查 / 位置对抗速查 (<details>)
          ――――――――
          Tournament GTO (外链)
```

三主 Tab（`.nav`），复盘下六子 Tab（`.subnav`，data-sub 驱动）。
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

## Constraints (Hard Rules)

1. **构建产物以单文件为核心**：`dist/index.html` 可通过 `file://` 直接打开；只允许额外输出 manifest、Service Worker、favicon、Apple touch icon 和三张声明过的 PWA PNG
2. **开发用 Vite dev server**：`npm run dev`，不直接双击 `index.html`
3. **禁止代码省略**：不可用 `// ...`、`…` 替代真实代码
4. **禁止外部依赖**：仅 `vite` + `vite-plugin-singlefile` 两个 devDependencies
5. **禁止自动上传用户数据**：localStorage 键名 `pa_` 前缀
6. **向后兼容**：存储结构变更平滑迁移，不丢数据
7. **CSP**：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
