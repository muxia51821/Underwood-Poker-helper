# 部署基线

> 核查日期：2026-08-08。本文件记录已观察到的证据，不代表平台侧全部设置都已确认。
> 2026-08-25 更新：GitHub Pages 部署来源切换为 GitHub Actions 工作流并修复 CI，见「GitHub Pages」小节与证据表新增行。

## 当前结论

项目当前有两个内容不同的线上入口。Netlify 是文档中记录的主入口候选，GitHub Pages 仍是有效备用入口。Netlify 控制台已经确认仓库绑定、Git 持续部署、自动发布、生产分支、构建命令、发布目录和 Node.js 版本。2026-08-25 抽查显示 `poker.catstarry.xyz` 实际返回 `V7.8.0`（与 GitHub Pages 产物字节级一致），2026-08-08 记录的「Netlify 仍停留在 V7.3.3」结论已过时；控制台侧的最新发布记录本轮未重新核查。

## 证据表

| 来源 | 观察到的状态 | 证据 |
| --- | --- | --- |

> 未标注日期的行均为 2026-08-08 核查证据；标注 2026-08-25 的行为本轮更新。

| 本地 `HEAD` | `3c04f75770c0464fce85967cde240304abd557b2` | `V7.7.2 — Quiz独立可用 + 文档全面更新` |
| 本地 `origin/master` | `3c04f75770c0464fce85967cde240304abd557b2` | 本地 tracking ref，不能证明当前 GitHub 状态 |
| 公开 GitHub `master` | `e89e19077ad13895439099da25d839f6460d5d19` | 前一次远端核查中连续 3 次直接查询成功 |
| 本次 Git 远端重试 | 本轮未确认 | `git ls-remote` 因 RPC 连接失败超时 |
| Netlify 项目控制台 | Git 持续部署 Active；仓库为 `muxia51821/Underwood-Poker-helper`；生产分支为 `master` | Base `/`；Build command `npm run build`；Publish directory `dist`；Node.js `22.x`；所有分支部署；PR Deploy Preview 已启用 |
| Netlify Deploys 页面 | `Production: master@a2c17da`；Auto publishing is on | 页面显示 `May 19 at 8:35 PM`；发布说明为 `V7.3.0–V7.3.3 — 图表系统改版 + hover交互 + 单面板布局`；页面只显示短 SHA，本地当前仓库无法解析该对象 |
| Netlify | HTTP 200，`V7.3.3`，256,955 bytes | SHA-256 `805c41b8e3499117e6d1ca24ebc193313acee66fc0604a0a8cf4eacb987645a7`；server 为 `Netlify`；连续 3 次 GET 结果一致 |
| GitHub Pages | HTTP 200，`V7.7.2`，329,637 bytes | SHA-256 `493ef5c212dcc2a9be346e2c2463c286b55c6ca3130495217f61d2576eafde9d`；server 为 `GitHub.com`；Last-Modified 为 `Sat, 23 May 2026 19:43:56 GMT`；连续 3 次 GET 结果一致 |
| GitHub Pages（2026-08-08 至 2026-08-25 期间） | HTTP 200 但返回的是源码根目录 `index.html`（55,048 bytes），UI 无法加载 | 原因：`static.yml` 因 CI 缺少 Playwright 浏览器在 `npm run check` 失败；同时 Pages 来源为 legacy "Deploy from a branch"，push 后把 `master` 根目录当站点发布 |
| GitHub Pages（2026-08-25） | HTTP 200，`V7.8.0`，362,880 bytes，与 Netlify 入口字节级一致 | 最新部署：commit `c17214d` 触发的 run `32863472393`；上传产物 `index.html` SHA-256 `25E8A175E76B975E43B243DC5BCE3204CF25C99BC5B26EB5D6A4F101B5352AA2`，与线上返回内容哈希完全一致；真浏览器验证：标题 `V7.8.0`、导航可见、无 console 报错、SW 已接管、与 `poker.catstarry.xyz` 行为一致 |
| Netlify 自定义域（2026-08-25 抽查） | HTTP 200，`V7.8.0`，362,880 bytes，server 为 `Netlify` | `https://poker.catstarry.xyz/` 实测；仅记录观察值，控制台配置未重新核查 |

## 仓库部署配置

### Netlify

`netlify.toml` declares:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

当前控制台已确认该项目连接 GitHub 并启用 Git 持续部署。仓库文件中的构建契约与控制台配置一致：`npm run build` 输出到 `dist`。

### GitHub Pages

`.github/workflows/static.yml` 由推送到 `master` 触发并部署 `dist`。当前 workflow 会先安装依赖、安装 Playwright Chromium（commit `7bb3cb9` 新增，修复 CI 中 e2e 因浏览器缺失而失败）、运行 `npm run check`，再构建 `dist` 后上传。

2026-08-25 起，仓库 Pages 设置的 Build type 已从 legacy "Deploy from a branch" 切换为 "GitHub Actions"（通过 Pages API `build_type=workflow` 修改）。切换原因：legacy 模式会把 `master` 根目录的源码 `index.html` 直接发布为站点，其 `/src/styles.css` 与 `/src/main.js` 引用在子路径下全部失效，导致 UI 无法加载。此后站点内容只来自工作流上传的 `dist` 产物；如需回滚该设置，在 GitHub 仓库 Settings → Pages → Build and deployment 中把 Source 改回 "Deploy from a branch"。GitHub Pages 在后续明确决定前继续作为备用入口。

## 仍需核对的线上证据

Netlify 的控制台配置和最近一次生产发布已经确认。若要建立新的发布基线，还需要在木下选择性提交并推送后记录新部署的完整 SHA、产物 hash 和线上 smoke 结果。

在把 Pages 当作备用入口依赖前，需要从 GitHub 记录：

- 最近一次成功的 `static.yml` run
- workflow checkout 的 SHA
- 上传产物的 SHA-256

2026-08-25 已全部满足：run `32863472393`，checkout `c17214d`，上传产物 `index.html` SHA-256 `25E8A175E76B975E43B243DC5BCE3204CF25C99BC5B26EB5D6A4F101B5352AA2`（与线上内容一致）。

## 发布保护

（2026-08-08 核查时）本次核查不授权执行 `pull`、`reset`、`rebase`、merge、push 或生产部署。建立发布基线前，必须先复核当前未提交工作区和远端提交差异。2026-08-25 的 Pages 修复与部署由木下明确授权，不适用上述限制。

## 2026-08-31 发布（V7.9.0 → V7.11.6 合入 master）

- master `13b28df` → `b01e368`：fast-forward 合入 `codex/poker-personal-os-plan` 全部 27 个提交（V7.9.0 导入可靠性 → V7.11.6 概念自测错题集），并合并 origin/master 上的 PR #1（`codex/fix-timer-pause` 计时器暂停/恢复修复，仅动 timer.js，与功能分支零文件交集）。
- 推送记录：`master` 与 `codex/poker-personal-os-plan` 均推送至 `b01e368`；合并后在 master 上跑契约测试 64 项全绿。
- `static.yml` 构建由 master 推送触发；**线上抽查（站点版本号/产物 SHA）尚未执行**——抽查结果回填本节后方可作为新基线。
- 合并过程中的操作偏差记录：一次 `merge origin/master` 误在 codex 分支上执行（生成 b01e368），master 首次推送被远端快进校验拒绝后改为 master fast-forward 到 b01e368，最终两分支内容一致。
