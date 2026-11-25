import { describe, expect, it } from 'vitest';
import {
  buildValidCreditCode,
  computeCheckChar,
  validateCreditCode,
} from './creditCode';

// 前 17 位前缀（虚构），由 buildValidCreditCode 补第 18 位校验位。
const PREFIX_17 = '91330100MA0000000';

describe('统一社会信用代码校验', () => {
  it('合法代码通过校验', () => {
    const code = buildValidCreditCode(PREFIX_17);
    expect(code).not.toBeNull();
    expect(code?.length).toBe(18);
    expect(validateCreditCode(code as string)).toBeNull();
  });

  it('AC3 校验位错误返回 check-digit', () => {
    const valid = buildValidCreditCode(PREFIX_17) as string;
    const wrongLast = valid[17] === '0' ? '1' : '0';
    const wrong = valid.slice(0, 17) + wrongLast;
    expect(validateCreditCode(wrong)).toBe('check-digit');
  });

  it('不足 18 位返回 length', () => {
    expect(validateCreditCode('91330100MA00000')).toBe('length');
  });

  it('含 I、O、S、V、Z 返回 charset', () => {
    expect(validateCreditCode('91330100IA0000000X')).toBe('charset');
    expect(validateCreditCode('91330100OA0000000X')).toBe('charset');
    expect(validateCreditCode('91330100SA0000000X')).toBe('charset');
    expect(validateCreditCode('91330100VA0000000X')).toBe('charset');
    expect(validateCreditCode('91330100ZA0000000X')).toBe('charset');
  });

  it('computeCheckChar 对非法前缀返回 null', () => {
    expect(computeCheckChar('91330100IA0000000')).toBeNull();
    expect(computeCheckChar('短')).toBeNull();
  });
});
