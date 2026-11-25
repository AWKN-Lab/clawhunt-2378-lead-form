import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 本仓 vitest 未开 globals，@testing-library/react 的自动 cleanup 不生效，
// 每个用例后手动卸载，避免上一个用例的表单残留在 DOM 里导致多匹配。
afterEach(() => {
  cleanup();
});
