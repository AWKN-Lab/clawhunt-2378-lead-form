# ClawHunt #2378 · 验收证据

订单：会员空间平台 · 新建线索表单与撞单拦截、疑似重复确认交互（$5.58，
jev_decision 直接指派，交付截止 2026-11-28 11:52 UTC）。
交付仓：`AWKN-Lab/clawhunt-2378-lead-form`（公开仓，main）。

> 截图本身不算证据：每项验收同时给出组件测试名、复跑命令与实跑输出、
> 关键 DOM 文本。截图只作辅助，见 `evidence/`。

## 环境与版本

- Node v24.22.1，npm 10.9.4（本机实测；CI 固定 Node 24）
- Vite 6 + React 18.3.1 + TypeScript ~5.7.3 + TDesign React ^1.18.0 +
  Vitest ^3.2.0 + Testing Library
- 复跑命令（与 CI 步骤一致）：`bash scripts/run-all.sh`
  （npm ci → lint → typecheck → `npx vitest run` → build）
- 完整实跑日志：`evidence/run-all.log`（RUNALL_EXIT=0），
  变异自证日志：`evidence/mutation-check.log`（MUTATION_EXIT=0）

## 实跑输出（原文，见 evidence/run-all.log）

```
 ✓ src/lib/creditCode.test.ts (5 tests) 7ms
 ✓ src/components/LeadForm.test.tsx (15 tests) 5343ms
   ✓ AC1 strong 归属他人 > AC1 提交按钮禁用且显示对方报备时间  519ms
   ✓ AC1 strong 归属他人 > AC1 提供发起撞单申诉入口并带 matched_lead_id  351ms
   ✓ AC2 weak 疑似重复 > AC2 weak 未勾选确认无法提交  378ms
   ✓ AC2 weak 疑似重复 > AC2 weak 已勾选未填原因无法提交，填原因后可提交  722ms
   ✓ AC3 信用代码校验位 > AC3 合法信用代码不报错，可正常提交  598ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_COLLISION 显示对应中文提示  320ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_IN_POOL 显示对应中文提示  387ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_HOLDING_LIMIT 显示对应中文提示  314ms
   ✓ 提交成功 > 提交成功跳转详情页并用 Toast 显示服务端报备时间  532ms
   ✓ 字段校验 > 企业名称 61 个字提示最多 60 个字  361ms
 Test Files  2 passed (2)
      Tests  20 passed (20)
   Duration  19.92s (transform 5.37s, setup 735ms, collect 12.04s, tests 5.35s, environment 2.71s, prepare 429ms)
✓ built in 24.74s
== 全部通过 ==
```

（vitest 默认只逐行列出耗时较长的单项；其余 10 项计入文件汇总：
组件 15 项 + 校验位 5 项 = 20 项，汇总 20 passed。）

## 验收逐项映射

### AC1 · strong 归属他人时提交按钮禁用且显示对方报备时间

- 测试（`src/components/LeadForm.test.tsx`）：
  - `AC1 提交按钮禁用且显示对方报备时间`
  - `AC1 提供发起撞单申诉入口并带 matched_lead_id`
- 关键 DOM 文本（浏览器实拍，`evidence/01-strong-other.png` 同款）：
  - 红条：`该企业已由其他顾问于 2026-11-20 10:24 报备，当前阶段 跟进中`
  - 申诉入口：`发起撞单申诉`（跳转 `/sales/leads/appeals/new?matched_lead_id=lead-2026-0001`）
  - 提交按钮带 `t-is-disabled` 类，置灰不可点
- 复跑：`bash scripts/run-all.sh`，两项均过（见上文输出）

### AC2 · weak 时未勾选确认或未填原因无法提交

- 测试：
  - `AC2 weak 未勾选确认无法提交`
  - `AC2 weak 已勾选未填原因无法提交，填原因后可提交`
- 关键 DOM 文本（浏览器实拍，`evidence/03-weak.png` 同款）：
  - 黄条：`疑似重复：疑似演示科技有限公司`
  - 确认项：`确认不是同一企业`（复选框）+ 原因输入框；两者齐全前提交按钮禁用
- 复跑：`bash scripts/run-all.sh`，两项均过

### AC3 · 信用代码校验位错误时显示字段级错误提示

- 测试：
  - `AC3 校验位错误显示字段级错误提示`
  - `AC3 合法信用代码不报错，可正常提交`
  - 另有 `src/lib/creditCode.test.ts` 5 项：`合法代码通过校验`、
    `AC3 校验位错误返回 check-digit`、`不足 18 位返回 length`、
    `含 I、O、S、V、Z 返回 charset`、`computeCheckChar 对非法前缀返回 null`
- 校验规则：GB 32100-2015，18 位格式 + 校验位（`src/lib/creditCode.ts`）
- 复跑：`bash scripts/run-all.sh`，7 项均过

### AC4 · 3 种后端错误码各自显示对应中文提示

- 测试（`AC4 后端错误码中文提示`，每种错误码一个测试，注入 fake api 抛错）：
  - `AC4 LEAD_COLLISION 显示对应中文提示`
  - `AC4 LEAD_IN_POOL 显示对应中文提示`
  - `AC4 LEAD_HOLDING_LIMIT 显示对应中文提示`
- 中文提示原文：
  - LEAD_COLLISION → `提交失败：该线索已被其他顾问报备，请勿重复提交。`
  - LEAD_IN_POOL → `提交失败：该企业已在公海中，请先去公海领取。`
  - LEAD_HOLDING_LIMIT → `提交失败：您当前持有线索已达上限，请先处理已有线索再提交。`
- 复跑：`bash scripts/run-all.sh`，三项均过

### 强在公海（AC 之外的三态之一）

- 测试：`显示在公海提示与去公海领取按钮`
- 关键 DOM 文本（浏览器实拍，`evidence/02-strong-pool.png` 同款）：
  - `该企业在公海中` + 按钮 `去公海领取`
    （跳转 `/sales/leads/pool/claim?matched_lead_id=lead-2026-0002`）

### 提交成功 · 跳转详情页 + Toast 显示服务端报备时间

- 测试：`提交成功跳转详情页并用 Toast 显示服务端报备时间`
- 关键 DOM 文本（浏览器实拍，`evidence/04-submit-success.png` 同款）：
  - Toast：`报备成功，报备时间 2026-11-25 20:30`
  - 详情卡：`线索已创建` / `报备成功，报备时间 2026-11-25 20:30` /
    `线索编号：lead-2026-0101` / `企业名称：演示科技有限公司` /
    `报备时间：2026-11-25 20:30`
  - 地址栏跳转至 `/sales/leads/lead-2026-0101`（history.pushState）
- 复跑：`bash scripts/run-all.sh`，该项通过

### 字段校验（附加）

- 测试：`企业名称为空提交时提示必填`、`企业名称 1 个字提示至少 2 个字`、
  `企业名称 61 个字提示最多 60 个字`、`手机号格式错误提示 11 位手机号`
- 复跑：`bash scripts/run-all.sh`，四项均过

## 变异自证（门禁会红）

`bash scripts/mutation-check.sh`，原文见 `evidence/mutation-check.log`：

```
== 变异 A：信用代码校验位比较取反（!== 改成 ===）==
变异 A 变红（符合预期）：
      Tests  2 failed | 13 skipped (15)
变异 A 已还原
== 变异 B：LEAD_COLLISION 映射串成 LEAD_IN_POOL 的文案 ==
变异 B 变红（符合预期）：
      Tests  1 failed | 14 skipped (15)
变异 B 已还原
== 还原后全套测试（必须绿）==
      Tests  20 passed (20)
== 变异自证通过：两处变异均变红，还原后全绿 ==
```

## 截图清单（浏览器实拍，Chromium，1280×900，fullPage）

| 文件 | 内容 |
| --- | --- |
| `evidence/01-strong-other.png` | strong 归属他人红条 + 申诉入口 + 提交按钮禁用 |
| `evidence/02-strong-pool.png` | strong 在公海提示 + 去公海领取按钮 |
| `evidence/03-weak.png` | weak 黄条 + 确认复选框 + 原因输入框 |
| `evidence/04-submit-success.png` | 提交成功 Toast + 详情卡（报备时间、线索编号） |

拍摄脚本：`scripts/screenshot.mjs`（`node scripts/screenshot.mjs`，
起 `vite preview`，用缓存的 Chromium 实拍；复拍方法见 README）。

## 未完成 / 限制（诚实记录）

- 接口为 mock：真实接口 `POST /api/sales/leads/collision-check` 与
  `POST /api/sales/leads` 未就绪，对接点见 README；mock 触发词见 README。
- 全部为虚构的演示数据，不含任何真实个人信息、企业信息或客户名称。
- 本交付只含新建线索表单页；申诉页、公海领取页、详情页本身不在本次
  范围内（提交成功后用详情卡 + pushState 展示，不做整页路由）。
- solution 未提交（提交通道等 GPT 裁决），平台未碰。
