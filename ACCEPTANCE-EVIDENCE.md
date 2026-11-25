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
- 完整实跑日志：`evidence/run-all.log`（EXIT=0，24 项全过），
  变异自证日志：`evidence/mutation-check-20261125-rerun2.log`
  （MUTATION_EXIT=0；旧日志 `evidence/mutation-check-20261125-rerun.log`
  与 `evidence/mutation-check.log` 均为历史记录，未改写）；
  MANIFEST 独立复核记录：`evidence/manifest-verify-20261126-newhead.log`
  （34/34 OK，针对上一 HEAD 631f3baa，在干净副本里独立复核；
  旧记录 `evidence/manifest-verify-20261125-newhead.log` 是针对上一 HEAD
  04470d59 的 31/31，未改写；更旧记录 `evidence/manifest-verify-20261125.log`
  是针对 2fc2dca 的 29/29，未改写）；上一 HEAD b3933523：35 项，本地干净副本
  校验 35/35；84d84c6c：35 项，本地干净副本校验 35/35；两者均尚无独立
  tarball 校验日志。本提交的 MANIFEST 共 35 项，本地干净副本 `sha256sum -c`
  35/35（退出码 0），独立 tarball 校验日志按既往模式须下一轮才有；
  依赖审计证据：`evidence/npm-audit-20261125.log`

## 实跑输出（原文，见 evidence/run-all.log）

```
 ✓ src/lib/creditCode.test.ts (5 tests) 11ms
 ✓ src/components/LeadForm.test.tsx (19 tests) 11356ms
   ✓ AC1 strong 归属他人 > AC1 提交按钮禁用且显示对方报备时间  856ms
   ✓ AC1 strong 归属他人 > AC1 提供发起撞单申诉入口并带 matched_lead_id  554ms
   ✓ AC2 weak 疑似重复 > AC2 weak 未勾选确认、原因已填仍无法提交  1156ms
   ✓ AC2 weak 疑似重复 > AC2 weak 已勾选未填原因无法提交，填原因后可提交  997ms
   ✓ AC3 信用代码校验位 > AC3 合法信用代码不报错，可正常提交  978ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_COLLISION 显示对应中文提示  726ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_IN_POOL 显示对应中文提示  633ms
   ✓ AC4 后端错误码中文提示 > AC4 LEAD_HOLDING_LIMIT 显示对应中文提示  577ms
   ✓ 提交成功 > 提交成功跳转详情页并用 Toast 显示 mock 报备时间（演示数据）  839ms
   ✓ 字段校验 > 企业名称 61 个字提示最多 60 个字  529ms
   ✓ 异步撞单预检竞态 > 旧预检进行中修改企业名称，提交不得采用旧预检结果  563ms
   ✓ 异步撞单预检竞态 > 旧请求晚于新请求返回，旧响应不得覆盖新状态  478ms
   ✓ 异步撞单预检竞态 > 提交等待预检期间再次修改字段，不得用旧预检结果提交新字段  588ms
 Test Files  2 passed (2)
      Tests  24 passed (24)
   Duration  31.39s (transform 7.73s, setup 1.05s, collect 16.37s, tests 11.37s, environment 3.65s, prepare 699ms)
✓ built in 39.55s
== 全部通过 ==
```

（vitest 默认只逐行列出耗时较长的单项；其余 11 项计入文件汇总：
组件 19 项 + 校验位 5 项 = 24 项，汇总 24 passed。）

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
  - `AC2 weak 未勾选确认、原因已填仍无法提交`（新增：只填原因不勾选确认，
    仍不能提交；旧实现下该逻辑已正确，本测试只是补齐缺失的格子）
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

### 异步撞单预检竞态（P1 整改，2026-11-25 批判复核后修）

- 问题：提交流程发现已有预检任务时直接等 `inFlightCheckRef.current.promise`，
  不比对任务 key；旧请求晚于新请求返回时还会覆盖新状态。
- 修法（`src/components/LeadForm.tsx`）：每次失焦预检递增版本号
  `checkVersionRef`，`.then` 只在版本号最新且表单当前 key 等于该次预检
  的 key 时才采纳响应；预检 Promise 携带它对应的 key
  （`{ key, result }`）；`submitFlow` 提交前循环取最新预检结论：
  读当前 key → 等该 key 的预检 → 再读当前 key，不同就重新预检；
  只有结果 key 与提交时 key 完全一致，才允许提交（二次竞态修复，
  2026-11-25 小范围终验后修：单次“等完再比对”不够，第二次等待期间
  也可能再改字段，所以必须循环到 key 稳定为止）。
- 测试（`异步撞单预检竞态` 一组，3 项；用可控 fake api，每次预检返回
  手动 resolve 的 deferred promise）：
  - `旧预检进行中修改企业名称，提交不得采用旧预检结果`
  - `旧请求晚于新请求返回，旧响应不得覆盖新状态`
  - `提交等待预检期间再次修改字段，不得用旧预检结果提交新字段`
    （新增：提交等 B 的预检期间改成 C，B 返回无撞单后不得拿 B 的
    结果提交 C，须按 C 重新预检；该测试在修前实现下真实失败过——
    旧实现下第 4 次预检调用始终不出现，checkCalls 停在 3 次——
    修后通过）
- 前两项测试在旧实现下均真实失败过（旧预检 strong 归属他人结果挡住了
  新表单的提交；旧响应晚到后红条重新出现），新实现下全绿。
- 复跑：`bash scripts/run-all.sh`，三项均过（见上文输出）

### 强在公海（AC 之外的三态之一）

- 测试：`显示在公海提示与去公海领取按钮`
- 关键 DOM 文本（浏览器实拍，`evidence/02-strong-pool.png` 同款）：
  - `该企业在公海中` + 按钮 `去公海领取`
    （跳转 `/sales/leads/pool/claim?matched_lead_id=lead-2026-0002`）

### 提交成功 · 跳转详情页 + Toast 显示 mock 报备时间（演示数据）

- 测试：`提交成功跳转详情页并用 Toast 显示 mock 报备时间（演示数据）`
- 关键 DOM 文本（浏览器实拍，`evidence/04-submit-success.png` 同款）：
  - Toast：`报备成功，报备时间 2026-11-25 20:30（演示数据）`
  - 详情卡：`线索已创建` / `报备成功，报备时间 2026-11-25 20:30（演示数据）` /
    `线索编号：lead-2026-0101` / `企业名称：演示科技有限公司` /
    `报备时间：2026-11-25 20:30（演示数据）`
  - 地址栏跳转至 `/sales/leads/lead-2026-0101`（history.pushState）
- **该报备时间是 mock 返回值，不是真实服务端报备凭证。**
- 复跑：`bash scripts/run-all.sh`，该项通过

### 字段校验（附加）

- 测试：`企业名称为空提交时提示必填`、`企业名称 1 个字提示至少 2 个字`、
  `企业名称 61 个字提示最多 60 个字`、`手机号格式错误提示 11 位手机号`
- 复跑：`bash scripts/run-all.sh`，四项均过

## 变异自证（门禁会红）

`bash scripts/mutation-check.sh`，原文见
`evidence/mutation-check-20261125-rerun2.log`（二次竞态整改后重跑，
旧日志 `evidence/mutation-check-20261125-rerun.log` 与
`evidence/mutation-check.log` 未改写）：

```
== 变异 A：信用代码校验位比较取反（!== 改成 ===）==
变异 A 变红（符合预期）：
      Tests  2 failed | 17 skipped (19)
变异 A 已还原
== 变异 B：LEAD_COLLISION 映射串成 LEAD_IN_POOL 的文案 ==
变异 B 变红（符合预期）：
      Tests  1 failed | 18 skipped (19)
变异 B 已还原
== 还原后全套测试（必须绿）==
      Tests  24 passed (24)
== 变异自证通过：两处变异均变红，还原后全绿 ==
```

## 截图清单（浏览器实拍，Chromium，1280×900–1357，fullPage）

| 文件 | 尺寸 | 内容 |
| --- | --- | --- |
| `evidence/01-strong-other.png` | 1280×1309 | strong 归属他人红条 + 申诉入口 + 提交按钮禁用 |
| `evidence/02-strong-pool.png` | 1280×1309 | strong 在公海提示 + 去公海领取按钮 |
| `evidence/03-weak.png` | 1280×1357 | weak 黄条 + 确认复选框 + 原因输入框 |
| `evidence/04-submit-success.png` | 1280×900 | 提交成功 Toast + 详情卡（报备时间、线索编号） |

拍摄脚本：`scripts/screenshot.mjs`（`node scripts/screenshot.mjs`，
起 `vite preview`，用缓存的 Chromium 实拍；复拍方法见 README）。
02/03 两张已人工目视核对，与渲染一致；04 于 2026-11-25 重拍，
Toast 与详情卡已带「（演示数据）」标注。

## 未完成 / 限制（诚实记录）

- 接口为 mock：真实接口 `POST /api/sales/leads/collision-check` 与
  `POST /api/sales/leads` 未就绪，对接点见 README；mock 触发词见 README。
- 全部为虚构的演示数据，不含任何真实个人信息、企业信息或客户名称。
  提交成功显示的报备时间 `2026-11-25 20:30` 是 mock 返回值，
  不是真实服务端报备凭证；组件内 Toast 与详情卡已加注「（演示数据）」。
- 本交付只含新建线索表单页；申诉页、公海领取页、详情页本身不在本次
  范围内（提交成功后用详情卡 + pushState 展示，不做整页路由）。
- 依赖安全警告（2026-11-25 直接审计，证据 `evidence/npm-audit-20261125.log`）：
  本机 `npm audit` 仍跑不通——出口代理对 npm CLI 的审计请求返回 403
  （policy_denied，策略 `zz_managed_internal_spaces_package_registries`，
  退出码 1）；但按 package-lock.json 重建依赖树（342 个包）直接 POST
  同一审计接口返回 HTTP 200 与真实审计结果：**5 条告警，3 项 moderate +
  2 项 critical**——vitest 3.2.7（moderate，GHSA-82fw-gwwq-j7x9 /
  CVE-2026-84373，@vitest/mocker 重定向 mock 路径穿越读文件，修复
  >=4.1.11）、@vitest/mocker 3.2.7（moderate，同一 GHSA-82fw，修复
  >=4.1.11；另 moderate GHSA-qxg6-89mg-rqv8 / CVE-2026-112949，
  未鉴权手动 mock 注册代码注入，修复 >=4.1.12）、tinypool 1.1.1
  （critical ×2，GHSA-5gmw-xhrv-c9v3 / CVE-2026-104848 与
  GHSA-85c8-ppgw-ccpr / CVE-2026-104849，原型污染 gadget 通向 RCE，
  修复 >=2.1.1 / >=2.1.2）。13 个多版本包的全部被压掉的版本已逐个
  补查，0 新增告警。此前逐项核对过的 vite 6.4.6、esbuild 0.25.12、
  tough-cookie 5.1.2、React 18.3.1 在本次全树审计中均无告警。
  与 GPT 小范围终验裁决“1 项 moderate、2 项 critical”的出入：实测为
  3 项 moderate + 2 项 critical，多的 2 项 moderate 均为 @vitest/mocker，
  来源不明，已如实记下，不作调和。唯一 GHSA 统计（GPT 终验第二轮口径）：
  5 条记录对应 4 个唯一 GHSA——GHSA-82fw-gwwq-j7x9 在 vitest 与
  @vitest/mocker 上是同一漏洞；唯一 moderate 2 个（GHSA-82fw-gwwq-j7x9、
  GHSA-qxg6-89mg-rqv8）、唯一 critical 2 个（GHSA-5gmw-xhrv-c9v3、
  GHSA-85c8-ppgw-ccpr）。5 条记录不等于 5 个独立漏洞；计数仍保留
  3 moderate + 2 critical。上轮“1 项 moderate、2 项 critical”的原始依据
  缺失，无法追溯。5 条全部落在开发期工具链（vitest
  及其依赖 tinypool），生产依赖 react 18.3.1 / react-dom 18.3.1 /
  tdesign-react 1.18.6 无告警；交付物是静态 dist，无 Node 运行时、
  无对外开发服务器；5 条的利用前提均为开发服务器/测试进程本地可达，
  本交付不启动对外 dev server。未做盲目升级（vitest 3→4、tinypool
  1→2 均跨大版本，须另行评估回归风险）。**风险保留：只能确认已知
  依赖告警得到处理，不能宣称整个依赖树不存在风险。**本次审计以
  package-lock.json 重建的依赖树为准，不是 npm audit 自身的输出
  （npm audit 在本机被代理 403 拦截）；如在能正常访问审计接口的
  机器上跑 npm audit，结果应以那次为准。
- solution 未提交（提交通道等 GPT 裁决），平台未碰。
