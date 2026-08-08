# 部署基线

> 核查日期：2026-08-08。本文件记录已观察到的证据，不代表平台侧全部设置都已确认。

## 当前结论

项目当前有两个内容不同的线上入口。Netlify 是文档中记录的主入口候选，GitHub Pages 仍是有效备用入口。Netlify 控制台已经确认仓库绑定、Git 持续部署、自动发布、生产分支、构建命令、发布目录和 Node.js 版本。最近一次生产发布是旧提交 `a2c17da`，因此 Netlify 当前仍停留在 `V7.3.3`。

## 证据表

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

`.github/workflows/static.yml` 由推送到 `master` 触发并部署 `dist`。当前 workflow 会先安装依赖、运行 `npm run check`，再构建 `dist` 后上传。GitHub Pages 在后续明确决定前继续作为备用入口。

## 仍需核对的线上证据

Netlify 的控制台配置和最近一次生产发布已经确认。若要建立新的发布基线，还需要在木下选择性提交并推送后记录新部署的完整 SHA、产物 hash 和线上 smoke 结果。

在把 Pages 当作备用入口依赖前，需要从 GitHub 记录：

- 最近一次成功的 `static.yml` run
- workflow checkout 的 SHA
- 上传产物的 SHA-256

## 发布保护

本次核查不授权执行 `pull`、`reset`、`rebase`、merge、push 或生产部署。建立发布基线前，必须先复核当前未提交工作区和远端提交差异。
