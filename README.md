# ClawHunt #2378 · 新建线索表单与撞单拦截、疑似重复确认交互

会员空间平台 · 业务员工作台新建线索页：填企业信息，失焦时调撞单预检，
三态提示（strong 归属他人 / strong 在公海 / weak 疑似重复），提交成功后
跳转线索详情页并用 Toast 显示 mock 返回的报备时间（演示数据，
非真实服务端报备凭证）。

> 全部为虚构的演示数据，不含任何真实个人信息、企业信息或客户名称。
> 接口为 mock（见“对接点”），真实接口就绪后按下表替换即可。

## 运行

```bash
npm ci
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 产物在 dist/
npx vite preview   # 预览构建产物，默认 http://localhost:4173
```

一键复核（依赖安装 → lint → 类型检查 → 组件测试 → 构建，
与 `.github/workflows/frontend-ci.yml` 的步骤一致）：

```bash
bash scripts/run-all.sh
```

变异自证（改坏校验位比较与错误码映射，测试必须变红；还原后全绿）：

```bash
bash scripts/mutation-check.sh
```

浏览器实拍截图（起 preview，用缓存的 Chromium 拍 4 张验收图到 `evidence/`）：

```bash
node scripts/screenshot.mjs
```

## 测试

```bash
npx vitest run    # 23 项：组件 18 项 + 信用代码 5 项
```

组件测试在 `src/components/LeadForm.test.tsx`，覆盖 4 条验收标准
（每条至少一个测试，测试名以 AC 编号开头）；信用代码校验位单测在
`src/lib/creditCode.test.ts`。验收逐项映射、实跑输出与关键 DOM 文本见
`ACCEPTANCE-EVIDENCE.md`。

## 演示触发词（mock 行为）

企业名称含以下子串时，失焦预检返回对应结果（`src/lib/mockApi.ts`）：

| 企业名称含 | 预检结果 | 页面表现 |
| --- | --- | --- |
| 强占 | strong 归属他人 | 红条「该企业已由其他顾问于 {报备时间} 报备，当前阶段 {阶段}」，提交禁用，「发起撞单申诉」入口（带 matched_lead_id） |
| 公海 | strong 在公海 | 提示「该企业在公海中」，「去公海领取」按钮 |
| 疑似 | weak 疑似重复 | 黄条「疑似重复：{企业名}」，须勾选「确认不是同一企业」并填原因才能提交 |
| 其他 | 无撞单 | 正常提交 |

提交时企业名称含以下子串，mock 抛对应错误码（页面显示中文提示）：

| 企业名称含 | 错误码 | 中文提示 |
| --- | --- | --- |
| 撞单 | LEAD_COLLISION | 提交失败：该线索已被其他顾问报备，请勿重复提交。 |
| 在池 | LEAD_IN_POOL | 提交失败：该企业已在公海中，请先去公海领取。 |
| 超限 | LEAD_HOLDING_LIMIT | 提交失败：您当前持有线索已达上限，请先处理已有线索再提交。 |

提交成功 mock 返回 `{ leadId: 'lead-2026-0101', reportedAt: '2026-11-25 20:30' }`，
页面跳转详情页并 Toast 显示报备时间（演示数据：该时间是 mock 返回值，
不是真实服务端报备凭证）。

## 对接点（真实接口就绪后替换）

只改 `src/lib/mockApi.ts`，或把 `LeadForm` 的 `api` 属性换成真实实现：

| mock | 真实接口 | 说明 |
| --- | --- | --- |
| `mockApi.collisionCheck` | `POST /api/sales/leads/collision-check` | 失焦预检；请求 `{ companyName, creditCode, phone }`，返回 strong / weak / 无撞单三态（含 matchedLeadId、报备时间、阶段） |
| `mockApi.submitLead` | `POST /api/sales/leads` | 提交新建；成功返回 `{ leadId, reportedAt }`，失败返回错误码 LEAD_COLLISION / LEAD_IN_POOL / LEAD_HOLDING_LIMIT |
| `LeadForm` 的 `api` 属性 | 真实 `LeadApi` 实现 | 组件默认用 mock；注入真实实现即可切换，无需改组件 |
| 申诉入口 | `/sales/leads/appeals/new?matched_lead_id={id}` | strong 归属他人时「发起撞单申诉」的跳转目标 |
| 公海领取入口 | `/sales/leads/pool/claim?matched_lead_id={id}` | strong 在公海时「去公海领取」的跳转目标 |
| 详情页 | `/sales/leads/{leadId}` | 提交成功后跳转目标（当前用 history.pushState + 详情卡展示） |

字段与校验（`src/components/LeadForm.tsx`）：企业名称必填 2–60 字；
统一社会信用代码可选，填了就校验 18 位格式与校验位（GB 32100-2015，
见 `src/lib/creditCode.ts`）；手机号填了就校验 11 位格式。

## 已知实现说明

- 提交按钮用原生 `<button>` + TDesign 样式类，不用 TDesign Button：
  TDesign Button 在 disabled 时渲染成 div、启用时渲染成 button，
  disabled 翻转会替换 DOM 节点，正在进行的点击可能落到已脱离文档的
  旧节点上。原生 button 的 disabled 属性不换节点。详见组件内注释。
- 预检进行中（checking）不禁用提交按钮：点提交会让手机号输入框失焦，
  失焦立刻触发预检；若预检进行中就禁用按钮，按钮会在点击序列完成前变
  disabled，点击直接丢了。禁用只看已落定的撞单结论；提交流程里会等在途
  预检出结果再决定能不能交。详见组件内注释。
- 预检提示常驻占位（visibility 切换，不增减节点）：提示若在 mousedown
  与 mouseup 之间突然出现，页面布局下移，mouseup 落不到按钮上，整次
  点击丢了。详见组件内注释。
- 异步预检竞态隔离（请求版本控制 + key 比对）：每次失焦预检递增版本
  号，只采纳最新版本号的响应，旧响应晚到也不覆盖新状态；提交流程发
  现有在途预检时，先比对该任务的 key（企业名称 + 信用代码 + 手机号）
  与当前表单的 key，key 不一致就丢弃旧任务、按当前表单重新预检后再
  决定能不能交。测试见 `异步撞单预检竞态` 一组（2 项）。详见组件内注释。

## 技术栈

Vite 6 + React 18.3 + TypeScript 5.7 + TDesign React 1.18 + Vitest 3 +
Testing Library。Node 24（Node 20 已 EOL，CI 固定用 Node 24）。
