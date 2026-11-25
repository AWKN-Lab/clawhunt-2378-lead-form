import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  InputNumber,
  MessagePlugin,
  Select,
  Textarea,
} from 'tdesign-react';
import { CREDIT_CODE_ERROR_TEXT, validateCreditCode } from '../lib/creditCode';
import {
  ApiError,
  mockApi,
  submitErrorText,
  type CollisionResult,
  type LeadApi,
} from '../lib/mockApi';
import 'tdesign-react/es/style/index.css';

const { Option } = Select;

export interface LeadFormData {
  companyName: string;
  creditCode?: string;
  industry?: string;
  staffSize?: string;
  source?: string;
  contactName?: string;
  phone?: string;
  spaceType?: string;
  seatCount?: number;
  remark?: string;
}

interface LeadFormProps {
  api?: LeadApi;
}

const INDUSTRY_OPTIONS = ['科技 / 互联网', '金融', '制造', '零售 / 消费', '医疗健康', '教育', '其他'];
const STAFF_SIZE_OPTIONS = ['1–10 人', '11–50 人', '51–200 人', '201–500 人', '500 人以上'];
const SOURCE_OPTIONS = ['电话拜访', '展会', '转介绍', '线上咨询', '其他'];
const SPACE_TYPE_OPTIONS = ['开放工位', '独立办公室', '会议室', '活动场地', '其他'];

export default function LeadForm({ api = mockApi }: LeadFormProps) {
  const [form] = Form.useForm();
  const [collision, setCollision] = useState<CollisionResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [weakConfirmed, setWeakConfirmed] = useState(false);
  const [weakReason, setWeakReason] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{
    leadId: string;
    companyName: string;
    reportedAt: string;
  } | null>(null);
  // 提交中的同步锁：按钮 onClick 与表单原生 submit 可能同时触发，
  // 用 ref 挡重入（state 更新是异步的，挡不住同一 tick 内的两次调用）。
  const submittingRef = useRef(false);
  // 正在进行的预检（去重用）：失焦预检是异步的，提交时若有在途预检，
  // 直接等它，不要另起一次；key 是触发本次预检的三字段拼接。
  const inFlightCheckRef = useRef<{
    key: string;
    promise: Promise<CollisionResult | null>;
  } | null>(null);
  // 预检请求版本号：每次新起预检递增。旧请求晚于新请求返回时，
  // 版本号已过期，其结果不得写回 state（过期响应隔离）。
  const checkVersionRef = useRef(0);
  // 最近一次已拿到结果的预检 key；提交时值没变就直接用 state 里的结果。
  const lastCheckedKeyRef = useRef<string | null>(null);

  const isStrongOther =
    collision?.level === 'strong' && collision.owner === 'other';
  const isStrongPool = collision?.level === 'strong' && collision.owner === 'pool';
  const isWeak = collision?.level === 'weak';
  const weakBlocked = isWeak && (!weakConfirmed || weakReason.trim() === '');
  // 注意：checking（预检进行中）不参与禁用。点提交会让手机号输入框失焦，
  // 失焦立刻触发预检；若预检进行中就禁用按钮，按钮会在点击序列完成前
  // 变 disabled，浏览器与 user-event 都不会再派发这次点击，
  // 提交就丢了（实测：TDesign Button 还会在 disabled 时把 button 换成
  // div，旧节点直接脱离文档）。所以禁用只看已落定的撞单结论；
  // 提交流程里会等在途预检出结果再决定能不能交。
  const submitDisabled = submitting || isStrongOther || weakBlocked;

  function checkKey(companyName: string, creditCode: string, phone: string) {
    return `${companyName}\n${creditCode}\n${phone}`;
  }

  async function runCollisionCheck(): Promise<CollisionResult | null> {
    const companyName = (form.getFieldValue('companyName') as string | undefined) ?? '';
    const creditCode = (form.getFieldValue('creditCode') as string | undefined) ?? '';
    const phone = (form.getFieldValue('phone') as string | undefined) ?? '';
    if (companyName.trim() === '' && creditCode.trim() === '' && phone.trim() === '') {
      setCollision(null);
      lastCheckedKeyRef.current = null;
      return null;
    }
    const key = checkKey(companyName, creditCode, phone);
    const inFlight = inFlightCheckRef.current;
    if (inFlight && inFlight.key === key) return inFlight.promise;
    setChecking(true);
    // 本次预检的版本号：比它旧的响应一律丢弃。
    const version = ++checkVersionRef.current;
    const promise = api
      .collisionCheck({ companyName, creditCode, phone })
      .then((result) => {
        // 过期响应隔离（两道闸）：只有最新一次预检、且表单值仍是
        // 本次预检那三字段时，结果才能写回 state。旧请求晚到、
        // 或用户已改字段，都不得覆盖新状态。
        const currentKey = checkKey(
          (form.getFieldValue('companyName') as string | undefined) ?? '',
          (form.getFieldValue('creditCode') as string | undefined) ?? '',
          (form.getFieldValue('phone') as string | undefined) ?? '',
        );
        if (version === checkVersionRef.current && currentKey === key) {
          setCollision(result);
          if (result.level !== 'weak') {
            setWeakConfirmed(false);
            setWeakReason('');
          }
          lastCheckedKeyRef.current = key;
        }
        return result;
      })
      .catch(() => {
        // 预检失败不拦提交：服务端提交时仍会按错误码拦截（LEAD_COLLISION 等）。
        return null;
      })
      .finally(() => {
        // 只有最新一次预检能关掉“正在预检”提示；旧请求的 finally
        // 不得把新请求的提示关掉。
        if (version === checkVersionRef.current) {
          setChecking(false);
        }
        if (inFlightCheckRef.current?.promise === promise) {
          inFlightCheckRef.current = null;
        }
      });
    inFlightCheckRef.current = { key, promise };
    return promise;
  }

  function handleCompanyNameChange() {
    // 企业名改了，旧的预检结果失效，先清掉，避免拿旧结论拦提交。
    setCollision(null);
    lastCheckedKeyRef.current = null;
  }

  function handleAppeal() {
    if (collision?.level === 'strong' && collision.owner === 'other') {
      const url = `/sales/leads/appeals/new?matched_lead_id=${collision.matchedLeadId}`;
      void MessagePlugin.info(`将跳转申诉页：${url}`);
    }
  }

  function handleClaimFromPool() {
    if (collision?.level === 'strong' && collision.owner === 'pool') {
      const url = `/sales/leads/pool/claim?matched_lead_id=${collision.matchedLeadId}`;
      void MessagePlugin.info(`将跳转公海领取：${url}`);
    }
  }

  // 提交主流程。按钮 onClick 直接调 form.validate() 再提交：
  // jsdom 里点 type="submit" 按钮不会触发表单 submit 事件，
  // 只靠 Form onSubmit 的话，组件测试里提交永远走不通；
  // 真实浏览器里回车仍走 Form onSubmit，同一入口、ref 挡重入。
  async function submitFlow() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const result = await form.validate();
      if (result !== true) return;
      // 提交前先拿到最新的预检结论：只有在途预检的 key 与当前表单
      // 一致时才等它；key 不一致（用户改了企业名/信用代码/手机号）
      // 就丢弃旧任务，按当前表单重新预检。用返回的 result 而不用
      // state 做判断——setState 是异步的，等完预检 state 不一定已更新。
      const companyName =
        (form.getFieldValue('companyName') as string | undefined) ?? '';
      const creditCode =
        (form.getFieldValue('creditCode') as string | undefined) ?? '';
      const phone = (form.getFieldValue('phone') as string | undefined) ?? '';
      const key = checkKey(companyName, creditCode, phone);
      let latest: CollisionResult | null;
      const inFlight = inFlightCheckRef.current;
      if (inFlight && inFlight.key === key) {
        latest = await inFlight.promise;
        // 等待期间用户可能又改了字段：key 变了就丢弃这次结果，
        // 按当前表单重新预检后再决定能不能提交。
        const keyAfter = checkKey(
          (form.getFieldValue('companyName') as string | undefined) ?? '',
          (form.getFieldValue('creditCode') as string | undefined) ?? '',
          (form.getFieldValue('phone') as string | undefined) ?? '',
        );
        if (keyAfter !== key) {
          latest = await runCollisionCheck();
        }
      } else if (key !== lastCheckedKeyRef.current) {
        latest = await runCollisionCheck();
      } else {
        latest = collision;
      }
      if (latest?.level === 'strong' && latest.owner === 'other') {
        setCollision(latest);
        return;
      }
      if (latest?.level === 'weak' && (!weakConfirmed || weakReason.trim() === '')) {
        setCollision(latest);
        return;
      }
      const values = form.getFieldsValue(true) as LeadFormData;
      setSubmitError(null);
      setSubmitting(true);
      try {
        const res = await api.submitLead({
          companyName: values.companyName,
          creditCode: values.creditCode ?? '',
          industry: values.industry ?? '',
          staffSize: values.staffSize ?? '',
          source: values.source ?? '',
          contactName: values.contactName ?? '',
          phone: values.phone ?? '',
          spaceType: values.spaceType ?? '',
          seatCount: values.seatCount,
          remark: values.remark ?? '',
        });
        void MessagePlugin.success(`报备成功，报备时间 ${res.reportedAt}（演示数据）`);
        try {
          window.history.pushState(null, '', `/sales/leads/${res.leadId}`);
        } catch {
          // 演示环境不支持 history 跳转时忽略，详情页仍正常展示。
        }
        setSubmitted({
          leadId: res.leadId,
          companyName: values.companyName,
          reportedAt: res.reportedAt,
        });
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'UNKNOWN';
        const text = submitErrorText(code);
        setSubmitError(text);
        void MessagePlugin.error(text);
      } finally {
        setSubmitting(false);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function handleReset() {
    form.reset();
    setCollision(null);
    setWeakConfirmed(false);
    setWeakReason('');
    setSubmitError(null);
    setSubmitted(null);
  }

  if (submitted) {
    // data-testid 放在原生 div 上：TDesign Card 不透传 data-testid 到 DOM，
    // 测试与无障碍定位不到它，详情卡本身仍用 Card 渲染。
    return (
      <div data-testid="lead-detail">
        <Card title="线索已创建">
          <p>报备成功，报备时间 {submitted.reportedAt}（演示数据）</p>
          <p>线索编号：{submitted.leadId}</p>
          <p>企业名称：{submitted.companyName}</p>
          <p>报备时间：{submitted.reportedAt}（演示数据）</p>
          <Button theme="primary" onClick={handleReset}>
            继续新建线索
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <Form
      form={form}
      labelAlign="top"
      onSubmit={(context) => {
        if (context.validateResult === true) {
          void submitFlow();
        }
      }}
    >
      <Form.FormItem
        label="企业名称"
        name="companyName"
        rules={[
          { required: true, message: '请输入企业名称' },
          {
            // 不用 TDesign 内置 min/max：它按字符宽度计（一个汉字算 2），
            // 1 个汉字的企业名会误判通过；任务书要求 2–60 字，按 JS 字符数计。
            validator: (value: unknown) => {
              const text = typeof value === 'string' ? value : '';
              if (text.trim() === '') return true;
              if (text.length < 2) {
                return { result: false, message: '企业名称至少 2 个字', type: 'error' as const };
              }
              if (text.length > 60) {
                return { result: false, message: '企业名称最多 60 个字', type: 'error' as const };
              }
              return true;
            },
          },
        ]}
      >
        <Input
          placeholder="请输入企业名称"
          onBlur={() => {
            void runCollisionCheck();
          }}
          onChange={handleCompanyNameChange}
        />
      </Form.FormItem>

      <Form.FormItem
        label="统一社会信用代码"
        name="creditCode"
        rules={[
          {
            validator: (value: unknown) => {
              const text = typeof value === 'string' ? value : '';
              if (text.trim() === '') return true;
              const err = validateCreditCode(text);
              if (err) {
                return { result: false, message: CREDIT_CODE_ERROR_TEXT[err], type: 'error' as const };
              }
              return true;
            },
          },
        ]}
      >
        <Input
          placeholder="18 位统一社会信用代码（可选）"
          onBlur={() => {
            void runCollisionCheck();
          }}
        />
      </Form.FormItem>

      <Form.FormItem label="行业" name="industry">
        <Select placeholder="请选择行业" clearable>
          {INDUSTRY_OPTIONS.map((item) => (
            <Option key={item} value={item} label={item}>
              {item}
            </Option>
          ))}
        </Select>
      </Form.FormItem>

      <Form.FormItem label="人员规模" name="staffSize">
        <Select placeholder="请选择人员规模" clearable>
          {STAFF_SIZE_OPTIONS.map((item) => (
            <Option key={item} value={item} label={item}>
              {item}
            </Option>
          ))}
        </Select>
      </Form.FormItem>

      <Form.FormItem label="来源渠道" name="source">
        <Select placeholder="请选择来源渠道" clearable>
          {SOURCE_OPTIONS.map((item) => (
            <Option key={item} value={item} label={item}>
              {item}
            </Option>
          ))}
        </Select>
      </Form.FormItem>

      <Form.FormItem label="联系人" name="contactName">
        <Input placeholder="请输入联系人姓名" />
      </Form.FormItem>

      <Form.FormItem
        label="联系人手机号"
        name="phone"
        rules={[
          {
            validator: (value: unknown) => {
              const text = typeof value === 'string' ? value : '';
              if (text.trim() === '') return true;
              if (!/^1[3-9]\d{9}$/.test(text.trim())) {
                return { result: false, message: '请输入正确的 11 位手机号', type: 'error' as const };
              }
              return true;
            },
          },
        ]}
      >
        <Input
          placeholder="请输入 11 位手机号"
          onBlur={() => {
            void runCollisionCheck();
          }}
        />
      </Form.FormItem>

      <Form.FormItem label="意向空间类型" name="spaceType">
        <Select placeholder="请选择意向空间类型" clearable>
          {SPACE_TYPE_OPTIONS.map((item) => (
            <Option key={item} value={item} label={item}>
              {item}
            </Option>
          ))}
        </Select>
      </Form.FormItem>

      <Form.FormItem label="意向工位数" name="seatCount">
        <InputNumber placeholder="请输入意向工位数" min={1} max={10000} />
      </Form.FormItem>

      <Form.FormItem label="备注" name="remark">
        <Textarea placeholder="请输入备注（可选）" />
      </Form.FormItem>

      {/*
        预检提示常驻占位（visibility 切换，不增减节点）：点提交时焦点离开
        手机号输入框会触发失焦预检，若提示在 mousedown 与 mouseup 之间
        突然出现，页面布局下移，mouseup 就落不到按钮上，整次点击丢了
        （真浏览器实测：Playwright 点提交 3 秒无反应，JS 直接 click 则
        正常）。常驻占位后布局不再抖动，点击不会丢。
      */}
      <p
        data-testid="checking-hint"
        style={{ visibility: checking ? 'visible' : 'hidden', minHeight: '1.5em', margin: 0 }}
      >
        正在预检撞单…
      </p>

      {isStrongOther && collision && collision.level === 'strong' && collision.owner === 'other' && (
        <Alert
          theme="error"
          data-testid="collision-strong-other"
          message={`该企业已由其他顾问于 ${collision.reportedAt} 报备，当前阶段 ${collision.stage}`}
        />
      )}

      {isStrongPool && collision && collision.level === 'strong' && collision.owner === 'pool' && (
        <div data-testid="collision-strong-pool">
          <Alert theme="info" message="该企业在公海中" />
          <Button
            variant="text"
            onClick={handleClaimFromPool}
            data-testid="claim-from-pool-button"
          >
            去公海领取
          </Button>
        </div>
      )}

      {isStrongOther && collision && collision.level === 'strong' && collision.owner === 'other' && (
        <Button
          variant="text"
          onClick={handleAppeal}
          data-testid="appeal-button"
        >
          发起撞单申诉
        </Button>
      )}

      {isWeak && collision && collision.level === 'weak' && (
        <div data-testid="collision-weak">
          <Alert theme="warning" message={`疑似重复：${collision.matchedName}`} />
          <Checkbox
            checked={weakConfirmed}
            onChange={(checked) => setWeakConfirmed(checked)}
          >
            确认不是同一企业
          </Checkbox>
          <Textarea
            placeholder="请填写与疑似线索不同的原因（必填）"
            value={weakReason}
            onChange={(value) => setWeakReason(value)}
          />
        </div>
      )}

      {submitError && (
        <Alert theme="error" data-testid="submit-error" message={submitError} />
      )}

      <Form.FormItem>
        {/*
          提交按钮用原生 button + TDesign 样式类，不用 TDesign Button：
          TDesign Button 在 disabled 时渲染成 div、启用时渲染成 button，
          disabled 翻转会替换 DOM 节点，正在进行的点击可能落到已脱离
          文档的旧节点上。原生 button 的 disabled 属性不换节点，
          样式类与 TDesign 渲染结果一致。另见 submitDisabled 的注释：
          预检进行中（checking）不禁用按钮，否则点击序列未完成按钮就
          变 disabled，点击直接丢了。
        */}
        <button
          type="submit"
          disabled={submitDisabled || submitting}
          aria-disabled={submitDisabled || submitting}
          data-testid="submit-button"
          className={[
            't-button',
            't-button--theme-primary',
            't-button--variant-base',
            submitDisabled || submitting ? 't-is-disabled' : '',
            submitting ? 't-is-loading' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            void submitFlow();
          }}
        >
          <span className="t-button__text">提交线索</span>
        </button>
      </Form.FormItem>
    </Form>
  );
}
