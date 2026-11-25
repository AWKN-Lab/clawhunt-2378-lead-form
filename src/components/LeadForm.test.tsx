import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeadForm from './LeadForm';
import { ApiError, type CollisionResult, type LeadApi } from '../lib/mockApi';
import { buildValidCreditCode } from '../lib/creditCode';

const VALID_CREDIT_CODE = buildValidCreditCode('91330100MA0000000') as string;
const VALID_PHONE = '13800138000';

function submitButton() {
  // TDesign 禁用态按钮渲染为 div（class 含 t-is-disabled），不用 getByRole。
  return screen.getByTestId('submit-button');
}

// 等预检跑完：提交按钮在预检中会被禁用，须等它恢复可用再点提交，
// 否则点击会被禁用态吞掉。只用于预检结果不拦提交的用例。
async function settleCollisionCheck() {
  await waitFor(() => expect(submitButton()).not.toHaveClass('t-is-disabled'), {
    timeout: 2000,
  });
}

// Toast（MessagePlugin）挂在 body 上、用例间不卸载，3 秒后才消失；
// 按文本查会撞上上一个用例残留的同名 Toast，改为在全部 Toast 里找。
function toastHasText(text: string): boolean {
  return Array.from(document.querySelectorAll('.t-message')).some((m) =>
    (m.textContent ?? '').includes(text),
  );
}

async function fillCompany(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByPlaceholderText('请输入企业名称');
  await user.clear(input);
  await user.type(input, name);
  await user.tab();
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>, companyName: string) {
  await fillCompany(user, companyName);
  await user.type(screen.getByPlaceholderText('请输入 11 位手机号'), VALID_PHONE);
  await settleCollisionCheck();
}

async function selectOption(
  user: ReturnType<typeof userEvent.setup>,
  placeholder: string,
  option: string,
) {
  await user.click(screen.getByPlaceholderText(placeholder));
  await user.click(await screen.findByText(option));
}

describe('AC1 strong 归属他人', () => {
  it('AC1 提交按钮禁用且显示对方报备时间', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '强占演示科技有限公司');
    const alert = await screen.findByTestId('collision-strong-other');
    expect(alert).toHaveTextContent('该企业已由其他顾问于 2026-11-20 10:24 报备，当前阶段 跟进中');
    expect(submitButton()).toHaveClass('t-is-disabled');
  });

  it('AC1 提供发起撞单申诉入口并带 matched_lead_id', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '强占演示科技有限公司');
    const appeal = await screen.findByTestId('appeal-button');
    expect(appeal).toHaveTextContent('发起撞单申诉');
    await user.click(appeal);
    expect(
      await screen.findByText(/将跳转申诉页：\/sales\/leads\/appeals\/new\?matched_lead_id=lead-2026-0001/),
    ).toBeInTheDocument();
  });
});

describe('AC2 weak 疑似重复', () => {
  it('AC2 weak 未勾选确认无法提交', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '疑似演示科技有限公司');
    const weak = await screen.findByTestId('collision-weak');
    expect(weak).toHaveTextContent('疑似重复：疑似演示科技有限公司');
    expect(submitButton()).toHaveClass('t-is-disabled');
  });

  it('AC2 weak 未勾选确认、原因已填仍无法提交', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '疑似演示科技有限公司');
    await screen.findByTestId('collision-weak');
    // 只填原因、不勾选确认：仍须禁用提交（确认与原因两者缺一不可）。
    await user.type(
      screen.getByPlaceholderText('请填写与疑似线索不同的原因（必填）'),
      '注册地址与经营范围均不同',
    );
    expect(submitButton()).toHaveClass('t-is-disabled');
    expect(screen.queryByTestId('lead-detail')).not.toBeInTheDocument();
  });

  it('AC2 weak 已勾选未填原因无法提交，填原因后可提交', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '疑似演示科技有限公司');
    await screen.findByTestId('collision-weak');
    await user.click(screen.getByText('确认不是同一企业'));
    expect(submitButton()).toHaveClass('t-is-disabled');
    await user.type(
      screen.getByPlaceholderText('请填写与疑似线索不同的原因（必填）'),
      '注册地址与经营范围均不同',
    );
    await waitFor(() => expect(submitButton()).not.toHaveClass('t-is-disabled'));
  });
});

describe('AC3 信用代码校验位', () => {
  it('AC3 校验位错误显示字段级错误提示', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '演示科技有限公司');
    const valid = VALID_CREDIT_CODE;
    const wrong = valid.slice(0, 17) + (valid[17] === '0' ? '1' : '0');
    await user.type(screen.getByPlaceholderText('18 位统一社会信用代码（可选）'), wrong);
    await user.click(submitButton());
    expect(
      await screen.findByText('统一社会信用代码校验位错误，请核对后重新输入'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('lead-detail')).not.toBeInTheDocument();
  });

  it('AC3 合法信用代码不报错，可正常提交', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user, '演示科技有限公司');
    await user.type(screen.getByPlaceholderText('18 位统一社会信用代码（可选）'), VALID_CREDIT_CODE);
    await user.click(submitButton());
    expect(await screen.findByTestId('lead-detail')).toBeInTheDocument();
  });
});

describe('AC4 后端错误码中文提示', () => {
  const cases: Array<{ code: string; text: string }> = [
    { code: 'LEAD_COLLISION', text: '提交失败：该线索已被其他顾问报备，请勿重复提交。' },
    { code: 'LEAD_IN_POOL', text: '提交失败：该企业已在公海中，请先去公海领取。' },
    { code: 'LEAD_HOLDING_LIMIT', text: '提交失败：您当前持有线索已达上限，请先处理已有线索再提交。' },
  ];

  for (const { code, text } of cases) {
    it(`AC4 ${code} 显示对应中文提示`, async () => {
      const user = userEvent.setup();
      const api: LeadApi = {
        collisionCheck: async () => ({ level: 'none' }),
        submitLead: async () => {
          throw new ApiError(code);
        },
      };
      render(<LeadForm api={api} />);
      await fillRequired(user, '演示科技有限公司');
      await user.click(submitButton());
      // 同一文案同时出现在表单内 Alert 与 Toast 里，按位置分别断言，避免多匹配。
      const alert = await screen.findByTestId('submit-error');
      expect(alert).toHaveTextContent(text);
      await waitFor(() => expect(toastHasText(text)).toBe(true));
      expect(screen.queryByTestId('lead-detail')).not.toBeInTheDocument();
    });
  }
});

describe('strong 在公海', () => {
  it('显示在公海提示与去公海领取按钮', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '公海演示科技有限公司');
    const pool = await screen.findByTestId('collision-strong-pool');
    expect(pool).toHaveTextContent('该企业在公海中');
    const claim = screen.getByTestId('claim-from-pool-button');
    expect(claim).toHaveTextContent('去公海领取');
    await user.click(claim);
    expect(
      await screen.findByText(/将跳转公海领取：\/sales\/leads\/pool\/claim\?matched_lead_id=lead-2026-0002/),
    ).toBeInTheDocument();
  });
});

describe('提交成功', () => {
  it('提交成功跳转详情页并用 Toast 显示 mock 报备时间（演示数据）', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user, '演示科技有限公司');
    await selectOption(user, '请选择行业', '科技 / 互联网');
    await user.click(submitButton());
    const detail = await screen.findByTestId('lead-detail');
    expect(detail).toHaveTextContent('线索编号：lead-2026-0101');
    expect(detail).toHaveTextContent('报备时间：2026-11-25 20:30');
    // Toast 与详情页含同一文案，按位置分别断言。
    expect(detail).toHaveTextContent('报备成功，报备时间 2026-11-25 20:30');
    await waitFor(() =>
      expect(toastHasText('报备成功，报备时间 2026-11-25 20:30')).toBe(true),
    );
    expect(window.location.pathname).toBe('/sales/leads/lead-2026-0101');
  });
});

describe('字段校验', () => {
  it('企业名称为空提交时提示必填', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.click(submitButton());
    expect(await screen.findByText('请输入企业名称')).toBeInTheDocument();
  });

  it('企业名称 1 个字提示至少 2 个字', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.type(screen.getByPlaceholderText('请输入企业名称'), '企');
    await user.click(submitButton());
    expect(await screen.findByText('企业名称至少 2 个字')).toBeInTheDocument();
  });

  it('企业名称 61 个字提示最多 60 个字', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.type(screen.getByPlaceholderText('请输入企业名称'), '企'.repeat(61));
    await user.click(submitButton());
    expect(await screen.findByText('企业名称最多 60 个字')).toBeInTheDocument();
  });

  it('手机号格式错误提示 11 位手机号', async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillCompany(user, '演示科技有限公司');
    const phone = screen.getByPlaceholderText('请输入 11 位手机号');
    await user.type(phone, '12345');
    fireEvent.blur(phone);
    await settleCollisionCheck();
    await user.click(submitButton());
    expect(await screen.findByText('请输入正确的 11 位手机号')).toBeInTheDocument();
  });
});

describe('异步撞单预检竞态', () => {
  const STRONG_OTHER: CollisionResult = {
    level: 'strong',
    owner: 'other',
    matchedLeadId: 'lead-2026-0001',
    reportedAt: '2026-11-20 10:24',
    stage: '跟进中',
  };

  interface ControllableApi {
    api: LeadApi;
    checkCalls: Array<{ companyName: string; creditCode: string; phone: string }>;
    pending: Array<(result: CollisionResult) => void>;
    submitCalls: number;
  }

  // 可控 api：每次预检都返回挂起的 promise，由测试手动按顺序放行，
  // 以复现“旧请求晚于新请求返回”的乱序场景；提交只记调用次数。
  function controllableApi(): ControllableApi {
    const ctl: ControllableApi = {
      api: {
        collisionCheck: (req) => {
          ctl.checkCalls.push(req);
          return new Promise<CollisionResult>((resolve) => {
            ctl.pending.push(resolve);
          });
        },
        submitLead: async () => {
          ctl.submitCalls += 1;
          return { leadId: 'lead-2026-0101', reportedAt: '2026-11-25 20:30' };
        },
      },
      checkCalls: [],
      pending: [],
      submitCalls: 0,
    };
    return ctl;
  }

  it('旧预检进行中修改企业名称，提交不得采用旧预检结果', async () => {
    const user = userEvent.setup();
    const ctl = controllableApi();
    render(<LeadForm api={ctl.api} />);
    const companyInput = screen.getByPlaceholderText('请输入企业名称');
    const phoneInput = screen.getByPlaceholderText('请输入 11 位手机号');
    await user.type(companyInput, '强占演示科技有限公司');
    await user.type(phoneInput, VALID_PHONE);
    await user.tab();
    // 此时两次失焦各触发一次预检（企业名失焦一次、手机号失焦一次），
    // 两次都挂起；在途任务是旧企业名的那次。
    await waitFor(() => expect(ctl.checkCalls.length).toBe(2));
    await user.click(companyInput);
    await user.clear(companyInput);
    await user.type(companyInput, '演示科技有限公司');
    // 回车提交不经过失焦：提交流程看到的仍是旧预检任务。
    await user.keyboard('{Enter}');
    // 新实现：提交流程比对 key，发现旧任务 key 与当前表单不符，丢弃后
    // 按当前表单重新预检（第 3 次调用），放行它返回无撞单，即可提交。
    ctl.pending[2]?.({ level: 'none' });
    // 旧预检此时才返回 strong-归属他人：提交流程不得拿它拦提交。
    ctl.pending[0](STRONG_OTHER);
    ctl.pending[1](STRONG_OTHER);
    const detail = await screen.findByTestId('lead-detail', {}, { timeout: 3000 });
    expect(detail).toHaveTextContent('线索编号：lead-2026-0101');
    expect(ctl.submitCalls).toBe(1);
  });

  it('旧请求晚于新请求返回，旧响应不得覆盖新状态', async () => {
    const user = userEvent.setup();
    const ctl = controllableApi();
    render(<LeadForm api={ctl.api} />);
    await fillCompany(user, '强占演示科技有限公司');
    // 第一次预检（旧企业名）已开始且挂起。
    await waitFor(() => expect(ctl.checkCalls.length).toBe(1));
    // 改企业名并失焦：触发第二次预检（新 key），立即放行返回无撞单。
    const companyInput = screen.getByPlaceholderText('请输入企业名称');
    await user.click(companyInput);
    await user.clear(companyInput);
    await user.type(companyInput, '演示科技有限公司');
    await user.tab();
    await waitFor(() => expect(ctl.checkCalls.length).toBe(2));
    ctl.pending[1]({ level: 'none' });
    // 旧请求此时才返回 strong-归属他人：不得覆盖新状态。
    ctl.pending[0](STRONG_OTHER);
    // 给旧响应留出落地时间（微任务 + React 渲染 flush），再断言。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(screen.queryByTestId('collision-strong-other')).not.toBeInTheDocument();
    expect(submitButton()).not.toHaveClass('t-is-disabled');
  });
});
