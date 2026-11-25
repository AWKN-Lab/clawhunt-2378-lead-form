// 后端接口桩（mock）。接口未就绪时先行开发，真实接口就绪后按 README「对接点」
// 把本文件的两个函数换成真实 fetch 调用即可，组件不改。
// 全部数据均为虚构，不含任何真实个人信息或企业信息。

export interface CollisionCheckRequest {
  companyName: string;
  creditCode: string;
  phone: string;
}

export type CollisionResult =
  | { level: 'none' }
  | {
      level: 'strong';
      owner: 'other';
      matchedLeadId: string;
      reportedAt: string;
      stage: string;
    }
  | { level: 'strong'; owner: 'pool'; matchedLeadId: string }
  | { level: 'weak'; matchedLeadId: string; matchedName: string };

export interface SubmitLeadRequest extends CollisionCheckRequest {
  industry: string;
  staffSize: string;
  source: string;
  contactName: string;
  spaceType: string;
  seatCount: number | undefined;
  remark: string;
}

export interface SubmitLeadResponse {
  leadId: string;
  reportedAt: string;
}

export class ApiError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** 后端错误码 -> 中文提示（与任务书一致）。 */
export const SUBMIT_ERROR_TEXT: Record<string, string> = {
  LEAD_COLLISION: '提交失败：该线索已被其他顾问报备，请勿重复提交。',
  LEAD_IN_POOL: '提交失败：该企业已在公海中，请先去公海领取。',
  LEAD_HOLDING_LIMIT: '提交失败：您当前持有线索已达上限，请先处理已有线索再提交。',
};

export function submitErrorText(code: string): string {
  return SUBMIT_ERROR_TEXT[code] ?? '提交失败，请稍后重试。';
}

const MOCK_LATENCY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 撞单预检 mock：按企业名称中的演示触发词返回确定性结果。
 * - 含「强占」-> strong 且归属其他顾问
 * - 含「公海」-> strong 且在公海
 * - 含「疑似」-> weak 疑似重复
 * - 其他 -> 无撞单
 * 真实接口：POST /api/sales/leads/collision-check
 */
export async function collisionCheck(req: CollisionCheckRequest): Promise<CollisionResult> {
  await delay(MOCK_LATENCY_MS);
  const name = req.companyName.trim();
  if (name.includes('强占')) {
    return {
      level: 'strong',
      owner: 'other',
      matchedLeadId: 'lead-2026-0001',
      reportedAt: '2026-11-20 10:24',
      stage: '跟进中',
    };
  }
  if (name.includes('公海')) {
    return { level: 'strong', owner: 'pool', matchedLeadId: 'lead-2026-0002' };
  }
  if (name.includes('疑似')) {
    return { level: 'weak', matchedLeadId: 'lead-2026-0003', matchedName: name };
  }
  return { level: 'none' };
}

/**
 * 提交线索 mock：按企业名称中的演示触发词返回确定性后端错误，
 * 其余一律成功并返回服务端报备时间。
 * - 含「撞单」-> LEAD_COLLISION
 * - 含「在池」-> LEAD_IN_POOL
 * - 含「超限」-> LEAD_HOLDING_LIMIT
 * 真实接口：POST /api/sales/leads
 */
export async function submitLead(req: SubmitLeadRequest): Promise<SubmitLeadResponse> {
  await delay(MOCK_LATENCY_MS);
  const name = req.companyName.trim();
  if (name.includes('撞单')) throw new ApiError('LEAD_COLLISION');
  if (name.includes('在池')) throw new ApiError('LEAD_IN_POOL');
  if (name.includes('超限')) throw new ApiError('LEAD_HOLDING_LIMIT');
  return { leadId: 'lead-2026-0101', reportedAt: '2026-11-25 20:30' };
}

export interface LeadApi {
  collisionCheck: (req: CollisionCheckRequest) => Promise<CollisionResult>;
  submitLead: (req: SubmitLeadRequest) => Promise<SubmitLeadResponse>;
}

export const mockApi: LeadApi = { collisionCheck, submitLead };
