# V7.12.0 UI review

2026-10-14；源码基线 `d3bacff`；本轮未发布。

## 审查范围

按 [make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better/blob/main/skills/make-interfaces-feel-better/SKILL.md) 的 full 模式审查 Timer、Review 手牌与 Session、手牌回放、Mark 快记及其公共控件。沿用 Vanilla ES modules、现有 CSS token 与四主题。Radar、策略、周报、总览、对手页仅检查共享样式回归，没有重新设计这些页面。

| 类别 | 实际证据 | 结果 |
| --- | --- | --- |
| Typography | Timer 数字、Hand/Session 表格、展开正文、回放金额与短标题 | 增补等宽数字；详情保留换行；缩短侧栏并提高列表可用宽度 |
| Surfaces | 四主题截图、详情/错误/反思、快记与回放 | 移除核心详情的固定蓝黑色，建立稳定阅读分区 |
| Animations | CTA hover/按压/释放、10% 速度检查、减少动态效果 | 普通 CTA 轻微缩放；高频列表、标记和回放保持稳定 |
| Icons | 手牌展开/标记/编辑/删除控件、快记标题操作 | 补充按钮名称；桌面 40px、移动 44px 操作区域；既有图标外观保留 |
| Performance | 核心 transition 属性、CSS 合并、构建产物 | 核心控件采用显式属性；未添加动画库或预设 will-change |

## 改动记录

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `src/styles.css` 公共焦点、导航和快记控件 | 部分导航缺少明确焦点，关闭按钮触控宽度不足 | 统一 focus-visible；快记触控至少 44×44px | 焦点和点击区域影响键盘与触屏操作 |
| MEDIUM | `src/styles.css` Review 布局与 `.hand-row-actions`；`index.html` 手牌模板 | 双侧栏占用宽度，短字段换行，操作按钮竖向堆叠 | 侧栏收窄，1280 附近子导航横排，手牌操作固定两列；窄屏保留编辑入口 | 列表应便于反复扫描与操作 |
| MEDIUM | `src/modules/review.js` Hand/Session 展开渲染 | 详情和盈亏使用硬编码颜色，跨主题层级不一致 | 使用主题 token；错误、反思和原文分区 | 状态与阅读表面需要一致 |
| MEDIUM | `src/styles.css` 快记布局 | 桌面输入区域铺满屏幕，关闭区域偏小，重复移动覆盖规则 | 内容居中限宽 640px，桌面备注至少 220px，移动保存区和安全区保留；合并重复规则 | 快记输入需要聚焦且易于触控 |
| MEDIUM | `src/modules/review.js` 空列表与筛选结果 | 空表头无引导；拟议 CSS 提示误称 Mark 会进入手牌列表 | 使用真实表格单元显示空状态，区分无数据与无匹配；说明 Mark 在收尾时匹配 | 用户应知道下一步与记录类型 |
| LOW | `src/styles.css` Timer 舞台与辅助统计 | 主舞台、辅助数字及设置标题的层次接近 | 强化阶段、倒计时、CTA 组合，辅助数字减弱发光，设置分区 | 视觉层级应围绕当前任务 |
| LOW | `src/styles.css` 回放、数字及主题表面 | 步骤控件偏小，金额排版不稳定，阅读分区弱 | 步骤最小高度桌面 40px/移动 44px；数字等宽；牌桌与行动记录分层 | 高频切街需要稳定反馈 |
| LOW | `src/styles.css` 动效规则 | 核心仍有宽泛 transition 与标记 hover 放大，缺少统一减少动态效果支持 | 显式颜色/边界过渡；CTA scale(.96)，标记无缩放；减少动态效果取消位移 | 动效应可打断且克制 |

## 考虑后未采用

| Location | Candidate | Rejected because |
| --- | --- | --- |
| 导航、筛选与回放 | 每次切换播放渐次入场 | 重复操作频繁，增加等待和注意力成本 |
| Mark 开合 | 为退出动画延迟隐藏、增加 JS 状态 | 当前 ESC、焦点与草稿恢复契约稳定；即时返回更适合快记 |
| 四主题与图标 | 更换配色、外部字体和图标库 | 本轮的视觉变化由现有排版与组件系统完成，无需新增运行时依赖 |

## 验证与结论

- `npm run check`：80 项契约测试、30 项 Playwright 测试和 8 文件构建产物契约通过。新增覆盖键盘导航、触控、减少动态效果及 `file://` 的 Timer/Mark 流程。
- 1280×800、1440×900、1920×1080、390×844、430×932 × 四主题 × 七个 Review 子页共 140 次检查，无页面级横向溢出或 runtime error；Timer 与 Mark 同时进行可见性检查。
- 合成 GG 手牌导入与回放切街检查通过；既有 E2E 验证回放只读、草稿恢复、快记保存、筛选导航及策略行为。
- Chromium CDP 以 10% 播放速度检查 CTA 按压：中间缩放约 .962，释放后恢复 `none`；减少动态效果下过渡为 .01ms。
- `git diff --check` 通过。未提交、推送或部署。
- 技术结论：Approve。未验证：真实手机软键盘、安全区实体设备表现、macOS 字体渲染、线上 HTTPS Service Worker 安装与离线行为，以及木下的主观视觉验收。

截图与矩阵 JSON 保存在本地 Codex 可视化目录的 `ui-polish/` 中；截图使用合成数据，不含个人牌局。空状态的前后截图与有数据截图不是同一数据量，不能据此比较行密度。

## 木下执行的 Git 命令

完成本地验收后，在 PowerShell 执行：

```powershell
Set-Location -LiteralPath 'D:\Poker\poker poject'
git diff --check
git add -- index.html src/styles.css src/modules/review.js src/constants.js package.json package-lock.json e2e/ui-polish.spec.js CHANGELOG.md CONTEXT.md docs/acceptance.md docs/ui-polish-review.md
git commit -m "Polish core poker workspace UI for V7.12.0"
```

生产推送与发布在木下决定后执行。
