# 变更日志

本文件记录正式发布证据。详细的历史功能说明继续保留在 `牌桌助手历史迭代版本/版本更新说明.md`。

## 未发布

- V7.9.0 新增多文件 `.txt` 导入可靠性：文件选择器支持多选、合并顺序与选择顺序一致（消除 FileReader 竞态）。
- V7.9.0 修复混合档位导入盈亏失真：盲注值改为逐块从牌局头部 `($sb/$bb)` 结构检测（异常 post 行与缺失时按块回退），导入语料 43,680 手逐手指纹与修复前一致（单档位零回归）。
- V7.9.0 修复 Session 等级硬编码：改由盲注派生（0.05→NL5、0.1→NL10、0.25→NL25），同日不同档位不再错并，档位变化强制切组。
- V7.9.0 导入手牌新增持久化事实字段：`heroPosition`、`heroCards`、`bbValue`、`heroStartStack`、`heroEndStack`、`marked:false`；覆盖补丁同步刷新这些字段且不触碰决策/反思/Session 关联。
- V7.9.0 修复 Discover 缓存：手牌数据任何增删改/导入/恢复经 `handDataChanged` 事件强制重扫，不再出现"编辑同数量手牌后 Discover 不刷新"。
- V7.9.0 移除 Discover 自动"偏离 GTO"发现：旧 GTO 数据无适用范围元数据，转为 scoped legacy reference；热力图对照、Quiz 场景区与 GTO 速查表统一标注"旧 GTO 参考数据：条件未记录，未经 9max/200bb 主线档案验证，仅作结构性参考"。
- V7.9.0 修正导入浮层文案：Session 自动分组间隔实际为 1 小时（V7.3.2 起），浮层"3 小时"为遗留描述。
- V7.8.0 新增可安装 PWA 基础：相对路径 manifest、Apple/PWA 图标、maskable 图标、HTTPS 离线 shell 与严格构建产物白名单；继续保留 `file://` 单文件核心能力。
- 新增部署基线，区分本地 Git 状态、公开远端状态、Netlify 和 GitHub Pages。
- 新增轻量开发、检查和发布流程。
- 新增面向用户的 parser、存储、离线、HTTPS 和移动端验收标准。
- 新增临时构建型 `npm run check` 流程，检查构建产物、数据契约和浏览器冒烟。
- 更新 GitHub Pages workflow：发布前先安装依赖并从源码构建。
- 完成存储 seam：IndexedDB、localStorage 降级、备份和迁移重试统一由持久化协调器管理。
- 完成 GG 导入 seam：解析失败、重复、覆盖和 Session 分组在写入前统一生成导入计划。
- 完成 Review 导航 seam：手牌、Session、Discover 和学习目标使用统一导航意图。
- 完成学习分析读模型：Review、Discover、Quiz 使用只读规范化快照，Discover 可稳定跳转 Quiz。
- 强化构建产物契约：检查单文件输出、CSP、无外部运行时资源、HTTPS Service Worker 和两套部署构建入口。

本条目不代表已经发布到生产环境。

## 正式发布记录模板

```text
Source SHA:
App Version:
Artifact Hash:
Target URL:
Automated Checks:
Manual Acceptance:
Online Smoke:
Rollback Point:
```
