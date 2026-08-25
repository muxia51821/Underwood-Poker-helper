import { defineConfig } from '@playwright/test';

// [V7.8.0 修改] check.mjs 传入 E2E_OUT_DIR 时，冒烟打生产构建预览（含 CSP 与内联产物）；
// 未传入时保持 dev server 模式，便于单独跑 npm run test:e2e。
const prodOutDir = process.env.E2E_OUT_DIR;
const baseURL = prodOutDir ? 'http://localhost:4174' : 'http://localhost:5173';

export default defineConfig({
  testDir: './',
  timeout: 30000,
  use: {
    baseURL,
    headless: true,
  },
  webServer: prodOutDir
    ? {
        command:
          'cd .. && npx vite preview --outDir ' +
          JSON.stringify(prodOutDir) +
          ' --port 4174 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 15000,
      }
    : {
        command: 'cd .. && npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 10000,
      },
});
