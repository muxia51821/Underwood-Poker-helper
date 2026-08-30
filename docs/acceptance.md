# 用户验收清单

## 发布身份

- [ ] 页面显示的应用版本与本次计划发布版本一致。
- [ ] 已记录 source SHA 和构建产物 hash。
- [ ] 已记录 Netlify 和 GitHub Pages 的入口角色。
- [ ] 已确认 Netlify 控制台绑定的仓库和生产分支。

## 核心操作

- [ ] 通过 `npm run dev` 打开应用，Console 没有真实错误。
- [ ] Timer、Odds、Review 三个 Tab 都能打开。
- [ ] Review 下的子 Tab 都能打开。
- [ ] 生产构建生成可用的单文件 `dist/index.html`。
- [ ] 构建文件可以通过 `file://` 打开。
- [ ] 在浏览器允许时，HTTPS 模式可以注册 Service Worker。

## 数据安全

- [ ] 可以导入 GG hand history。
- [ ] 可以一次选择多份 .txt 导入，预览顺序与文件选择顺序一致。
- [ ] 可以识别重复手牌（含多份文件之间的重复），不产生意外重复记录。
- [ ] 导入后原有手工复盘字段仍然保留。
- [ ] 导出的数据可以导入新的本地用户环境。
- [ ] IndexedDB 降级或 safe mode 会显示明确的存储状态。
- [ ] 正常使用时不会向外部 endpoint 发送用户数据。

## 代表性扑克行为

- [ ] `uncalled` bet 不计入实际投入金额。
- [ ] Ante、rake、jackpot 和 collected amount 表示正确。
- [ ] 解析后仍保留 board texture 和 board metadata。
- [ ] 混合档位（如 NL5 与 NL10）合并导入时，各手牌的 BB 盈亏按自己档位换算正确。
- [ ] Session 自动分组等级与盲注一致（NL5/NL10），同日不同档位不会并成一场。
- [ ] 修改或删除手牌后重新打开 Discover，结果按最新数据刷新（手牌数量不变时也要刷新）。
- [ ] Discover / Quiz / GTO 速查中的 GTO 对照均标注为"旧 GTO 参考"（适用范围未验证），不再自动出现"偏离 GTO"结论。
- [ ] Discover 发现的问题可以追溯到对应手牌。
- [ ] Quiz 答错后和重试后反馈仍然可用。

## 移动端检查

- [ ] 375px 宽度下主要控件可用。
- [ ] 390px 宽度下主要控件可用。
- [ ] 交互目标在可行时至少达到 44px。
- [ ] 表格和筛选器不会让手机主页面无法使用。
