# Architecture — 木下的牌桌助手 (Underwood's table agent)

## Tech Stack

- **Dev**: Vite 7 dev server (`npm run dev` → `http://localhost:5173`)
- **Build**: Vite + `vite-plugin-singlefile` → single `dist/index.html`
- **Runtime**: ES 模块（dev 时 Vite 处理 import；build 时全内联）
- **Storage**: IndexedDB (`pa_store`) 为主，localStorage 降级。`pa_migrated_v1` 标记迁移状态
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

## Module Map (22 ES modules, ~6300 lines)

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
    store.js          # Store + BaseRepo + repos + initStorage + 迁移 + 健康状态

  modules/
    app.js           # App 骨架（init/导航/SW注册/beep/vibrate/健康指示器/SRP/行动线）
    timer.js         # 站立提醒（beep/vibrate/notify 依赖注入）
    odds.js          # 底池赔率计算（MDF/SPR/隐含赔率/几何路线）
    tournament.js    # 占位桩
    tiltRescue.js    # 情绪急救（PubSub → Review）
    dataSync.js      # 剪切板导入导出 + CSV
    review.js        # 复盘系统（~1290行：Session/Hand/Weekly/Villain + 分页 + 统计 + 图表 + 对手合并）
    ggImport.js      # GG 导入（解析/去重/覆盖/文件拖拽/Session 自动分组）
    statsEngine.js   # 声明式统计引擎（~900行：36 指标 + 范围阈值 + 优化建议 + context 缓存）
    handPicker.js    # 手牌精选（☆ 标记 + Picks 卡片 + Hand/Session 跳转）

  data/
    srpData.js       # SB vs BB SRP 翻牌策略速查表
    actionLines.js   # underBluff + overBluff 行动线表

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
  ├── modules/review.js      → constants, utils, store, statsEngine, ggImport, handPicker
  ├── modules/statsEngine.js → constants
  ├── modules/handPicker.js  → constants, utils, store, review
  ├── modules/ggImport.js    → constants, utils, store, review
  ├── modules/tiltRescue.js  → constants, utils, store, PubSub
  ├── modules/dataSync.js    → utils, store
  ├── modules/tournament.js  (zero deps)
  ├── data/srpData.js        (zero deps)
  ├── data/actionLines.js    (zero deps)
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
  → this._cache (sync, in-memory)
  → _scheduleDBWrite() (300ms debounce)
      → if _dbReady: IndexedDB put/clear+putAll
      → else: localStorage.setItem() (fallback)

beforeunload:
  → Repo._flush() → localStorage.setItem() (sync safety net)
```

### GG Hand History Import

```
User pastes GG text in overlay
  → Utils.parseGGHandHistory(raw) — bridge to GGParser
      → Split by "Poker Hand #" delimiter
      → Parse each block: positions, cards, street actions, profit
      → Return [{ handId, heroCards, profitBB, opponentId, opponentCards, ... }]
  → HandRepo.getAll() → deduplicate by ggId
  → User selects/deselects hands → import selected
      → HandRepo.saveAll([...existing, ...new])
  → Review.handCurrentPage = 1
  → Review.renderHandReviews()
```

### BaseRepo Cache Layer

```
BaseRepo
  _cache: []          ← in-memory (sync reads)
  _dbReady: false     ← true after first IndexedDB load
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
handReviews:       [ { id, sessionId, date, potType, board, desc, mistake, reflection, pBB,
                       gg?, ggId?, oId?, oCards?, rake, jackpot, marked } ]
weeklyReviews:     [ { week: 'YYYY-Www', weakness, plan } ]
tiltLogs:          [ { date, time, trigger, intensity, note } ]
```

IndexedDB: `pa_store` v1, 4 ObjectStores (`handReviews`/`sessions`/`weeklyReviews`/`tiltLogs`).
`handReviews` has 3 indexes: `sessionId`, `ggId`, `date`.

## UI Navigation

```
计时 ──── 赔率 ──── 锦标赛 ──── 复盘 ─────────────────────────────
番茄钟    底池赔率  (外链)     Hand│Session│Weekly│Villain
今日统计  隐含赔率             ┌─Picks (手牌精选卡片)
错误日志  随机数               ├─Hand History (筛选/分页)
                               ├─GG 导入
                               └─SRP表 / 行动线表 (<details>)
```

四主 Tab（`.nav`），复盘下四子 Tab（`.subnav`，data-sub 驱动）。
Hand 面板内含 Picks 精选卡片（有标记手牌时显示）。
SRP 表 / 行动线表 `<details>` 懒加载。
存储健康指示器：页面标题旁圆点，🟢 IndexedDB / 🟡 localStorage / 🔴 异常。

## Performance Optimizations (V7.0)

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

## Constraints (Hard Rules)

1. **构建产物为单文件**：`dist/index.html`，`file://` 可直接打开
2. **开发用 Vite dev server**：`npm run dev`，不直接双击 `index.html`
3. **禁止代码省略**：不可用 `// ...`、`…` 替代真实代码
4. **禁止外部依赖**：仅 `vite` + `vite-plugin-singlefile` 两个 devDependencies
5. **禁止自动上传用户数据**：localStorage 键名 `pa_` 前缀
6. **向后兼容**：存储结构变更平滑迁移，不丢数据
7. **CSP**：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
