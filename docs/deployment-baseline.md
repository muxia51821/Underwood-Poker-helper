# 部署基线

> 本文件保存 2026-08-08、2026-08-25 的核查证据与 2026-08-31 的发布记录。历史观察不代表最新平台设置或线上状态；建立新发布基线时按 [工作流](workflow.md) 复核。

## 已记录的核查结论

Netlify 是主入口候选，GitHub Pages 是备用入口。2026-08-08 核查记录确认了 Netlify 的仓库绑定、Git 持续部署、自动发布、生产分支、构建命令、发布目录和 Node.js 版本；当时两个入口返回不同内容。2026-08-25 抽查的 `poker.catstarry.xyz` 与 GitHub Pages 均返回 `V7.8.0`，产物字节级一致。2026-08-31 的合入和推送已有记录，但对应线上抽查未补齐，不能据此确认新的线上基线。

## 证据表

未标注日期的行均为 2026-08-08 核查证据；其他行以所标日期为准。

| 来源 | 观察到的状态 | 证据 |
| --- | --- | --- |
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

构建命令和发布目录以 `netlify.toml` 的 `[build]` 为准。仓库配置只执行构建，完整发布检查由 [PR 与发布流程](workflow.md#pr-与发布) 负责。上表中的 Git 持续部署和平台绑定是历史控制台观察，配置文件本身不能证明后台设置仍然相同。

### GitHub Pages

`.github/workflows/static.yml` 声明推送到 `master` 或手动触发后，先安装依赖与 Playwright Chromium、运行 `npm run check`，再构建并上传 `dist`，最后部署 Pages。工作流配置与一次运行成功、线上内容一致是不同证据。

2026-08-25 核查记录显示，仓库 Pages 设置的 Build type 已从 legacy "Deploy from a branch" 切换为 "GitHub Actions"（通过 Pages API `build_type=workflow` 修改）。旧模式曾把 `master` 根目录的源码 `index.html` 直接发布为站点，导致 `/src/styles.css` 与 `/src/main.js` 在子路径下失效；Actions 改为发布工作流上传的 `dist`。恢复旧 Source 设置会重新引入该风险，不能作为产物回滚方案。

## 仍需核对的线上证据

建立新发布基线时，按 [工作流](workflow.md#发布证据) 记录 source SHA、产物 hash、自动检查与线上 smoke 结果，并关联对应平台的部署记录或 workflow run 与 checkout SHA。平台绑定、生产分支或域名有变化时再复核相关后台设置；上表中曾核对成功的记录只证明其所标日期的状态。

## 权限入口

Git 与生产操作权限统一见 [AGENTS.md](../AGENTS.md#git-与协作权限)；历史核查中的临时操作限制不作为当前任务规则。

## 2026-08-31 发布（V7.9.0 → V7.11.6 合入 master）

- master `13b28df` → `b01e368`：fast-forward 合入 `codex/poker-personal-os-plan` 全部 27 个提交（V7.9.0 导入可靠性 → V7.11.6 概念自测错题集），并合并 origin/master 上的 PR #1（`codex/fix-timer-pause` 计时器暂停/恢复修复，仅动 timer.js，与功能分支零文件交集）。
- 推送记录：`master` 与 `codex/poker-personal-os-plan` 均推送至 `b01e368`；合并后在 master 上跑契约测试 64 项全绿。
- 该次 master 推送会触发 `static.yml`；截至此记录，**线上抽查（站点版本号/产物 SHA）尚未执行**，因此不构成已确认的线上基线。
- 合并过程中的操作偏差记录：一次 `merge origin/master` 误在 codex 分支上执行（生成 b01e368），master 首次推送被远端快进校验拒绝后改为 master fast-forward 到 b01e368，最终两分支内容一致。
