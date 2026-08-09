# Architecture — 木下的牌桌助手 (Underwood's table agent)

## Tech Stack

- **Dev**: Vite 7 dev server (`npm run dev` → `http://localhost:5173`)
- **Build**: Vite + `vite-plugin-singlefile` → single `dist/index.html`
- **Runtime**: ES 模块（dev 时 Vite 处理 import；build 时全内联）
- **Storage**: `src/store/storage.js` 统一协调 IndexedDB 主存储、localStorage 降级、备份和迁移重试。保留所有 `pa_` 键名和历史迁移标记
- **Hosting**: Netlify (`https://mxpoker.netlify.app/`) + GitHub Pages (`https://muxia51821.github.io/Underwood-Poker-helper/`)
- **PWA**: `public/sw.js` (独立文件)，Blob URL 降级。仅 HTTPS 生效

## Dual-Scenario Runtime

| | `file://` (offline) | `https://` (online) |
|---|---|---|
| Entry | 双击 `dist/index.html` | Netlify / GitHub Pages |
| Dev | — | `npm run dev` |
| Service Worker | Disabled | `public/sw.js` (DevTools 可调试) |
| Notifications | Disabled | Enabled |
| Storage | IndexedDB + localStorage | 同左 |

## Module Map (28 ES modules, ~9000 lines)

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

  data/
    srpData.js       # GTO 策略速查表（从 gtoRaw 自动生成，import Utils + gtoRaw）
    actionLines.js   # underBluff + overBluff 行动线表
    strategy/
      gtoBaseline.js # L1 极端阈值自动编译（>90%/<5%）+ getGTOReference()
      gtoRaw/        # Solver 原始输出
        BTNvsBB_SRP_flop.js  # BTNvsBB 翻牌频率（183 boards）
        SBvsBB_SRP_flop.js   # SBvsBB 翻牌频率（183 boards）

public/
  sw.js              # Service Worker（cache-first + notificationclick）
```

### Dependency DAG

```
main.js
  ├── constants.js           (zero deps)
  ├── utils.js               → constants
  ├── parsers/ggParser.js    → constants, utils
  ├── store/db.js            (zero deps)
  ├── store/store.js         → constants, utils, db, statsEngine.clearStatsCache
  ├── modules/app.js         → constants, utils, store, srpData, actionLines, 全部子模块
  ├── modules/timer.js       → constants, utils, store, [beep/vibrate/notify from app]
  ├── modules/odds.js        → constants, utils
  ├── modules/review.js      → constants, utils, store, statsEngine, ggImport, handPicker, discover, quizTrainer, navigation, analysisReadModel
  ├── modules/statsEngine.js → constants
  ├── modules/handPicker.js  → constants, utils, store, navigation
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
```

### GG Hand History Import

```
User pastes GG text in overlay
  → GGParser.parseDetailed(raw)
      → Return { hands, failures, total }
  → ggImportCoordinator.buildImportPlan()
      → duplicate / overwrite / Session 分组 / record mapping
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
                       gg?, ggId?, oId?, oCards?, oHash?, rake, jackpot, marked } ]
weeklyReviews:     [ { week: 'YYYY-Www', weakness, plan } ]
tiltLogs:          [ { date, time, trigger, intensity, note } ]
// Quiz & Discover (localStorage)
pa_quizState:      { scenario, records: { boardCode: { cat, picks } }, stageStats: { cat: { ok, fail } } }
pa_quiz_errors:    [ { id, type, scenario, boardCode, category, userAnswer, correctAnswer, gtoFreqs, timestamp } ]
pa_quiz_mastery:   { "scenario|boardCode": { consecutiveCorrect, totalAttempts, lastResult, mastered } }
pa_discoverState:  { findings, scanHandCount, archive }
```

IndexedDB: `pa_store` v1, 4 ObjectStores (`handReviews`/`sessions`/`weeklyReviews`/`tiltLogs`).
`handReviews` has 3 indexes: `sessionId`, `ggId`, `date`.

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
  → detect: profit_anomaly (< -0.5BB) / self_contradiction (CBet deviation >10pp) / gto_deviation
  → try-finally release _scanning lock
  → cache: skip re-scan if hand count unchanged

Discover.getHeatmapData()
  → return full category×scenario grid (not just anomalies)
  → each cell: handCount, avgProfit, cbetFreq, gtoAvgCbet

Review / Discover / Quiz 共用 `analysisReadModel` 的规范化字段，不回写手牌数据。
Discover 的 Quiz 按钮通过 `Navigation.goToLearningTarget()` 传递 `{ scenario, boardCategory, handIds }`。
```

## Constraints (Hard Rules)

1. **构建产物为单文件**：`dist/index.html`，`file://` 可直接打开
2. **开发用 Vite dev server**：`npm run dev`，不直接双击 `index.html`
3. **禁止代码省略**：不可用 `// ...`、`…` 替代真实代码
4. **禁止外部依赖**：仅 `vite` + `vite-plugin-singlefile` 两个 devDependencies
5. **禁止自动上传用户数据**：localStorage 键名 `pa_` 前缀
6. **向后兼容**：存储结构变更平滑迁移，不丢数据
7. **CSP**：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
