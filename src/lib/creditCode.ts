// 统一社会信用代码（GB 32100-2015）校验。
// 18 位：第 1 位登记管理部门代码，第 2 位机构类别，第 3-8 位登记管理机关行政区划码，
// 第 9-17 位主体标识码，第 18 位校验码。
// 字符集为 0-9 与 A-Z，但不含 I、O、S、V、Z；校验码算法：加权和对 31 取模。

const WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];

// 码值表：字符 -> 码值（跳过 I、O、S、V、Z）
const CODE_VALUES: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, J: 18, K: 19, L: 20,
  M: 21, N: 22, P: 23, Q: 24, R: 25, T: 26, U: 27, W: 28, X: 29, Y: 30,
};

const VALUE_TO_CHAR: Record<number, string> = Object.fromEntries(
  Object.entries(CODE_VALUES).map(([ch, v]) => [v, ch]),
);

export type CreditCodeError = 'length' | 'charset' | 'check-digit';

/** 计算前 17 位对应的第 18 位校验字符；前 17 位非法时返回 null。 */
export function computeCheckChar(first17: string): string | null {
  if (first17.length !== 17) return null;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const v = CODE_VALUES[first17[i]];
    if (v === undefined) return null;
    sum += v * WEIGHTS[i];
  }
  const c = 31 - (sum % 31);
  if (c === 31) return '0';
  return VALUE_TO_CHAR[c] ?? null;
}

/** 校验 18 位统一社会信用代码；合法返回 null，否则返回错误类型。 */
export function validateCreditCode(code: string): CreditCodeError | null {
  const value = code.trim().toUpperCase();
  if (value.length !== 18) return 'length';
  for (const ch of value) {
    if (CODE_VALUES[ch] === undefined) return 'charset';
  }
  const expected = computeCheckChar(value.slice(0, 17));
  if (expected === null || expected !== value[17]) return 'check-digit';
  return null;
}

export const CREDIT_CODE_ERROR_TEXT: Record<CreditCodeError, string> = {
  length: '统一社会信用代码应为 18 位',
  charset: '统一社会信用代码含有非法字符（不含 I、O、S、V、Z）',
  'check-digit': '统一社会信用代码校验位错误，请核对后重新输入',
};

/** 由 17 位前缀生成一条合法的 18 位代码（仅用于测试与演示的虚构数据）。 */
export function buildValidCreditCode(first17: string): string | null {
  const check = computeCheckChar(first17);
  if (check === null) return null;
  return first17 + check;
}
