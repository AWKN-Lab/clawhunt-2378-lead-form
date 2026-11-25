// 浏览器实拍截图：起 vite preview，用缓存的 Chromium 拍 4 张验收图。
// 用法：node scripts/screenshot.mjs（需先 npm run build；Chromium 路径默认取
// ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome，或用 CHROME_PATH 指定）。
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4173;
const BASE = `http://localhost:${PORT}/`;
const EVIDENCE = new URL('../evidence/', import.meta.url).pathname;

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) throw new Error('找不到 Chromium 缓存，请设 CHROME_PATH');
  const dirs = readdirSync(cache)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const d of dirs) {
    const p = join(cache, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('缓存里没有 chrome-linux64/chrome，请设 CHROME_PATH');
}

async function waitServer(url, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // 未起好，继续等
    }
    if (Date.now() - start > timeoutMs) throw new Error(`preview 未在 ${timeoutMs}ms 内就绪`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function shot(page, name, fill) {
  await page.goto(BASE);
  await page.getByPlaceholder('请输入企业名称').fill(fill.company);
  if (fill.phone) await page.getByPlaceholder('请输入 11 位手机号').fill(fill.phone);
  // 点手机号框让企业名失焦，触发撞单预检；成功场景随后点提交。
  await page.getByPlaceholder('请输入 11 位手机号').click();
  if (fill.waitText) {
    await page.getByText(fill.waitText, { exact: false }).first().waitFor({ timeout: 5000 });
  }
  if (fill.submit) {
    await page.getByTestId('submit-button').click();
    await page.getByTestId('lead-detail').waitFor({ timeout: 5000 });
  }
  await page.waitForTimeout(300);
  const path = join(EVIDENCE, name);
  await page.screenshot({ path, fullPage: true });
  const alertText = await page
    .locator('.t-alert__message, .t-message, [data-testid="lead-detail"]')
    .first()
    .innerText()
    .catch(() => '');
  console.log(`${name}: ${path}`);
  console.log(`  关键 DOM 文本：${alertText.replace(/\s+/g, ' ').slice(0, 200)}`);
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
try {
  await waitServer(BASE);
  const browser = await chromium.launch({ executablePath: findChrome() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await shot(page, '01-strong-other.png', {
    company: '强占演示科技有限公司',
    waitText: '该企业已由其他顾问',
  });
  await shot(page, '02-strong-pool.png', {
    company: '公海演示科技有限公司',
    waitText: '该企业在公海中',
  });
  await shot(page, '03-weak.png', {
    company: '疑似演示科技有限公司',
    waitText: '疑似重复：',
  });
  await shot(page, '04-submit-success.png', {
    company: '演示科技有限公司',
    phone: '13800138000',
    submit: true,
  });
  await browser.close();
  console.log('4 张截图全部完成');
} finally {
  server.kill();
}
