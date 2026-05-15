# Architecture — 木下的牌桌助手 (Underwood's table agent)

## Tech Stack

- **Dev**: Vite 7 dev server (`npm run dev` → `http://localhost:5173`)
- **Build**: Vite + `vite-plugin-singlefile` → single `dist/index.html`
- **Runtime**: ES 模块（dev 时 Vite 处理 import；build 时全内联）
- **Storage**: IndexedDB (`pa_store`) 为主，localStorage 降级。`pa_migrated_v1` 标记迁移状态
- **Hosting**: Netlify (`https://mxpoker.netlify.app/`)
- **PWA**: `public/sw.js` (独立文件)，Blob URL 降级。仅 HTTPS 生效

## Dual-Scenario Runtime

| | `file://` (offline) | `https://` (online) |
|---|---|---|
| Entry | 双击 `dist/index.html` | `https://mxpoker.netlify.app/` |
| Dev | — | `npm run dev` |
| Service Worker | Disabled | `public/sw.js` (DevTools 可调试) |
| Notifications | Disabled | Enabled |
| Storage | IndexedDB + localStorage | 同左 |

## Module Map (17 ES modules)

```
src/
  main.js              # 入口：initStorage() → App.init(health)
  constants.js         # CONSTANTS + EQUITY 查找表 + JSDoc typedef
  utils.js             # Utils (16 methods) + PubSub (on/off/emit)
  styles.css           # 全局 CSS（HTML <link> 引入）
  selfTests.js         # GG 解析器自测（仅 DEV）

  parsers/
    ggParser.js        # GG 手牌历史 → 结构化数据

  store/
    store.js           # Store + DB(IndexedDB) + BaseRepo + repos + initStorage + 迁移

  modules/
    app.js             # App 骨架（init/导航/beep/vibrate/健康指示器/SRP/行动线）
    timer.js           # 站立提醒（beep/vibrate/notify 依赖注入）
    odds.js            # 底池赔率计算（MDF/SPR/隐含赔率/几何路线）
    tournament.js      # 占位桩
    tiltRescue.js      # 情绪急救（PubSub → Review）
    dataSync.js        # 剪切板导入导出 + CSV
    review.js          # 复盘系统（Session/手局/周级 + 分页 + 图表 + 统计 + 迁徙 + 对手画像）
    ggImport.js        # GG 导入（解析/去重/覆盖/对比）

  data/
    srpData.js         # SB vs BB SRP 翻牌策略速查表 (~100 条)
    actionLines.js     # underBluff + overBluff 行动线表

public/
  sw.js                # Service Worker（cache-first）
```

### Dependency DAG

```
main.js
  ├── constants.js        (zero deps)
  ├── utils.js            → constants
  ├── parsers/ggParser.js → constants, utils
  ├── store/store.js      → constants, utils
  ├── modules/app.js      → constants, utils, store, srpData, actionLines, 全部子模块
  ├── modules/timer.js    → constants, utils, store, [beep/vibrate/notify from app]
  ├── modules/odds.js     → constants, utils
  ├── modules/review.js   → constants, utils, store
  ├── modules/ggImport.js → constants, utils, store, review
  ├── modules/tiltRescue.js → constants, utils, store, PubSub
  ├── modules/dataSync.js → utils, store
  ├── modules/tournament.js (zero deps)
  ├── data/srpData.js     (zero deps)
  ├── data/actionLines.js (zero deps)
  └── selfTests.js        → parsers/ggParser (DEV only)
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
settings:       { sound: bool, vibrate: bool }
timerState:     { endTime, phase, workStart, breakStart, longBreak: { enabled, interval, minutes }, cycleCount }
standup:        { date: 'YYYY-MM-DD', count: int }
log_<date>:     [ { workStart, workEnd, breakStart, breakEnd } ]
sessions:       [ { id, date, level, duration, hands, profit, tilt, mistake, remark } ]
handReviews:    [ { id, sessionId, date, potType, board, desc, decision, mistake, reflection, pBB,
                    gg?, ggId?, oId?, oCards? } ]
weeklyReviews:  [ { week: 'YYYY-Www', weakness, plan } ]
tiltLogs:       [ { date, time, trigger, intensity, note } ]
```

IndexedDB: `pa_store` v1, 4 ObjectStores (`handReviews`/`sessions`/`weeklyReviews`/`tiltLogs`).
`handReviews` has 3 indexes: `sessionId`, `ggId`, `date`.

## UI Navigation

```
计时 ──── 赔率 ──── 锦标赛 ──── 复盘 ──────────────────────
番茄钟    底池赔率  (外链)     Session│手局│周级│对手
今日统计  隐含赔率             SRP表  │行动线│    │
错误日志  随机数               迁徙   │GG导入│    │
```

四主 Tab（`.nav`），复盘下四子 Tab（`.subnav`，data-sub 驱动）。
SRP 表 / 行动线表 `<details>` 懒加载。
存储健康指示器：页面标题旁圆点，🟢 IndexedDB / 🟡 localStorage / 🔴 异常。

## Constraints (Hard Rules)

1. **构建产物为单文件**：`dist/index.html`，`file://` 可直接打开
2. **开发用 Vite dev server**：`npm run dev`，不直接双击 `index.html`
3. **禁止代码省略**：不可用 `// ...`、`…` 替代真实代码
4. **禁止外部依赖**：仅 `vite` + `vite-plugin-singlefile` 两个 devDependencies
5. **禁止自动上传用户数据**：localStorage 键名 `pa_` 前缀
6. **向后兼容**：存储结构变更平滑迁移，不丢数据
7. **CSP**：`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:`
